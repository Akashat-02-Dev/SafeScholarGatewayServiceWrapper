//go:build ignore

package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
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
		fmt.Printf("Connect DB: %v\n", err)
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

	// Since we changed demo@localhost password to Password123! in the browser test
	res, err := authService.Login(ctx, "demo@localhost", "Password123!", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
	if err != nil {
		fmt.Printf("Login failed (try password123): %v\n", err)
		res, err = authService.Login(ctx, "demo@localhost", "password123", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
		if err != nil {
			fmt.Printf("Fallback login failed: %v\n", err)
			return
		}
	}
	
	token := res.AccessToken
	fmt.Printf("Successfully logged in as demo@localhost.\n")

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Timeout: 15 * time.Second, Transport: tr}

	endpoints := []struct {
		method string
		path   string
		body   any
	}{
		{"GET", "/api/v1/dashboard/metrics", nil},
		{"GET", "/api/admin/users", nil},
		{"GET", "/api/admin/users/approvals", nil},
		{"GET", "/api/admin/roles", nil},
		{"GET", "/api/v1/rag/documents", nil},
		{"GET", "/api/v1/bots/list", nil},
		{"POST", "/api/moderation/moderation/actions", map[string]string{"contentId": "123", "action": "flag", "reason": "test"}},
	}

	for _, ep := range endpoints {
		fmt.Printf("\n--- Testing %s %s ---\n", ep.method, ep.path)
		
		var reqBody io.Reader
		if ep.body != nil {
			b, _ := json.Marshal(ep.body)
			reqBody = bytes.NewBuffer(b)
		}
		
		req, err := http.NewRequest(ep.method, "http://localhost:8080"+ep.path, reqBody)
		if err != nil {
			fmt.Printf("Req Error: %v\n", err)
			continue
		}
		
		req.Header.Set("Authorization", "Bearer "+token)
		if ep.body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		
		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("HTTP Error: %v\n", err)
			continue
		}
		
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		
		fmt.Printf("Status: %s\n", resp.Status)
		if len(body) > 300 {
			fmt.Printf("Body: %s...\n", body[:300])
		} else {
			fmt.Printf("Body: %s\n", body)
		}
	}
}
