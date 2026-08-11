package gateway

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/security"
)

type OversightService struct {
	redisClient *redis.Client
}

func NewOversightService(redisClient *redis.Client) *OversightService {
	return &OversightService{redisClient: redisClient}
}

type FreezeRequest struct {
	SessionID string `json:"session_id" validate:"required"`
	Freeze    bool   `json:"freeze"`
}

// HandleOversightStream streams real-time student activity events to the teacher console
func (s *OversightService) HandleOversightStream(w http.ResponseWriter, r *http.Request) {
	// 1. Upgrade connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade oversight stream: %v", err)
		return
	}
	defer conn.Close()

	// Start read pump to discard student/client messages and process control frames (Ping, Close)
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()

	// 2. Validate tenant (Multi-Tenancy check)
	uc := middleware.UserContextFromContext(r.Context())
	teacherInstitution := uc.InstitutionID

	// 3. Subscribe to Redis student_session_events channel
	pubsub := s.redisClient.Subscribe(r.Context(), "student_session_events")
	defer pubsub.Close()

	ch := pubsub.Channel()

	// Keep-alive ping ticker
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	go func() {
		for range ticker.C {
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}()

	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}

			// Parse event to enforce multi-tenant boundary (only relay events of the same institution)
			var event StudentSessionEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err == nil {
				if event.InstitutionID == teacherInstitution {
					if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
						log.Printf("Failed to write to oversight websocket: %v", err)
						return
					}
				}
			}
		case <-r.Context().Done():
			return
		}
	}
}

// HandleOversightFreeze sets or clears the student session suspension flag in Redis
func (s *OversightService) HandleOversightFreeze(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	var req FreezeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if req.SessionID == "" {
		security.WriteJSONError(w, http.StatusBadRequest, "session_id required")
		return
	}

	key := "student_freeze_state:" + req.SessionID
	ctx := r.Context()

	if req.Freeze {
		// Set freeze flag for 12 hours (session auto-suspension lifetime)
		if err := s.redisClient.Set(ctx, key, true, 12*time.Hour).Err(); err != nil {
			security.WriteJSONError(w, http.StatusInternalServerError, "Failed to apply suspension in cache")
			return
		}
	} else {
		if err := s.redisClient.Del(ctx, key).Err(); err != nil {
			security.WriteJSONError(w, http.StatusInternalServerError, "Failed to lift suspension in cache")
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success","message":"Session freeze state updated successfully"}`))
}
