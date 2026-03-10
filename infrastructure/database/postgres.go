package database

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"safescholar/gateway/config"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context, cfg config.PostgresConfig) (*pgxpool.Pool, error) {
	if strings.TrimSpace(cfg.ConnString) == "" {
		return nil, errors.New("postgres conn string required")
	}
	u, err := url.Parse(cfg.ConnString)
	if err != nil {
		return nil, fmt.Errorf("invalid postgres conn string: %w", err)
	}

	poolCfg, err := pgxpool.ParseConfig(cfg.ConnString)
	if err != nil {
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}

	sslmode := strings.ToLower(strings.TrimSpace(u.Query().Get("sslmode")))
	if sslmode == "" {
		sslmode = "prefer"
	}
	if sslmode != "disable" {
		tlsCfg := poolCfg.ConnConfig.TLSConfig
		if tlsCfg == nil {
			tlsCfg = &tls.Config{}
		}
		if tlsCfg.MinVersion == 0 {
			tlsCfg.MinVersion = tls.VersionTLS12
		}
		if strings.TrimSpace(tlsCfg.ServerName) == "" && strings.TrimSpace(u.Hostname()) != "" {
			tlsCfg.ServerName = strings.TrimSpace(u.Hostname())
		}
		poolCfg.ConnConfig.TLSConfig = tlsCfg
	}

	if cfg.AppName != "" {
		poolCfg.ConnConfig.RuntimeParams["application_name"] = cfg.AppName
	}

	if cfg.MaxConns > 0 {
		poolCfg.MaxConns = cfg.MaxConns
	}
	if cfg.MinConns > 0 {
		poolCfg.MinConns = cfg.MinConns
	}
	if cfg.HealthCheckPeriod > 0 {
		poolCfg.HealthCheckPeriod = cfg.HealthCheckPeriod
	}

	poolCfg.ConnConfig.ConnectTimeout = 5 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return pool, nil
}

type AppContext struct {
	InstitutionID string
	AllowLogin    bool
}

func ApplyAppContext(ctx context.Context, tx pgx.Tx, ac AppContext) error {
	if tx == nil {
		return errors.New("tx required")
	}
	allowLogin := "false"
	if ac.AllowLogin {
		allowLogin = "true"
	}
	if _, err := tx.Exec(ctx, `select set_config('app.allow_login', $1, true)`, allowLogin); err != nil {
		return err
	}
	if strings.TrimSpace(ac.InstitutionID) != "" {
		if _, err := tx.Exec(ctx, `select set_config('app.institution_id', $1, true)`, ac.InstitutionID); err != nil {
			return err
		}
	}
	return nil
}
