package plugins

import (
	"strings"
	"time"
)

type PluginCategory string

const (
	CategoryCore         PluginCategory = "core"
	CategoryAIEducation  PluginCategory = "ai_education"
	CategoryMicroservice PluginCategory = "microservice"
	CategoryGovernance   PluginCategory = "governance"
	CategoryIntegration  PluginCategory = "integration"
	CategoryCustom       PluginCategory = "custom"
)

type PluginStatus string

const (
	StatusActive      PluginStatus = "active"
	StatusDegraded    PluginStatus = "degraded"
	StatusCircuitOpen PluginStatus = "circuit_open"
	StatusDisabled    PluginStatus = "disabled"
)

type CircuitState string

const (
	CircuitClosed   CircuitState = "CLOSED"
	CircuitOpen     CircuitState = "OPEN"
	CircuitHalfOpen CircuitState = "HALF_OPEN"
)

type Plugin struct {
	ID                     string         `json:"id"`
	Name                   string         `json:"name"`
	Category               PluginCategory `json:"category"`
	Version                string         `json:"version"`
	Description            string         `json:"description"`
	Enabled                bool           `json:"enabled"`
	IsSystem               bool           `json:"isSystem"`
	TargetService          string         `json:"targetService"`
	TargetURL              string         `json:"targetUrl,omitempty"`
	EndpointPrefix         string         `json:"endpointPrefix"`
	RequiredPermission    string         `json:"requiredPermission"`
	FailureThreshold       int            `json:"failureThreshold"`
	TimeoutSeconds         int            `json:"timeoutSeconds"`
	CooldownSeconds        int            `json:"cooldownSeconds"`
	FallbackMode           string         `json:"fallbackMode"` // "graceful_fallback", "offline_template", "fail_fast"
	CustomFallbackPayload  string         `json:"customFallbackPayload,omitempty"`
	CreatedAt              time.Time      `json:"createdAt"`
	UpdatedAt              time.Time      `json:"updatedAt"`

	// Runtime Circuit Breaker & Health metrics (in-memory)
	CircuitBreaker *CircuitBreaker `json:"-"`
}

type PluginView struct {
	ID                     string         `json:"id"`
	Name                   string         `json:"name"`
	Category               PluginCategory `json:"category"`
	Version                string         `json:"version"`
	Description            string         `json:"description"`
	Enabled                bool           `json:"enabled"`
	IsSystem               bool           `json:"isSystem"`
	Status                 PluginStatus   `json:"status"`
	TargetService          string         `json:"targetService"`
	TargetURL              string         `json:"targetUrl,omitempty"`
	EndpointPrefix         string         `json:"endpointPrefix"`
	RequiredPermission    string         `json:"requiredPermission"`
	FailureThreshold       int            `json:"failureThreshold"`
	TimeoutSeconds         int            `json:"timeoutSeconds"`
	CooldownSeconds        int            `json:"cooldownSeconds"`
	FallbackMode           string         `json:"fallbackMode"`
	CustomFallbackPayload  string         `json:"customFallbackPayload,omitempty"`

	// Circuit breaker runtime telemetry
	CircuitState        CircuitState `json:"circuitState"`
	ConsecutiveFailures int          `json:"consecutiveFailures"`
	TotalRequests       int64        `json:"totalRequests"`
	TotalFailures       int64        `json:"totalFailures"`
	TotalSuccesses      int64        `json:"totalSuccesses"`
	LastFailureTime     *time.Time   `json:"lastFailureTime,omitempty"`
	LastSuccessTime     *time.Time   `json:"lastSuccessTime,omitempty"`
	LastStateChange     time.Time    `json:"lastStateChange"`
	AvgLatencyMs        float64      `json:"avgLatencyMs"`
	TenantOverride      *bool        `json:"tenantOverride,omitempty"`
}

type CreatePluginRequest struct {
	ID                    string         `json:"id"`
	Name                  string         `json:"name"`
	Category              PluginCategory `json:"category"`
	Version               string         `json:"version"`
	Description           string         `json:"description"`
	Enabled               bool           `json:"enabled"`
	TargetService         string         `json:"targetService"`
	TargetURL             string         `json:"targetUrl"`
	EndpointPrefix        string         `json:"endpointPrefix"`
	RequiredPermission   string         `json:"requiredPermission"`
	FailureThreshold      int            `json:"failureThreshold"`
	TimeoutSeconds        int            `json:"timeoutSeconds"`
	CooldownSeconds       int            `json:"cooldownSeconds"`
	FallbackMode          string         `json:"fallbackMode"`
	CustomFallbackPayload string         `json:"customFallbackPayload"`
}

type UpdatePluginRequest struct {
	PluginID              string         `json:"pluginId"`
	Name                  string         `json:"name"`
	Category              PluginCategory `json:"category"`
	Version               string         `json:"version"`
	Description           string         `json:"description"`
	Enabled               bool           `json:"enabled"`
	TargetService         string         `json:"targetService"`
	TargetURL             string         `json:"targetUrl"`
	EndpointPrefix        string         `json:"endpointPrefix"`
	RequiredPermission   string         `json:"requiredPermission"`
	FailureThreshold      int            `json:"failureThreshold"`
	TimeoutSeconds        int            `json:"timeoutSeconds"`
	CooldownSeconds       int            `json:"cooldownSeconds"`
	FallbackMode          string         `json:"fallbackMode"`
	CustomFallbackPayload string         `json:"customFallbackPayload"`
}

type DeletePluginRequest struct {
	PluginID string `json:"pluginId"`
}

type UpdatePluginConfigRequest struct {
	PluginID         string `json:"pluginId"`
	FailureThreshold int    `json:"failureThreshold"`
	TimeoutSeconds   int    `json:"timeoutSeconds"`
	CooldownSeconds  int    `json:"cooldownSeconds"`
	FallbackMode     string `json:"fallbackMode"`
}

type TogglePluginRequest struct {
	PluginID string `json:"pluginId"`
	Enabled  bool   `json:"enabled"`
}

type TenantOverrideRequest struct {
	InstitutionID string `json:"institutionId"`
	PluginID      string `json:"pluginId"`
	Enabled       bool   `json:"enabled"`
}

type ResetCircuitRequest struct {
	PluginID string `json:"pluginId"`
}

func (p *Plugin) Normalize() {
	p.ID = strings.ToLower(strings.TrimSpace(p.ID))
	p.Name = strings.TrimSpace(p.Name)
	p.Version = strings.TrimSpace(p.Version)
	if p.Version == "" {
		p.Version = "1.0.0"
	}
	p.Description = strings.TrimSpace(p.Description)
	p.TargetService = strings.ToLower(strings.TrimSpace(p.TargetService))
	if p.TargetService == "" {
		p.TargetService = "ai-orchestrator"
	}
	p.TargetURL = strings.TrimSpace(p.TargetURL)
	p.EndpointPrefix = strings.TrimSpace(p.EndpointPrefix)
	p.RequiredPermission = strings.ToUpper(strings.TrimSpace(p.RequiredPermission))
	p.FallbackMode = strings.ToLower(strings.TrimSpace(p.FallbackMode))
	if p.FailureThreshold <= 0 {
		p.FailureThreshold = 3
	}
	if p.TimeoutSeconds <= 0 {
		p.TimeoutSeconds = 20
	}
	if p.CooldownSeconds <= 0 {
		p.CooldownSeconds = 30
	}
	if p.FallbackMode == "" {
		p.FallbackMode = "graceful_fallback"
	}
}
