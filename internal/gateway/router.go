package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/infrastructure/service_registry"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/clients"
	"safescholar/gateway/internal/contracts"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/oauth"
	"safescholar/gateway/internal/rbac"
	"safescholar/gateway/internal/security"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type routeCtxKey string

const ctxKeyRoute routeCtxKey = "gateway_route"

type Router struct {
	routes []Route
	logger *slog.Logger

	authSvc     *auth.AuthService
	oauthSvc    *oauth.OAuthService
	roleSvc     *rbac.RoleService
	registry    *service_registry.Registry
	proxy       *ServiceProxy
	wsService   *WSService
	modClient   *clients.ModerationClient
	auditLogger *security.AuditLogger
	oversightSvc *OversightService
	aiClient    clients.AIOrchestratorClient
	redisClient *redis.Client
	dbPool      *pgxpool.Pool
}

type RouterDeps struct {
	Config           config.Config
	Logger           *slog.Logger
	RateLimiter      *security.TokenBucketLimiter
	TokenValidator   *auth.TokenValidator
	AuthService      *auth.AuthService
	OAuthService     *oauth.OAuthService
	RoleService      *rbac.RoleService
	ServiceRegistry  *service_registry.Registry
	ServiceProxy     *ServiceProxy
	WSService        *WSService
	ModerationClient *clients.ModerationClient
	AuditLogger      *security.AuditLogger
	RedisClient      *redis.Client
	DBPool           *pgxpool.Pool
	AIClient         clients.AIOrchestratorClient
}

func NewRouter(deps RouterDeps) (http.Handler, func(), error) {
	if deps.Logger == nil {
		deps.Logger = slog.Default()
	}
	if deps.ServiceRegistry == nil {
		return nil, nil, errors.New("service registry required")
	}
	if deps.ServiceProxy == nil {
		return nil, nil, errors.New("service proxy required")
	}

	r := &Router{
		routes:      Routes(),
		logger:      deps.Logger,
		authSvc:     deps.AuthService,
		oauthSvc:    deps.OAuthService,
		roleSvc:     deps.RoleService,
		registry:    deps.ServiceRegistry,
		proxy:       deps.ServiceProxy,
		wsService:   deps.WSService,
		modClient:   deps.ModerationClient,
		auditLogger: deps.AuditLogger,
		oversightSvc: NewOversightService(deps.RedisClient),
		aiClient:    deps.AIClient,
		redisClient: deps.RedisClient,
		dbPool:      deps.DBPool,
	}

	base := http.HandlerFunc(r.serve)

	var telemetry middleware.TelemetryLogger
	if deps.RedisClient != nil && deps.DBPool != nil {
		telemetry = middleware.NewTelemetryLogger(deps.RedisClient, deps.DBPool)
	}

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
		func(next http.Handler) http.Handler {
			if telemetry != nil {
				return middleware.TenantTelemetryMiddleware(telemetry)(next)
			}
			return next
		},
	)
	cleanup := func() {
		if telemetry != nil {
			telemetry.Close()
		}
	}

	return h, cleanup, nil
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
	case route.PathPrefix == "/api/auth/register":
		r.handleRegister(w, req)
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
	case route.PathPrefix == "/api/v1/dashboard/metrics":
		r.handleDashboardMetrics(w, req)
		return
	case strings.HasPrefix(route.PathPrefix, "/api/oauth/"):
		r.handleOAuth(w, req, route.PathPrefix)
		return
	case route.PathPrefix == "/api/v1/admin/oversight/stream":
		if r.oversightSvc == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		r.oversightSvc.HandleOversightStream(w, req)
		return
	case route.PathPrefix == "/api/v1/admin/oversight/freeze":
		if r.oversightSvc == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		r.oversightSvc.HandleOversightFreeze(w, req)
		return
	case strings.HasPrefix(route.PathPrefix, "/api/admin/") || strings.HasPrefix(route.PathPrefix, "/api/v1/admin/"):
		r.handleAdmin(w, req, route.PathPrefix)
		return
	case route.PathPrefix == "/api/v1/ai/tutor":
		if r.wsService == nil || r.modClient == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		handler := http.HandlerFunc(r.wsService.HandleStudentSession)
		moderated := middleware.AIModerationMiddleware(r.modClient, r.auditLogger, r.redisClient, r.dbPool)(handler)
		moderated.ServeHTTP(w, req)
		return
	case route.PathPrefix == "/api/v1/ai/educator/lesson-planner":
		r.handleSpecificAITool(w, req, "lesson_planner")
		return
	case route.PathPrefix == "/api/v1/ai/educator/video-question-maker":
		r.handleSpecificAITool(w, req, "video_question_maker")
		return
	case route.PathPrefix == "/api/v1/ai/educator/iep-generator":
		r.handleSpecificAITool(w, req, "iep_generator")
		return
	case route.PathPrefix == "/api/v1/ai/educator/leveler":
		r.handleSpecificAITool(w, req, "leveler")
		return
	case route.PathPrefix == "/api/v1/ai/student/writing-feedback":
		handler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			r.handleSpecificAITool(w, req, "writing_feedback")
		})
		if r.modClient != nil {
			moderated := middleware.AIModerationMiddleware(r.modClient, r.auditLogger, r.redisClient, r.dbPool)(handler)
			moderated.ServeHTTP(w, req)
		} else {
			handler.ServeHTTP(w, req)
		}
		return
	case route.PathPrefix == "/api/v1/ai/student/quiz-generator":
		r.handleSpecificAITool(w, req, "quiz_generator")
		return
	case route.PathPrefix == "/api/v1/ai/student/character-bot":
		r.handleSpecificAITool(w, req, "character_bot")
		return
	case route.PathPrefix == "/api/v1/ai/student/custom-bot":
		r.handleSpecificAITool(w, req, "custom_bot")
		return
	case route.PathPrefix == "/api/v1/lti/login/init":
		r.handleLTIInit(w, req)
		return
	case route.PathPrefix == "/api/v1/lti/launch":
		r.handleLTILaunch(w, req)
		return
	case route.PathPrefix == "/.well-known/jwks.json":
		r.handleJWKS(w, req)
		return
	case route.ServiceName != "":
		r.handleProxy(w, req, route)
		return
	default:
		w.WriteHeader(http.StatusNotFound)
		return
	}
}

// Phase 2: Strict IMS Global LTI 1.3 Endpoints
func (r *Router) handleLTIInit(w http.ResponseWriter, req *http.Request) {
	// 1. OIDC Initiation
	security.WriteJSONError(w, http.StatusNotImplemented, "LTI Init not fully implemented")
}

func (r *Router) handleLTILaunch(w http.ResponseWriter, req *http.Request) {
	// 2. The secure redirect
	security.WriteJSONError(w, http.StatusNotImplemented, "LTI Launch not fully implemented")
}

func (r *Router) handleJWKS(w http.ResponseWriter, req *http.Request) {
	// 3. Public key exposure for LMS verification
	writeJSON(w, http.StatusOK, map[string]any{"keys": []any{}})
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
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	ip := middleware.ClientIP(req)
	accessTTL := 15 * time.Minute
	refreshTTL := 30 * 24 * time.Hour
	result, err := r.authSvc.Login(req.Context(), lr.Email, lr.Password, ip, req.UserAgent(), middleware.CorrelationIDFromContext(req.Context()), accessTTL, refreshTTL)
	if err != nil {
		security.WriteJSONError(w, http.StatusUnauthorized, "invalid credentials")
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
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := r.authSvc.Logout(req.Context(), uc.InstitutionID, uc.SessionID, uc.TokenID); err != nil {
		security.WriteJSONError(w, http.StatusInternalServerError, "failed to logout")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleMe(w http.ResponseWriter, req *http.Request) {
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	me, err := r.authSvc.Me(req.Context(), uc.UserID, uc.InstitutionID, uc.Roles, uc.Permissions)
	if err != nil {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
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
			security.WriteJSONError(w, http.StatusBadRequest, "failed to start oauth")
		}
	case "/api/oauth/microsoft/start":
		if err := r.oauthSvc.Start(w, req, oauth.ProviderMicrosoft); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "failed to start oauth")
		}
	case "/api/oauth/apple/start":
		if err := r.oauthSvc.Start(w, req, oauth.ProviderApple); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "failed to start oauth")
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
		security.WriteJSONError(w, http.StatusUnauthorized, "oauth failed")
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
	ip := middleware.ClientIP(req)
	ipStr := ""
	if ip != nil {
		ipStr = ip.String()
	}
	actor := rbac.ActorContext{
		UserID:        uc.UserID,
		InstitutionID: uc.InstitutionID,
		IsSysAdmin:    uc.IsSysAdmin,
		RoleIDs:       nil,
		RoleNames:     uc.Roles,
		Permissions:   uc.Permissions,
		CorrelationID: middleware.CorrelationIDFromContext(req.Context()),
		IP:            ipStr,
		UserAgent:     req.UserAgent(),
	}

	switch prefix {
	case "/api/admin/roles":
		if req.Method == http.MethodGet {
			roles, err := r.roleSvc.ListRoles(req.Context(), actor)
			if err != nil {
				security.WriteJSONError(w, http.StatusForbidden, "forbidden")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
			return
		}
		if req.Method == http.MethodPost {
			var cr createRoleRequest
			if err := json.NewDecoder(req.Body).Decode(&cr); err != nil {
				security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
				return
			}
			roleID, err := r.roleSvc.CreateRole(req.Context(), actor, cr.Name, cr.Description)
			if err != nil {
				if r.logger != nil {
					r.logger.Error("create role failed",
						"error", err.Error(),
						"userId", actor.UserID,
						"institutionId", actor.InstitutionID,
						"requestId", actor.CorrelationID,
					)
				}
				msg := strings.ToLower(strings.TrimSpace(err.Error()))
				if msg == "forbidden" {
					security.WriteJSONError(w, http.StatusForbidden, "forbidden")
					return
				}
				if strings.Contains(msg, "required") || strings.Contains(msg, "too long") || strings.Contains(msg, "invalid") {
					security.WriteJSONError(w, http.StatusBadRequest, err.Error())
					return
				}
				security.WriteJSONError(w, http.StatusInternalServerError, "internal server error")
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
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.roleSvc.AssignPermissionToRole(req.Context(), actor, ap.RoleID, ap.PermissionCode); err != nil {
			security.WriteJSONError(w, http.StatusForbidden, "forbidden")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case "/api/admin/users":
		if req.Method == http.MethodGet {
			r.handleListUsers(w, req)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/users/approvals":
		if req.Method == http.MethodGet {
			r.handleGetApprovalRequests(w, req)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/users/approve":
		if req.Method == http.MethodPost {
			r.handleApproveUser(w, req)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/users/delete", "/api/v1/admin/users/delete":
		if req.Method == http.MethodPost || req.Method == http.MethodOptions {
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			r.handleDeleteUser(w, req)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/users/isolate", "/api/v1/admin/users/isolate":
		if req.Method == http.MethodPost || req.Method == http.MethodOptions {
			if req.Method == http.MethodOptions {
				w.WriteHeader(http.StatusOK)
				return
			}
			r.handleIsolateUser(w, req)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	case "/api/admin/users/assign-role":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var ar assignRoleRequest
		if err := json.NewDecoder(req.Body).Decode(&ar); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.roleSvc.AssignRoleToUser(req.Context(), actor, ar.UserID, ar.RoleID); err != nil {
			security.WriteJSONError(w, http.StatusForbidden, "forbidden")
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

// writeJSON is deprecated, use security.WriteJSONError for errors. Keeping for successful responses.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
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

func (r *Router) handleGetApprovalRequests(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	reqs, err := r.authSvc.GetApprovalRequests(req.Context(), uc.InstitutionID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": reqs})
}

type registerRequest struct {
	Email         string `json:"email"`
	Password      string `json:"password"`
	FirstName     string `json:"firstName"`
	LastName      string `json:"lastName"`
	RequestedRole string `json:"requestedRole"`
}

func (r *Router) handleRegister(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var rr registerRequest
	if err := json.NewDecoder(req.Body).Decode(&rr); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	err := r.authSvc.RegisterUser(req.Context(), rr.Email, rr.Password, rr.FirstName, rr.LastName, rr.RequestedRole)
	if err != nil {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "exists") {
			writeJSON(w, http.StatusConflict, map[string]any{"error": "user already exists"})
			return
		}
		if strings.Contains(msg, "required") || strings.Contains(msg, "password") {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"status": "pending_approval"})
}

func (r *Router) handleListUsers(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	users, err := r.authSvc.ListUsers(req.Context())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

type approveUserRequest struct {
	UserID string `json:"userId"`
	Status string `json:"status"`
	RoleID string `json:"roleId"`
}

func (r *Router) handleApproveUser(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var ar approveUserRequest
	if err := json.NewDecoder(req.Body).Decode(&ar); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	err := r.authSvc.ApproveUser(req.Context(), ar.UserID, ar.Status, ar.RoleID)
	if err != nil {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "not found") || strings.Contains(msg, "unknown") {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		if strings.Contains(msg, "invalid") || strings.Contains(msg, "required") {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type deleteUserRequest struct {
	UserID string `json:"userId"`
}

func (r *Router) handleDeleteUser(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var dr deleteUserRequest
	if err := json.NewDecoder(req.Body).Decode(&dr); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	ipObj := middleware.ClientIP(req)
	ipStr := ""
	if ipObj != nil {
		ipStr = ipObj.String()
	}
	err := r.authSvc.DeleteUser(req.Context(), uc.UserID, uc.InstitutionID, uc.IsSysAdmin, dr.UserID, ipStr)
	if err != nil {
		r.logger.Error("DeleteUser failed", "error", err, "userId", dr.UserID, "actorUserID", uc.UserID, "actorInstitutionID", uc.InstitutionID)
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "forbidden") {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if strings.Contains(msg, "not found") || strings.Contains(msg, "no rows") || strings.Contains(msg, "unknown") {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleIsolateUser(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var dr deleteUserRequest
	if err := json.NewDecoder(req.Body).Decode(&dr); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	ipObj := middleware.ClientIP(req)
	ipStr := ""
	if ipObj != nil {
		ipStr = ipObj.String()
	}
	err := r.authSvc.IsolateUser(req.Context(), uc.UserID, uc.InstitutionID, uc.IsSysAdmin, dr.UserID, ipStr)
	if err != nil {
		r.logger.Error("IsolateUser failed", "error", err, "userId", dr.UserID, "actorUserID", uc.UserID, "actorInstitutionID", uc.InstitutionID)
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "forbidden") {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if strings.Contains(msg, "not found") || strings.Contains(msg, "no rows") || strings.Contains(msg, "unknown") {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleDashboardMetrics(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	metrics, err := r.authSvc.GetDashboardMetrics(req.Context(), uc.UserID, uc.InstitutionID, uc.Roles, uc.IsSysAdmin)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, metrics)
}

func (r *Router) handleSpecificAITool(w http.ResponseWriter, req *http.Request, toolID string) {
	if r.aiClient == nil {
		r.logger.Error("AI orchestrator client is not configured")
		security.WriteJSONError(w, http.StatusServiceUnavailable, "AI Orchestrator client unavailable")
		return
	}

	var body struct {
		Parameters map[string]interface{} `json:"parameters"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		r.logger.Warn("Failed to decode AI completion request", "error", err)
		security.WriteJSONError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	uc := middleware.UserContextFromContext(req.Context())
	
	completionReq := contracts.AICompletionRequest{
		ToolID:        toolID,
		InstitutionID: uc.InstitutionID,
		Parameters:    body.Parameters,
	}

	r.logger.Info("Executing secure AI completion request", "tool_id", toolID, "institution_id", uc.InstitutionID)
	resp, err := r.aiClient.ExecutePrompt(req.Context(), &completionReq)
	if err != nil {
		r.logger.Error("AI completion request failed", "tool_id", toolID, "error", err)
		
		if r.auditLogger != nil {
			ipObj := middleware.ClientIP(req)
			ipStr := ""
			if ipObj != nil {
				ipStr = ipObj.String()
			}
			_ = r.auditLogger.Log(req.Context(), security.AuditEvent{
				UserID:     uc.UserID,
				Action:     "EXECUTE_SECURE_AI_PROMPT_FAILED",
				Resource:   "AI_Orchestrator",
				ResourceID: toolID,
				IPAddress:  ipStr,
				Metadata:   map[string]any{"error": err.Error(), "user_agent": req.UserAgent()},
				CreatedAt:  time.Now(),
			})
		}
		
		security.WriteJSONError(w, http.StatusBadGateway, fmt.Sprintf("Upstream Error: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, resp)
}
