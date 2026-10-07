package gateway

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"safescholar/gateway/internal/clients"
	"safescholar/gateway/internal/contracts"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/security"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WSService struct {
	aiClient    clients.AIOrchestratorClient
	redisClient *redis.Client
	modClient   *clients.ModerationClient
	auditLogger *security.AuditLogger
}

func NewWSService(
	aiClient clients.AIOrchestratorClient,
	redisClient *redis.Client,
	modClient *clients.ModerationClient,
	auditLogger *security.AuditLogger,
) *WSService {
	return &WSService{
		aiClient:    aiClient,
		redisClient: redisClient,
		modClient:   modClient,
		auditLogger: auditLogger,
	}
}

type StudentSessionEvent struct {
	SessionID     string `json:"session_id"`
	InstitutionID string `json:"institution_id"`
	StudentID     string `json:"student_id"`
	Prompt        string `json:"prompt"`
	Response      string `json:"response"`
	Timestamp     string `json:"timestamp"`
	Sentiment     string `json:"sentiment"`
	IsFlagged     bool   `json:"is_flagged"`
}

// Simple heuristic to determine student sentiment
func detectSentiment(prompt string) string {
	lower := strings.ToLower(prompt)
	if strings.Contains(lower, "stuck") || strings.Contains(lower, "frustrated") || strings.Contains(lower, "hard") || strings.Contains(lower, "don't understand") || strings.Contains(lower, "hate") || strings.Contains(lower, "confused") {
		return "frustrated"
	}
	if strings.Contains(lower, "thanks") || strings.Contains(lower, "thank you") || strings.Contains(lower, "helper") || strings.Contains(lower, "understand now") || strings.Contains(lower, "got it") || strings.Contains(lower, "awesome") {
		return "positive"
	}
	return "neutral"
}

// HandleStudentSession manages a long-lived, stateful WebSocket connection
func (ws *WSService) HandleStudentSession(w http.ResponseWriter, r *http.Request) {
	// 1. Upgrade HTTP to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer conn.Close()

	// 2. Extract Session Context (Requires Auth Middleware execution prior to routing)
	sessionID := r.URL.Query().Get("session_id")
	botID := r.URL.Query().Get("bot_id")
	botType := r.URL.Query().Get("bot_type")
	if sessionID == "" {
		_ = conn.WriteMessage(websocket.CloseMessage, []byte("Missing session ID"))
		return
	}

	uc := middleware.UserContextFromContext(r.Context())
	studentID := uc.UserID
	institutionID := uc.InstitutionID

	for {
		// Read message from student frontend
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket read error or disconnect")
			break
		}

		userPrompt := string(p)

		// A. Check if the session has been frozen by the teacher
		if ws.redisClient != nil {
			isFrozen, err := ws.redisClient.Get(r.Context(), "student_freeze_state:"+sessionID).Bool()
			if err == nil && isFrozen {
				errMsg := `{"error": "Session Suspension Active", "message": "Your AI session has been temporarily suspended by an instructor."}`
				_ = conn.WriteMessage(websocket.TextMessage, []byte(errMsg))
				continue
			}
		}

		// B. Run Inline Content Moderation on the user prompt
		isFlagged := false
		scrubbedPrompt := userPrompt
		if ws.modClient != nil {
			modReq := &contracts.ModerationCheckRequest{
				UserID:    studentID,
				InputText: userPrompt,
				Role:      "student",
			}
			modResp, err := ws.modClient.CheckContent(r.Context(), modReq)
			if err == nil {
				if modResp.IsFlagged {
					isFlagged = true
					errMsg := `{"error": "Moderation Warning", "message": "Your prompt was flagged as unsafe by the school safety filters. Please try again with appropriate language."}`
					_ = conn.WriteMessage(websocket.TextMessage, []byte(errMsg))
					
					// Publish flagged event even if we block the prompt
					if ws.redisClient != nil {
						event := StudentSessionEvent{
							SessionID:     sessionID,
							InstitutionID: institutionID,
							StudentID:     studentID,
							Prompt:        userPrompt,
							Response:      "[Blocked by safety filter]",
							Timestamp:     time.Now().Format(time.RFC3339),
							Sentiment:     "negative",
							IsFlagged:     true,
						}
						eventJSON, _ := json.Marshal(event)
						_ = ws.redisClient.Publish(r.Context(), "student_session_events", eventJSON).Err()
					}
					continue
				}
				if modResp.ScrubbedText != "" {
					scrubbedPrompt = modResp.ScrubbedText
				}
			}
		}

		toolID := "socratic_tutor"
		switch botType {
		case "character":
			toolID = "character_bot"
		case "custom":
			toolID = "custom_bot"
		case "research":
			toolID = "research_assistant" // If needed later
		}

		// C. Prepare prompt payload for the AI Orchestrator
		params := map[string]interface{}{
			"user_prompt":   scrubbedPrompt,
			"student_id":    studentID,
			"session_id":    sessionID,
			"bot_id":        botID,
			"bot_type":      botType,
			"grade_level":   "Middle School", // default/fallback
			"subject_topic": "General Study",
			"chat_history":  "",
		}

		if toolID == "character_bot" {
			params["character_name"] = "Albert Einstein"
			params["context"] = "the 20th century as a renowned theoretical physicist"
		}

		req := &contracts.AICompletionRequest{
			ToolID:        toolID,
			SessionID:     sessionID,
			InstitutionID: institutionID,
			Parameters:    params,
		}

		// Send to Orchestrator
		resp, err := ws.aiClient.ExecutePrompt(r.Context(), req)
		if err != nil {
			_ = conn.WriteMessage(messageType, []byte(`{"error": "AI Service failure", "message": "The Socratic tutor is currently offline. Please try again later."}`))
			continue
		}

		// Write the AI output back to the student (JSON if citations are present, else plain text)
		var wsResp []byte
		if resp.Metadata != nil && resp.Metadata["citations"] != "" {
			payload := map[string]string{
				"text":           resp.ResponseText,
				"citations_json": resp.Metadata["citations"],
				"confidence":     resp.Metadata["confidence_score"],
			}
			wsResp, _ = json.Marshal(payload)
		} else {
			wsResp = []byte(resp.ResponseText)
		}

		if err := conn.WriteMessage(messageType, wsResp); err != nil {
			log.Println("Failed to write to WebSocket")
			break
		}

		// D. Publish the real-time event to Redis for teacher oversight
		if ws.redisClient != nil {
			event := StudentSessionEvent{
				SessionID:     sessionID,
				InstitutionID: institutionID,
				StudentID:     studentID,
				Prompt:        userPrompt,
				Response:      resp.ResponseText,
				Timestamp:     time.Now().Format(time.RFC3339),
				Sentiment:     detectSentiment(userPrompt),
				IsFlagged:     isFlagged,
			}
			eventJSON, err := json.Marshal(event)
			if err == nil {
				_ = ws.redisClient.Publish(r.Context(), "student_session_events", eventJSON).Err()
			}
		}
	}
}