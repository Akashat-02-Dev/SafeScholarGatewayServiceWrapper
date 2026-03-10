package middleware

import (
	"errors"
	"net/http"
	"strings"

	"safescholar/gateway/config"
)

func MaxBodyBytes(max int64) Middleware {
	if max <= 0 {
		max = 1024 * 1024
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, max)
			next.ServeHTTP(w, r)
		})
	}
}

func HostValidation(allowedHostnames []string) Middleware {
	allowed := map[string]bool{}
	for _, h := range allowedHostnames {
		v := strings.ToLower(strings.TrimSpace(h))
		if v != "" {
			allowed[v] = true
		}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if len(allowed) == 0 {
				next.ServeHTTP(w, r)
				return
			}
			host := strings.ToLower(strings.TrimSpace(r.Host))
			host = strings.Split(host, ":")[0]
			if host == "" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if !allowed[host] {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireTLS(require bool) func(r *http.Request) error {
	return func(r *http.Request) error {
		if !require {
			return nil
		}
		if r.TLS == nil {
			return errors.New("tls required")
		}
		return nil
	}
}

func SecurityHeadersMiddleware(cfg config.SecurityConfig) Middleware {
	csp := strings.TrimSpace(cfg.ContentSecurityPolicy)
	hsts := cfg.StrictTransportMaxAge
	if hsts <= 0 {
		hsts = 31536000
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "no-referrer")
			w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
			w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
			w.Header().Set("Cross-Origin-Resource-Policy", "same-site")
			w.Header().Set("Cross-Origin-Embedder-Policy", "credentialless")
			if csp != "" {
				w.Header().Set("Content-Security-Policy", csp)
			}
			if isHTTPS(r) {
				w.Header().Set("Strict-Transport-Security", "max-age="+intToString(hsts)+"; includeSubDomains; preload")
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isHTTPS(r *http.Request) bool {
	if r == nil {
		return false
	}
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https")
}
