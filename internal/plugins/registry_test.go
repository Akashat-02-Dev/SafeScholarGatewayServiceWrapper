package plugins

import (
	"context"
	"errors"
	"testing"
)

func TestPluginRegistry_FeatureIsolation(t *testing.T) {
	registry := NewPluginRegistry(nil, nil)
	ctx := context.Background()

	// 1. Execute failing tool "lesson_planner" until circuit trips
	failingCall := func(ctx context.Context) (any, error) {
		return nil, errors.New("ai model internal server error")
	}

	for i := 0; i < 3; i++ {
		_, isFallback, err := registry.ExecuteWithResilience(
			ctx,
			"lesson_planner",
			"tenant-1",
			failingCall,
			map[string]interface{}{"topic": "Fractions", "year_level": "Year 4"},
		)
		// Should return graceful fallback on error
		if err != nil {
			t.Fatalf("expected graceful fallback, got error: %v", err)
		}
		if !isFallback {
			t.Fatalf("expected fallback to be true")
		}
	}

	// Verify lesson_planner circuit is OPEN
	lp, ok := registry.GetPlugin("lesson_planner")
	if !ok {
		t.Fatalf("expected lesson_planner plugin to exist")
	}
	if lp.CircuitBreaker.GetStats().State != CircuitOpen {
		t.Fatalf("expected lesson_planner circuit to be OPEN, got %v", lp.CircuitBreaker.GetStats().State)
	}

	// 2. PROVE FEATURE ISOLATION:
	// Verify other tools like "socratic_tutor" and "worksheet_service" are COMPLETELY UNAFFECTED!
	st, ok := registry.GetPlugin("socratic_tutor")
	if !ok {
		t.Fatalf("expected socratic_tutor plugin to exist")
	}
	if st.CircuitBreaker.GetStats().State != CircuitClosed {
		t.Fatalf("expected socratic_tutor circuit to remain CLOSED, got %v", st.CircuitBreaker.GetStats().State)
	}

	// Execute successful call on socratic_tutor
	socraticCalled := false
	socraticCall := func(ctx context.Context) (any, error) {
		socraticCalled = true
		return map[string]string{"reply": "What makes you think that?"}, nil
	}

	res, isFallback, err := registry.ExecuteWithResilience(ctx, "socratic_tutor", "tenant-1", socraticCall, nil)
	if err != nil || isFallback || !socraticCalled {
		t.Fatalf("expected socratic_tutor to execute normally, err=%v, isFallback=%v", err, isFallback)
	}
	m, ok := res.(map[string]string)
	if !ok || m["reply"] != "What makes you think that?" {
		t.Fatalf("unexpected result: %v", res)
	}
}

func TestPluginRegistry_TenantOverride(t *testing.T) {
	registry := NewPluginRegistry(nil, nil)
	ctx := context.Background()

	// By default, quiz_me is enabled globally
	if !registry.IsPluginEnabled("quiz_me", "tenant-alpha") {
		t.Fatalf("expected quiz_me to be enabled by default")
	}

	// Disable for tenant-alpha
	err := registry.SetTenantOverride(ctx, "tenant-alpha", "quiz_me", false)
	if err != nil {
		t.Fatalf("SetTenantOverride failed: %v", err)
	}

	// Verify tenant-alpha has quiz_me disabled
	if registry.IsPluginEnabled("quiz_me", "tenant-alpha") {
		t.Fatalf("expected quiz_me to be disabled for tenant-alpha")
	}

	// Verify tenant-beta still has quiz_me ENABLED!
	if !registry.IsPluginEnabled("quiz_me", "tenant-beta") {
		t.Fatalf("expected quiz_me to remain enabled for tenant-beta")
	}
}

func TestPluginRegistry_CustomFeatureCreationAndLifecycle(t *testing.T) {
	registry := NewPluginRegistry(nil, nil)
	ctx := context.Background()

	// 1. Create a custom feature dynamically
	createReq := CreatePluginRequest{
		ID:                    "naplan_writing_evaluator",
		Name:                  "NAPLAN Writing Evaluator",
		Category:              CategoryCustom,
		Version:               "1.0.0",
		Description:           "Automated NAPLAN 10-criterion writing analysis",
		Enabled:               true,
		TargetService:         "ai-orchestrator",
		EndpointPrefix:        "/api/v1/ai/custom/naplan-eval",
		RequiredPermission:   "EVALUATE_NAPLAN_WRITING",
		FailureThreshold:      2,
		TimeoutSeconds:        15,
		CooldownSeconds:       30,
		FallbackMode:          "graceful_fallback",
		CustomFallbackPayload: `{"status":"degraded","naplan_criteria":{"ideas":"scaffolded","grammar":"baseline"}}`,
	}

	p, err := registry.CreatePlugin(ctx, createReq)
	if err != nil {
		t.Fatalf("CreatePlugin failed: %v", err)
	}
	if p.ID != "naplan_writing_evaluator" || p.IsSystem {
		t.Fatalf("unexpected plugin state: id=%s, isSystem=%v", p.ID, p.IsSystem)
	}

	// 2. Test endpoint matching
	matched, ok := registry.MatchPluginEndpoint("/api/v1/ai/custom/naplan-eval/submit")
	if !ok || matched.ID != "naplan_writing_evaluator" {
		t.Fatalf("MatchPluginEndpoint failed: got %v, ok=%v", matched, ok)
	}

	// 3. Test resilient execution with custom fallback payload
	failingCall := func(ctx context.Context) (any, error) {
		return nil, errors.New("upstream custom engine timeout")
	}

	res, isFallback, err := registry.ExecuteWithResilience(
		ctx,
		"naplan_writing_evaluator",
		"tenant-custom",
		failingCall,
		nil,
	)
	if err != nil || !isFallback {
		t.Fatalf("expected custom fallback on failure, err=%v, isFallback=%v", err, isFallback)
	}
	parsedMap, ok := res.(map[string]any)
	if !ok || parsedMap["status"] != "degraded" {
		t.Fatalf("expected parsed custom fallback payload, got: %v", res)
	}

	// 4. Disallow deleting core system plugins
	err = registry.DeletePlugin(ctx, "lesson_planner")
	if err == nil {
		t.Fatalf("expected error when attempting to delete core system plugin, got nil")
	}

	// 5. Update custom plugin
	updateReq := UpdatePluginRequest{
		PluginID:         "naplan_writing_evaluator",
		Name:             "NAPLAN Writing Evaluator Pro",
		FailureThreshold: 5,
		TimeoutSeconds:   25,
	}
	err = registry.UpdatePlugin(ctx, updateReq)
	if err != nil {
		t.Fatalf("UpdatePlugin failed: %v", err)
	}
	updated, ok := registry.GetPlugin("naplan_writing_evaluator")
	if !ok || updated.Name != "NAPLAN Writing Evaluator Pro" || updated.FailureThreshold != 5 {
		t.Fatalf("unexpected updated plugin state: %v", updated)
	}

	// 6. Delete custom plugin
	err = registry.DeletePlugin(ctx, "naplan_writing_evaluator")
	if err != nil {
		t.Fatalf("DeletePlugin failed: %v", err)
	}
	_, ok = registry.GetPlugin("naplan_writing_evaluator")
	if ok {
		t.Fatalf("expected custom plugin to be deleted from registry")
	}
}
