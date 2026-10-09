package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPluginNotFound = errors.New("plugin not found")
	ErrPluginDisabled = errors.New("feature is currently disabled by administrator")
	ErrCircuitOpen    = errors.New("feature circuit breaker is open (upstream service temporarily unavailable)")
)

type PluginRegistry struct {
	mu              sync.RWMutex
	plugins         map[string]*Plugin
	tenantOverrides map[string]map[string]bool // institution_id -> (plugin_id -> enabled)
	pool            *pgxpool.Pool
	logger          *slog.Logger
}

func NewPluginRegistry(pool *pgxpool.Pool, logger *slog.Logger) *PluginRegistry {
	if logger == nil {
		logger = slog.Default()
	}
	r := &PluginRegistry{
		plugins:         make(map[string]*Plugin),
		tenantOverrides: make(map[string]map[string]bool),
		pool:            pool,
		logger:          logger,
	}

	// Initialize default core plugins in memory
	r.initDefaults()

	return r
}

func (r *PluginRegistry) initDefaults() {
	defaults := []Plugin{
		{
			ID: "lesson_planner", Name: "AI Lesson Planner", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Australian curriculum aligned lesson planning engine for Prep to Year 5",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/lesson-planner",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "socratic_tutor", Name: "Socratic AI Tutor", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Interactive Socratic teaching dialog with Australian student guardrails",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/socratic-tutor",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 20, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "quiz_me", Name: "Quiz Me Interactive", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Real-time adaptive curriculum mastery quiz generator with immediate feedback",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/quiz-me",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 20, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "quiz_generator", Name: "Quiz & Assessment Generator", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Diagnostic and formative quiz creation with scoring rubric options",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/quiz-generator",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "writing_feedback", Name: "Writing Feedback Assessor", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Detailed formative rubric evaluation of student written submissions",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/writing-feedback",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "text_leveler", Name: "Lexile & Text Leveler", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Differentiates complex texts to student reading levels across Year levels",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/leveler",
			RequiredPermission: "USE_TEXT_LEVELER", FailureThreshold: 3, TimeoutSeconds: 20, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "video_question_maker", Name: "Video Assessment Generator", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Generates time-stamped comprehension questions from video materials",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/video-question-maker",
			RequiredPermission: "USE_VIDEO_ASSESSOR", FailureThreshold: 3, TimeoutSeconds: 30, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "iep_generator", Name: "IEP & Rubric Generator", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Individualized Education Plan generator with scaffolding and adjustments",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/iep-generator",
			RequiredPermission: "GENERATE_IEP_RUBRIC", FailureThreshold: 3, TimeoutSeconds: 30, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "report_card_generator", Name: "Report Card Comment Composer", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Synthesizes formative grades into curriculum-compliant report card comments",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/report-card",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "ismg_rubric_generator", Name: "ISMG Assessment Rubric", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Instrument-Specific Marking Guide rubric generator for Australian standards",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/ismg-rubric",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "worksheet_generator", Name: "Printable Worksheet Builder", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Generates differentiated printable classroom exercises and worksheets",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/worksheet-generator",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "assessment_generator", Name: "Curriculum Assessment Creator", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Formal formative and summative assessment generation with answer keys",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/assessment-generator",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 30, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "district_knowledge_bot", Name: "District Knowledge Assistant", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "RAG assistant grounded in district curriculum documents and policies",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/educator/district-knowledge-bot",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "character_bot", Name: "Historical Character Persona", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Immersive roleplay with historical figures and literary characters",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/character-bot",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 20, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "custom_bot", Name: "Custom AI Bot Studio", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Educator-created targeted learning and subject tutor personas",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/ai/student/custom-bot",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 20, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "speech_audio", Name: "Speech & Audio Processing", Category: CategoryAIEducation,
			Version: "1.0.0", Description: "Audio transcription and sovereign voice synthesis engine",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/audio/transcribe",
			RequiredPermission: "EXECUTE_AI_TUTOR", FailureThreshold: 3, TimeoutSeconds: 30, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "rag_ingestion", Name: "District Curriculum Vector Ingestion", Category: CategoryIntegration,
			Version: "1.0.0", Description: "Processes and vectorizes district curriculum guidelines and lesson plans",
			Enabled: true, TargetService: "ai-orchestrator", EndpointPrefix: "/api/v1/rag/ingest",
			RequiredPermission: "MANAGE_DISTRICT_AI_KNOWLEDGE", FailureThreshold: 3, TimeoutSeconds: 40, CooldownSeconds: 30,
			FallbackMode: "fail_fast",
		},
		{
			ID: "worksheet_service", Name: "Worksheet Microservice Proxy", Category: CategoryMicroservice,
			Version: "1.0.0", Description: "Dedicated backend microservice for worksheet persistence and tracking",
			Enabled: true, TargetService: "worksheet", EndpointPrefix: "/api/worksheet/",
			RequiredPermission: "VIEW_WORKSHEET", FailureThreshold: 3, TimeoutSeconds: 15, CooldownSeconds: 30,
			FallbackMode: "fail_fast",
		},
		{
			ID: "assessment_service", Name: "Assessment Microservice Proxy", Category: CategoryMicroservice,
			Version: "1.0.0", Description: "Dedicated backend microservice for formal student exam assessment submissions",
			Enabled: true, TargetService: "assessment", EndpointPrefix: "/api/assessment/",
			RequiredPermission: "VIEW_ASSESSMENT", FailureThreshold: 3, TimeoutSeconds: 15, CooldownSeconds: 30,
			FallbackMode: "fail_fast",
		},
		{
			ID: "moderation_service", Name: "AI Safety Moderation Microservice", Category: CategoryMicroservice,
			Version: "1.0.0", Description: "Real-time profanity, PII scrubbing and content moderation proxy",
			Enabled: true, TargetService: "moderation", EndpointPrefix: "/api/moderation/",
			RequiredPermission: "MODERATE_CONTENT", FailureThreshold: 3, TimeoutSeconds: 10, CooldownSeconds: 30,
			FallbackMode: "graceful_fallback",
		},
		{
			ID: "lms_integration", Name: "LMS OneRoster Export Service", Category: CategoryIntegration,
			Version: "1.0.0", Description: "Canvas, Moodle, and Blackboard gradebook and roster synchronization",
			Enabled: true, TargetService: "lms-integration", EndpointPrefix: "/api/v1/lms/export",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 25, CooldownSeconds: 30,
			FallbackMode: "fail_fast",
		},
		{
			ID: "live_oversight", Name: "Live Classroom Oversight & Freeze", Category: CategoryGovernance,
			Version: "1.0.0", Description: "Real-time WebSocket telemetry stream and emergency student session freeze control",
			Enabled: true, TargetService: "internal", EndpointPrefix: "/api/v1/admin/oversight/stream",
			RequiredPermission: "GENERATE_LESSON_PLAN", FailureThreshold: 3, TimeoutSeconds: 15, CooldownSeconds: 30,
			FallbackMode: "fail_fast",
		},
	}

	for _, d := range defaults {
		plugin := d
		plugin.Normalize()
		plugin.IsSystem = true
		plugin.CircuitBreaker = NewCircuitBreaker(plugin.FailureThreshold, plugin.CooldownSeconds)
		plugin.CreatedAt = time.Now()
		plugin.UpdatedAt = time.Now()
		r.plugins[plugin.ID] = &plugin
	}
}

func (r *PluginRegistry) LoadFromDatabase(ctx context.Context) error {
	if r.pool == nil {
		return nil
	}

	rows, err := r.pool.Query(ctx, `
select plugin_id, name, category, version, coalesce(description,''), enabled, target_service,
       coalesce(target_url, ''), endpoint_prefix, coalesce(required_permission,''), failure_threshold, timeout_seconds,
       cooldown_seconds, fallback_mode, coalesce(custom_fallback_payload, ''), coalesce(is_system, false), created_at, updated_at
from system_plugins`)
	if err != nil {
		// Fallback to legacy query if migration 008 columns are not yet present
		rows, err = r.pool.Query(ctx, `
select plugin_id, name, category, version, coalesce(description,''), enabled, target_service,
       '' as target_url, endpoint_prefix, coalesce(required_permission,''), failure_threshold, timeout_seconds,
       cooldown_seconds, fallback_mode, '' as custom_fallback_payload, true as is_system, created_at, updated_at
from system_plugins`)
	}
	if err != nil {
		r.logger.Warn("Failed to query system_plugins, continuing with in-memory defaults", "error", err)
		return nil
	}
	defer rows.Close()

	r.mu.Lock()
	defer r.mu.Unlock()

	for rows.Next() {
		var p Plugin
		var cat string
		if err := rows.Scan(
			&p.ID, &p.Name, &cat, &p.Version, &p.Description, &p.Enabled,
			&p.TargetService, &p.TargetURL, &p.EndpointPrefix, &p.RequiredPermission,
			&p.FailureThreshold, &p.TimeoutSeconds, &p.CooldownSeconds,
			&p.FallbackMode, &p.CustomFallbackPayload, &p.IsSystem, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			continue
		}
		p.Category = PluginCategory(cat)
		p.Normalize()

		if existing, ok := r.plugins[p.ID]; ok {
			existing.Name = p.Name
			existing.Description = p.Description
			existing.Enabled = p.Enabled
			existing.IsSystem = p.IsSystem
			existing.TargetService = p.TargetService
			existing.TargetURL = p.TargetURL
			existing.EndpointPrefix = p.EndpointPrefix
			existing.RequiredPermission = p.RequiredPermission
			existing.FailureThreshold = p.FailureThreshold
			existing.TimeoutSeconds = p.TimeoutSeconds
			existing.CooldownSeconds = p.CooldownSeconds
			existing.FallbackMode = p.FallbackMode
			existing.CustomFallbackPayload = p.CustomFallbackPayload
			existing.UpdatedAt = p.UpdatedAt
			existing.CircuitBreaker.UpdateParams(p.FailureThreshold, p.CooldownSeconds)
		} else {
			p.CircuitBreaker = NewCircuitBreaker(p.FailureThreshold, p.CooldownSeconds)
			r.plugins[p.ID] = &p
		}
	}

	// Load tenant overrides
	overrideRows, err := r.pool.Query(ctx, `select institution_id::text, plugin_id, enabled from tenant_plugin_overrides`)
	if err == nil {
		defer overrideRows.Close()
		for overrideRows.Next() {
			var instID, pluginID string
			var enabled bool
			if err := overrideRows.Scan(&instID, &pluginID, &enabled); err == nil {
				instID = strings.TrimSpace(instID)
				pluginID = strings.ToLower(strings.TrimSpace(pluginID))
				if instID != "" && pluginID != "" {
					if _, ok := r.tenantOverrides[instID]; !ok {
						r.tenantOverrides[instID] = make(map[string]bool)
					}
					r.tenantOverrides[instID][pluginID] = enabled
				}
			}
		}
	}

	r.logger.Info("Plugin Registry successfully loaded from database", "pluginCount", len(r.plugins))
	return nil
}

func (r *PluginRegistry) GetPlugin(pluginID string) (*Plugin, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.plugins[strings.ToLower(strings.TrimSpace(pluginID))]
	return p, ok
}

func (r *PluginRegistry) IsPluginEnabled(pluginID, institutionID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	pID := strings.ToLower(strings.TrimSpace(pluginID))
	p, ok := r.plugins[pID]
	if !ok {
		return false
	}
	if !p.Enabled {
		return false
	}

	instID := strings.TrimSpace(institutionID)
	if instID != "" {
		if overrides, ok := r.tenantOverrides[instID]; ok {
			if tenantEnabled, exists := overrides[pID]; exists {
				return tenantEnabled
			}
		}
	}

	return true
}

func (r *PluginRegistry) ExecuteWithResilience(
	ctx context.Context,
	pluginID string,
	institutionID string,
	action func(ctx context.Context) (any, error),
	fallbackParams map[string]interface{},
) (result any, isFallback bool, err error) {
	pID := strings.ToLower(strings.TrimSpace(pluginID))

	r.mu.RLock()
	plugin, exists := r.plugins[pID]
	r.mu.RUnlock()

	if !exists {
		// If plugin not in registry, execute directly without circuit breaking
		res, err := action(ctx)
		return res, false, err
	}

	// 1. Tenant & Global Enabled Check
	if !r.IsPluginEnabled(pID, institutionID) {
		return nil, false, fmt.Errorf("%w: '%s'", ErrPluginDisabled, plugin.Name)
	}

	// 2. Circuit Breaker Check
	allowed, circuitState := plugin.CircuitBreaker.AllowRequest()
	if !allowed {
		r.logger.Warn("Circuit breaker OPEN for plugin", "plugin_id", pID, "state", circuitState)
		if plugin.FallbackMode == "graceful_fallback" {
			if plugin.CustomFallbackPayload != "" {
				var parsed any
				if json.Unmarshal([]byte(plugin.CustomFallbackPayload), &parsed) == nil {
					return parsed, true, nil
				}
				return map[string]any{"fallback": plugin.CustomFallbackPayload, "status": "degraded"}, true, nil
			}
			fallbackRes, ok := GenerateGracefulFallback(pID, fallbackParams)
			if ok {
				return fallbackRes, true, nil
			}
		}
		return nil, false, fmt.Errorf("%w: '%s'", ErrCircuitOpen, plugin.Name)
	}

	// 3. Execution under Plugin Timeout
	timeoutDuration := time.Duration(plugin.TimeoutSeconds) * time.Second
	execCtx, cancel := context.WithTimeout(ctx, timeoutDuration)
	defer cancel()

	start := time.Now()
	res, execErr := action(execCtx)
	elapsed := time.Since(start)

	if execErr != nil {
		r.logger.Error("Plugin upstream execution failure", "plugin_id", pID, "latency_ms", elapsed.Milliseconds(), "error", execErr)
		plugin.CircuitBreaker.RecordFailure(execErr)

		// Graceful degradation: Check if fallback is enabled
		if plugin.FallbackMode == "graceful_fallback" {
			if plugin.CustomFallbackPayload != "" {
				var parsed any
				if json.Unmarshal([]byte(plugin.CustomFallbackPayload), &parsed) == nil {
					return parsed, true, nil
				}
				return map[string]any{"fallback": plugin.CustomFallbackPayload, "status": "degraded"}, true, nil
			}
			fallbackRes, ok := GenerateGracefulFallback(pID, fallbackParams)
			if ok {
				r.logger.Info("Returning resilient educational fallback for plugin", "plugin_id", pID)
				return fallbackRes, true, nil
			}
		}

		return nil, false, execErr
	}

	// Record success
	plugin.CircuitBreaker.RecordSuccess(elapsed)
	return res, false, nil
}

func (r *PluginRegistry) ListPlugins(institutionID string) []PluginView {
	r.mu.RLock()
	defer r.mu.RUnlock()

	instID := strings.TrimSpace(institutionID)
	out := make([]PluginView, 0, len(r.plugins))

	for _, p := range r.plugins {
		stats := p.CircuitBreaker.GetStats()

		status := StatusActive
		if !p.Enabled {
			status = StatusDisabled
		} else if stats.State == CircuitOpen {
			status = StatusCircuitOpen
		} else if stats.State == CircuitHalfOpen || stats.ConsecutiveFailures > 0 {
			status = StatusDegraded
		}

		var tenantOverride *bool
		if instID != "" {
			if overrides, ok := r.tenantOverrides[instID]; ok {
				if overrideVal, exists := overrides[p.ID]; exists {
					val := overrideVal
					tenantOverride = &val
				}
			}
		}

		out = append(out, PluginView{
			ID:                     p.ID,
			Name:                   p.Name,
			Category:               p.Category,
			Version:                p.Version,
			Description:            p.Description,
			Enabled:                p.Enabled,
			IsSystem:               p.IsSystem,
			Status:                 status,
			TargetService:          p.TargetService,
			TargetURL:              p.TargetURL,
			EndpointPrefix:         p.EndpointPrefix,
			RequiredPermission:    p.RequiredPermission,
			FailureThreshold:       p.FailureThreshold,
			TimeoutSeconds:         p.TimeoutSeconds,
			CooldownSeconds:        p.CooldownSeconds,
			FallbackMode:           p.FallbackMode,
			CustomFallbackPayload:  p.CustomFallbackPayload,
			CircuitState:           stats.State,
			ConsecutiveFailures:    stats.ConsecutiveFailures,
			TotalRequests:          stats.TotalRequests,
			TotalFailures:          stats.TotalFailures,
			TotalSuccesses:         stats.TotalSuccesses,
			LastFailureTime:        stats.LastFailureTime,
			LastSuccessTime:        stats.LastSuccessTime,
			LastStateChange:        stats.LastStateChange,
			AvgLatencyMs:           stats.AvgLatencyMs,
			TenantOverride:         tenantOverride,
		})
	}

	return out
}

func (r *PluginRegistry) TogglePlugin(ctx context.Context, pluginID string, enabled bool) error {
	pID := strings.ToLower(strings.TrimSpace(pluginID))

	r.mu.Lock()
	plugin, ok := r.plugins[pID]
	if !ok {
		r.mu.Unlock()
		return ErrPluginNotFound
	}
	plugin.Enabled = enabled
	plugin.UpdatedAt = time.Now()
	r.mu.Unlock()

	if r.pool != nil {
		_, err := r.pool.Exec(ctx, `update system_plugins set enabled=$1, updated_at=now() where plugin_id=$2`, enabled, pID)
		if err != nil {
			r.logger.Error("Failed to update system_plugins enabled state in db", "error", err)
			return err
		}
	}

	return nil
}

func (r *PluginRegistry) UpdatePluginConfig(ctx context.Context, req UpdatePluginConfigRequest) error {
	pID := strings.ToLower(strings.TrimSpace(req.PluginID))

	r.mu.Lock()
	plugin, ok := r.plugins[pID]
	if !ok {
		r.mu.Unlock()
		return ErrPluginNotFound
	}

	if req.FailureThreshold > 0 {
		plugin.FailureThreshold = req.FailureThreshold
	}
	if req.TimeoutSeconds > 0 {
		plugin.TimeoutSeconds = req.TimeoutSeconds
	}
	if req.CooldownSeconds > 0 {
		plugin.CooldownSeconds = req.CooldownSeconds
	}
	if req.FallbackMode != "" {
		plugin.FallbackMode = strings.ToLower(strings.TrimSpace(req.FallbackMode))
	}
	plugin.UpdatedAt = time.Now()
	plugin.CircuitBreaker.UpdateParams(plugin.FailureThreshold, plugin.CooldownSeconds)
	r.mu.Unlock()

	if r.pool != nil {
		_, err := r.pool.Exec(ctx, `
update system_plugins
set failure_threshold=$1, timeout_seconds=$2, cooldown_seconds=$3, fallback_mode=$4, updated_at=now()
where plugin_id=$5`,
			plugin.FailureThreshold, plugin.TimeoutSeconds, plugin.CooldownSeconds, plugin.FallbackMode, pID,
		)
		if err != nil {
			r.logger.Error("Failed to update system_plugins in db", "error", err)
			return err
		}
	}

	return nil
}

func (r *PluginRegistry) ResetCircuit(pluginID string) bool {
	pID := strings.ToLower(strings.TrimSpace(pluginID))

	r.mu.RLock()
	plugin, ok := r.plugins[pID]
	r.mu.RUnlock()

	if !ok {
		return false
	}
	plugin.CircuitBreaker.Reset()
	return true
}

func (r *PluginRegistry) SetTenantOverride(ctx context.Context, institutionID string, pluginID string, enabled bool) error {
	instID := strings.TrimSpace(institutionID)
	pID := strings.ToLower(strings.TrimSpace(pluginID))

	if instID == "" || pID == "" {
		return errors.New("institutionId and pluginId required")
	}

	r.mu.Lock()
	if _, ok := r.tenantOverrides[instID]; !ok {
		r.tenantOverrides[instID] = make(map[string]bool)
	}
	r.tenantOverrides[instID][pID] = enabled
	r.mu.Unlock()

	if r.pool != nil {
		_, err := r.pool.Exec(ctx, `
insert into tenant_plugin_overrides(institution_id, plugin_id, enabled, updated_at)
values ($1::uuid, $2, $3, now())
on conflict (institution_id, plugin_id) do update set enabled=excluded.enabled, updated_at=now()`,
			instID, pID, enabled,
		)
		if err != nil {
			r.logger.Error("Failed to save tenant_plugin_overrides in db", "error", err)
			return err
		}
	}

	return nil
}

func (r *PluginRegistry) CreatePlugin(ctx context.Context, req CreatePluginRequest) (*Plugin, error) {
	pID := strings.ToLower(strings.TrimSpace(req.ID))
	if pID == "" {
		slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(req.Name), " ", "_"))
		pID = slug
	}
	if pID == "" {
		return nil, errors.New("plugin ID or Name is required")
	}
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("plugin Name is required")
	}
	if strings.TrimSpace(req.EndpointPrefix) == "" {
		return nil, errors.New("endpointPrefix is required")
	}

	p := Plugin{
		ID:                    pID,
		Name:                  req.Name,
		Category:              req.Category,
		Version:               req.Version,
		Description:           req.Description,
		Enabled:               req.Enabled,
		IsSystem:              false,
		TargetService:         req.TargetService,
		TargetURL:             req.TargetURL,
		EndpointPrefix:        req.EndpointPrefix,
		RequiredPermission:   req.RequiredPermission,
		FailureThreshold:      req.FailureThreshold,
		TimeoutSeconds:        req.TimeoutSeconds,
		CooldownSeconds:       req.CooldownSeconds,
		FallbackMode:          req.FallbackMode,
		CustomFallbackPayload: req.CustomFallbackPayload,
		CreatedAt:             time.Now(),
		UpdatedAt:             time.Now(),
	}
	p.Normalize()
	p.CircuitBreaker = NewCircuitBreaker(p.FailureThreshold, p.CooldownSeconds)

	r.mu.Lock()
	if _, exists := r.plugins[p.ID]; exists {
		r.mu.Unlock()
		return nil, fmt.Errorf("plugin '%s' already exists", p.ID)
	}
	r.plugins[p.ID] = &p
	r.mu.Unlock()

	if r.pool != nil {
		_, err := r.pool.Exec(ctx, `
insert into system_plugins (
  plugin_id, name, category, version, description, enabled, is_system,
  target_service, target_url, endpoint_prefix, required_permission,
  failure_threshold, timeout_seconds, cooldown_seconds, fallback_mode, custom_fallback_payload,
  created_at, updated_at
) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now())
on conflict (plugin_id) do update set
  name=excluded.name, description=excluded.description, enabled=excluded.enabled,
  target_service=excluded.target_service, target_url=excluded.target_url, endpoint_prefix=excluded.endpoint_prefix,
  required_permission=excluded.required_permission, failure_threshold=excluded.failure_threshold,
  timeout_seconds=excluded.timeout_seconds, cooldown_seconds=excluded.cooldown_seconds,
  fallback_mode=excluded.fallback_mode, custom_fallback_payload=excluded.custom_fallback_payload,
  updated_at=now()`,
			p.ID, p.Name, string(p.Category), p.Version, p.Description, p.Enabled, false,
			p.TargetService, p.TargetURL, p.EndpointPrefix, p.RequiredPermission,
			p.FailureThreshold, p.TimeoutSeconds, p.CooldownSeconds, p.FallbackMode, p.CustomFallbackPayload,
		)
		if err != nil {
			r.logger.Error("Failed to persist new plugin in db", "plugin_id", p.ID, "error", err)
			return nil, err
		}

		if p.RequiredPermission != "" {
			_, _ = r.pool.Exec(ctx, `
insert into permissions (code, description, immutable)
values ($1, $2, false)
on conflict (code) do nothing`,
				p.RequiredPermission, fmt.Sprintf("Access to custom feature %s", p.Name),
			)
		}
	}

	return &p, nil
}

func (r *PluginRegistry) UpdatePlugin(ctx context.Context, req UpdatePluginRequest) error {
	pID := strings.ToLower(strings.TrimSpace(req.PluginID))
	if pID == "" {
		return errors.New("pluginId is required")
	}

	r.mu.Lock()
	p, exists := r.plugins[pID]
	if !exists {
		r.mu.Unlock()
		return ErrPluginNotFound
	}

	if req.Name != "" {
		p.Name = strings.TrimSpace(req.Name)
	}
	if req.Category != "" {
		p.Category = req.Category
	}
	if req.Version != "" {
		p.Version = strings.TrimSpace(req.Version)
	}
	p.Description = strings.TrimSpace(req.Description)
	p.Enabled = req.Enabled
	if req.TargetService != "" {
		p.TargetService = strings.ToLower(strings.TrimSpace(req.TargetService))
	}
	p.TargetURL = strings.TrimSpace(req.TargetURL)
	if req.EndpointPrefix != "" {
		p.EndpointPrefix = strings.TrimSpace(req.EndpointPrefix)
	}
	p.RequiredPermission = strings.ToUpper(strings.TrimSpace(req.RequiredPermission))
	if req.FailureThreshold > 0 {
		p.FailureThreshold = req.FailureThreshold
	}
	if req.TimeoutSeconds > 0 {
		p.TimeoutSeconds = req.TimeoutSeconds
	}
	if req.CooldownSeconds > 0 {
		p.CooldownSeconds = req.CooldownSeconds
	}
	if req.FallbackMode != "" {
		p.FallbackMode = strings.ToLower(strings.TrimSpace(req.FallbackMode))
	}
	p.CustomFallbackPayload = strings.TrimSpace(req.CustomFallbackPayload)
	p.UpdatedAt = time.Now()
	p.CircuitBreaker.UpdateParams(p.FailureThreshold, p.CooldownSeconds)
	r.mu.Unlock()

	if r.pool != nil {
		_, err := r.pool.Exec(ctx, `
update system_plugins set
  name=$1, category=$2, version=$3, description=$4, enabled=$5,
  target_service=$6, target_url=$7, endpoint_prefix=$8, required_permission=$9,
  failure_threshold=$10, timeout_seconds=$11, cooldown_seconds=$12, fallback_mode=$13,
  custom_fallback_payload=$14, updated_at=now()
where plugin_id=$15`,
			p.Name, string(p.Category), p.Version, p.Description, p.Enabled,
			p.TargetService, p.TargetURL, p.EndpointPrefix, p.RequiredPermission,
			p.FailureThreshold, p.TimeoutSeconds, p.CooldownSeconds, p.FallbackMode,
			p.CustomFallbackPayload, pID,
		)
		if err != nil {
			r.logger.Error("Failed to update plugin in db", "plugin_id", pID, "error", err)
			return err
		}

		if p.RequiredPermission != "" {
			_, _ = r.pool.Exec(ctx, `
insert into permissions (code, description, immutable)
values ($1, $2, false)
on conflict (code) do nothing`,
				p.RequiredPermission, fmt.Sprintf("Access to custom feature %s", p.Name),
			)
		}
	}
	return nil
}

func (r *PluginRegistry) DeletePlugin(ctx context.Context, pluginID string) error {
	pID := strings.ToLower(strings.TrimSpace(pluginID))
	if pID == "" {
		return errors.New("pluginId is required")
	}

	r.mu.Lock()
	p, exists := r.plugins[pID]
	if !exists {
		r.mu.Unlock()
		return ErrPluginNotFound
	}
	if p.IsSystem {
		r.mu.Unlock()
		return errors.New("core system feature plugins cannot be deleted; you may disable them instead")
	}

	delete(r.plugins, pID)
	r.mu.Unlock()

	if r.pool != nil {
		_, _ = r.pool.Exec(ctx, `delete from tenant_plugin_overrides where plugin_id=$1`, pID)
		_, err := r.pool.Exec(ctx, `delete from system_plugins where plugin_id=$1`, pID)
		if err != nil {
			r.logger.Error("Failed to delete plugin from db", "plugin_id", pID, "error", err)
			return err
		}
	}
	return nil
}

func (r *PluginRegistry) MatchPluginEndpoint(path string) (*Plugin, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var bestMatch *Plugin
	var longestPrefix int

	for _, p := range r.plugins {
		if p.EndpointPrefix != "" && strings.HasPrefix(path, p.EndpointPrefix) {
			if len(p.EndpointPrefix) > longestPrefix {
				longestPrefix = len(p.EndpointPrefix)
				bestMatch = p
			}
		}
	}

	if bestMatch != nil {
		return bestMatch, true
	}
	return nil, false
}
