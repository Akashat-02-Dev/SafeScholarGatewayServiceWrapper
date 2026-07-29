package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"safescholar/gateway/internal/contracts"
	"safescholar/gateway/internal/security"
)

type ContentModerator interface {
	CheckContent(ctx context.Context, req *contracts.ModerationCheckRequest) (*contracts.ModerationCheckResponse, error)
}

// AIModerationMiddleware acts as a Synchronous Inline Filter Pipeline
func AIModerationMiddleware(modClient ContentModerator, logger *security.AuditLogger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			
			// 1. Read the body without destroying the buffer
			bodyBytes, _ := io.ReadAll(r.Body)
			r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

			var aiReq contracts.AICompletionRequest
			if err := json.Unmarshal(bodyBytes, &aiReq); err != nil {
				http.Error(w, "Invalid AI request payload", http.StatusBadRequest)
				return
			}

			// Extract UserID and Role from Context (Injected by authMiddleware.go)
			uc := UserContextFromContext(r.Context())
			userID := uc.UserID

			isStudent := false
			for _, role := range uc.Roles {
				if strings.ToLower(strings.TrimSpace(role)) == "student" {
					isStudent = true
					break
				}
			}

			// 2. We only strictly moderate Student Workspace tools
			if isStudent && aiReq.ToolID == "socratic_tutor" {
				
				// Extract the prompt from the dynamic parameters
				promptRaw, exists := aiReq.Parameters["user_prompt"]
				if !exists {
					http.Error(w, "user_prompt parameter missing", http.StatusBadRequest)
					return
				}

				promptStr, ok := promptRaw.(string)
				if !ok {
					http.Error(w, "user_prompt parameter must be string", http.StatusBadRequest)
					return
				}

				modReq := &contracts.ModerationCheckRequest{
					UserID:    userID,
					InputText: promptStr,
					Role:      "student",
				}

				// 3. Call the Moderation Microservice (Presidio/Classifier)
				modResp, err := modClient.CheckContent(r.Context(), modReq)
				if err != nil {
					// Fail closed: If moderation is down, do not allow AI requests
					if logger != nil {
						_ = logger.Log(r.Context(), security.AuditEvent{
							UserID:    userID,
							Action:    "MODERATION_SERVICE_UNAVAILABLE",
							IPAddress: r.RemoteAddr,
							CreatedAt: time.Now().UTC(),
						})
					}
					http.Error(w, "Safety systems temporarily unavailable", http.StatusServiceUnavailable)
					return
				}

				// 4. Block malicious intents
				if modResp.IsFlagged {
					if logger != nil {
						_ = logger.Log(r.Context(), security.AuditEvent{
							UserID:    userID,
							Action:    "STUDENT_AI_FLAGGED",
							IPAddress: r.RemoteAddr,
							Metadata:  map[string]any{"payload": string(bodyBytes)},
							CreatedAt: time.Now().UTC(),
						})
					}
					http.Error(w, "Your request violates safety guidelines and has been logged.", http.StatusForbidden)
					return
				}

				// 5. Hydrate request with PII-Scrubbed text
				aiReq.Parameters["user_prompt"] = modResp.ScrubbedText
				
				// Re-encode body for downstream proxying
				newBodyBytes, _ := json.Marshal(aiReq)
				r.Body = io.NopCloser(bytes.NewBuffer(newBodyBytes))
				r.ContentLength = int64(len(newBodyBytes))
			}

			// Proceed to the AI Orchestrator Reverse Proxy
			next.ServeHTTP(w, r)
		})
	}
}