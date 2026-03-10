package bootstrap

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/rbac"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Run(ctx context.Context, cfg config.Config, pool *pgxpool.Pool) error {
	if pool == nil {
		return errors.New("postgres pool required")
	}

	migrateCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	if err := database.ApplyMigrations(migrateCtx, pool); err != nil {
		return err
	}
	if boolFromEnv("MIGRATE_ONLY") {
		return nil
	}

	bootstrapCtx, cancel2 := context.WithTimeout(ctx, 45*time.Second)
	defer cancel2()
	if err := rbac.NewPermissionService(pool).EnsureImmutablePermissions(bootstrapCtx); err != nil {
		return err
	}
	if err := EnsureSysAdmin(bootstrapCtx, cfg.Bootstrap, cfg.Audit.Enabled, pool); err != nil {
		return err
	}
	return nil
}

func boolFromEnv(key string) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch v {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
