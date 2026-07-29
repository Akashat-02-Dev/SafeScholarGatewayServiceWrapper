package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type TelemetryLogger interface {
	IncrementTenantLoad(ctx context.Context, institutionID string, role string) error
}

type telemetryLoggerImpl struct {
	redisClient *redis.Client
}

func NewTelemetryLogger(redisClient *redis.Client) TelemetryLogger {
	return &telemetryLoggerImpl{redisClient: redisClient}
}

func (t *telemetryLoggerImpl) IncrementTenantLoad(ctx context.Context, institutionID string, role string) error {
	pipe := t.redisClient.Pipeline()
	
	// Track total cumulative request counts for the tenant load
	tenantKey := fmt.Sprintf("tenant_load:%s", institutionID)
	pipe.HIncrBy(ctx, tenantKey, "total_requests", 1)

	// Update active candidate or teacher resource metrics dynamically
	r := strings.ToLower(strings.TrimSpace(role))
	if r == "teacher" {
		pipe.HIncrBy(ctx, tenantKey, "active_teachers", 1)
	} else if r == "student" {
		pipe.HIncrBy(ctx, tenantKey, "active_candidates", 1)
	}

	// Set sliding window TTL for active real-time load analytics (e.g., 1 hour window)
	pipe.Expire(ctx, tenantKey, 1*time.Hour)

	_, err := pipe.Exec(ctx)
	return err
}

// TenantTelemetryMiddleware captures outgoing traffic metrics for the Super Admin
func TenantTelemetryMiddleware(telemetry TelemetryLogger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			
			// Execute the rest of the proxy pipeline first (Auth, RBAC, Downstream LLM run)
			next.ServeHTTP(w, r)

			// Extract context variables injected by authMiddleware
			uc := UserContextFromContext(r.Context())

			if uc.IsAuthenticated && uc.InstitutionID != "" {
				role := ""
				if len(uc.Roles) > 0 {
					role = uc.Roles[0]
				}
				// Fire-and-forget telemetry increment asynchronously to prevent blocking the HTTP path
				go func() {
					ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
					defer cancel()
					_ = telemetry.IncrementTenantLoad(ctx, uc.InstitutionID, role)
				}()
			}
		})
	}
}
