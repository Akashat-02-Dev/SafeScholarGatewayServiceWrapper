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

	res, err := authService.Login(ctx, "demo@localhost", "password123", net.ParseIP("127.0.0.1"), "test-agent", "corr-123", time.Hour, 24*time.Hour)
	if err != nil {
		fmt.Printf("Login failed: %v\n", err)
		return
	}
	
	token := res.AccessToken
	fmt.Printf("Successfully logged in as demo@localhost.\n")

	testEndpoint := func(name, url string, payload map[string]interface{}) {
		fmt.Printf("\n--- Testing %s ---\n", name)
		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest("POST", "http://localhost:8080"+url, bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)

		client := &http.Client{
			Timeout: 15 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		}

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("Status: %s\n", resp.Status)
		fmt.Printf("Response: %s\n", string(respBody))
	}

	testEndpoint("Lesson Planner", "/api/v1/ai/educator/lesson-planner", map[string]interface{}{
		"tool_id": "lesson_planner",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"topic": "Photosynthesis",
			"grade_level": "Grade 6",
			"standard_code": "MS-LS1-1",
		},
	})

	testEndpoint("Text Leveler", "/api/v1/ai/educator/leveler", map[string]interface{}{
		"tool_id": "leveler",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"user_prompt": "Photosynthesis is the process by which plants use sunlight to synthesize foods.",
			"target_grade": "Grade 2",
		},
	})
	
	testEndpoint("Video Assessor", "/api/v1/ai/educator/video-question-maker", map[string]interface{}{
		"tool_id": "video_question_maker",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"grade_level": "Grade 6",
			"question_count": 3,
			"user_prompt": "Generate questions",
		},
	})

	testEndpoint("IEP Generator", "/api/v1/ai/educator/iep-generator", map[string]interface{}{
		"tool_id": "iep_generator",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"user_prompt": "IEP for student with ADHD",
		},
	})

	testEndpoint("Writing Feedback", "/api/v1/ai/student/writing-feedback", map[string]interface{}{
		"tool_id": "writing_feedback",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"draft_text": "I is going to the store.",
		},
	})

	testEndpoint("Quiz Generator", "/api/v1/ai/student/quiz-generator", map[string]interface{}{
		"tool_id": "quiz_generator",
		"institution_id": "db09ec74-14b5-4f03-b00a-318c24333d73",
		"parameters": map[string]interface{}{
			"topic": "Photosynthesis",
			"grade_level": "Grade 6",
			"question_count": 3,
		},
	})
}
