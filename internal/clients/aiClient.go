package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"safescholar/gateway/infrastructure/service_registry"
	"safescholar/gateway/internal/contracts"
)

type AIOrchestratorClient interface {
	ExecutePrompt(ctx context.Context, req *contracts.AICompletionRequest) (*contracts.AICompletionResponse, error)
}

type aiOrchestratorClientImpl struct {
	httpClient *http.Client
	registry   *service_registry.Registry
}

func NewAIOrchestratorClient(httpClient *http.Client, registry *service_registry.Registry) AIOrchestratorClient {
	return &aiOrchestratorClientImpl{
		httpClient: httpClient,
		registry:   registry,
	}
}

func (c *aiOrchestratorClientImpl) ExecutePrompt(ctx context.Context, req *contracts.AICompletionRequest) (*contracts.AICompletionResponse, error) {
	baseURL, err := c.registry.Resolve(ctx, "ai-orchestrator")
	if err != nil {
		return nil, fmt.Errorf("failed to resolve AI orchestrator address: %w", err)
	}
	endpoint := fmt.Sprintf("%s/v1/orchestrate", baseURL)
	
	bodyBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach AI orchestrator: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI orchestrator returned status %d", resp.StatusCode)
	}

	var aiResponse contracts.AICompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResponse); err != nil {
		return nil, errors.New("failed to unmarshal AI response payload")
	}

	return &aiResponse, nil
}