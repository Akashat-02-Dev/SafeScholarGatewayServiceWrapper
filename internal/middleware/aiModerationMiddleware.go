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
	"github.com/redis/go-redis/v9"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContentModerator interface {
	CheckContent(ctx context.Context, req *contracts.ModerationCheckRequest) (*contracts.ModerationCheckResponse, error)
}

// AIModerationMiddleware acts as a Synchronous Inline Filter Pipeline
func AIModerationMiddleware(modClient ContentModerator, logger *security.AuditLogger, rdb *redis.Client, db *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			
			// If it's a WebSocket upgrade request, bypass body reading/moderation in this HTTP middleware
			if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
				next.ServeHTTP(w, r)
				return
			}

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
			instID := uc.InstitutionID

			isStudent := false
			for _, role := range uc.Roles {
				if strings.ToLower(strings.TrimSpace(role)) == "student" {
					isStudent = true
					break
				}
			}

			// 2. We only strictly moderate Student Workspace tools
			if isStudent && (aiReq.ToolID == "socratic_tutor" || aiReq.ToolID == "writing_feedback" || aiReq.ToolID == "character_bot" || aiReq.ToolID == "custom_bot" || aiReq.ToolID == "quiz_generator" || aiReq.ToolID == "research_assistant") {
				
				promptRaw := aiReq.Parameters["user_prompt"]
				if promptRaw == nil {
					promptRaw = aiReq.Parameters["draft_text"]
				}
				if promptRaw == nil {
					// Some endpoints might not have user_prompt
					next.ServeHTTP(w, r)
					return
				}

				promptStr, ok := promptRaw.(string)
				if !ok {
					http.Error(w, "prompt parameter must be string", http.StatusBadRequest)
					return
				}

				// Phase 1: Dynamic Keyword Filtering with Redis Cache
				cacheKey := "mod_rules:" + instID
				rulesStr, err := rdb.Get(r.Context(), cacheKey).Result()
				
				var blockedKeywords []string
				blockedMsg := "Your request violates safety guidelines."
				
				if err == nil && rulesStr != "" {
					var cached struct {
						Keywords []string `json:"keywords"`
						Message  string   `json:"message"`
					}
					json.Unmarshal([]byte(rulesStr), &cached)
					blockedKeywords = cached.Keywords
					if cached.Message != "" {
						blockedMsg = cached.Message
					}
				} else {
					var kwRaw []byte
					var msg string
					err := db.QueryRow(r.Context(), "SELECT blocked_keywords, custom_blocked_message FROM tenant_moderation_rules WHERE institution_id = $1", instID).Scan(&kwRaw, &msg)
					if err == nil {
						json.Unmarshal(kwRaw, &blockedKeywords)
						if msg != "" {
							blockedMsg = msg
						}
						// Cache result
						cached, _ := json.Marshal(map[string]any{"keywords": blockedKeywords, "message": blockedMsg})
						rdb.Set(r.Context(), cacheKey, string(cached), 15*time.Minute)
					} else {
						// Print the error to stdout
						println("AIModeration DB Query Error:", err.Error())
					}
					println("Blocked keywords loaded:", string(kwRaw), "Parsed count:", len(blockedKeywords))
				}

				promptLower := strings.ToLower(promptStr)
				for _, kw := range blockedKeywords {
					if kw != "" && strings.Contains(promptLower, strings.ToLower(kw)) {
						if logger != nil {
							_ = logger.Log(r.Context(), security.AuditEvent{
								UserID:    userID,
								Action:    "STUDENT_AI_KEYWORD_BLOCKED",
								IPAddress: r.RemoteAddr,
								Metadata:  map[string]any{"keyword": kw},
								CreatedAt: time.Now().UTC(),
							})
						}
						security.WriteJSONError(w, http.StatusForbidden, blockedMsg)
						return
					}
				}

				modReq := &contracts.ModerationCheckRequest{
					UserID:    userID,
					InputText: promptStr,
					Role:      "student",
				}

				// 3. Call the Moderation Microservice (Presidio/Classifier)
				if modClient != nil {
					modResp, err := modClient.CheckContent(r.Context(), modReq)
					if err != nil {
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
						
						// Phase 1 Async Alert Dispatching
						security.DispatchAlert(instID, "High-Risk AI Violation Detected", promptStr)

						security.WriteJSONError(w, http.StatusForbidden, "Your request violates safety guidelines and has been logged.")
						return
					}

					// 5. Hydrate request with PII-Scrubbed text
					if aiReq.Parameters["user_prompt"] != nil {
						aiReq.Parameters["user_prompt"] = modResp.ScrubbedText
					} else if aiReq.Parameters["draft_text"] != nil {
						aiReq.Parameters["draft_text"] = modResp.ScrubbedText
					}
					
					newBodyBytes, _ := json.Marshal(aiReq)
					r.Body = io.NopCloser(bytes.NewBuffer(newBodyBytes))
					r.ContentLength = int64(len(newBodyBytes))
				}
			}

			// Proceed to the AI Orchestrator Reverse Proxy
			next.ServeHTTP(w, r)
		})
	}
}