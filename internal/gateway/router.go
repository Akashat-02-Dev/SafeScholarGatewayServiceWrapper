package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	"safescholar/gateway/internal/plugins"
	"safescholar/gateway/internal/rbac"
	"safescholar/gateway/internal/security"
	"safescholar/gateway/internal/trial"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type routeCtxKey string

const ctxKeyRoute routeCtxKey = "gateway_route"

type Router struct {
	routes []Route
	logger *slog.Logger

	authSvc        *auth.AuthService
	oauthSvc       *oauth.OAuthService
	roleSvc        *rbac.RoleService
	registry       *service_registry.Registry
	proxy          *ServiceProxy
	wsService      *WSService
	modClient      *clients.ModerationClient
	auditLogger    *security.AuditLogger
	oversightSvc   *OversightService
	aiClient       clients.AIOrchestratorClient
	redisClient    *redis.Client
	dbPool         *pgxpool.Pool
	trialSvc       *trial.TrialService
	pluginRegistry *plugins.PluginRegistry
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
	TrialService     *trial.TrialService
	PluginRegistry   *plugins.PluginRegistry
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
		routes:         Routes(),
		logger:         deps.Logger,
		authSvc:        deps.AuthService,
		oauthSvc:       deps.OAuthService,
		roleSvc:        deps.RoleService,
		registry:       deps.ServiceRegistry,
		proxy:          deps.ServiceProxy,
		wsService:      deps.WSService,
		modClient:      deps.ModerationClient,
		auditLogger:    deps.AuditLogger,
		oversightSvc:   NewOversightService(deps.RedisClient),
		aiClient:       deps.AIClient,
		redisClient:    deps.RedisClient,
		dbPool:         deps.DBPool,
		trialSvc:       deps.TrialService,
		pluginRegistry: deps.PluginRegistry,
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
	case route.PathPrefix == "/api/auth/institutions":
		r.handleListPublicInstitutions(w, req)
		return
	case route.PathPrefix == "/api/auth/login":
		r.handleLogin(w, req)
		return
	case route.PathPrefix == "/api/auth/forgot-password":
		r.handleForgotPassword(w, req)
		return
	case route.PathPrefix == "/api/auth/reset-password":
		r.handleResetPassword(w, req)
		return
	case route.PathPrefix == "/api/auth/logout":
		r.handleLogout(w, req)
		return
	case route.PathPrefix == "/api/auth/me":
		r.handleMe(w, req)
		return
	case route.PathPrefix == "/api/auth/profile":
		if req.Method == http.MethodGet {
			r.handleGetProfile(w, req)
		} else if req.Method == http.MethodPatch {
			r.handleUpdateProfile(w, req)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
		return
	case route.PathPrefix == "/api/auth/profile/request-change":
		r.handleRequestProfileChange(w, req)
		return
	case route.PathPrefix == "/api/auth/change-password":
		r.handleChangePassword(w, req)
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
	case route.PathPrefix == "/api/v1/ai/educator/report-card":
		r.handleSpecificAITool(w, req, "report_card_generator")
		return
	case route.PathPrefix == "/api/v1/ai/educator/ismg-rubric":
		r.handleSpecificAITool(w, req, "ismg_rubric_generator")
		return
	case route.PathPrefix == "/api/v1/ai/educator/worksheet-generator":
		r.handleSpecificAITool(w, req, "worksheet_generator")
		return
	case route.PathPrefix == "/api/v1/ai/educator/assessment-generator":
		r.handleSpecificAITool(w, req, "assessment_generator")
		return
	case route.PathPrefix == "/api/v1/ai/educator/leveler" || route.PathPrefix == "/api/v1/ai/educator/text-leveler" || route.PathPrefix == "/api/v1/ai/student/text-leveler":
		r.handleSpecificAITool(w, req, "leveler")
		return
	case route.PathPrefix == "/api/v1/ai/educator/report-card" || route.PathPrefix == "/api/v1/ai/admin/report-card-generator":
		r.handleSpecificAITool(w, req, "report_card_generator")
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
	case route.PathPrefix == "/api/v1/ai/student/quiz-generator" || route.PathPrefix == "/api/v1/ai/student/quiz-me":
		r.handleSpecificAITool(w, req, "quiz_generator")
		return
	case route.PathPrefix == "/api/v1/ai/student/socratic-tutor":
		r.handleSpecificAITool(w, req, "socratic_tutor")
		return
	case route.PathPrefix == "/api/v1/ai/student/character-bot":
		r.handleSpecificAITool(w, req, "character_bot")
		return
	case route.PathPrefix == "/api/v1/ai/student/custom-bot":
		r.handleSpecificAITool(w, req, "custom_bot")
		return
	case route.PathPrefix == "/api/v1/lms/export":
		r.handleLmsExport(w, req)
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
		if r.pluginRegistry != nil {
			if dynamicPlugin, ok := r.pluginRegistry.MatchPluginEndpoint(req.URL.Path); ok {
				r.handleDynamicPluginRequest(w, req, dynamicPlugin)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
		return
	}
}

// Phase 2: Strict IMS Global LTI 1.3 Endpoints
func (r *Router) handleLTIInit(w http.ResponseWriter, _ *http.Request) {
	// 1. OIDC Initiation
	security.WriteJSONError(w, http.StatusNotImplemented, "LTI Init not fully implemented")
}

func (r *Router) handleLmsExport(w http.ResponseWriter, req *http.Request) {
	var payload map[string]interface{}

	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	// In a real application, we would use LTI 1.3 Deep Linking or Canvas API here.
	// We dynamically handle both the LMSExportPayload (from LessonPlanner) and the new HtmlContent payload.
	targetLMS := "canvas"
	if platform, ok := payload["platform"].(string); ok {
		targetLMS = platform
	} else if target, ok := payload["target_lms"].(string); ok {
		targetLMS = target
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Successfully pushed content to " + targetLMS,
		"external_id": "simulated-lms-export-12345",
	})
}

func (r *Router) handleLTILaunch(w http.ResponseWriter, _ *http.Request) {
	// 2. The secure redirect
	security.WriteJSONError(w, http.StatusNotImplemented, "LTI Launch not fully implemented")
}

func (r *Router) handleJWKS(w http.ResponseWriter, _ *http.Request) {
	// 3. Public key exposure for LMS verification
	writeJSON(w, http.StatusOK, map[string]any{"keys": []any{}})
}

func (r *Router) handleProxy(w http.ResponseWriter, req *http.Request, route Route) {
	pluginID := route.ServiceName
	switch pluginID {
	case ServiceWorksheet:
		pluginID = "worksheet_service"
	case ServiceAssessment:
		pluginID = "assessment_service"
	case ServiceModeration:
		pluginID = "moderation_service"
	case "lms-integration":
		pluginID = "lms_integration"
	}

	uc := middleware.UserContextFromContext(req.Context())
	if r.pluginRegistry != nil && pluginID != "" {
		if !r.pluginRegistry.IsPluginEnabled(pluginID, uc.InstitutionID) {
			security.WriteJSONError(w, http.StatusForbidden, fmt.Sprintf("Feature '%s' is currently disabled by administrator", pluginID))
			return
		}
		if p, ok := r.pluginRegistry.GetPlugin(pluginID); ok {
			allowed, _ := p.CircuitBreaker.AllowRequest()
			if !allowed {
				security.WriteJSONError(w, http.StatusServiceUnavailable, fmt.Sprintf("Circuit breaker OPEN for upstream '%s'", pluginID))
				return
			}
		}
	}

	start := time.Now()
	baseURL, err := r.registry.Resolve(req.Context(), route.ServiceName)
	if err != nil {
		if r.pluginRegistry != nil && pluginID != "" {
			if p, ok := r.pluginRegistry.GetPlugin(pluginID); ok {
				p.CircuitBreaker.RecordFailure(err)
			}
		}
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	if err := r.proxy.Forward(w, req, baseURL, route.StripPrefix); err != nil {
		if r.pluginRegistry != nil && pluginID != "" {
			if p, ok := r.pluginRegistry.GetPlugin(pluginID); ok {
				p.CircuitBreaker.RecordFailure(err)
			}
		}
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	if r.pluginRegistry != nil && pluginID != "" {
		if p, ok := r.pluginRegistry.GetPlugin(pluginID); ok {
			p.CircuitBreaker.RecordSuccess(time.Since(start))
		}
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
	accessTTL := 24 * time.Hour
	refreshTTL := 30 * 24 * time.Hour
	result, err := r.authSvc.Login(req.Context(), lr.Email, lr.Password, ip, req.UserAgent(), middleware.CorrelationIDFromContext(req.Context()), accessTTL, refreshTTL)
	if err != nil {
		msg := err.Error()
		low := strings.ToLower(msg)
		if strings.Contains(low, "pending") || strings.Contains(low, "rejected") || strings.Contains(low, "disabled") || strings.Contains(low, "locked") {
			security.WriteJSONError(w, http.StatusForbidden, msg)
			return
		}
		security.WriteJSONError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"accessToken":      result.AccessToken,
		"refreshToken":     result.RefreshToken,
		"expiresInSeconds": int64(accessTTL.Seconds()),
	})
}

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

func (r *Router) handleForgotPassword(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var fr forgotPasswordRequest
	if err := json.NewDecoder(req.Body).Decode(&fr); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	// Call ForgotPassword; it shouldn't reveal if user exists
	_ = r.authSvc.ForgotPassword(req.Context(), fr.Email)
	
	// Always return 200 to prevent user enumeration
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "If an account with that email exists, a password reset link has been generated.",
	})
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (r *Router) handleResetPassword(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var rr resetPasswordRequest
	if err := json.NewDecoder(req.Body).Decode(&rr); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	err := r.authSvc.ResetPassword(req.Context(), rr.Token, rr.NewPassword)
	if err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Password successfully reset.",
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

func (r *Router) handleGetProfile(w http.ResponseWriter, req *http.Request) {
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	profile, err := r.authSvc.GetProfile(req.Context(), uc.UserID)
	if err != nil {
		security.WriteJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (r *Router) handleUpdateProfile(w http.ResponseWriter, req *http.Request) {
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var up auth.UpdateProfileRequest
	if err := json.NewDecoder(req.Body).Decode(&up); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.authSvc.UpdateProfile(req.Context(), uc.UserID, up); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Profile updated successfully.",
	})
}

func (r *Router) handleRequestProfileChange(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var payload auth.ProfileChangeRequestPayload
	if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.authSvc.RequestProfileChange(req.Context(), uc.UserID, uc.InstitutionID, payload); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"message": "Profile change request submitted successfully for administrator review.",
		"status":  "PENDING",
	})
}

type changePasswordReq struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (r *Router) handleChangePassword(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsAuthenticated {
		security.WriteJSONError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var cp changePasswordReq
	if err := json.NewDecoder(req.Body).Decode(&cp); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.authSvc.ChangePassword(req.Context(), uc.UserID, cp.CurrentPassword, cp.NewPassword); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Password changed successfully.",
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
	case "/api/v1/admin/trials":
		if req.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleListTrials(w, req)
		return
	case "/api/v1/admin/trials/onboard":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleOnboardTrial(w, req)
		return
	case "/api/v1/admin/trials/toggle":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleToggleTrial(w, req)
		return
	case "/api/v1/admin/institution-requests":
		if req.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleListInstitutionRequests(w, req)
		return
	case "/api/v1/admin/institution-requests/review":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleReviewInstitutionRequest(w, req)
		return
	case "/api/admin/roles/update":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleUpdateRole(w, req, actor)
		return
	case "/api/admin/roles/delete":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleDeleteRole(w, req, actor)
		return
	case "/api/admin/roles/unassign-permission":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleUnassignPermission(w, req, actor)
		return
	case "/api/admin/permissions":
		r.handleAdminPermissions(w, req, actor)
		return
	case "/api/admin/permissions/delete":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		r.handleDeletePermission(w, req, actor)
		return
	case "/api/v1/admin/plugins",
		"/api/v1/admin/plugins/toggle",
		"/api/v1/admin/plugins/config",
		"/api/v1/admin/plugins/reset-circuit",
		"/api/v1/admin/plugins/tenant-override",
		"/api/v1/admin/plugins/health-check":
		r.handleAdminPlugins(w, req, prefix, actor)
		return
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

func (r *Router) handleRegister(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	var rr auth.RegisterRequest
	if err := json.NewDecoder(req.Body).Decode(&rr); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	ip := middleware.ClientIP(req)
	ua := req.UserAgent()
	cid := middleware.CorrelationIDFromContext(req.Context())
	err := r.authSvc.Register(req.Context(), rr, ip, ua, cid)
	if err != nil {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "exists") {
			writeJSON(w, http.StatusConflict, map[string]any{"error": "user already exists"})
			return
		}
		if strings.Contains(msg, "required") || strings.Contains(msg, "password") || strings.Contains(msg, "invalid") || strings.Contains(msg, "must be") {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"status":  "pending_approval",
		"message": "Account registration submitted successfully. It will be reviewed by the appropriate administrator.",
	})
}

func (r *Router) handleListPublicInstitutions(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	insts, err := r.authSvc.ListPublicInstitutions(req.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"institutions": insts})
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
	Reason string `json:"reason,omitempty"`
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
	if r.trialSvc != nil && ar.Status == "active" {
		if err := r.validateUserApprovalAgainstTrial(req.Context(), ar.UserID, ar.RoleID); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	uc := middleware.UserContextFromContext(req.Context())
	err := r.authSvc.ApproveUser(req.Context(), uc.UserID, uc.InstitutionID, uc.IsSysAdmin, ar.UserID, ar.Status, ar.RoleID, ar.Reason)
	if err != nil {
		msg := strings.ToLower(strings.TrimSpace(err.Error()))
		if strings.Contains(msg, "not found") || strings.Contains(msg, "unknown") {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": err.Error()})
			return
		}
		if strings.Contains(msg, "forbidden") {
			writeJSON(w, http.StatusForbidden, map[string]any{"error": err.Error()})
			return
		}
		if strings.Contains(msg, "invalid") || strings.Contains(msg, "required") {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleListInstitutionRequests(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	reqs, err := r.authSvc.ListInstitutionRequests(req.Context(), uc.IsSysAdmin)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"requests": reqs})
}

type reviewInstitutionPayload struct {
	RequestID       string `json:"requestId"`
	Decision        string `json:"decision"`
	RejectionReason string `json:"rejectionReason,omitempty"`
}

func (r *Router) handleReviewInstitutionRequest(w http.ResponseWriter, req *http.Request) {
	if r.authSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	var rip reviewInstitutionPayload
	if err := json.NewDecoder(req.Body).Decode(&rip); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid request body"})
		return
	}
	if err := r.authSvc.ReviewInstitutionRequest(req.Context(), uc.IsSysAdmin, uc.UserID, rip.RequestID, rip.Decision, rip.RejectionReason); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Institution request updated successfully"})
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

	r.logger.Info("Executing resilient AI completion request", "tool_id", toolID, "institution_id", uc.InstitutionID)

	var resp any
	var isFallback bool
	var err error

	if r.pluginRegistry != nil {
		resp, isFallback, err = r.pluginRegistry.ExecuteWithResilience(
			req.Context(),
			toolID,
			uc.InstitutionID,
			func(execCtx context.Context) (any, error) {
				return r.aiClient.ExecutePrompt(execCtx, &completionReq)
			},
			body.Parameters,
		)
	} else {
		resp, err = r.aiClient.ExecutePrompt(req.Context(), &completionReq)
	}

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
		
		if errors.Is(err, plugins.ErrPluginDisabled) {
			security.WriteJSONError(w, http.StatusForbidden, err.Error())
			return
		}
		if errors.Is(err, plugins.ErrCircuitOpen) {
			security.WriteJSONError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		security.WriteJSONError(w, http.StatusBadGateway, fmt.Sprintf("Upstream Error: %v", err))
		return
	}

	if isFallback {
		w.Header().Set("X-Feature-Fallback", "true")
	}
	writeJSON(w, http.StatusOK, resp)
}

func (r *Router) handleListTrials(w http.ResponseWriter, req *http.Request) {
	if r.trialSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	trials, err := r.trialSvc.ListTrialInstitutes(req.Context(), uc.IsSysAdmin)
	if err != nil {
		security.WriteJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"trials": trials})
}

func (r *Router) handleOnboardTrial(w http.ResponseWriter, req *http.Request) {
	if r.trialSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	var otr trial.OnboardTrialRequest
	if err := json.NewDecoder(req.Body).Decode(&otr); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	inst, err := r.trialSvc.OnboardTrialInstitute(req.Context(), uc.IsSysAdmin, otr)
	if err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, inst)
}

func (r *Router) handleToggleTrial(w http.ResponseWriter, req *http.Request) {
	if r.trialSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	uc := middleware.UserContextFromContext(req.Context())
	if !uc.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	var ttr trial.ToggleTrialRequest
	if err := json.NewDecoder(req.Body).Decode(&ttr); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.trialSvc.ToggleTrial(req.Context(), uc.IsSysAdmin, ttr); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (r *Router) validateUserApprovalAgainstTrial(ctx context.Context, userID, roleID string) error {
	if r.dbPool == nil || r.trialSvc == nil {
		return nil
	}
	var instID string
	err := r.dbPool.QueryRow(ctx, `select coalesce(institution_id::text,'') from users where user_id=nullif($1,'')::uuid`, userID).Scan(&instID)
	if err != nil || instID == "" {
		return nil
	}

	roleName := "teacher"
	if roleID != "" {
		var name string
		_ = r.dbPool.QueryRow(ctx, `select lower(name) from roles where role_id=nullif($1,'')::uuid`, roleID).Scan(&name)
		if name != "" {
			roleName = name
		}
	}
	return r.trialSvc.ValidateTrialQuota(ctx, instID, roleName)
}

type updateRoleRequest struct {
	RoleID      string `json:"roleId"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (r *Router) handleUpdateRole(w http.ResponseWriter, req *http.Request, actor rbac.ActorContext) {
	var body updateRoleRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.roleSvc.UpdateRole(req.Context(), actor, body.RoleID, body.Name, body.Description); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Role updated successfully"})
}

func (r *Router) handleDeleteRole(w http.ResponseWriter, req *http.Request, actor rbac.ActorContext) {
	var body struct {
		RoleID string `json:"roleId"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.roleSvc.DeleteRole(req.Context(), actor, body.RoleID); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Role deleted successfully"})
}

func (r *Router) handleUnassignPermission(w http.ResponseWriter, req *http.Request, actor rbac.ActorContext) {
	var ap assignPermissionRequest
	if err := json.NewDecoder(req.Body).Decode(&ap); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.roleSvc.RemovePermissionFromRole(req.Context(), actor, ap.RoleID, ap.PermissionCode); err != nil {
		security.WriteJSONError(w, http.StatusForbidden, "forbidden")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (r *Router) handleAdminPermissions(w http.ResponseWriter, req *http.Request, actor rbac.ActorContext) {
	if r.roleSvc == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	if req.Method == http.MethodGet {
		perms, err := r.roleSvc.Permissions().List(req.Context())
		if err != nil {
			security.WriteJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"permissions": perms})
		return
	}
	if req.Method == http.MethodPost {
		if !actor.IsSysAdmin {
			security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
			return
		}
		var cp struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Module      string `json:"module"`
		}
		if err := json.NewDecoder(req.Body).Decode(&cp); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.roleSvc.Permissions().Create(req.Context(), cp.Name, cp.Description, cp.Module); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"message": "Permission created successfully", "name": cp.Name})
		return
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (r *Router) handleDeletePermission(w http.ResponseWriter, req *http.Request, actor rbac.ActorContext) {
	if !actor.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}
	var dp struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(req.Body).Decode(&dp); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := r.roleSvc.Permissions().Delete(req.Context(), dp.Name); err != nil {
		security.WriteJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Permission deleted successfully"})
}

func (r *Router) handleAdminPlugins(w http.ResponseWriter, req *http.Request, prefix string, actor rbac.ActorContext) {
	if r.pluginRegistry == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	if !actor.IsSysAdmin {
		security.WriteJSONError(w, http.StatusForbidden, "super admin access required")
		return
	}

	switch prefix {
	case "/api/v1/admin/plugins":
		if req.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		instID := req.URL.Query().Get("institutionId")
		list := r.pluginRegistry.ListPlugins(instID)
		writeJSON(w, http.StatusOK, map[string]any{"plugins": list})
		return

	case "/api/v1/admin/plugins/toggle":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var tp plugins.TogglePluginRequest
		if err := json.NewDecoder(req.Body).Decode(&tp); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.pluginRegistry.TogglePlugin(req.Context(), tp.PluginID, tp.Enabled); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"message":  "Plugin state toggled successfully",
			"pluginId": tp.PluginID,
			"enabled":  tp.Enabled,
		})
		return

	case "/api/v1/admin/plugins/config":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var up plugins.UpdatePluginConfigRequest
		if err := json.NewDecoder(req.Body).Decode(&up); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.pluginRegistry.UpdatePluginConfig(req.Context(), up); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Plugin configuration updated successfully"})
		return

	case "/api/v1/admin/plugins/reset-circuit":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var rc plugins.ResetCircuitRequest
		if err := json.NewDecoder(req.Body).Decode(&rc); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		ok := r.pluginRegistry.ResetCircuit(rc.PluginID)
		if !ok {
			security.WriteJSONError(w, http.StatusNotFound, "plugin not found")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Circuit breaker reset to CLOSED state", "pluginId": rc.PluginID})
		return

	case "/api/v1/admin/plugins/tenant-override":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var to plugins.TenantOverrideRequest
		if err := json.NewDecoder(req.Body).Decode(&to); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := r.pluginRegistry.SetTenantOverride(req.Context(), to.InstitutionID, to.PluginID, to.Enabled); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Tenant override configured successfully"})
		return

	case "/api/v1/admin/plugins/health-check":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var hc struct {
			PluginID string `json:"pluginId"`
		}
		if err := json.NewDecoder(req.Body).Decode(&hc); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		p, exists := r.pluginRegistry.GetPlugin(hc.PluginID)
		if !exists {
			security.WriteJSONError(w, http.StatusNotFound, "plugin not found")
			return
		}
		start := time.Now()
		var healthy bool
		var detail string
		if p.TargetService == "internal" {
			healthy = true
			detail = "Internal gateway subsystem operational"
		} else {
			baseURL, err := r.registry.Resolve(req.Context(), p.TargetService)
			if err != nil {
				healthy = false
				detail = fmt.Sprintf("Service registry cannot resolve '%s': %v", p.TargetService, err)
			} else {
				healthy = true
				detail = fmt.Sprintf("Service reachable at %s", baseURL)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"pluginId":      p.ID,
			"targetService": p.TargetService,
			"healthy":       healthy,
			"detail":        detail,
			"latencyMs":     time.Since(start).Milliseconds(),
			"circuitState":  p.CircuitBreaker.GetStats().State,
		})
		return

	case "/api/v1/admin/plugins/create":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var cp plugins.CreatePluginRequest
		if err := json.NewDecoder(req.Body).Decode(&cp); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}
		created, err := r.pluginRegistry.CreatePlugin(req.Context(), cp)
		if err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"message": "Custom feature plugin created successfully",
			"plugin":  created,
		})
		return

	case "/api/v1/admin/plugins/update":
		if req.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var up plugins.UpdatePluginRequest
		if err := json.NewDecoder(req.Body).Decode(&up); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
			return
		}
		if err := r.pluginRegistry.UpdatePlugin(req.Context(), up); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Feature plugin updated successfully"})
		return

	case "/api/v1/admin/plugins/delete":
		if req.Method != http.MethodPost && req.Method != http.MethodDelete {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var dp plugins.DeletePluginRequest
		if req.Body != nil {
			_ = json.NewDecoder(req.Body).Decode(&dp)
		}
		if dp.PluginID == "" {
			dp.PluginID = req.URL.Query().Get("pluginId")
		}
		if err := r.pluginRegistry.DeletePlugin(req.Context(), dp.PluginID); err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"message":  "Custom feature plugin deleted successfully",
			"pluginId": dp.PluginID,
		})
		return

	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

func (r *Router) handleDynamicPluginRequest(w http.ResponseWriter, req *http.Request, plugin *plugins.Plugin) {
	uc := middleware.UserContextFromContext(req.Context())

	// 1. Check required permission if configured
	if plugin.RequiredPermission != "" {
		hasAccess := uc.IsSysAdmin
		if !hasAccess {
			for _, r := range uc.Roles {
				rLower := strings.ToLower(strings.TrimSpace(r))
				if rLower == "sys_admin" || rLower == "super_admin" || rLower == "superadmin" || rLower == "sysadmin" {
					hasAccess = true
					break
				}
			}
		}
		if !hasAccess {
			for _, p := range uc.Permissions {
				if strings.EqualFold(p, plugin.RequiredPermission) || strings.EqualFold(p, "SUPER_ADMIN") {
					hasAccess = true
					break
				}
			}
		}
		if !hasAccess {
			security.WriteJSONError(w, http.StatusForbidden, fmt.Sprintf("Forbidden: requires permission '%s'", plugin.RequiredPermission))
			return
		}
	}

	// 2. Read request body safely
	var bodyBytes []byte
	if req.Body != nil {
		var err error
		bodyBytes, err = io.ReadAll(req.Body)
		if err != nil {
			security.WriteJSONError(w, http.StatusBadRequest, "failed to read request body")
			return
		}
		req.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	// 3. Execute with circuit breaker & timeout protection
	res, isFallback, err := r.pluginRegistry.ExecuteWithResilience(
		req.Context(),
		plugin.ID,
		uc.InstitutionID,
		func(execCtx context.Context) (any, error) {
			targetURL := plugin.TargetURL
			if targetURL == "" {
				resolved, err := r.registry.Resolve(execCtx, plugin.TargetService)
				if err != nil {
					return nil, fmt.Errorf("service registry cannot resolve '%s': %w", plugin.TargetService, err)
				}
				targetURL = resolved + req.URL.Path
				if req.URL.RawQuery != "" {
					targetURL += "?" + req.URL.RawQuery
				}
			}

			proxyReq, err := http.NewRequestWithContext(execCtx, req.Method, targetURL, bytes.NewReader(bodyBytes))
			if err != nil {
				return nil, err
			}
			for k, v := range req.Header {
				proxyReq.Header[k] = v
			}
			proxyReq.Header.Set("X-Forwarded-For", req.RemoteAddr)
			if uc.UserID != "" {
				proxyReq.Header.Set("X-User-Id", uc.UserID)
				proxyReq.Header.Set("X-Institution-Id", uc.InstitutionID)
			}

			timeoutSecs := plugin.TimeoutSeconds
			if timeoutSecs <= 0 {
				timeoutSecs = 20
			}
			client := &http.Client{Timeout: time.Duration(timeoutSecs) * time.Second}
			resp, err := client.Do(proxyReq)
			if err != nil {
				return nil, err
			}
			defer resp.Body.Close()

			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, err
			}

			if resp.StatusCode >= 500 {
				return nil, fmt.Errorf("upstream returned server error: %d", resp.StatusCode)
			}

			return map[string]any{
				"statusCode":  resp.StatusCode,
				"contentType": resp.Header.Get("Content-Type"),
				"body":        respBody,
			}, nil
		},
		map[string]interface{}{"path": req.URL.Path},
	)

	if isFallback {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Resilience-Fallback", "true")
		w.Header().Set("X-Plugin-ID", plugin.ID)
		w.WriteHeader(http.StatusOK)
		if str, ok := res.(string); ok {
			w.Write([]byte(str))
		} else {
			_ = json.NewEncoder(w).Encode(res)
		}
		return
	}

	if err != nil {
		if errors.Is(err, plugins.ErrCircuitOpen) {
			security.WriteJSONError(w, http.StatusServiceUnavailable, err.Error())
		} else if errors.Is(err, plugins.ErrPluginDisabled) {
			security.WriteJSONError(w, http.StatusForbidden, err.Error())
		} else {
			security.WriteJSONError(w, http.StatusBadGateway, fmt.Sprintf("Upstream failure in feature '%s': %v", plugin.ID, err))
		}
		return
	}

	// Successful proxy response
	if proxyMap, ok := res.(map[string]any); ok {
		if ct, ok := proxyMap["contentType"].(string); ok && ct != "" {
			w.Header().Set("Content-Type", ct)
		} else {
			w.Header().Set("Content-Type", "application/json")
		}
		statusCode := http.StatusOK
		if sc, ok := proxyMap["statusCode"].(int); ok && sc > 0 {
			statusCode = sc
		}
		w.WriteHeader(statusCode)
		if b, ok := proxyMap["body"].([]byte); ok {
			w.Write(b)
		}
		return
	}

	writeJSON(w, http.StatusOK, res)
}

