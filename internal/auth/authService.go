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
