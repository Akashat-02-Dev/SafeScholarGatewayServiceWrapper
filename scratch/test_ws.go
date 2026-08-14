//go:build ignore

package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gorilla/websocket"
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
		log.Fatalf("Load config: %v", err)
	}

	pool, err := database.Connect(ctx, cfg.Postgres)
	if err != nil {
		log.Fatalf("Connect DB: %v", err)
	}
	defer pool.Close()

	rdb, err := cache.Connect(ctx, cfg.Redis)
	if err != nil {
		log.Fatalf("Redis: %v", err)
	}

	jwtManager, _ := security.NewJWTManager(cfg.JWT.Issuer, cfg.JWT.Audience, cfg.JWT.PrivateKeyPEMFile, cfg.JWT.PublicKeyPEMFile, cfg.JWT.ClockSkew)
	tokenGen := auth.NewTokenGenerator(jwtManager, pool)
	sessionManager := auth.NewSessionManager(rdb, pool)
	auditLogger := security.NewAuditLogger(cfg.Audit.Enabled, pool)
	authService := auth.NewAuthService(pool, rdb, sessionManager, tokenGen, auditLogger)

	// Since we changed demo@localhost password to Password123! in the browser test
	res, err := authService.Login(ctx, "demo@localhost", "Password123!", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
	if err != nil {
		res, err = authService.Login(ctx, "demo@localhost", "password123", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
		if err != nil {
			log.Fatalf("Fallback login failed: %v", err)
		}
	}
	
	token := res.AccessToken
	fmt.Printf("Successfully logged in as demo@localhost.\n")

	u := url.URL{Scheme: "ws", Host: "localhost:8080", Path: "/api/v1/ai/tutor"}
	q := u.Query()
	q.Set("session_id", "test-session-123")
	u.RawQuery = q.Encode()

	headers := http.Header{}
	headers.Add("Authorization", "Bearer "+token)

	log.Printf("Connecting to %s", u.String())
	c, _, err := websocket.DefaultDialer.Dial(u.String(), headers)
	if err != nil {
		log.Fatalf("Dial error: %v", err)
	}
	defer c.Close()

	err = c.WriteMessage(websocket.TextMessage, []byte("Hello, tutor!"))
	if err != nil {
		log.Fatalf("Write error: %v", err)
	}
	
	c.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, message, err := c.ReadMessage()
	if err != nil {
		log.Fatalf("Read error: %v", err)
	}
	
	log.Printf("Received: %s", message)
}
