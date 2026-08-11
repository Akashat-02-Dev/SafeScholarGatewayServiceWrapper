package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"safescholar/gateway/internal/contracts"
	"safescholar/gateway/internal/security"
)

type AIOrchestratorClient interface {
	ExecutePrompt(ctx context.Context, req *contracts.AICompletionRequest) (*contracts.AICompletionResponse, error)
}

type aiOrchestratorClientImpl struct {
	httpClient *http.Client
	baseURL    string
	auditLog   *security.AuditLogger
}

func NewAIOrchestratorClient(httpClient *http.Client, baseURL string, auditLog *security.AuditLogger) AIOrchestratorClient {
	return &aiOrchestratorClientImpl{
		httpClient: httpClient,
		baseURL:    baseURL,
		auditLog:   auditLog,
	}
}

func (c *aiOrchestratorClientImpl) ExecutePrompt(ctx context.Context, req *contracts.AICompletionRequest) (*contracts.AICompletionResponse, error) {
	endpoint := fmt.Sprintf("%s/v1/orchestrate", c.baseURL)
	
	bodyBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	// Ensure the request has a strict 120-second context timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(timeoutCtx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		// Log the exact network error using c.auditLog
		if c.auditLog != nil {
			_ = c.auditLog.Log(ctx, security.AuditEvent{
				Action:     "AI_ORCHESTRATOR_CONNECT_FAILED",
				Resource:   "AI_Orchestrator",
				ResourceID: req.ToolID,
				Metadata:   map[string]any{"error": err.Error(), "endpoint": endpoint},
				CreatedAt:  time.Now(),
			})
		}
		return nil, fmt.Errorf("failed to reach AI orchestrator: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return nil, fmt.Errorf("AI orchestrator returned status %d and failed to read body", resp.StatusCode)
		}
		return nil, fmt.Errorf("AI orchestrator returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var aiResponse contracts.AICompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		return nil, errors.New("failed to unmarshal AI response payload")
	}

	return &aiResponse, nil
}