package auth

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"safescholar/gateway/infrastructure/database"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Session struct {
	SessionID string    `json:"sessionId"`
	UserID    string    `json:"userId"`
	TokenID   string    `json:"tokenId"`
	IPAddress string    `json:"ipAddress"`
	UserAgent string    `json:"userAgent"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
	Revoked   bool      `json:"revoked"`
}

type SessionManager struct {
	rdb       *redis.Client
	pool      *pgxpool.Pool
	keyPrefix string
}

func NewSessionManager(rdb *redis.Client, pool *pgxpool.Pool) *SessionManager {
	return &SessionManager{
		rdb:       rdb,
		pool:      pool,
		keyPrefix: "session:",
	}
}

func (m *SessionManager) Create(ctx context.Context, session Session) error {
	if strings.TrimSpace(session.SessionID) == "" || strings.TrimSpace(session.UserID) == "" {
		return errors.New("session requires ids")
	}
	if session.CreatedAt.IsZero() {
		session.CreatedAt = time.Now().UTC()
	}
	if session.ExpiresAt.IsZero() {
		return errors.New("session expiresAt required")
	}
	ttl := time.Until(session.ExpiresAt)
	if ttl <= 0 {
		return errors.New("session already expired")
	}

	if m.pool != nil {
		tx, err := m.pool.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
insert into sessions(session_id, user_id, token_id, ip_address, user_agent, created_at, expires_at, revoked)
values (nullif($1,'')::uuid, nullif($2,'')::uuid, nullif($3,'')::uuid, nullif($4,''), nullif($5,''), $6, $7, $8)
on conflict (session_id) do nothing`,
			session.SessionID, session.UserID, session.TokenID, strings.TrimSpace(session.IPAddress), strings.TrimSpace(session.UserAgent), session.CreatedAt, session.ExpiresAt, session.Revoked,
		)
		if err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	if m.rdb != nil {
		b, err := json.Marshal(session)
		if err != nil {
			return err
		}
		return m.rdb.Set(ctx, m.keyPrefix+session.SessionID, b, ttl).Err()
	}

	return nil
}

func (m *SessionManager) Validate(ctx context.Context, institutionID, sessionID string) (Session, error) {
	sid := strings.TrimSpace(sessionID)
	if sid == "" {
		return Session{}, errors.New("session id required")
	}

	if m.rdb != nil {
		raw, err := m.rdb.Get(ctx, m.keyPrefix+sid).Bytes()
		if err == nil {
			var s Session
			if err := json.Unmarshal(raw, &s); err == nil {
				if err := validateSessionStruct(s); err != nil {
					return Session{}, err
				}
				return s, nil
			}
		}
	}

	if m.pool == nil {
		return Session{}, errors.New("session store unavailable")
	}

	tx, err := m.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return Session{}, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return Session{}, err
	}

	var s Session
	var tokenID string
	var ipAddr string
	var ua string
	err = tx.QueryRow(ctx, `
select session_id::text, user_id::text, coalesce(token_id::text,''), coalesce(ip_address,''), coalesce(user_agent,''), created_at, expires_at, revoked
from sessions
where session_id = nullif($1,'')::uuid`, sid).Scan(&s.SessionID, &s.UserID, &tokenID, &ipAddr, &ua, &s.CreatedAt, &s.ExpiresAt, &s.Revoked)
	if err != nil {
		return Session{}, errors.New("invalid session")
	}
	s.TokenID = strings.TrimSpace(tokenID)
	s.IPAddress = strings.TrimSpace(ipAddr)
	s.UserAgent = strings.TrimSpace(ua)

	if err := validateSessionStruct(s); err != nil {
		return Session{}, err
	}

	return s, tx.Commit(ctx)
}

func (m *SessionManager) Revoke(ctx context.Context, institutionID, sessionID string) error {
	sid := strings.TrimSpace(sessionID)
	if sid == "" {
		return errors.New("session id required")
	}

	if m.pool != nil {
		tx, err := m.pool.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `update sessions set revoked=true where session_id = nullif($1,'')::uuid`, sid); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	if m.rdb != nil {
		_ = m.rdb.Del(ctx, m.keyPrefix+sid).Err()
	}
	return nil
}

func (m *SessionManager) SetTokenID(ctx context.Context, institutionID, sessionID, tokenID string) error {
	sid := strings.TrimSpace(sessionID)
	if sid == "" {
		return errors.New("session id required")
	}
	tid := strings.TrimSpace(tokenID)
	if tid == "" {
		return errors.New("token id required")
	}

	if m.pool != nil {
		tx, err := m.pool.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback(context.Background()) }()
		if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `update sessions set token_id = nullif($2,'')::uuid where session_id = nullif($1,'')::uuid`, sid, tid); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}

	if m.rdb != nil {
		raw, err := m.rdb.Get(ctx, m.keyPrefix+sid).Bytes()
		if err == nil {
			var s Session
			if err := json.Unmarshal(raw, &s); err == nil {
				s.TokenID = tid
				b, err := json.Marshal(s)
				if err == nil {
					ttl := time.Until(s.ExpiresAt)
					if ttl > 0 {
						_ = m.rdb.Set(ctx, m.keyPrefix+sid, b, ttl).Err()
					}
				}
			}
		}
	}

	return nil
}

func (m *SessionManager) BlacklistTokenID(ctx context.Context, tokenID string, ttl time.Duration) error {
	if m.rdb == nil {
		return nil
	}
	tid := strings.TrimSpace(tokenID)
	if tid == "" {
		return errors.New("token id required")
	}
	if ttl <= 0 {
		ttl = time.Minute
	}
	return m.rdb.Set(ctx, "jwt:blacklist:"+tid, "1", ttl).Err()
}

func (m *SessionManager) IsTokenBlacklisted(ctx context.Context, tokenID string) (bool, error) {
	if m.rdb == nil {
		return false, nil
	}
	tid := strings.TrimSpace(tokenID)
	if tid == "" {
		return false, nil
	}
	v, err := m.rdb.Exists(ctx, "jwt:blacklist:"+tid).Result()
	if err != nil {
		return false, err
	}
	return v == 1, nil
}

func validateSessionStruct(s Session) error {
	if strings.TrimSpace(s.SessionID) == "" || strings.TrimSpace(s.UserID) == "" {
		return errors.New("invalid session")
	}
	if !s.ExpiresAt.After(time.Now().UTC()) {
		return errors.New("session expired")
	}
	if s.Revoked {
		return errors.New("session revoked")
	}
	return nil
}
