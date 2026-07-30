package gateway

import (
	"net/http"

	"safescholar/gateway/internal/rbac"
)

const (
	ServiceWorksheet  = "worksheet"
	ServiceAssessment = "assessment"
	ServiceModeration = "moderation"
)

const (
	PermissionCreateRole       = "CREATE_ROLE"
	PermissionAssignPermission = "ASSIGN_PERMISSION"
	PermissionAssignRole       = "ASSIGN_ROLE"
	PermissionCreateUser       = "CREATE_USER"
	PermissionDeleteUser       = "DELETE_USER"
	PermissionManageUsers      = "MANAGE_USERS"
	PermissionViewWorksheet    = "VIEW_WORKSHEET"
	PermissionViewAssessment   = "VIEW_ASSESSMENT"
	PermissionModerateContent  = "MODERATE_CONTENT"
)

type Route struct {
	Method             string
	PathPrefix         string
	ServiceName        string
	StripPrefix        string
	RequiredPermission string
	AuthRequired       bool
}

func Routes() []Route {
	return []Route{
		{Method: http.MethodGet, PathPrefix: "/healthz", AuthRequired: false},

		{Method: http.MethodPost, PathPrefix: "/api/auth/register", AuthRequired: false},
		{Method: http.MethodPost, PathPrefix: "/api/auth/login", AuthRequired: false},
		{Method: http.MethodPost, PathPrefix: "/api/auth/logout", AuthRequired: true},
		{Method: http.MethodGet, PathPrefix: "/api/auth/me", AuthRequired: true},
		{Method: http.MethodGet, PathPrefix: "/api/v1/dashboard/metrics", AuthRequired: true},

		{Method: http.MethodGet, PathPrefix: "/api/oauth/google/start", AuthRequired: false},
		{Method: http.MethodGet, PathPrefix: "/api/oauth/google/callback", AuthRequired: false},
		{Method: http.MethodGet, PathPrefix: "/api/oauth/microsoft/start", AuthRequired: false},
		{Method: http.MethodGet, PathPrefix: "/api/oauth/microsoft/callback", AuthRequired: false},
		{Method: http.MethodGet, PathPrefix: "/api/oauth/apple/start", AuthRequired: false},
		{Method: http.MethodGet, PathPrefix: "/api/oauth/apple/callback", AuthRequired: false},

		{Method: http.MethodGet, PathPrefix: "/api/admin/users", AuthRequired: true, RequiredPermission: PermissionManageUsers},
		{Method: http.MethodGet, PathPrefix: "/api/admin/users/approvals", AuthRequired: true, RequiredPermission: PermissionManageUsers},
		{Method: http.MethodPost, PathPrefix: "/api/admin/users/approve", AuthRequired: true, RequiredPermission: PermissionManageUsers},
		{Method: http.MethodPost, PathPrefix: "/api/admin/users/delete", AuthRequired: true, RequiredPermission: PermissionManageUsers},
		{Method: http.MethodPost, PathPrefix: "/api/v1/admin/users/delete", AuthRequired: true, RequiredPermission: PermissionManageUsers},
		{Method: http.MethodGet, PathPrefix: "/api/admin/roles", AuthRequired: true, RequiredPermission: PermissionCreateRole},
		{Method: http.MethodPost, PathPrefix: "/api/admin/roles", AuthRequired: true, RequiredPermission: PermissionCreateRole},
		{Method: http.MethodPost, PathPrefix: "/api/admin/roles/assign-permission", AuthRequired: true, RequiredPermission: PermissionAssignPermission},
		{Method: http.MethodPost, PathPrefix: "/api/admin/users/assign-role", AuthRequired: true, RequiredPermission: PermissionAssignRole},

		// AiOS Endpoints
		{Method: http.MethodGet, PathPrefix: "/api/v1/ai/tutor", AuthRequired: true, RequiredPermission: rbac.PermissionExecuteAITutor, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/ai/educator/lesson-planner", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionGenerateLesson, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/ai/educator/leveler", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionUseLeveler, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/ai/educator/video-question-maker", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionUseVideoAssessor, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/ai/educator/iep-generator", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionGenerateIEP, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/rag/ingest", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionManageDistrictAI, ServiceName: "ai-orchestrator"},
		{Method: http.MethodPost, PathPrefix: "/api/v1/lms/export", StripPrefix: "/api", AuthRequired: true, RequiredPermission: rbac.PermissionGenerateLesson, ServiceName: "lms-integration"},

		{Method: "", PathPrefix: "/api/worksheet/", ServiceName: ServiceWorksheet, StripPrefix: "/api/worksheet", AuthRequired: true, RequiredPermission: PermissionViewWorksheet},
		{Method: "", PathPrefix: "/api/assessment/", ServiceName: ServiceAssessment, StripPrefix: "/api/assessment", AuthRequired: true, RequiredPermission: PermissionViewAssessment},
		{Method: "", PathPrefix: "/api/moderation/", ServiceName: ServiceModeration, StripPrefix: "/api/moderation", AuthRequired: true, RequiredPermission: PermissionModerateContent},
	}
}
