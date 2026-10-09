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
