package main

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"safescholar/gateway/cmd/bootstrap"
	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/cache"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/infrastructure/service_registry"
	"safescholar/gateway/internal/adapters"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/gateway"
	"safescholar/gateway/internal/oauth"
	"safescholar/gateway/internal/rbac"
	"safescholar/gateway/internal/security"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		fatal(err)
	}

	level := slog.LevelInfo
	if cfg.Env == config.EnvDev {
		level = slog.LevelDebug
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	slog.SetDefault(logger)

	if err := validateStartupSecurity(cfg); err != nil {
		fatal(err)
	}

	pool, err := database.Connect(ctx, cfg.Postgres)
	if err != nil {
		fatal(err)
	}
	defer pool.Close()

	if err := bootstrap.Run(ctx, cfg, pool); err != nil {
		fatal(err)
	}

	if boolFromEnv("MIGRATE_ONLY") || boolFromEnv("BOOTSTRAP_ONLY") {
		return
	}

	rdb, err := cache.Connect(ctx, cfg.Redis)
	if err != nil {
		fatal(err)
	}
	defer func() { _ = rdb.Close() }()

	jwtManager, err := security.NewJWTManager(cfg.JWT.Issuer, cfg.JWT.Audience, cfg.JWT.PrivateKeyPEMFile, cfg.JWT.PublicKeyPEMFile, cfg.JWT.ClockSkew)
	if err != nil {
		fatal(err)
	}

	auditLogger := security.NewAuditLogger(cfg.Audit.Enabled, pool)
	sessionManager := auth.NewSessionManager(rdb, pool)
	tokenGen := auth.NewTokenGenerator(jwtManager, pool)
	tokenValidator := auth.NewTokenValidator(jwtManager, sessionManager)
	authSvc := auth.NewAuthService(pool, rdb, sessionManager, tokenGen, auditLogger)

	oauthSvc, err := oauth.NewOAuthService(ctx, cfg.OAuth, pool, rdb, tokenGen, sessionManager, auditLogger)
	if err != nil {
		fatal(err)
	}

	roleSvc := rbac.NewRoleService(pool, auditLogger, rbac.NewDelegationService(pool))
	registry := service_registry.New(cfg.ServiceRegistry, pool)

	httpClient, err := adapters.NewHTTPClientWithDeps(cfg.MTLS, adapters.HTTPClientDeps{
		TokenGenerator:  tokenGen,
		TokenValidator:  tokenValidator,
		ServiceTokenTTL: cfg.JWT.ServiceTokenTTL,
		GatewayName:     "safescholar-gateway",
	})
	if err != nil {
		fatal(err)
	}
	proxy := gateway.NewServiceProxy(httpClient)

	var limiter *security.TokenBucketLimiter
	if cfg.RateLimit.Enabled {
		limiter, err = security.NewTokenBucketLimiter(rdb, cfg.RateLimit.Prefix, cfg.RateLimit.Capacity, cfg.RateLimit.RefillRate, cfg.RateLimit.RefillPeriod)
		if err != nil {
			fatal(err)
		}
	}

	handler, err := gateway.NewRouter(gateway.RouterDeps{
		Config:          cfg,
		Logger:          logger,
		RateLimiter:     limiter,
		TokenValidator:  tokenValidator,
		AuthService:     authSvc,
		OAuthService:    oauthSvc,
		RoleService:     roleSvc,
		ServiceRegistry: registry,
		ServiceProxy:    proxy,
	})
	if err != nil {
		fatal(err)
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:           handler,
		ReadTimeout:       cfg.Server.ReadTimeout,
		ReadHeaderTimeout: cfg.Server.ReadHeaderTimeout,
		WriteTimeout:      cfg.Server.WriteTimeout,
		IdleTimeout:       cfg.Server.IdleTimeout,
		TLSConfig:         &tls.Config{MinVersion: tls.VersionTLS13},
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
		BaseContext: func(_ net.Listener) context.Context {
			return ctx
		},
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- serveHTTP(cfg, srv)
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			fatal(err)
		}
	}
}

func serveHTTP(cfg config.Config, srv *http.Server) error {
	if cfg.Server.TLSCertFile != "" && cfg.Server.TLSKeyFile != "" {
		return srv.ListenAndServeTLS(cfg.Server.TLSCertFile, cfg.Server.TLSKeyFile)
	}
	if cfg.Env == config.EnvDev && cfg.Security.RequireTLSInDev {
		return errors.New("tls required in dev but no tls cert/key configured")
	}
	return srv.ListenAndServe()
}

func fatal(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err.Error())
	os.Exit(1)
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

func validateStartupSecurity(cfg config.Config) error {
	if cfg.Env == config.EnvProd && !boolFromEnv("ALLOW_INSECURE_HTTP") {
		if strings.TrimSpace(cfg.Server.TLSCertFile) == "" || strings.TrimSpace(cfg.Server.TLSKeyFile) == "" {
			return errors.New("prod requires tls cert/key; set ALLOW_INSECURE_HTTP=1 only if TLS is terminated upstream")
		}
	}

	if cfg.Env == config.EnvProd {
		u, err := url.Parse(strings.TrimSpace(cfg.Postgres.ConnString))
		if err == nil {
			sslmode := strings.ToLower(strings.TrimSpace(u.Query().Get("sslmode")))
			if sslmode == "disable" {
				return errors.New("postgres sslmode=disable is not allowed in prod")
			}
		}
		if !cfg.Redis.UseTLS && !boolFromEnv("ALLOW_INSECURE_REDIS") {
			slog.Default().Warn("redis tls disabled; set redis.useTls=true or ALLOW_INSECURE_REDIS=1 when redis is on a trusted network boundary")
		}
	}

	return nil
}
