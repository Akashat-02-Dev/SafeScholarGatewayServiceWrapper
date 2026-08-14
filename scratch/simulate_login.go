//go:build ignore

package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/cache"
	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/security"
)

func main() {
	ctx := context.Background()
	os.Setenv("CONFIG_PATH", "d:\\Project\\SafeScholarGatewayWrapper\\SafeScholarGatewayServiceWrapper\\config\\config.dev.yaml")
	os.Setenv("APP_ENV", "dev")
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Load config: %v\n", err)
		return
	}
	
	pool, err := database.Connect(ctx, cfg.Postgres)
	if err != nil {
		fmt.Printf("Connect: %v\n", err)
		return
	}
	defer pool.Close()
	
	rdb, err := cache.Connect(ctx, cfg.Redis)
	if err != nil {
		fmt.Printf("Redis: %v\n", err)
		return
	}

	jwtManager, _ := security.NewJWTManager(cfg.JWT.Issuer, cfg.JWT.Audience, cfg.JWT.PrivateKeyPEMFile, cfg.JWT.PublicKeyPEMFile, cfg.JWT.ClockSkew)
	tokenGen := auth.NewTokenGenerator(jwtManager, pool)
	sessionManager := auth.NewSessionManager(rdb, pool)
	auditLogger := security.NewAuditLogger(cfg.Audit.Enabled, pool)
	authService := auth.NewAuthService(pool, rdb, sessionManager, tokenGen, auditLogger)

	res, err := authService.Login(ctx, "demo@student", "password123", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
	if err != nil {
		fmt.Printf("Login: %v\n", err)
		return
	}
	
	fmt.Printf("TOKEN=%s\n", res.AccessToken)
}
