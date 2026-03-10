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

			key := rateLimitKey(r, validator)
			res, err := limiter.Allow(r.Context(), key)
			if err != nil {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("X-RateLimit-Remaining", int64ToString(res.Remaining))
			w.Header().Set("X-RateLimit-Reset", int64ToString(res.ResetAtUnix))
			if !res.Allowed {
				retryAfter := retryAfterSeconds(time.Now().UTC(), res.ResetAtUnix)
				if retryAfter > 0 {
					w.Header().Set("Retry-After", int64ToString(retryAfter))
				}
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func rateLimitKey(r *http.Request, validator *auth.TokenValidator) string {
	uc := UserContextFromContext(r.Context())
	if uc.IsAuthenticated && uc.UserID != "" {
		return uc.UserID
	}

	if validator != nil {
		tokenString, tokenPresent, err := tryBearerTokenForRateLimit(r)
		if err == nil && tokenPresent {
			claims, _, err := validator.ValidateAccessToken(r.Context(), tokenString)
			if err == nil && strings.TrimSpace(claims.Subject) != "" {
				return strings.TrimSpace(claims.Subject)
			}
		}
	}

	ip := ClientIP(r)
	if ip == nil {
		return "ip:unknown"
	}
	return "ip:" + ip.String()
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
	d := time.Until(resetAt)
	if d <= 0 {
		return 0
	}
	sec := int64(d.Seconds())
	if sec <= 0 {
		return 1
	}
	return sec
}
