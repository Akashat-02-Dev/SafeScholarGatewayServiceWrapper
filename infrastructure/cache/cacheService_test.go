package cache

import (
	"context"
	"testing"
	"time"
)

func TestCacheService_FailOpenWhenDisabled(t *testing.T) {
	svc := NewCacheService(nil, false, 10*time.Minute, "safescholar:cache:", nil)

	if svc.IsEnabled() {
		t.Error("expected cache to be disabled when rdb is nil")
	}

	ctx := context.Background()

	// GetUser should fail-open (return nil, false) without error
	user, ok := svc.GetUser(ctx, "usr_123")
	if ok || user != nil {
		t.Errorf("expected miss on disabled cache, got: %v", user)
	}

	// SetUser should not panic or fail
	svc.SetUser(ctx, "usr_123", &CachedUser{
		UserID: "usr_123",
		Email:  "test@example.com",
	}, 10*time.Minute)

	// InvalidateUser should execute cleanly
	svc.InvalidateUser(ctx, "usr_123")

	// GetInstitution should fail-open
	inst, ok := svc.GetInstitution(ctx, "inst_123")
	if ok || inst != nil {
		t.Errorf("expected miss on disabled cache, got: %v", inst)
	}

	// InvalidateInstitution should execute cleanly
	svc.InvalidateInstitution(ctx, "inst_123")
}
