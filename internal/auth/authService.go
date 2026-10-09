package auth

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/security"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type AuthService struct {
	pool           *pgxpool.Pool
	rdb            *redis.Client
	passwordPolicy PasswordPolicy
	sessions       *SessionManager
	tokens         *TokenGenerator
	auditLogger    *security.AuditLogger

	maxFailedAttemptsAccount int64
	maxFailedAttemptsIP      int64
	lockoutDurationAccount   time.Duration
	lockoutDurationIP        time.Duration
	failureWindow            time.Duration
}

type LoginResult struct {
	UserID        string
	InstitutionID string
	Email         string
	FirstName     string
	LastName      string
	IsSysAdmin    bool
	Roles         []string
	Permissions   []string
	SessionID     string
	AccessToken   string
	RefreshToken  string
}

type MeResult struct {
	UserID        string
	InstitutionID string
	Email         string
	FirstName     string
	LastName      string
	IsSysAdmin    bool
	Roles         []string
	Permissions   []string
}

func NewAuthService(pool *pgxpool.Pool, rdb *redis.Client, sessions *SessionManager, tokens *TokenGenerator, auditLogger *security.AuditLogger) *AuthService {
	return &AuthService{
		pool:           pool,
		rdb:            rdb,
		passwordPolicy: DefaultPasswordPolicy(),
		sessions:       sessions,
		tokens:         tokens,
		auditLogger:    auditLogger,

		maxFailedAttemptsAccount: 5,
		maxFailedAttemptsIP:      10,
		lockoutDurationAccount:   30 * time.Minute,
		lockoutDurationIP:        15 * time.Minute,
		failureWindow:            15 * time.Minute,
	}
}

func (s *AuthService) Login(ctx context.Context, email, password string, ip net.IP, userAgent, correlationID string, accessTTL, refreshTTL time.Duration) (LoginResult, error) {
	if s.pool == nil || s.tokens == nil || s.sessions == nil {
		return LoginResult{}, errors.New("auth service not configured")
	}
	e := strings.ToLower(strings.TrimSpace(email))
	if e == "" || len(e) > 255 {
		return LoginResult{}, errors.New("invalid credentials")
	}
	if strings.TrimSpace(password) == "" {
		return LoginResult{}, errors.New("invalid credentials")
	}

	if s.rdb != nil {
		if ok, err := s.allowAttempt(ctx, e, ip); err != nil {
			return LoginResult{}, err
		} else if !ok {
			return LoginResult{}, errors.New("too many attempts")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return LoginResult{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return LoginResult{}, err
	}

	var userID string
	var institutionID string
	var passwordHash string
	var firstName string
	var lastName string
	var status string
	var isSysAdmin bool
	err = tx.QueryRow(ctx, `
select user_id::text, coalesce(institution_id::text,''), password_hash, coalesce(first_name,''), coalesce(last_name,''), status, is_sys_admin
from users
where lower(email)=lower($1)
limit 1`, e).Scan(&userID, &institutionID, &passwordHash, &firstName, &lastName, &status, &isSysAdmin)
	if err != nil {
		_ = s.recordFailure(ctx, e, ip)
		return LoginResult{}, errors.New("invalid credentials")
	}
	if strings.TrimSpace(institutionID) == "" {
		instID, err := ensureDefaultInstitution(ctx, tx)
		if err != nil {
			return LoginResult{}, err
		}
		if _, err := tx.Exec(ctx, `update users set institution_id = nullif($2,'')::uuid, updated_at=now() where user_id = nullif($1,'')::uuid`, userID, instID); err != nil {
			return LoginResult{}, err
		}
		institutionID = instID
	}
	ok, err := security.VerifyPassword(passwordHash, password)
	if err != nil || !ok {
		_ = s.recordFailure(ctx, e, ip)
		return LoginResult{}, errors.New("invalid credentials")
	}
	st := strings.ToLower(strings.TrimSpace(status))
	if st == "pending" {
		return LoginResult{}, errors.New("account pending approval by administrator")
	}
	if st == "rejected" {
		return LoginResult{}, errors.New("account registration has been rejected")
	}
	if st != "active" {
		_ = s.recordFailure(ctx, e, ip)
		return LoginResult{}, errors.New("account is disabled or locked")
	}

	if _, err := tx.Exec(ctx, `update users set last_login=now(), updated_at=now() where user_id = nullif($1,'')::uuid`, userID); err != nil {
		return LoginResult{}, err
	}

	roles, roleIDs, err := loadUserRoles(ctx, tx, institutionID, userID)
	if err != nil {
		return LoginResult{}, err
	}
	perms, err := loadUserPermissions(ctx, tx, institutionID, roleIDs)
	if err != nil {
		return LoginResult{}, err
	}
	if isSysAdmin {
		perms = append(perms, "SUPER_ADMIN")
	}

	sessionID, err := newUUIDv4()
	if err != nil {
		return LoginResult{}, err
	}
	session := Session{
		SessionID: sessionID,
		UserID:    userID,
		InstitutionID: institutionID,
		IPAddress: ip.String(),
		UserAgent: userAgent,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(refreshTTL),
	}
	if err := s.sessions.Create(ctx, session); err != nil {
		return LoginResult{}, err
	}

	toks, _, refreshClaims, err := s.tokens.IssueUserTokens(ctx, userID, institutionID, sessionID, roles, perms, accessTTL, refreshTTL)
	if err != nil {
		return LoginResult{}, err
	}
	_ = s.sessions.SetTokenID(ctx, institutionID, sessionID, refreshClaims.TokenID)

	if err := tx.Commit(ctx); err != nil {
		return LoginResult{}, err
	}

	if s.rdb != nil {
		_ = s.clearFailures(ctx, e, ip)
		_ = s.setPermissionsCache(ctx, userID, perms, refreshTTL)
	}

	_ = s.auditLogger.Log(ctx, security.AuditEvent{
		UserID:     userID,
		Action:     "LOGIN_SUCCESS",
		Resource:   "user",
		ResourceID: userID,
		IPAddress:  ip.String(),
		CreatedAt:  time.Now().UTC(),
		Metadata: map[string]any{
			"correlationId": correlationID,
		},
	})

	return LoginResult{
		UserID:        userID,
		InstitutionID: institutionID,
		Email:         e,
		FirstName:     firstName,
		LastName:      lastName,
		IsSysAdmin:    isSysAdmin,
		Roles:         roles,
		Permissions:   perms,
		SessionID:     sessionID,
		AccessToken:   toks.AccessToken,
		RefreshToken:  toks.RefreshToken,
	}, nil
}

func (s *AuthService) InvalidatePermissionCache(ctx context.Context, userID string) {
	if s == nil || s.rdb == nil {
		return
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return
	}
	_ = s.rdb.Del(ctx, "permissions:"+uid).Err()
}

func (s *AuthService) setPermissionsCache(ctx context.Context, userID string, perms []string, ttl time.Duration) error {
	if s == nil || s.rdb == nil {
		return nil
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return nil
	}
	if ttl <= 0 {
		ttl = 30 * time.Minute
	}
	b, err := json.Marshal(perms)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, "permissions:"+uid, b, ttl).Err()
}

func (s *AuthService) Logout(ctx context.Context, institutionID, sessionID, tokenID string) error {
	if s.sessions == nil {
		return errors.New("session manager not configured")
	}
	_ = s.sessions.BlacklistTokenID(ctx, tokenID, 30*time.Minute)
	return s.sessions.Revoke(ctx, institutionID, sessionID)
}

func (s *AuthService) Me(ctx context.Context, userID, institutionID string, roles []string, perms []string) (MeResult, error) {
	if s.pool == nil {
		return MeResult{}, errors.New("auth service not configured")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return MeResult{}, errors.New("user required")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return MeResult{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return MeResult{}, err
	}

	var email string
	var first string
	var last string
	var status string
	var isSysAdmin bool
	var inst string
	err = tx.QueryRow(ctx, `
select user_id::text, coalesce(institution_id::text,''), email, coalesce(first_name,''), coalesce(last_name,''), status, is_sys_admin
from users
where user_id = nullif($1,'')::uuid
limit 1`, uid).Scan(&uid, &inst, &email, &first, &last, &status, &isSysAdmin)
	if err != nil {
		return MeResult{}, errors.New("not found")
	}
	if strings.ToLower(strings.TrimSpace(status)) != "active" {
		return MeResult{}, errors.New("inactive")
	}

	if err := tx.Commit(ctx); err != nil {
		return MeResult{}, err
	}

	outPerms := perms
	if isSysAdmin {
		has := false
		for _, p := range perms {
			if strings.EqualFold(strings.TrimSpace(p), "SUPER_ADMIN") {
				has = true
				break
			}
		}
		if !has {
			outPerms = append(outPerms, "SUPER_ADMIN")
		}
	}

	return MeResult{
		UserID:        uid,
		InstitutionID: strings.TrimSpace(inst),
		Email:         strings.ToLower(strings.TrimSpace(email)),
		FirstName:     strings.TrimSpace(first),
		LastName:      strings.TrimSpace(last),
		IsSysAdmin:    isSysAdmin,
		Roles:         roles,
		Permissions:   outPerms,
	}, nil
}

func loadUserRoles(ctx context.Context, tx pgx.Tx, institutionID, userID string) ([]string, []string, error) {
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return nil, nil, err
	}
	rows, err := tx.Query(ctx, `
select r.role_id::text, r.name
from user_roles ur
join roles r on r.role_id = ur.role_id
where ur.user_id = nullif($1,'')::uuid`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var names []string
	var ids []string
	for rows.Next() {
		var id string
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, nil, err
		}
		id = strings.TrimSpace(id)
		if id != "" {
			ids = append(ids, id)
		}
		name = strings.ToLower(strings.TrimSpace(name))
		if name != "" {
			names = append(names, name)
		}
	}
	return names, ids, rows.Err()
}

func loadUserPermissions(ctx context.Context, tx pgx.Tx, institutionID string, roleIDs []string) ([]string, error) {
	if len(roleIDs) == 0 {
		return []string{}, nil
	}
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `
	select distinct p.name
from role_permissions rp
join permissions p on p.permission_id = rp.permission_id
where rp.role_id = any($1::uuid[])`, roleIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var perms []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		name = strings.ToUpper(strings.TrimSpace(name))
		if name != "" {
			perms = append(perms, name)
		}
	}
	return perms, rows.Err()
}

func (s *AuthService) allowAttempt(ctx context.Context, email string, ip net.IP) (bool, error) {
	if s.rdb == nil {
		return true, nil
	}
	if email != "" {
		locked, err := s.rdb.Exists(ctx, lockoutKeyAccount(email)).Result()
		if err != nil {
			return false, err
		}
		if locked == 1 {
			return false, nil
		}
	}
	if ip != nil {
		locked, err := s.rdb.Exists(ctx, lockoutKeyIP(ip)).Result()
		if err != nil {
			return false, err
		}
		if locked == 1 {
			return false, nil
		}
	}
	return true, nil
}

func (s *AuthService) recordFailure(ctx context.Context, email string, ip net.IP) error {
	if s.rdb == nil {
		return nil
	}
	window := s.failureWindow
	if window <= 0 {
		window = 15 * time.Minute
	}

	if email != "" {
		n, err := s.rdb.Incr(ctx, failureKeyAccount(email)).Result()
		if err != nil {
			return err
		}
		if n == 1 {
			_ = s.rdb.Expire(ctx, failureKeyAccount(email), window).Err()
		}
		if s.maxFailedAttemptsAccount > 0 && n >= s.maxFailedAttemptsAccount {
			_ = s.rdb.Set(ctx, lockoutKeyAccount(email), "1", s.lockoutDurationAccount).Err()
			_ = s.rdb.Del(ctx, failureKeyAccount(email)).Err()
		}
	}

	if ip != nil {
		n, err := s.rdb.Incr(ctx, failureKeyIP(ip)).Result()
		if err != nil {
			return err
		}
		if n == 1 {
			_ = s.rdb.Expire(ctx, failureKeyIP(ip), window).Err()
		}
		if s.maxFailedAttemptsIP > 0 && n >= s.maxFailedAttemptsIP {
			_ = s.rdb.Set(ctx, lockoutKeyIP(ip), "1", s.lockoutDurationIP).Err()
			_ = s.rdb.Del(ctx, failureKeyIP(ip)).Err()
		}
	}

	return nil
}

func (s *AuthService) clearFailures(ctx context.Context, email string, ip net.IP) error {
	if s.rdb == nil {
		return nil
	}
	keys := []string{}
	if email != "" {
		keys = append(keys, failureKeyAccount(email), lockoutKeyAccount(email))
	}
	if ip != nil {
		keys = append(keys, failureKeyIP(ip), lockoutKeyIP(ip))
	}
	if len(keys) == 0 {
		return nil
	}
	return s.rdb.Del(ctx, keys...).Err()
}

func failureKeyAccount(email string) string {
	return "auth:fail:acct:" + strings.ToLower(strings.TrimSpace(email))
}

func failureKeyIP(ip net.IP) string {
	if ip == nil {
		return "auth:fail:ip:unknown"
	}
	return "auth:fail:ip:" + ip.String()
}

func lockoutKeyAccount(email string) string {
	return "auth:lock:acct:" + strings.ToLower(strings.TrimSpace(email))
}

func lockoutKeyIP(ip net.IP) string {
	if ip == nil {
		return "auth:lock:ip:unknown"
	}
	return "auth:lock:ip:" + ip.String()
}

func newUUIDv4() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	p1 := binary.BigEndian.Uint32(b[0:4])
	p2 := binary.BigEndian.Uint16(b[4:6])
	p3 := binary.BigEndian.Uint16(b[6:8])
	p4 := binary.BigEndian.Uint16(b[8:10])
	p5 := uint64(0)
	for i := 10; i < 16; i++ {
		p5 = (p5 << 8) | uint64(b[i])
	}
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", p1, p2, p3, p4, p5), nil
}

func ensureDefaultInstitution(ctx context.Context, tx pgx.Tx) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `select institution_id::text from institutions order by created_at asc limit 1`).Scan(&id)
	if err == nil && strings.TrimSpace(id) != "" {
		return id, nil
	}
	err = tx.QueryRow(ctx, `insert into institutions(name, status, created_at) values ('Default', 'active', now()) returning institution_id::text`).Scan(&id)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(id), nil
}

type UserSummary struct {
	UserID        string   `json:"userId"`
	InstitutionID string   `json:"institutionId"`
	Email         string   `json:"email"`
	FirstName     string   `json:"firstName"`
	LastName      string   `json:"lastName"`
	Status        string   `json:"status"`
	IsSysAdmin    bool     `json:"isSysAdmin"`
	Roles         []string `json:"roles"`
}

type ApprovalRequestSummary struct {
	RequestID       string         `json:"requestId"`
	InstitutionID   string         `json:"institutionId"`
	InstitutionName string         `json:"institutionName,omitempty"`
	UserID          string         `json:"userId"`
	Email           string         `json:"email"`
	FirstName       string         `json:"firstName"`
	LastName        string         `json:"lastName"`
	RequestedRole   string         `json:"requestedRole"`
	RequestType     string         `json:"requestType"`
	Status          string         `json:"status"`
	Metadata        map[string]any `json:"metadata"`
	RejectionReason string         `json:"rejectionReason,omitempty"`
	CreatedAt       string         `json:"createdAt"`
	ReviewedAt      string         `json:"reviewedAt,omitempty"`
}

type RegisterRequest struct {
	Role             string `json:"role"` // "student", "teacher", "institute_management"
	Email            string `json:"email"`
	Password         string `json:"password"`
	FirstName        string `json:"firstName"`
	LastName         string `json:"lastName"`
	InstitutionID    string `json:"institutionId,omitempty"`
	AcademicYear     string `json:"academicYear,omitempty"`
	StudentIDNumber  string `json:"studentIdNumber,omitempty"`
	Department       string `json:"department,omitempty"`
	EmployeeID       string `json:"employeeId,omitempty"`
	Designation      string `json:"designation,omitempty"`
	InstituteName    string `json:"instituteName,omitempty"`
	Domain           string `json:"domain,omitempty"`
	InstituteType    string `json:"instituteType,omitempty"`
	RegistrationCode string `json:"registrationCode,omitempty"`
	Phone            string `json:"phone,omitempty"`
	Address          string `json:"address,omitempty"`
}

type PublicInstitution struct {
	InstitutionID string `json:"institutionId"`
	Name          string `json:"name"`
	Domain        string `json:"domain,omitempty"`
	InstituteType string `json:"instituteType,omitempty"`
}

func (s *AuthService) ListPublicInstitutions(ctx context.Context) ([]PublicInstitution, error) {
	if s.pool == nil {
		return nil, errors.New("database pool unavailable")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select institution_id::text, name, coalesce(domain, ''), coalesce(institute_type, '')
		from institutions
		where status = 'active'
		order by name asc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []PublicInstitution
	for rows.Next() {
		var pi PublicInstitution
		if err := rows.Scan(&pi.InstitutionID, &pi.Name, &pi.Domain, &pi.InstituteType); err != nil {
			return nil, err
		}
		list = append(list, pi)
	}
	return list, tx.Commit(ctx)
}

func (s *AuthService) Register(ctx context.Context, req RegisterRequest, ip net.IP, userAgent, correlationID string) error {
	if s.pool == nil {
		return errors.New("auth service pool not configured")
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role == "" {
		return errors.New("role is required")
	}
	if role == "institution_admin" || role == "institution" || role == "institute" {
		role = "institute_management"
	}
	if role != "student" && role != "teacher" && role != "institute_management" {
		return errors.New("invalid role selected; must be student, teacher, or institute_management")
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		return errors.New("email is required")
	}
	if len(email) > 255 || !strings.Contains(email, "@") {
		return errors.New("invalid email address")
	}

	password := req.Password
	if strings.TrimSpace(password) == "" {
		return errors.New("password is required")
	}
	if err := s.passwordPolicy.Validate(password); err != nil {
		return err
	}
	hash, err := security.HashPassword(password, security.DefaultArgon2idParams)
	if err != nil {
		return err
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	var exists bool
	err = tx.QueryRow(ctx, `select exists(select 1 from users where lower(email)=lower($1))`, email).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("user already exists")
	}

	fn := strings.TrimSpace(req.FirstName)
	ln := strings.TrimSpace(req.LastName)

	if role == "institute_management" {
		instName := strings.TrimSpace(req.InstituteName)
		if instName == "" {
			return errors.New("institute name is required")
		}
		if fn == "" || ln == "" {
			return errors.New("first name and last name of the institute administrator are required")
		}

		domain := strings.ToLower(strings.TrimSpace(req.Domain))
		if domain == "" {
			slug := strings.ToLower(strings.ReplaceAll(instName, " ", "-"))
			domain = slug + ".safescholar.net"
		}

		instType := strings.TrimSpace(req.InstituteType)
		if instType == "" {
			instType = "School / College"
		}

		var instID string
		err = tx.QueryRow(ctx, `
			insert into institutions(name, domain, status, is_trial, trial_status, max_teachers, max_students, institute_type, registration_code, contact_phone, address, created_at, updated_at)
			values ($1, $2, 'pending', true, 'pending', 15, 200, nullif($3,''), nullif($4,''), nullif($5,''), nullif($6,''), now(), now())
			returning institution_id::text
		`, instName, domain, instType, strings.TrimSpace(req.RegistrationCode), strings.TrimSpace(req.Phone), strings.TrimSpace(req.Address)).Scan(&instID)
		if err != nil {
			return fmt.Errorf("failed to register institution: %w", err)
		}

		var newUserID string
		err = tx.QueryRow(ctx, `
			insert into users(institution_id, email, password_hash, first_name, last_name, status, is_sys_admin, created_at)
			values ($1::uuid, $2, $3, nullif($4,''), nullif($5,''), 'pending', false, now())
			returning user_id::text
		`, instID, email, hash, fn, ln).Scan(&newUserID)
		if err != nil {
			return fmt.Errorf("failed to register admin user: %w", err)
		}

		metaJSON, _ := json.Marshal(map[string]any{
			"institute_name":    instName,
			"domain":            domain,
			"institute_type":    instType,
			"registration_code": strings.TrimSpace(req.RegistrationCode),
			"contact_phone":     strings.TrimSpace(req.Phone),
			"address":           strings.TrimSpace(req.Address),
			"admin_name":        fn + " " + ln,
			"admin_email":       email,
		})

		_, err = tx.Exec(ctx, `
			insert into institution_approval_requests(institution_id, user_id, requested_role, request_type, status, metadata, created_at)
			values ($1::uuid, $2::uuid, 'institution_admin', 'INSTITUTION', 'PENDING', $3::jsonb, now())
		`, instID, newUserID, metaJSON)
		if err != nil {
			return err
		}

		if err := tx.Commit(ctx); err != nil {
			return err
		}

		if s.auditLogger != nil {
			ipStr := ""
			if ip != nil {
				ipStr = ip.String()
			}
			_ = s.auditLogger.Log(ctx, security.AuditEvent{
				UserID:     newUserID,
				Action:     "SIGNUP_INSTITUTE_REQUEST",
				Resource:   "institution",
				ResourceID: instID,
				IPAddress:  ipStr,
				CreatedAt:  time.Now().UTC(),
				Metadata: map[string]any{
					"institute_name": instName,
					"correlationId":  correlationID,
					"email":          email,
				},
			})
		}
		return nil
	}

	// Student or Teacher registration flow
	if fn == "" || ln == "" {
		return errors.New("first name and last name are required")
	}
	instID := strings.TrimSpace(req.InstitutionID)
	if instID == "" {
		return errors.New("institution selection is required")
	}

	var instExists bool
	var instName string
	err = tx.QueryRow(ctx, `select exists(select 1 from institutions where institution_id=nullif($1,'')::uuid and status='active'), coalesce(name,'') from institutions where institution_id=nullif($1,'')::uuid group by name`, instID).Scan(&instExists, &instName)
	if err != nil || !instExists {
		return errors.New("invalid or inactive institution selected")
	}

	meta := map[string]any{
		"institution_name": instName,
	}

	if role == "student" {
		ay := strings.TrimSpace(req.AcademicYear)
		if ay == "" {
			return errors.New("academic year / grade is required for student registration")
		}
		meta["academic_year"] = ay
		if strings.TrimSpace(req.StudentIDNumber) != "" {
			meta["student_id_number"] = strings.TrimSpace(req.StudentIDNumber)
		}
		if strings.TrimSpace(req.Department) != "" {
			meta["department"] = strings.TrimSpace(req.Department)
		}
	} else if role == "teacher" {
		dept := strings.TrimSpace(req.Department)
		if dept == "" {
			return errors.New("department or subject is required for teacher registration")
		}
		meta["department"] = dept
		if strings.TrimSpace(req.EmployeeID) != "" {
			meta["employee_id"] = strings.TrimSpace(req.EmployeeID)
		}
		if strings.TrimSpace(req.Designation) != "" {
			meta["designation"] = strings.TrimSpace(req.Designation)
		}
	}

	metaJSON, _ := json.Marshal(meta)

	var newUserID string
	err = tx.QueryRow(ctx, `
		insert into users(institution_id, email, password_hash, first_name, last_name, status, is_sys_admin, metadata, created_at)
		values ($1::uuid, $2, $3, nullif($4,''), nullif($5,''), 'pending', false, $6::jsonb, now())
		returning user_id::text
	`, instID, email, hash, fn, ln, metaJSON).Scan(&newUserID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		insert into institution_approval_requests(institution_id, user_id, requested_role, request_type, status, metadata, created_at)
		values ($1::uuid, $2::uuid, $3, $3, 'PENDING', $4::jsonb, now())
	`, instID, newUserID, role, metaJSON)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		ipStr := ""
		if ip != nil {
			ipStr = ip.String()
		}
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     newUserID,
			Action:     "SIGNUP_USER_REQUEST",
			Resource:   "user",
			ResourceID: newUserID,
			IPAddress:  ipStr,
			CreatedAt:  time.Now().UTC(),
			Metadata: map[string]any{
				"requestedRole": role,
				"institutionId": instID,
				"correlationId": correlationID,
			},
		})
	}
	return nil
}

func (s *AuthService) RegisterUser(ctx context.Context, email, password, firstName, lastName, requestedRole string) error {
	return s.Register(ctx, RegisterRequest{
		Role:      requestedRole,
		Email:     email,
		Password:  password,
		FirstName: firstName,
		LastName:  lastName,
	}, nil, "", "")
}

func (s *AuthService) ListUsers(ctx context.Context) ([]UserSummary, error) {
	if s.pool == nil {
		return nil, errors.New("auth service pool not configured")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select user_id::text, coalesce(institution_id::text,''), email, coalesce(first_name,''), coalesce(last_name,''), status, is_sys_admin
		from users
		order by created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []UserSummary
	for rows.Next() {
		var u UserSummary
		if err := rows.Scan(&u.UserID, &u.InstitutionID, &u.Email, &u.FirstName, &u.LastName, &u.Status, &u.IsSysAdmin); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	// For each user, load their role names
	for i, u := range users {
		roles, _, err := loadUserRoles(ctx, tx, u.InstitutionID, u.UserID)
		if err == nil {
			users[i].Roles = roles
		}
	}

	return users, tx.Commit(ctx)
}

func (s *AuthService) ApproveUser(ctx context.Context, reviewerUserID, reviewerInstitutionID string, isSysAdmin bool, targetUserID, status, roleID, rejectionReason string) error {
	if s.pool == nil {
		return errors.New("auth service pool not configured")
	}
	uid := strings.TrimSpace(targetUserID)
	st := strings.ToLower(strings.TrimSpace(status))
	rid := strings.TrimSpace(roleID)
	if uid == "" || st == "" {
		return errors.New("userId and status required")
	}
	if st != "active" && st != "rejected" && st != "isolated" {
		return errors.New("invalid status value: must be active, rejected, or isolated")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	var currentStatus string
	var userInst string
	err = tx.QueryRow(ctx, `select status, coalesce(institution_id::text,'') from users where user_id=nullif($1,'')::uuid`, uid).Scan(&currentStatus, &userInst)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Multi-tenant isolation enforcement: non-superadmins can ONLY authorize users within their own institution
	if !isSysAdmin {
		if strings.TrimSpace(reviewerInstitutionID) == "" || strings.TrimSpace(userInst) != strings.TrimSpace(reviewerInstitutionID) {
			return errors.New("forbidden: cannot authorize or reject users outside your institution")
		}
	}

	// Check if this pending request is a profile edit request
	var reqType string
	var reqMetaBytes []byte
	_ = tx.QueryRow(ctx, `
		select coalesce(request_type, ''), coalesce(metadata, '{}'::jsonb)::text
		from institution_approval_requests 
		where user_id=nullif($1,'')::uuid and status='PENDING' 
		order by created_at desc limit 1
	`, uid).Scan(&reqType, &reqMetaBytes)

	if reqType == "profile_edit" {
		if st == "active" {
			var metaMap map[string]any
			if len(reqMetaBytes) > 0 {
				_ = json.Unmarshal(reqMetaBytes, &metaMap)
			}
			if reqChanges, ok := metaMap["requested_changes"].(map[string]any); ok {
				var currentMetaBytes []byte
				var currFirstName, currLastName string
				_ = tx.QueryRow(ctx, `select coalesce(first_name,''), coalesce(last_name,''), coalesce(metadata, '{}'::jsonb)::text from users where user_id=nullif($1,'')::uuid`, uid).Scan(&currFirstName, &currLastName, &currentMetaBytes)
				userMeta := make(map[string]any)
				if len(currentMetaBytes) > 0 {
					_ = json.Unmarshal(currentMetaBytes, &userMeta)
				}
				for k, v := range reqChanges {
					if k == "firstName" {
						if s, ok := v.(string); ok && s != "" {
							currFirstName = s
						}
					} else if k == "lastName" {
						if s, ok := v.(string); ok && s != "" {
							currLastName = s
						}
					} else {
						userMeta[k] = v
					}
				}
				updatedMetaJSON, _ := json.Marshal(userMeta)
				_, _ = tx.Exec(ctx, `update users set first_name=$1, last_name=$2, metadata=$3::jsonb, updated_at=now() where user_id=nullif($4,'')::uuid`, currFirstName, currLastName, string(updatedMetaJSON), uid)
			}
		}
	} else {
		_, err = tx.Exec(ctx, `update users set status=$1, updated_at=now() where user_id=nullif($2,'')::uuid`, st, uid)
		if err != nil {
			return err
		}

		// Fetch requested role from pending request if roleID is not explicitly provided
		var requestedRole string
		_ = tx.QueryRow(ctx, `
			select requested_role from institution_approval_requests 
			where user_id=nullif($1,'')::uuid and status='PENDING' 
			order by created_at desc limit 1
		`, uid).Scan(&requestedRole)

		// If status is approved ('active'), assign appropriate role
		if st == "active" {
			targetRoleID := rid
			if targetRoleID == "" && requestedRole != "" {
				// Find existing role matching requested_role
				_ = tx.QueryRow(ctx, `
					select role_id::text from roles 
					where (institution_id = nullif($1,'')::uuid or institution_id is null) 
					  and lower(name) = lower($2)
					order by (institution_id is not null) desc
					limit 1
				`, userInst, requestedRole).Scan(&targetRoleID)

				// If still empty, create it
				if targetRoleID == "" {
					_ = tx.QueryRow(ctx, `
						insert into roles(institution_id, name, description, is_system_role, created_at)
						values (nullif($1,'')::uuid, lower($2), initcap($2) || ' Role', false, now())
						returning role_id::text
					`, userInst, requestedRole).Scan(&targetRoleID)
				}
			}

			if targetRoleID != "" {
				_, err = tx.Exec(ctx, `
					insert into user_roles(user_id, role_id)
					values (nullif($1,'')::uuid, nullif($2,'')::uuid)
					on conflict (user_id, role_id) do nothing`,
					uid, targetRoleID,
				)
				if err != nil {
					return err
				}
			}
		}
	}

	// Also update approval requests table
	reqStatus := "APPROVED"
	switch st {
	case "rejected":
		reqStatus = "REJECTED"
	case "isolated":
		reqStatus = "ISOLATED"
	}
	_, _ = tx.Exec(ctx, `
		update institution_approval_requests
		set status=$1, rejection_reason=nullif($2,''), reviewed_by=nullif($3,'')::uuid, reviewed_at=now(), updated_at=now()
		where user_id=nullif($4,'')::uuid and status='PENDING'
	`, reqStatus, strings.TrimSpace(rejectionReason), nullIfEmpty(reviewerUserID), uid)

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     reviewerUserID,
			Action:     "USER_APPROVAL_DECISION",
			Resource:   "user",
			ResourceID: uid,
			CreatedAt:  time.Now().UTC(),
			Metadata: map[string]any{
				"decision":      st,
				"reason":        rejectionReason,
				"institutionId": userInst,
			},
		})
	}
	return nil
}

func nullIfEmpty(s string) any {
	t := strings.TrimSpace(s)
	if t == "" {
		return nil
	}
	return t
}

func (s *AuthService) GetApprovalRequests(ctx context.Context, institutionID string) ([]ApprovalRequestSummary, error) {
	if s.pool == nil {
		return nil, errors.New("auth pool not configured")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID, AllowLogin: true}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select 
			r.request_id::text, 
			coalesce(r.institution_id::text, ''), 
			coalesce(i.name, ''),
			r.user_id::text, 
			u.email, 
			coalesce(u.first_name,''), 
			coalesce(u.last_name,''), 
			r.requested_role, 
			coalesce(r.request_type, 'USER'),
			r.status, 
			coalesce(r.metadata, '{}'::jsonb),
			coalesce(r.rejection_reason, ''),
			r.created_at,
			r.reviewed_at
		from institution_approval_requests r
		join users u on r.user_id = u.user_id
		left join institutions i on r.institution_id = i.institution_id
		where r.institution_id = nullif($1,'')::uuid
		  and coalesce(r.request_type, 'USER') != 'INSTITUTION'
		order by r.created_at desc
	`, institutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reqs []ApprovalRequestSummary
	for rows.Next() {
		var r ApprovalRequestSummary
		var createdAt time.Time
		var reviewedAt *time.Time
		var rawMeta []byte
		if err := rows.Scan(&r.RequestID, &r.InstitutionID, &r.InstitutionName, &r.UserID, &r.Email, &r.FirstName, &r.LastName, &r.RequestedRole, &r.RequestType, &r.Status, &rawMeta, &r.RejectionReason, &createdAt, &reviewedAt); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.Format(time.RFC3339)
		if reviewedAt != nil {
			r.ReviewedAt = reviewedAt.Format(time.RFC3339)
		}
		if len(rawMeta) > 0 {
			_ = json.Unmarshal(rawMeta, &r.Metadata)
		}
		if r.Metadata == nil {
			r.Metadata = make(map[string]any)
		}
		reqs = append(reqs, r)
	}
	return reqs, tx.Commit(ctx)
}

func (s *AuthService) ListInstitutionRequests(ctx context.Context, isSysAdmin bool) ([]ApprovalRequestSummary, error) {
	if !isSysAdmin {
		return nil, errors.New("forbidden: super admin access required")
	}
	if s.pool == nil {
		return nil, errors.New("auth pool not configured")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select 
			r.request_id::text, 
			coalesce(r.institution_id::text, ''), 
			coalesce(i.name, ''),
			r.user_id::text, 
			u.email, 
			coalesce(u.first_name,''), 
			coalesce(u.last_name,''), 
			r.requested_role, 
			coalesce(r.request_type, 'INSTITUTION'),
			r.status, 
			coalesce(r.metadata, '{}'::jsonb),
			coalesce(r.rejection_reason, ''),
			r.created_at,
			r.reviewed_at
		from institution_approval_requests r
		join users u on r.user_id = u.user_id
		left join institutions i on r.institution_id = i.institution_id
		where coalesce(r.request_type, 'USER') = 'INSTITUTION'
		order by r.created_at desc
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reqs []ApprovalRequestSummary
	for rows.Next() {
		var r ApprovalRequestSummary
		var createdAt time.Time
		var reviewedAt *time.Time
		var rawMeta []byte
		if err := rows.Scan(&r.RequestID, &r.InstitutionID, &r.InstitutionName, &r.UserID, &r.Email, &r.FirstName, &r.LastName, &r.RequestedRole, &r.RequestType, &r.Status, &rawMeta, &r.RejectionReason, &createdAt, &reviewedAt); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.Format(time.RFC3339)
		if reviewedAt != nil {
			r.ReviewedAt = reviewedAt.Format(time.RFC3339)
		}
		if len(rawMeta) > 0 {
			_ = json.Unmarshal(rawMeta, &r.Metadata)
		}
		if r.Metadata == nil {
			r.Metadata = make(map[string]any)
		}
		reqs = append(reqs, r)
	}
	return reqs, tx.Commit(ctx)
}

func (s *AuthService) ReviewInstitutionRequest(ctx context.Context, isSysAdmin bool, reviewerUserID, requestID, decision, rejectionReason string) error {
	if !isSysAdmin {
		return errors.New("forbidden: super admin access required")
	}
	if s.pool == nil {
		return errors.New("database pool unavailable")
	}

	rid := strings.TrimSpace(requestID)
	dec := strings.ToLower(strings.TrimSpace(decision))
	if rid == "" || (dec != "approve" && dec != "reject") {
		return errors.New("valid requestId and decision ('approve' or 'reject') required")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	var instID string
	var userID string
	var currentStatus string
	err = tx.QueryRow(ctx, `
		select institution_id::text, user_id::text, status
		from institution_approval_requests
		where request_id = nullif($1,'')::uuid
	`, rid).Scan(&instID, &userID, &currentStatus)
	if err != nil {
		return fmt.Errorf("institution request not found: %w", err)
	}
	if currentStatus != "PENDING" {
		return fmt.Errorf("request has already been %s", currentStatus)
	}

	now := time.Now().UTC()
	trialEnds := now.AddDate(0, 0, 30)

	if dec == "approve" {
		_, err = tx.Exec(ctx, `
			update institutions
			set status='active', trial_status='active', trial_starts_at=$1, trial_ends_at=$2, updated_at=now()
			where institution_id = nullif($3,'')::uuid
		`, now, trialEnds, instID)
		if err != nil {
			return fmt.Errorf("failed to activate institution: %w", err)
		}

		_, err = tx.Exec(ctx, `
			update users
			set status='active', updated_at=now()
			where user_id = nullif($1,'')::uuid
		`, userID)
		if err != nil {
			return fmt.Errorf("failed to activate admin user: %w", err)
		}

		// Ensure default admin role for this institution
		var roleID string
		err = tx.QueryRow(ctx, `
			select role_id::text from roles 
			where institution_id = nullif($1,'')::uuid and lower(name) in ('admin', 'institution_admin')
			limit 1
		`, instID).Scan(&roleID)
		if err != nil {
			// Create institution admin role
			err = tx.QueryRow(ctx, `
				insert into roles(institution_id, name, description, is_system_role, created_at)
				values (nullif($1,'')::uuid, 'admin', 'Institution Administrator', false, now())
				returning role_id::text
			`, instID).Scan(&roleID)
			if err != nil {
				return fmt.Errorf("failed to create admin role: %w", err)
			}
		}

		// Assign admin role to user
		_, err = tx.Exec(ctx, `
			insert into user_roles(user_id, role_id)
			values (nullif($1,'')::uuid, nullif($2,'')::uuid)
			on conflict (user_id, role_id) do nothing
		`, userID, roleID)
		if err != nil {
			return fmt.Errorf("failed to assign admin role: %w", err)
		}

		// Seed core administrative permissions to this role
		_, _ = tx.Exec(ctx, `
			insert into role_permissions(role_id, permission_id)
			select nullif($1,'')::uuid, permission_id 
			from permissions 
			where name in ('MANAGE_USERS', 'MANAGE_LOCAL_ROLES', 'EXECUTE_AI_TUTOR', 'GENERATE_LESSON_PLAN', 'USE_TEXT_LEVELER', 'USE_VIDEO_ASSESSOR', 'GENERATE_IEP_RUBRIC', 'MANAGE_DISTRICT_AI_KNOWLEDGE')
			on conflict do nothing
		`, roleID)

		// Update request
		_, err = tx.Exec(ctx, `
			update institution_approval_requests
			set status='APPROVED', reviewed_by=nullif($1,'')::uuid, reviewed_at=now(), updated_at=now()
			where request_id = nullif($2,'')::uuid
		`, nullIfEmpty(reviewerUserID), rid)
		if err != nil {
			return err
		}

		if err := tx.Commit(ctx); err != nil {
			return err
		}

		if s.auditLogger != nil {
			_ = s.auditLogger.Log(ctx, security.AuditEvent{
				UserID:     reviewerUserID,
				Action:     "APPROVE_INSTITUTION",
				Resource:   "institution",
				ResourceID: instID,
				CreatedAt:  time.Now().UTC(),
				Metadata: map[string]any{
					"requestId": rid,
					"userId":    userID,
				},
			})
		}
		return nil
	}

	// Reject decision
	_, err = tx.Exec(ctx, `
		update institutions
		set status='rejected', trial_status='rejected', updated_at=now()
		where institution_id = nullif($1,'')::uuid
	`, instID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		update users
		set status='rejected', updated_at=now()
		where user_id = nullif($1,'')::uuid
	`, userID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		update institution_approval_requests
		set status='REJECTED', rejection_reason=nullif($1,''), reviewed_by=nullif($2,'')::uuid, reviewed_at=now(), updated_at=now()
		where request_id = nullif($3,'')::uuid
	`, strings.TrimSpace(rejectionReason), nullIfEmpty(reviewerUserID), rid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     reviewerUserID,
			Action:     "REJECT_INSTITUTION",
			Resource:   "institution",
			ResourceID: instID,
			CreatedAt:  time.Now().UTC(),
			Metadata: map[string]any{
				"requestId": rid,
				"reason":    rejectionReason,
			},
		})
	}
	return nil
}

func (s *AuthService) GetDashboardMetrics(ctx context.Context, userID, institutionID string, roles []string, isSysAdmin bool) (map[string]any, error) {
	if s.pool == nil {
		return nil, errors.New("auth pool not configured")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return nil, err
	}

	res := make(map[string]any)

	if isSysAdmin {
		var activeUsers int64
		var totalInstitutions int64
		var totalTeachers int64
		var totalStudents int64

		// Active Users
		_ = tx.QueryRow(ctx, `select count(*) from users where status='active'`).Scan(&activeUsers)

		// Institutions
		_ = tx.QueryRow(ctx, `select count(*) from institutions`).Scan(&totalInstitutions)

		// Teachers
		_ = tx.QueryRow(ctx, `
			select count(distinct ur.user_id) 
			from user_roles ur 
			join roles r on ur.role_id = r.role_id 
			where lower(r.name) = 'teacher'
		`).Scan(&totalTeachers)

		// Students
		_ = tx.QueryRow(ctx, `
			select count(distinct ur.user_id) 
			from user_roles ur 
			join roles r on ur.role_id = r.role_id 
			where lower(r.name) = 'student'
		`).Scan(&totalStudents)

		res["role"] = "sysadmin"
		res["activeUsers"] = activeUsers
		res["totalInstitutions"] = totalInstitutions
		res["totalTeachers"] = totalTeachers
		res["totalStudents"] = totalStudents

		// Telemetry metrics from Redis for each institution
		type tenantInfo struct {
			ID   string
			Name string
		}
		var tenants []tenantInfo
		rows, err := tx.Query(ctx, `select institution_id::text, name from institutions`)
		if err == nil {
			for rows.Next() {
				var t tenantInfo
				if err := rows.Scan(&t.ID, &t.Name); err == nil {
					tenants = append(tenants, t)
				}
			}
			rows.Close()
		}

		var telemetryList []map[string]any
		for _, t := range tenants {
			tenantKey := fmt.Sprintf("tenant_load:%s", t.ID)
			metrics, _ := s.rdb.HGetAll(ctx, tenantKey).Result()
			
			activeTeachers := 0
			activeCandidates := 0
			totalRequests := 0
			promptTokens := 0
			completionTokens := 0

			if val, ok := metrics["active_teachers"]; ok {
				activeTeachers = parseIntVal(val)
			}
			if val, ok := metrics["active_candidates"]; ok {
				activeCandidates = parseIntVal(val)
			}
			if val, ok := metrics["total_requests"]; ok {
				totalRequests = parseIntVal(val)
			}
			if val, ok := metrics["total_prompt_tokens"]; ok {
				promptTokens = parseIntVal(val)
			}
			if val, ok := metrics["total_completion_tokens"]; ok {
				completionTokens = parseIntVal(val)
			}

			telemetryList = append(telemetryList, map[string]any{
				"institutionId":   t.ID,
				"name":            t.Name,
				"activeTeachers":  activeTeachers,
				"activeCandidates": activeCandidates,
				"totalRequests":   totalRequests,
				"promptTokens":    promptTokens,
				"completionTokens": completionTokens,
			})
		}
		res["telemetry"] = telemetryList
	} else {
		isInstitute := false
		for _, r := range roles {
			rStr := strings.ToLower(strings.TrimSpace(r))
			if rStr == "institute" || rStr == "institute_admin" {
				isInstitute = true
				break
			}
		}

		isTeacher := false
		for _, r := range roles {
			if strings.ToLower(strings.TrimSpace(r)) == "teacher" {
				isTeacher = true
				break
			}
		}

		isStudent := false
		for _, r := range roles {
			if strings.ToLower(strings.TrimSpace(r)) == "student" {
				isStudent = true
				break
			}
		}

		if isInstitute {
			// Query specific metrics for this institute
			var totalTeachers int64
			var totalStudents int64
			var activeUsers int64
			var pendingUsers int64

			// Teachers in this institute
			_ = tx.QueryRow(ctx, `
				select count(distinct ur.user_id) 
				from user_roles ur 
				join roles r on ur.role_id = r.role_id 
				join users u on ur.user_id = u.user_id
				where lower(r.name) = 'teacher' and u.institution_id = $1
			`, institutionID).Scan(&totalTeachers)

			// Students in this institute
			_ = tx.QueryRow(ctx, `
				select count(distinct ur.user_id) 
				from user_roles ur 
				join roles r on ur.role_id = r.role_id 
				join users u on ur.user_id = u.user_id
				where lower(r.name) = 'student' and u.institution_id = $1
			`, institutionID).Scan(&totalStudents)

			// Active vs Pending Users
			_ = tx.QueryRow(ctx, `select count(*) from users where status='active' and institution_id = $1`, institutionID).Scan(&activeUsers)
			_ = tx.QueryRow(ctx, `select count(*) from users where status='pending' and institution_id = $1`, institutionID).Scan(&pendingUsers)

			// Institute Telemetry from Redis
			activeTeachers := 0
			activeCandidates := 0
			totalRequests := 0
			promptTokens := 0
			completionTokens := 0

			if institutionID != "" {
				tenantKey := fmt.Sprintf("tenant_load:%s", institutionID)
				metrics, _ := s.rdb.HGetAll(ctx, tenantKey).Result()
				
				if val, ok := metrics["active_teachers"]; ok { activeTeachers = parseIntVal(val) }
				if val, ok := metrics["active_candidates"]; ok { activeCandidates = parseIntVal(val) }
				if val, ok := metrics["total_requests"]; ok { totalRequests = parseIntVal(val) }
				if val, ok := metrics["total_prompt_tokens"]; ok { promptTokens = parseIntVal(val) }
				if val, ok := metrics["total_completion_tokens"]; ok { completionTokens = parseIntVal(val) }
			}

			res["role"] = "institute"
			res["totalTeachers"] = totalTeachers
			res["totalStudents"] = totalStudents
			res["activeUsers"] = activeUsers
			res["pendingUsers"] = pendingUsers
			res["activeTeachers"] = activeTeachers
			res["activeCandidates"] = activeCandidates
			res["totalRequests"] = totalRequests
			res["promptTokens"] = promptTokens
			res["completionTokens"] = completionTokens
			// Artificial progress history for the chart
			res["progressHistory"] = []int{45, 52, 60, 58, 65, 78, 85, 92}
		} else if isTeacher {
			res["role"] = "teacher"
			res["totalStudents"] = 28
			res["averageAttendance"] = 96.4
			res["submittedAssignments"] = 142
			res["pendingAssignments"] = 12
			res["academicProgress"] = 87.5
			res["progressHistory"] = []int{80, 82, 85, 87, 88}
		} else if isStudent {
			res["role"] = "student"
			res["gpa"] = 91.2
			res["attendance"] = 98.2
			res["completedAssignments"] = 18
			res["totalAssignments"] = 22
			res["pendingAssignments"] = 4
			res["academicProgress"] = 82.0
			res["progressHistory"] = []int{75, 78, 80, 81, 82}
		} else {
			res["role"] = "user"
		}
	}

	return res, tx.Commit(ctx)
}

func parseIntVal(s string) int {
	var i int
	_, _ = fmt.Sscan(s, &i)
	return i
}

func (s *AuthService) IsolateUser(ctx context.Context, actorUserID, actorInstitutionID string, isSysAdmin bool, userID, ipAddress string) error {
	if s.pool == nil {
		return errors.New("auth pool not configured")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return errors.New("userId required")
	}
	if !isSysAdmin {
		return errors.New("forbidden: system administrator privileges required for account isolation")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	appCtx := database.AppContext{AllowLogin: true}
	if err := database.ApplyAppContext(ctx, tx, appCtx); err != nil {
		return err
	}

	var targetEmail string
	err = tx.QueryRow(ctx, `select email from users where user_id=nullif($1,'')::uuid`, uid).Scan(&targetEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("user not found")
		}
		return err
	}

	// Soft Isolation Pattern: Update status to ISOLATED instead of hard deleting
	_, err = tx.Exec(ctx, `update users set status='ISOLATED', updated_at=now() where user_id=nullif($1,'')::uuid`, uid)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `update institution_approval_requests set status='ISOLATED', updated_at=now() where user_id=nullif($1,'')::uuid`, uid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Session Revocation: Purge all session keys from Redis and set revoked=true
	if s.sessions != nil {
		_ = s.sessions.RevokeAllUserSessions(ctx, uid)
	}

	// Global Audit Logging
	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     actorUserID,
			Action:     "ISOLATE_USER",
			Resource:   "user",
			ResourceID: uid,
			IPAddress:  ipAddress,
			Metadata: map[string]any{
				"target_user_id": uid,
				"target_email":   targetEmail,
				"status":         "ISOLATED",
				"is_sys_admin":   isSysAdmin,
				"timestamp":      time.Now().UTC(),
			},
		})
	}

	return nil
}

func (s *AuthService) DeleteUser(ctx context.Context, actorUserID, actorInstitutionID string, isSysAdmin bool, userID, ipAddress string) error {
	if s.pool == nil {
		return errors.New("auth pool not configured")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return errors.New("userId required")
	}
	if !isSysAdmin {
		return errors.New("forbidden: system administrator privileges required for account deletion")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	appCtx := database.AppContext{AllowLogin: true}
	if err := database.ApplyAppContext(ctx, tx, appCtx); err != nil {
		return err
	}

	var targetEmail string
	err = tx.QueryRow(ctx, `select email from users where user_id=nullif($1,'')::uuid`, uid).Scan(&targetEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("user not found")
		}
		return err
	}

	// Hard Deletion Pattern
	_, err = tx.Exec(ctx, `delete from user_roles where user_id=nullif($1,'')::uuid`, uid)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `delete from institution_approval_requests where user_id=nullif($1,'')::uuid`, uid)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `delete from users where user_id=nullif($1,'')::uuid`, uid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Session Revocation: Purge all session keys from Redis and set revoked=true
	if s.sessions != nil {
		_ = s.sessions.RevokeAllUserSessions(ctx, uid)
	}

	// Global Audit Logging
	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     actorUserID,
			Action:     "DELETE_USER",
			Resource:   "user",
			ResourceID: uid,
			IPAddress:  ipAddress,
			Metadata: map[string]any{
				"target_user_id": uid,
				"target_email":   targetEmail,
				"status":         "DELETED",
				"is_sys_admin":   isSysAdmin,
				"timestamp":      time.Now().UTC(),
			},
		})
	}

	return nil
}

// ForgotPassword generates a secure token and stores it in Redis for password reset
func (s *AuthService) ForgotPassword(ctx context.Context, email string) error {
	if s.pool == nil || s.rdb == nil {
		return errors.New("auth service not fully configured")
	}

	e := strings.ToLower(strings.TrimSpace(email))
	if e == "" {
		return errors.New("email is required")
	}

	// Look up user
	var userID string
	var status string
	err := s.pool.QueryRow(ctx, `select user_id::text, status from users where lower(email)=$1 limit 1`, e).Scan(&userID, &status)
	if err != nil {
		// Do not leak if user exists or not, just return nil
		return nil
	}
	if strings.ToLower(strings.TrimSpace(status)) != "active" {
		return nil
	}

	// Generate secure token
	token, err := newUUIDv4()
	if err != nil {
		return err
	}

	// Store token in Redis mapping to UserID for 15 minutes
	redisKey := "pwd_reset_token:" + token
	if err := s.rdb.Set(ctx, redisKey, userID, 15*time.Minute).Err(); err != nil {
		return err
	}

	// Since this is a test environment, print to console instead of sending real email
	fmt.Printf("\n=======================================================\n")
	fmt.Printf("[SIMULATED EMAIL] Password Reset Request for: %s\n", e)
	fmt.Printf("Link: http://localhost:5173/reset-password?token=%s\n", token)
	fmt.Printf("=======================================================\n\n")

	return nil
}

// ResetPassword validates the token and updates the user's password
func (s *AuthService) ResetPassword(ctx context.Context, token string, newPassword string) error {
	if s.pool == nil || s.rdb == nil {
		return errors.New("auth service not fully configured")
	}

	t := strings.TrimSpace(token)
	if t == "" {
		return errors.New("invalid or expired token")
	}

	if err := s.passwordPolicy.Validate(newPassword); err != nil {
		return err
	}

	redisKey := "pwd_reset_token:" + t
	userID, err := s.rdb.Get(ctx, redisKey).Result()
	if err != nil || userID == "" {
		return errors.New("invalid or expired token")
	}

	// Hash the new password
	hash, err := security.HashPassword(newPassword, security.DefaultArgon2idParams)
	if err != nil {
		return err
	}

	// Update user record
	res, err := s.pool.Exec(ctx, `update users set password_hash=$1, updated_at=now() where user_id=nullif($2,'')::uuid`, hash, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errors.New("user not found")
	}

	// Invalidate all active sessions for the user to force re-login
	if s.sessions != nil {
		_ = s.sessions.RevokeAllUserSessions(ctx, userID)
	}

	// Delete the token
	_ = s.rdb.Del(ctx, redisKey)

	// Log audit event
	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     userID,
			Action:     "RESET_PASSWORD",
			Resource:   "user",
			ResourceID: userID,
			Metadata: map[string]any{
				"timestamp": time.Now().UTC(),
			},
		})
	}

	return nil
}

type UserProfile struct {
	UserID          string                   `json:"userId"`
	InstitutionID   string                   `json:"institutionId"`
	InstitutionName string                   `json:"institutionName"`
	InstitutionType string                   `json:"institutionType"`
	Domain          string                   `json:"domain"`
	Email           string                   `json:"email"`
	FirstName       string                   `json:"firstName"`
	LastName        string                   `json:"lastName"`
	DisplayName     string                   `json:"displayName"`
	Phone           string                   `json:"phone"`
	Bio             string                   `json:"bio"`
	IsSysAdmin      bool                     `json:"isSysAdmin"`
	Roles           []string                 `json:"roles"`
	Permissions     []string                 `json:"permissions"`
	Metadata        map[string]any           `json:"metadata"`
	PendingRequest  *ApprovalRequestSummary  `json:"pendingRequest,omitempty"`
	RequestHistory  []ApprovalRequestSummary `json:"requestHistory"`
	CreatedAt       time.Time                `json:"createdAt"`
	LastLogin       *time.Time               `json:"lastLogin,omitempty"`
}

type UpdateProfileRequest struct {
	DisplayName             string         `json:"displayName"`
	Phone                   string         `json:"phone"`
	Bio                     string         `json:"bio"`
	NotificationPreferences map[string]any `json:"notificationPreferences"`
	AvatarURL               string         `json:"avatarUrl"`
}

type ProfileChangeRequestPayload struct {
	RequestedChanges map[string]any `json:"requestedChanges"`
	Reason           string         `json:"reason"`
}

func (s *AuthService) GetProfile(ctx context.Context, userID string) (UserProfile, error) {
	if s.pool == nil {
		return UserProfile{}, errors.New("database pool unavailable")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return UserProfile{}, errors.New("user ID required")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return UserProfile{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true, UserID: uid}); err != nil {
		return UserProfile{}, err
	}

	var instID, email, firstName, lastName string
	var metaBytes []byte
	var isSysAdmin bool
	var createdAt time.Time
	var lastLogin *time.Time

	err = tx.QueryRow(ctx, `
		select coalesce(institution_id::text,''), email, coalesce(first_name,''), coalesce(last_name,''), 
		       coalesce(metadata, '{}'::jsonb)::text, is_sys_admin, created_at, last_login
		from users
		where user_id = nullif($1,'')::uuid
		limit 1
	`, uid).Scan(&instID, &email, &firstName, &lastName, &metaBytes, &isSysAdmin, &createdAt, &lastLogin)
	if err != nil {
		return UserProfile{}, fmt.Errorf("user not found: %w", err)
	}

	var instName, instType, domain string
	if instID != "" {
		_ = tx.QueryRow(ctx, `
			select coalesce(name,''), coalesce(institute_type,''), coalesce(domain,'')
			from institutions
			where institution_id = nullif($1,'')::uuid
		`, instID).Scan(&instName, &instType, &domain)
	}

	roles, roleIDs, _ := loadUserRoles(ctx, tx, instID, uid)
	perms, _ := loadUserPermissions(ctx, tx, instID, roleIDs)
	if isSysAdmin {
		perms = append(perms, "SUPER_ADMIN")
	}

	meta := make(map[string]any)
	if len(metaBytes) > 0 {
		_ = json.Unmarshal(metaBytes, &meta)
	}

	displayName := ""
	if p, ok := meta["preferred_name"].(string); ok && p != "" {
		displayName = p
	} else {
		displayName = strings.TrimSpace(firstName + " " + lastName)
	}
	phone := ""
	if p, ok := meta["phone"].(string); ok {
		phone = p
	}
	bio := ""
	if b, ok := meta["bio"].(string); ok {
		bio = b
	}

	var pendingReq *ApprovalRequestSummary
	var pReqID, pInstID, pUID, pStatus, pReqType, pReason string
	var pMetaBytes []byte
	var pCreatedAt time.Time
	var pReviewedAt *time.Time
	err = tx.QueryRow(ctx, `
		select request_id::text, coalesce(institution_id::text,''), user_id::text, status, 
		       coalesce(request_type,''), coalesce(metadata, '{}'::jsonb)::text, 
		       coalesce(rejection_reason,''), created_at, reviewed_at
		from institution_approval_requests
		where user_id = nullif($1,'')::uuid and status = 'PENDING'
		order by created_at desc
		limit 1
	`, uid).Scan(&pReqID, &pInstID, &pUID, &pStatus, &pReqType, &pMetaBytes, &pReason, &pCreatedAt, &pReviewedAt)
	if err == nil {
		pMeta := make(map[string]any)
		if len(pMetaBytes) > 0 {
			_ = json.Unmarshal(pMetaBytes, &pMeta)
		}
		var pRevStr string
		if pReviewedAt != nil {
			pRevStr = pReviewedAt.Format(time.RFC3339)
		}
		pendingReq = &ApprovalRequestSummary{
			RequestID:       pReqID,
			InstitutionID:   pInstID,
			InstitutionName: instName,
			UserID:          pUID,
			Email:           email,
			FirstName:       firstName,
			LastName:        lastName,
			RequestType:     pReqType,
			Status:          pStatus,
			Metadata:        pMeta,
			RejectionReason: pReason,
			CreatedAt:       pCreatedAt.Format(time.RFC3339),
			ReviewedAt:      pRevStr,
		}
	}

	var history []ApprovalRequestSummary
	hRows, err := tx.Query(ctx, `
		select request_id::text, coalesce(institution_id::text,''), user_id::text, status, 
		       coalesce(request_type,''), coalesce(metadata, '{}'::jsonb)::text, 
		       coalesce(rejection_reason,''), created_at, reviewed_at
		from institution_approval_requests
		where user_id = nullif($1,'')::uuid
		order by created_at desc
		limit 5
	`, uid)
	if err == nil {
		defer hRows.Close()
		for hRows.Next() {
			var hReqID, hInstID, hUID, hStatus, hReqType, hReason string
			var hMetaBytes []byte
			var hCreatedAt time.Time
			var hReviewedAt *time.Time
			if err := hRows.Scan(&hReqID, &hInstID, &hUID, &hStatus, &hReqType, &hMetaBytes, &hReason, &hCreatedAt, &hReviewedAt); err == nil {
				hMeta := make(map[string]any)
				if len(hMetaBytes) > 0 {
					_ = json.Unmarshal(hMetaBytes, &hMeta)
				}
				var hRevStr string
				if hReviewedAt != nil {
					hRevStr = hReviewedAt.Format(time.RFC3339)
				}
				history = append(history, ApprovalRequestSummary{
					RequestID:       hReqID,
					InstitutionID:   hInstID,
					InstitutionName: instName,
					UserID:          hUID,
					Email:           email,
					FirstName:       firstName,
					LastName:        lastName,
					RequestType:     hReqType,
					Status:          hStatus,
					Metadata:        hMeta,
					RejectionReason: hReason,
					CreatedAt:       hCreatedAt.Format(time.RFC3339),
					ReviewedAt:      hRevStr,
				})
			}
		}
	}

	_ = tx.Commit(ctx)

	return UserProfile{
		UserID:          uid,
		InstitutionID:   instID,
		InstitutionName: instName,
		InstitutionType: instType,
		Domain:          domain,
		Email:           email,
		FirstName:       firstName,
		LastName:        lastName,
		DisplayName:     displayName,
		Phone:           phone,
		Bio:             bio,
		IsSysAdmin:      isSysAdmin,
		Roles:           roles,
		Permissions:     perms,
		Metadata:        meta,
		PendingRequest:  pendingReq,
		RequestHistory:  history,
		CreatedAt:       createdAt,
		LastLogin:       lastLogin,
	}, nil
}

func (s *AuthService) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) error {
	if s.pool == nil {
		return errors.New("database pool unavailable")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return errors.New("user ID required")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true, UserID: uid}); err != nil {
		return err
	}

	var metaBytes []byte
	err = tx.QueryRow(ctx, `select coalesce(metadata, '{}'::jsonb)::text from users where user_id = nullif($1,'')::uuid`, uid).Scan(&metaBytes)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	meta := make(map[string]any)
	if len(metaBytes) > 0 {
		_ = json.Unmarshal(metaBytes, &meta)
	}

	if req.DisplayName != "" {
		meta["preferred_name"] = strings.TrimSpace(req.DisplayName)
	}
	if req.Phone != "" {
		meta["phone"] = strings.TrimSpace(req.Phone)
	}
	if req.Bio != "" {
		meta["bio"] = strings.TrimSpace(req.Bio)
	}
	if req.AvatarURL != "" {
		meta["avatar_url"] = strings.TrimSpace(req.AvatarURL)
	}
	if req.NotificationPreferences != nil {
		meta["notifications"] = req.NotificationPreferences
	}

	updatedJSON, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `update users set metadata = $1::jsonb, updated_at = now() where user_id = nullif($2,'')::uuid`, string(updatedJSON), uid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     uid,
			Action:     "PROFILE_UPDATED",
			Resource:   "user",
			ResourceID: uid,
			CreatedAt:  time.Now().UTC(),
		})
	}

	return nil
}

func (s *AuthService) RequestProfileChange(ctx context.Context, userID, userInstitutionID string, req ProfileChangeRequestPayload) error {
	if s.pool == nil {
		return errors.New("database pool unavailable")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return errors.New("user ID required")
	}
	if len(req.RequestedChanges) == 0 {
		return errors.New("at least one field change must be requested")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true, UserID: uid}); err != nil {
		return err
	}

	var pendingCount int
	err = tx.QueryRow(ctx, `
		select count(*) from institution_approval_requests
		where user_id = nullif($1,'')::uuid and status = 'PENDING'
	`, uid).Scan(&pendingCount)
	if err == nil && pendingCount > 0 {
		return errors.New("a profile change request is already pending administrator review")
	}

	var currFirst, currLast string
	var currMetaBytes []byte
	_ = tx.QueryRow(ctx, `
		select coalesce(first_name,''), coalesce(last_name,''), coalesce(metadata, '{}'::jsonb)::text
		from users where user_id = nullif($1,'')::uuid
	`, uid).Scan(&currFirst, &currLast, &currMetaBytes)

	currMeta := make(map[string]any)
	if len(currMetaBytes) > 0 {
		_ = json.Unmarshal(currMetaBytes, &currMeta)
	}

	currentValues := make(map[string]any)
	for k := range req.RequestedChanges {
		if k == "firstName" {
			currentValues["firstName"] = currFirst
		} else if k == "lastName" {
			currentValues["lastName"] = currLast
		} else if v, ok := currMeta[k]; ok {
			currentValues[k] = v
		} else {
			currentValues[k] = ""
		}
	}

	metaPayload := map[string]any{
		"requested_changes": req.RequestedChanges,
		"current_values":    currentValues,
		"reason":            strings.TrimSpace(req.Reason),
		"submitted_at":      time.Now().UTC(),
	}
	metaBytes, err := json.Marshal(metaPayload)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		insert into institution_approval_requests(
			institution_id, user_id, requested_role, request_type, status, metadata, created_at, updated_at
		) values (
			nullif($1,'')::uuid, nullif($2,'')::uuid, 'USER', 'profile_edit', 'PENDING', $3::jsonb, now(), now()
		)
	`, nullIfEmpty(userInstitutionID), uid, string(metaBytes))
	if err != nil {
		return fmt.Errorf("failed to submit profile request: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     uid,
			Action:     "PROFILE_CHANGE_REQUESTED",
			Resource:   "user",
			ResourceID: uid,
			CreatedAt:  time.Now().UTC(),
			Metadata: map[string]any{
				"changes": req.RequestedChanges,
				"reason":  req.Reason,
			},
		})
	}

	return nil
}

func (s *AuthService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if s.pool == nil {
		return errors.New("database pool unavailable")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return errors.New("user ID required")
	}
	if err := s.passwordPolicy.Validate(newPassword); err != nil {
		return err
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true, UserID: uid}); err != nil {
		return err
	}

	var pwdHash string
	err = tx.QueryRow(ctx, `select password_hash from users where user_id = nullif($1,'')::uuid`, uid).Scan(&pwdHash)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	ok, err := security.VerifyPassword(pwdHash, currentPassword)
	if err != nil || !ok {
		return errors.New("current password is incorrect")
	}

	newHash, err := security.HashPassword(newPassword, security.DefaultArgon2idParams)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `update users set password_hash=$1, updated_at=now() where user_id=nullif($2,'')::uuid`, newHash, uid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	if s.auditLogger != nil {
		_ = s.auditLogger.Log(ctx, security.AuditEvent{
			UserID:     uid,
			Action:     "PASSWORD_CHANGED",
			Resource:   "user",
			ResourceID: uid,
			CreatedAt:  time.Now().UTC(),
		})
	}

	return nil
}
