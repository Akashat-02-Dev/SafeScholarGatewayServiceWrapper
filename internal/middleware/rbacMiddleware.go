package middleware

import (
	"net/http"
	"strings"

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
			isAdmin := uc.IsSysAdmin
			if !isAdmin {
				for _, role := range uc.Roles {
					rStr := strings.ToLower(strings.TrimSpace(role))
					if rStr == "sys_admin" || rStr == "super_admin" || rStr == "admin" || rStr == "sysadmin" || rStr == "institute" {
						isAdmin = true
						break
					}
				}
			}
			if isAdmin {
				next.ServeHTTP(w, r)
				return
			}
			// Phase 5: Hardcode hierarchy boundaries for admin routes
			if strings.HasPrefix(r.URL.Path, "/api/admin/") || strings.HasPrefix(r.URL.Path, "/api/v1/admin/") {
				w.WriteHeader(http.StatusForbidden)
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
