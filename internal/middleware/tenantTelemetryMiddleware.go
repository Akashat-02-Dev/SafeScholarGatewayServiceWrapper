package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TelemetryRecord struct {
	InstitutionID string
	Role          string
}

type TelemetryLogger interface {
	IncrementTenantLoad(ctx context.Context, institutionID string, role string) error
	Close()
}

type telemetryLoggerImpl struct {
	redisClient *redis.Client
	dbPool      *pgxpool.Pool
	ch          chan TelemetryRecord
	done        chan struct{}
}

func NewTelemetryLogger(redisClient *redis.Client, dbPool *pgxpool.Pool) TelemetryLogger {
	t := &telemetryLoggerImpl{
		redisClient: redisClient,
		dbPool:      dbPool,
		ch:          make(chan TelemetryRecord, 10000),
		done:        make(chan struct{}),
	}
	go t.worker()
	return t
}

func (t *telemetryLoggerImpl) worker() {
	batch := make(map[string]map[string]int)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if t.dbPool != nil {
			ctx := context.Background()
			tx, err := t.dbPool.Begin(ctx)
			if err == nil {
				defer tx.Rollback(ctx)
				for instID, roles := range batch {
					for role, count := range roles {
						_, _ = tx.Exec(ctx, `
						INSERT INTO tenant_analytics (institution_id, role, request_count, updated_at) 
						VALUES (nullif($1,'')::uuid, $2, $3, NOW())
						ON CONFLICT (institution_id, role) DO UPDATE SET request_count = tenant_analytics.request_count + $3, updated_at = NOW()
						`, instID, role, count)
					}
				}
				_ = tx.Commit(ctx)
			}
		}
		batch = make(map[string]map[string]int)
	}

	for {
		select {
		case record, ok := <-t.ch:
			if !ok {
				flush()
				close(t.done)
				return
			}
			if batch[record.InstitutionID] == nil {
				batch[record.InstitutionID] = make(map[string]int)
			}
			batch[record.InstitutionID][record.Role]++
		case <-ticker.C:
			flush()
		}
	}
}

func (t *telemetryLoggerImpl) Close() {
	close(t.ch)
	<-t.done
}

func (t *telemetryLoggerImpl) IncrementTenantLoad(ctx context.Context, institutionID string, role string) error {
	r := strings.ToLower(strings.TrimSpace(role))
	select {
	case t.ch <- TelemetryRecord{InstitutionID: institutionID, Role: r}:
	default:
		slog.Warn("Telemetry channel full, dropping record", "institution_id", institutionID)
	}
	return nil
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
