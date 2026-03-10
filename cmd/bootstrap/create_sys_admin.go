package bootstrap

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/security"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func EnsureSysAdmin(ctx context.Context, cfg config.BootstrapConfig, auditEnabled bool, pool *pgxpool.Pool) error {
	if pool == nil {
		return errors.New("postgres pool required")
	}

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `select pg_advisory_xact_lock(7211843001)`); err != nil {
		return err
	}

	userCount, err := countUsers(ctx, tx)
	if err != nil {
		return err
	}
	sysAdminCount, err := countSysAdmins(ctx, tx)
	if err != nil {
		return err
	}
	if sysAdminCount > 0 {
		return tx.Commit(ctx)
	}
	if userCount > 0 {
		return errors.New("no sysadmin exists but users already exist; bootstrap sysadmin is disabled in this state")
	}

	email := strings.ToLower(strings.TrimSpace(os.Getenv(cfg.SysAdminEmailEnv)))
	password := strings.TrimSpace(os.Getenv(cfg.SysAdminPasswordEnv))
	first := strings.TrimSpace(os.Getenv(cfg.SysAdminFirstNameEnv))
	last := strings.TrimSpace(os.Getenv(cfg.SysAdminLastNameEnv))
	if email == "" || password == "" {
		return errors.New("sysadmin bootstrap required but env vars are missing")
	}
	if err := auth.DefaultPasswordPolicy().Validate(password); err != nil {
		return err
	}
	hash, err := security.HashPassword(password, security.DefaultArgon2idParams)
	if err != nil {
		return err
	}
	password = ""

	var userID string
	err = tx.QueryRow(ctx, `
insert into users(email, password_hash, first_name, last_name, status, is_sys_admin, created_at)
values ($1, $2, nullif($3,''), nullif($4,''), 'active', true, now())
returning user_id::text`,
		email, hash, first, last,
	).Scan(&userID)
	if err != nil {
		return err
	}

	var sysAdminRoleID string
	err = tx.QueryRow(ctx, `
select role_id::text
from roles
where institution_id is null and lower(name)=lower('sysadmin')
limit 1`).Scan(&sysAdminRoleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			err = tx.QueryRow(ctx, `
insert into roles(institution_id, name, description, is_system_role, created_at)
values (null, 'sysadmin', 'System administrator', true, now())
returning role_id::text`).Scan(&sysAdminRoleID)
			if err != nil {
				return err
			}
		} else {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
insert into user_roles(user_id, role_id, assigned_by)
values (nullif($1,'')::uuid, nullif($2,'')::uuid, nullif($3,'')::uuid)
on conflict (user_id, role_id) do nothing`, userID, sysAdminRoleID, userID); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	auditLogger := security.NewAuditLogger(auditEnabled, pool)
	_ = auditLogger.Log(ctx, security.AuditEvent{
		UserID:     userID,
		Action:     "BOOTSTRAP_SYS_ADMIN_CREATED",
		Resource:   "user",
		ResourceID: userID,
		CreatedAt:  time.Now().UTC(),
		Metadata: map[string]any{
			"email": email,
		},
	})
	return nil
}

func countUsers(ctx context.Context, tx pgx.Tx) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var c int64
	if err := tx.QueryRow(ctx, `select count(1) from users`).Scan(&c); err != nil {
		return 0, err
	}
	return c, nil
}

func countSysAdmins(ctx context.Context, tx pgx.Tx) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var c int64
	if err := tx.QueryRow(ctx, `select count(1) from users where is_sys_admin=true`).Scan(&c); err != nil {
		return 0, err
	}
	return c, nil
}
