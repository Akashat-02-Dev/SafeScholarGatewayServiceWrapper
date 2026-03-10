package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/service_registry"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/oauth"
	"safescholar/gateway/internal/rbac"
	"safescholar/gateway/internal/security"
)

type routeCtxKey string

const ctxKeyRoute routeCtxKey = "gateway_route"

type Router struct {
	routes []Route
	logger *slog.Logger

	authSvc  *auth.AuthService
	oauthSvc *oauth.OAuthService
	roleSvc  *rbac.RoleService
	registry *service_registry.Registry
	proxy    *ServiceProxy
}

type RouterDeps struct {
	Config          config.Config
	Logger          *slog.Logger
	RateLimiter     *security.TokenBucketLimiter
	TokenValidator  *auth.TokenValidator
	AuthService     *auth.AuthService
	OAuthService    *oauth.OAuthService
	RoleService     *rbac.RoleService
	ServiceRegistry *service_registry.Registry
	ServiceProxy    *ServiceProxy
}

func NewRouter(deps RouterDeps) (http.Handler, error) {
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	if deps.ServiceRegistry == nil {
		return nil, errors.New("service registry required")
	}
	if deps.ServiceProxy == nil {
		return nil, errors.New("service proxy required")
	}

	r := &Router{
		routes:   Routes(),
		logger:   deps.Logger,
		authSvc:  deps.AuthService,
		oauthSvc: deps.OAuthService,
		roleSvc:  deps.RoleService,
		registry: deps.ServiceRegistry,
		proxy:    deps.ServiceProxy,
	}

	base := http.HandlerFunc(r.serve)

	h := middleware.Chain(
		base,
		middleware.HostValidation(deps.Config.Server.AllowedHostnames),
		middleware.MaxBodyBytes(deps.Config.Server.MaxRequestBodyBytes),
		RouteMatchMiddleware(r.routes),
		middleware.LoggingMiddleware(deps.Logger),
		middleware.SecurityHeadersMiddleware(deps.Config.Security),
		middleware.CORSMiddleware(deps.Config.CORS),
		middleware.RateLimitMiddleware(deps.RateLimiter, deps.TokenValidator),
		middleware.AuthMiddleware(deps.TokenValidator),
		middleware.RBACMiddleware(rbac.NewPolicyEngine()),
	)

	return h, nil
}

func (r *Router) serve(w http.ResponseWriter, req *http.Request) {
	route, ok := RouteFromContext(req.Context())
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	switch {
	case route.PathPrefix == "/healthz":
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
		return
	case route.PathPrefix == "/api/auth/login":
		r.handleLogin(w, req)
		return
	case route.PathPrefix == "/api/auth/logout":
		r.handleLogout(w, req)
		return
	case route.PathPrefix == "/api/auth/me":
		r.handleMe(w, req)
		return
	case strings.HasPrefix(route.PathPrefix, "/api/oauth/"):
		r.handleOAuth(w, req, route.PathPrefix)
		return
	case strings.HasPrefix(route.PathPrefix, "/api/admin/"):
		r.handleAdmin(w, req, route.PathPrefix)
		return
	case route.ServiceName != "":
		r.handleProxy(w, req, route)
		return
	default:
		w.WriteHeader(http.StatusNotFound)
		return
	}
}

func (r *Router) handleProxy(w http.ResponseWriter, req *http.Request, route Route) {
	baseURL, err := r.registry.Resolve(req.Context(), route.ServiceName)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	if err := r.proxy.Forward(w, req, baseURL, route.StripPrefix); err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (r *Router) handleLogin(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var lr loginRequest
	if err := json.NewDecoder(req.Body).Decode(&lr); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	ip := middleware.ClientIP(req)
	accessTTL := 15 * time.Minute
	refreshTTL := 30 * 24 * time.Hour
	result, err := r.authSvc.Login(req.Context(), lr.Email, lr.Password, ip, req.UserAgent(), middleware.CorrelationIDFromContext(req.Context()), accessTTL, refreshTTL)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"accessToken":      result.AccessToken,
		"refreshToken":     result.RefreshToken,
		"expiresInSeconds": int64(accessTTL.Seconds()),
	})
}

func (r *Router) handleLogout(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if err := r.authSvc.Logout(req.Context(), uc.InstitutionID, uc.SessionID, uc.TokenID); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleMe(w http.ResponseWriter, req *http.Request) {
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	me, err := r.authSvc.Me(req.Context(), uc.UserID, uc.InstitutionID, uc.Roles, uc.Permissions)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"userId":        me.UserID,
		"institutionId": me.InstitutionID,
		"email":         me.Email,
		"firstName":     me.FirstName,
		"lastName":      me.LastName,
		"isSysAdmin":    me.IsSysAdmin,
		"roles":         me.Roles,
		"permissions":   me.Permissions,
	})
}

func (r *Router) handleOAuth(w http.ResponseWriter, req *http.Request, prefix string) {
	if r.oauthSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	switch prefix {
	case "/api/oauth/google/start":
		if err := r.oauthSvc.Start(w, req, oauth.ProviderGoogle); err != nil {
			w.WriteHeader(http.StatusBadRequest)
		}
	case "/api/oauth/microsoft/start":
		if err := r.oauthSvc.Start(w, req, oauth.ProviderMicrosoft); err != nil {
			w.WriteHeader(http.StatusBadRequest)
		}
	case "/api/oauth/apple/start":
		if err := r.oauthSvc.Start(w, req, oauth.ProviderApple); err != nil {
			w.WriteHeader(http.StatusBadRequest)
		}
	case "/api/oauth/google/callback":
		r.handleOAuthCallback(w, req, oauth.ProviderGoogle)
	case "/api/oauth/microsoft/callback":
		r.handleOAuthCallback(w, req, oauth.ProviderMicrosoft)
	case "/api/oauth/apple/callback":
		r.handleOAuthCallback(w, req, oauth.ProviderApple)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (r *Router) handleOAuthCallback(w http.ResponseWriter, req *http.Request, provider oauth.Provider) {
	code := req.URL.Query().Get("code")
	state := req.URL.Query().Get("state")
	ip := middleware.ClientIP(req)
	ipStr := ""
	if ip != nil {
		ipStr = ip.String()
	}
	res, err := r.oauthSvc.Callback(req.Context(), provider, code, state, req.Cookies(), ipStr, req.UserAgent(), middleware.CorrelationIDFromContext(req.Context()))
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"accessToken":      res.AccessToken,
		"refreshToken":     res.RefreshToken,
		"expiresInSeconds": int64((15 * time.Minute).Seconds()),
	})
}

type createRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type assignPermissionRequest struct {
	RoleID         string `json:"roleId"`
	PermissionCode string `json:"permission"`
}

type assignRoleRequest struct {
	UserID string `json:"userId"`
	RoleID string `json:"roleId"`
}

func (r *Router) handleAdmin(w http.ResponseWriter, req *http.Request, prefix string) {
	if r.roleSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	actor := rbac.ActorContext{
		UserID:        uc.UserID,
		InstitutionID: uc.InstitutionID,
		IsSysAdmin:    uc.IsSysAdmin,
		RoleIDs:       nil,
		RoleNames:     uc.Roles,
		Permissions:   uc.Permissions,
		CorrelationID: middleware.CorrelationIDFromContext(req.Context()),
		IP:            middleware.ClientIP(req).String(),
		UserAgent:     req.UserAgent(),
	}

	switch prefix {
	case "/api/admin/roles":
		if req.Method == http.MethodGet {
			roles, err := r.roleSvc.ListRoles(req.Context(), actor)
			if err != nil {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
			return
		}
		if req.Method == http.MethodPost {
			var cr createRoleRequest
			if err := json.NewDecoder(req.Body).Decode(&cr); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			roleID, err := r.roleSvc.CreateRole(req.Context(), actor, cr.Name, cr.Description)
			if err != nil {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			writeJSON(w, http.StatusCreated, map[string]any{"roleId": roleID})
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/roles/assign-permission":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var ap assignPermissionRequest
		if err := json.NewDecoder(req.Body).Decode(&ap); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if err := r.roleSvc.AssignPermissionToRole(req.Context(), actor, ap.RoleID, ap.PermissionCode); err != nil {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case "/api/admin/users/assign-role":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var ar assignRoleRequest
		if err := json.NewDecoder(req.Body).Decode(&ar); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if err := r.roleSvc.AssignRoleToUser(req.Context(), actor, ar.UserID, ar.RoleID); err != nil {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if r.authSvc != nil {
			r.authSvc.InvalidatePermissionCache(req.Context(), ar.UserID)
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func RouteFromContext(ctx context.Context) (Route, bool) {
	v := ctx.Value(ctxKeyRoute)
	if v == nil {
		return Route{}, false
	}
	rt, ok := v.(Route)
	return rt, ok
}

func RouteMatchMiddleware(routes []Route) middleware.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			route, ok := matchRoute(routes, req.Method, req.URL.Path)
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			ctx := context.WithValue(req.Context(), ctxKeyRoute, route)
			ctx = middleware.ContextWithRouteMeta(ctx, middleware.RouteMeta{
				ServiceName:        route.ServiceName,
				RequiredPermission: route.RequiredPermission,
				AuthRequired:       route.AuthRequired,
			})
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	}
}

func matchRoute(routes []Route, method, path string) (Route, bool) {
	var best Route
	bestLen := -1
	if method == http.MethodOptions {
		method = ""
	}
	for _, r := range routes {
		rm := strings.TrimSpace(r.Method)
		if rm != "" && method != "" && rm != method {
			continue
		}
		if !routePathMatches(r.PathPrefix, path) {
			continue
		}
		if len(r.PathPrefix) > bestLen {
			bestLen = len(r.PathPrefix)
			best = r
		}
	}
	if bestLen == -1 {
		return Route{}, false
	}
	return best, true
}

func routePathMatches(prefix, path string) bool {
	pp := strings.TrimSpace(prefix)
	if pp == "" {
		return false
	}
	if !strings.HasPrefix(pp, "/") {
		pp = "/" + pp
	}
	if pp == "/" {
		return true
	}
	if strings.HasSuffix(pp, "/") {
		base := strings.TrimSuffix(pp, "/")
		return path == base || strings.HasPrefix(path, pp)
	}
	return path == pp
}
