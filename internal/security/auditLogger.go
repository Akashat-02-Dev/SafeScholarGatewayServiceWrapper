package security

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEvent struct {
	UserID     string
	Action     string
	Resource   string
	ResourceID string
	IPAddress  string
	Metadata   map[string]any
	CreatedAt  time.Time
}

type AuditLogger struct {
	enabled bool
	pool    *pgxpool.Pool
}

func NewAuditLogger(enabled bool, pool *pgxpool.Pool) *AuditLogger {
	return &AuditLogger{
		enabled: enabled,
		pool:    pool,
	}
}

func (a *AuditLogger) Log(ctx context.Context, e AuditEvent) error {
	if !a.enabled {
		return nil
	}
	if a.pool == nil {
		return errors.New("audit logger not configured")
	}
	e = normalizeAuditEvent(e)
	if err := validateAuditEvent(e); err != nil {
		return err
	}
	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now().UTC()
	}

	if ctx == nil {
		ctx = context.Background()
	}
	if _, ok := ctx.Deadline(); !ok {
		c, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		ctx = c
	}

	var meta any
	if e.Metadata != nil {
		b, err := json.Marshal(e.Metadata)
		if err != nil {
			return err
		}
		if len(b) > 16*1024 {
			return errors.New("audit metadata too large")
		}
		meta = b
	}
	_, err := a.pool.Exec(ctx, `
insert into audit_logs(
  user_id, action, resource, resource_id, resource_id_text, ip_address, metadata, created_at
) values (
  nullif($1,'')::uuid,
  $2,
  nullif($3,''),
  case when $4 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then nullif($4,'')::uuid else null end,
  nullif($4,''),
  nullif($5,''),
  $6,
  $7
)`,
		e.UserID, e.Action, e.Resource, e.ResourceID, e.IPAddress, meta, e.CreatedAt,
	)
	return err
}

func normalizeAuditEvent(e AuditEvent) AuditEvent {
	e.UserID = strings.TrimSpace(e.UserID)
	e.Action = strings.ToUpper(strings.TrimSpace(e.Action))
	e.Resource = strings.TrimSpace(e.Resource)
	e.ResourceID = strings.TrimSpace(e.ResourceID)
	e.IPAddress = strings.TrimSpace(e.IPAddress)
	return e
}

func validateAuditEvent(e AuditEvent) error {
	if e.Action == "" {
		return errors.New("audit action required")
	}
	if len(e.Action) > 120 || hasCtl(e.Action, false) {
		return errors.New("invalid audit action")
	}
	if e.Resource != "" && (len(e.Resource) > 80 || hasCtl(e.Resource, false)) {
		return errors.New("invalid audit resource")
	}
	if e.ResourceID != "" && (len(e.ResourceID) > 256 || hasCtl(e.ResourceID, false)) {
		return errors.New("invalid audit resource id")
	}
	if e.IPAddress != "" && (len(e.IPAddress) > 64 || hasCtl(e.IPAddress, false)) {
		return errors.New("invalid audit ip address")
	}
	return nil
}

func hasCtl(s string, allowNewlines bool) bool {
	for _, r := range s {
		if r == 0 {
			return true
		}
		if unicode.IsControl(r) {
			if allowNewlines && (r == '\n' || r == '\r' || r == '\t') {
				continue
			}
			return true
		}
	}
	return false
}
