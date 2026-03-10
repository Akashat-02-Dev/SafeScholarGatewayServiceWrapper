package middleware

import (
	"net/http"
	"strings"

	"safescholar/gateway/config"
)

func CORSMiddleware(cfg config.CORSConfig) Middleware {
	allowedOrigins := normalizeSet(cfg.AllowedOrigins)
	allowedMethods := strings.Join(cfg.AllowedMethods, ", ")
	allowedHeaders := strings.Join(cfg.AllowedHeaders, ", ")
	maxAge := cfg.MaxAgeSeconds
	if maxAge <= 0 {
		maxAge = 600
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			allowed := origin == "" || isOriginAllowed(allowedOrigins, origin)
			if origin != "" {
				w.Header().Set("Vary", "Origin")
				w.Header().Add("Vary", "Access-Control-Request-Method")
				w.Header().Add("Vary", "Access-Control-Request-Headers")
			}

			if r.Method == http.MethodOptions {
				if origin != "" && !allowed {
					w.WriteHeader(http.StatusForbidden)
					return
				}
				if origin != "" && allowed {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					if cfg.AllowCredentials {
						w.Header().Set("Access-Control-Allow-Credentials", "true")
					}
					if allowedMethods != "" {
						w.Header().Set("Access-Control-Allow-Methods", allowedMethods)
					}
					if allowedHeaders != "" {
						w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
					}
					w.Header().Set("Access-Control-Max-Age", intToString(maxAge))
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}

			if origin != "" && !allowed {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			if origin != "" && allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				if cfg.AllowCredentials {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isOriginAllowed(allowed map[string]bool, origin string) bool {
	if origin == "" {
		return true
	}
	if allowed["*"] {
		return true
	}
	return allowed[origin]
}

func normalizeSet(in []string) map[string]bool {
	out := map[string]bool{}
	for _, s := range in {
		v := strings.TrimSpace(s)
		if v != "" {
			out[v] = true
		}
	}
	return out
}

func intToString(i int) string {
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
