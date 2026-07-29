package gateway

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"safescholar/gateway/internal/clients"
	"safescholar/gateway/internal/contracts"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// In production, strictly check origin against your allowed CORS domains
	CheckOrigin: func(r *http.Request) bool { return true }, 
}

type WSService struct {
	aiClient clients.AIOrchestratorClient
}

func NewWSService(aiClient clients.AIOrchestratorClient) *WSService {
	return &WSService{aiClient: aiClient}
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
	if sessionID == "" {
		conn.WriteMessage(websocket.CloseMessage, []byte("Missing session ID"))
		return
	}

	for {
		// Read message from student frontend
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket read error or disconnect")
			break
		}

		// The raw payload 'p' is expected to be a JSON string of the prompt.
		// NOTE: In a real system, pass this through your modClient first!
		req := &contracts.AICompletionRequest{
			ToolID: "socratic_tutor",
			SessionID: sessionID,
			Parameters: map[string]interface{}{
				"user_prompt": string(p),
			},
		}

		// Send to Orchestrator (Synchronous for now, but should ideally stream via gRPC)
		resp, err := ws.aiClient.ExecutePrompt(r.Context(), req)
		if err != nil {
			conn.WriteMessage(messageType, []byte(`{"error": "AI Service failure"}`))
			continue
		}

		// Write the AI output back to the student
		if err := conn.WriteMessage(messageType, []byte(resp.ResponseText)); err != nil {
			log.Println("Failed to write to WebSocket")
			break
		}
	}
}