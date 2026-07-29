package contracts

// AICompletionRequest represents the payload expected from the frontend
type AICompletionRequest struct {
	ToolID        string                 `json:"tool_id" validate:"required"` // e.g., "lesson_planner", "socratic_tutor"
	InstitutionID string                 `json:"institution_id" validate:"required"`
	Parameters    map[string]interface{} `json:"parameters" validate:"required"` // Dynamic based on tool
	SessionID     string                 `json:"session_id,omitempty"`           // For stateful tools
}

// AICompletionResponse represents the standardized output
type AICompletionResponse struct {
	ResponseText string            `json:"response_text"`
	ModelUsed    string            `json:"model_used"`
	Tokens       TokenUsage        `json:"tokens"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ModerationCheckRequest represents the payload sent to the inline moderation engine
type ModerationCheckRequest struct {
	UserID    string `json:"user_id"`
	InputText string `json:"input_text"`
	Role      string `json:"role"` // "student", "teacher", etc.
}

// ModerationCheckResponse dictates if the gateway should drop the request
type ModerationCheckResponse struct {
	IsFlagged    bool     `json:"is_flagged"`
	Categories   []string `json:"categories,omitempty"`
	ScrubbedText string   `json:"scrubbed_text,omitempty"` // PII masked text
}
