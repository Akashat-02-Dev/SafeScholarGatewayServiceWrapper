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
	if strings.ToLower(strings.TrimSpace(status)) != "active" {
		_ = s.recordFailure(ctx, e, ip)
		return LoginResult{}, errors.New("invalid credentials")
	}
	ok, err := security.VerifyPassword(passwordHash, password)
	if err != nil || !ok {
		_ = s.recordFailure(ctx, e, ip)
		return LoginResult{}, errors.New("invalid credentials")
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
	RequestID     string `json:"requestId"`
	UserID        string `json:"userId"`
	Email         string `json:"email"`
	FirstName     string `json:"firstName"`
	LastName      string `json:"lastName"`
	RequestedRole string `json:"requestedRole"`
	Status        string `json:"status"`
	CreatedAt     string `json:"createdAt"`
}

func (s *AuthService) RegisterUser(ctx context.Context, email, password, firstName, lastName, requestedRole string) error {
	if s.pool == nil {
		return errors.New("auth service pool not configured")
	}
	e := strings.ToLower(strings.TrimSpace(email))
	if e == "" || password == "" {
		return errors.New("email and password required")
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
	err = tx.QueryRow(ctx, `select exists(select 1 from users where lower(email)=lower($1))`, e).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("user already exists")
	}

	instID, err := ensureDefaultInstitution(ctx, tx)
	if err != nil {
		return err
	}

	var newUserID string
	err = tx.QueryRow(ctx, `
		insert into users(institution_id, email, password_hash, first_name, last_name, status, is_sys_admin, created_at)
		values (nullif($1,'')::uuid, $2, $3, nullif($4,''), nullif($5,''), 'pending', false, now())
		returning user_id::text`,
		instID, e, hash, firstName, lastName,
	).Scan(&newUserID)
	if err != nil {
		return err
	}

	roleName := strings.TrimSpace(requestedRole)
	if roleName == "" {
		roleName = "teacher"
	}

	_, err = tx.Exec(ctx, `
		insert into institution_approval_requests(institution_id, user_id, requested_role, status, created_at)
		values (nullif($1,'')::uuid, nullif($2,'')::uuid, $3, 'PENDING', now())`,
		instID, newUserID, roleName,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
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

func (s *AuthService) ApproveUser(ctx context.Context, userID, status, roleID string) error {
	if s.pool == nil {
		return errors.New("auth service pool not configured")
	}
	uid := strings.TrimSpace(userID)
	st := strings.ToLower(strings.TrimSpace(status))
	rid := strings.TrimSpace(roleID)
	if uid == "" || st == "" {
		return errors.New("userId and status required")
	}
	if st != "active" && st != "rejected" && st != "isolated" {
		return errors.New("invalid status value")
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
	var inst string
	err = tx.QueryRow(ctx, `select status, coalesce(institution_id::text,'') from users where user_id=nullif($1,'')::uuid`, uid).Scan(&currentStatus, &inst)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `update users set status=$1, updated_at=now() where user_id=nullif($2,'')::uuid`, st, uid)
	if err != nil {
		return err
	}

	// If status is approved ('active') and a roleID is provided, assign that role to the user
	if st == "active" && rid != "" {
		var roleExists bool
		err = tx.QueryRow(ctx, `select exists(select 1 from roles where role_id=nullif($1,'')::uuid)`, rid).Scan(&roleExists)
		if err != nil {
			return err
		}
		if !roleExists {
			return errors.New("role not found")
		}

		_, err = tx.Exec(ctx, `
			insert into user_roles(user_id, role_id)
			values (nullif($1,'')::uuid, nullif($2,'')::uuid)
			on conflict (user_id, role_id) do nothing`,
			uid, rid,
		)
		if err != nil {
			return err
		}
	}

	// Also update approval requests table
	reqStatus := "APPROVED"
	if st == "rejected" {
		reqStatus = "REJECTED"
	} else if st == "isolated" {
		reqStatus = "ISOLATED"
	}
	_, _ = tx.Exec(ctx, `
		update institution_approval_requests
		set status=$1, updated_at=now()
		where user_id=nullif($2,'')::uuid and status='PENDING'
	`, reqStatus, uid)

	return tx.Commit(ctx)
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

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		select r.request_id::text, r.user_id::text, u.email, coalesce(u.first_name,''), coalesce(u.last_name,''), r.requested_role, r.status, r.created_at
		from institution_approval_requests r
		join users u on r.user_id = u.user_id
		where r.institution_id = nullif($1,'')::uuid
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
		if err := rows.Scan(&r.RequestID, &r.UserID, &r.Email, &r.FirstName, &r.LastName, &r.RequestedRole, &r.Status, &createdAt); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.Format(time.RFC3339)
		reqs = append(reqs, r)
	}
	return reqs, tx.Commit(ctx)
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

		if isTeacher {
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

func (s *AuthService) DeleteUser(ctx context.Context, actorUserID, actorInstitutionID string, isSysAdmin bool, userID, ipAddress string) error {
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
