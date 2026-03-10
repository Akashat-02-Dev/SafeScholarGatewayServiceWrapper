package middleware

import (
	"net/http"

	"safescholar/gateway/internal/rbac"
)

func RBACMiddleware(engine *rbac.PolicyEngine) Middleware {
	if engine == nil {
		engine = rbac.NewPolicyEngine()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			meta := RouteMetaFromContext(r.Context())
			if meta.RequiredPermission == "" {
				next.ServeHTTP(w, r)
				return
			}
			uc := UserContextFromContext(r.Context())
			if !uc.IsAuthenticated {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			if !engine.Allowed(uc.Permissions, meta.RequiredPermission) {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
