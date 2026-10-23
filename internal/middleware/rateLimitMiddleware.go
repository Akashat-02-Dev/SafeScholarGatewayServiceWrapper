package middleware

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/security"
)

func RateLimitMiddleware(limiter *security.TokenBucketLimiter, validator *auth.TokenValidator) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if limiter == nil {
				next.ServeHTTP(w, r)
				return
			}
			if r.Method == http.MethodOptions || r.URL.Path == "/healthz" {
				next.ServeHTTP(w, r)
				return
			}

			key, cap, refill, period := rateLimitKeyAndTier(r, validator)
			var res security.RateLimitResult
			var err error
			if cap > 0 && refill > 0 && period > 0 {
				res, err = limiter.AllowCustom(r.Context(), key, cap, refill, period)
			} else {
				res, err = limiter.Allow(r.Context(), key)
			}

			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(`{"error":"Rate limiter service unavailable","code":"RATE_LIMIT_ERROR"}`))
				return
			}

			w.Header().Set("X-RateLimit-Limit", int64ToString(res.Limit))
			w.Header().Set("X-RateLimit-Remaining", int64ToString(res.Remaining))
			w.Header().Set("X-RateLimit-Reset", int64ToString(res.ResetAtUnix))
			if !res.Allowed {
				retryAfter := retryAfterSeconds(time.Now().UTC(), res.ResetAtUnix)
				if retryAfter > 0 {
					w.Header().Set("Retry-After", int64ToString(retryAfter))
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"Too many requests. Rate limit exceeded.","code":"RATE_LIMIT_EXCEEDED"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitKeyAndTier(r *http.Request, validator *auth.TokenValidator) (key string, capacity int64, refillRate int64, period time.Duration) {
	path := strings.ToLower(r.URL.Path)
	ip := ClientIP(r)
	ipStr := "unknown"
	if ip != nil {
		ipStr = ip.String()
	}

	// 1. Strict Auth Tier: login, register, forgot-password, reset-password
	// 10 requests / minute max to prevent brute force, credential stuffing, password spraying
	if path == "/api/auth/login" || path == "/api/auth/register" ||
		path == "/api/auth/forgot-password" || path == "/api/auth/reset-password" ||
		strings.HasPrefix(path, "/api/oauth/") {
		return "rate_limit:auth:ip:" + ipStr, 10, 10, time.Minute
	}

	// 2. High-Resource AI Tier: /api/v1/ai/*
	// 20 requests / minute max to prevent ReDoS / LLM compute exhaustion
	if strings.HasPrefix(path, "/api/v1/ai/") {
		userKey := userIdentifier(r, validator)
		if userKey != "" {
			return "rate_limit:ai:user:" + userKey, 20, 20, time.Minute
		}
		return "rate_limit:ai:ip:" + ipStr, 20, 20, time.Minute
	}

	// 3. Admin Tier: /api/v1/admin/*
	// 60 requests / minute max
	if strings.HasPrefix(path, "/api/v1/admin/") {
		userKey := userIdentifier(r, validator)
		if userKey != "" {
			return "rate_limit:admin:user:" + userKey, 60, 60, time.Minute
		}
		return "rate_limit:admin:ip:" + ipStr, 60, 60, time.Minute
	}

	// 4. Default General API Tier (uses default limiter capacity and period)
	userKey := userIdentifier(r, validator)
	if userKey != "" {
		return "rate_limit:api:user:" + userKey, 0, 0, 0
	}
	return "rate_limit:api:ip:" + ipStr, 0, 0, 0
}

func userIdentifier(r *http.Request, validator *auth.TokenValidator) string {
	uc := UserContextFromContext(r.Context())
	if uc.IsAuthenticated && uc.UserID != "" {
		return uc.InstitutionID + ":" + uc.UserID
	}

	if validator != nil {
		tokenString, tokenPresent, err := tryBearerTokenForRateLimit(r)
		if err == nil && tokenPresent {
			claims, _, err := validator.ValidateAccessToken(r.Context(), tokenString)
			if err == nil && strings.TrimSpace(claims.Subject) != "" {
				return strings.TrimSpace(claims.Institution) + ":" + strings.TrimSpace(claims.Subject)
			}
		}
	}
	return ""
}

func rateLimitKey(r *http.Request, validator *auth.TokenValidator) string {
	key, _, _, _ := rateLimitKeyAndTier(r, validator)
	return key
}

func tryBearerTokenForRateLimit(r *http.Request) (string, bool, error) {
	h := strings.TrimSpace(r.Header.Get("Authorization"))
	if h == "" {
		return "", false, nil
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return "", true, errors.New("invalid")
	}
	t := strings.TrimSpace(parts[1])
	if t == "" {
		return "", true, errors.New("invalid")
	}
	return t, true, nil
}

func ClientIP(r *http.Request) net.IP {
	remote := remoteIP(r)
	if remote != nil && (remote.IsLoopback() || isPrivateIP(remote)) {
		xff := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0])
		if ip := net.ParseIP(xff); ip != nil {
			return ip
		}
	}
	return remote
}

func int64ToString(i int64) string {
	if i == 0 {
		return "0"
	}
	var b [32]byte
	n := len(b)
	neg := i < 0
	if neg {
		i = -i
	}
	for i > 0 {
		n--
		b[n] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		n--
		b[n] = '-'
	}
	return string(b[n:])
}

func remoteIP(r *http.Request) net.IP {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		if ip := net.ParseIP(host); ip != nil {
			return ip
		}
	}
	if ip := net.ParseIP(r.RemoteAddr); ip != nil {
		return ip
	}
	return nil
}

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 10 {
			return true
		}
		if ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31 {
			return true
		}
		if ip4[0] == 192 && ip4[1] == 168 {
			return true
		}
		return false
	}
	ip16 := ip.To16()
	if ip16 == nil {
		return false
	}
	return ip16[0]&0xfe == 0xfc
}

func retryAfterSeconds(now time.Time, resetAtUnixMs int64) int64 {
	if resetAtUnixMs <= 0 {
		return 0
	}
	resetAt := time.Unix(resetAtUnixMs, 0)
	d := resetAt.Sub(now)
	if d <= 0 {
		return 0
	}
	sec := int64(d.Seconds())
	if sec <= 0 {
		return 1
	}
	return sec
}
