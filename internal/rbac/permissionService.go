package rbac

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AiOS Atomic Permission Constants
const (
	// Student Workspace Permissions
	PermissionExecuteAITutor     = "EXECUTE_AI_TUTOR"
	
	// Educator Workspace Permissions
	PermissionGenerateLesson     = "GENERATE_LESSON_PLAN"
	PermissionUseLeveler         = "USE_TEXT_LEVELER"
	PermissionUseVideoAssessor   = "USE_VIDEO_ASSESSOR"
	PermissionGenerateIEP        = "GENERATE_IEP_RUBRIC"
	
	// District / Administrative Permissions
	PermissionManageDistrictAI   = "MANAGE_DISTRICT_AI_KNOWLEDGE"
	PermissionViewAIAudits       = "VIEW_AI_AUDIT_LOGS"

	// Multi-tenant Governance Permissions
	PermissionManageGlobalTenants = "MANAGE_GLOBAL_TENANTS"
	PermissionManageLocalRoles    = "MANAGE_LOCAL_ROLES"
)

type PermissionDefinition struct {
	Name        string
	Description string
	Module      string
}

type Permission struct {
	PermissionID string
	Name         string
	Description  string
	Module       string
}

type PermissionService struct {
	pool *pgxpool.Pool
}

func NewPermissionService(pool *pgxpool.Pool) *PermissionService {
	return &PermissionService{pool: pool}
}

func (s *PermissionService) ImmutableDefinitions() []PermissionDefinition {
	return []PermissionDefinition{
		{Name: "SUPER_ADMIN", Description: "Global super administrator", Module: "core"},
		{Name: "CREATE_USER", Description: "Create users", Module: "users"},
		{Name: "DELETE_USER", Description: "Delete users", Module: "users"},
		{Name: "MANAGE_USERS", Description: "Manage system user signups and roles", Module: "users"},
		{Name: "CREATE_ROLE", Description: "Create roles", Module: "rbac"},
		{Name: "ASSIGN_ROLE", Description: "Assign roles to users", Module: "rbac"},
		{Name: "ASSIGN_PERMISSION", Description: "Assign permissions to roles", Module: "rbac"},
		{Name: "VIEW_WORKSHEET", Description: "Access worksheet service", Module: "worksheet"},
		{Name: "VIEW_ASSESSMENT", Description: "Access assessment service", Module: "assessment"},
		{Name: "MODERATE_CONTENT", Description: "Access moderation service", Module: "moderation"},

		// Student Workspace
		{Name: PermissionExecuteAITutor, Description: "Execute AI Tutor", Module: "ai"},

		// Educator Workspace
		{Name: PermissionGenerateLesson, Description: "Generate lesson plan", Module: "ai"},
		{Name: PermissionUseLeveler, Description: "Use text leveler", Module: "ai"},
		{Name: PermissionUseVideoAssessor, Description: "Use video assessor", Module: "ai"},
		{Name: PermissionGenerateIEP, Description: "Generate IEP rubric", Module: "ai"},

		// District / Administrative
		{Name: PermissionManageDistrictAI, Description: "Manage district AI knowledge", Module: "ai"},
		{Name: PermissionViewAIAudits, Description: "View AI audit logs", Module: "ai"},

		// Multi-tenant Governance
		{Name: PermissionManageGlobalTenants, Description: "Manage global tenant infrastructure", Module: "core"},
		{Name: PermissionManageLocalRoles, Description: "Manage local tenant roles and approvals", Module: "core"},
	}
}

func (s *PermissionService) EnsureImmutablePermissions(ctx context.Context) error {
	if s.pool == nil {
		return errors.New("permission service not configured")
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	for _, p := range s.ImmutableDefinitions() {
		name := strings.ToUpper(strings.TrimSpace(p.Name))
		if name == "" {
			continue
		}
		_, err := tx.Exec(ctx, `
insert into permissions(name, description, module)
values ($1, $2, nullif($3,''))
on conflict (name) do update set description=excluded.description, module=excluded.module`,
			name, strings.TrimSpace(p.Description), strings.TrimSpace(p.Module),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *PermissionService) List(ctx context.Context) ([]Permission, error) {
	if s.pool == nil {
		return nil, errors.New("permission service not configured")
	}
	rows, err := s.pool.Query(ctx, `select permission_id::text, name, coalesce(description,''), coalesce(module,'') from permissions order by name asc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Permission, 0, 64)
	for rows.Next() {
		var p Permission
		if err := rows.Scan(&p.PermissionID, &p.Name, &p.Description, &p.Module); err != nil {
			return nil, err
		}
		p.Name = strings.ToUpper(strings.TrimSpace(p.Name))
		p.Description = strings.TrimSpace(p.Description)
		p.Module = strings.TrimSpace(p.Module)
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *PermissionService) Exists(ctx context.Context, code string) (bool, error) {
	if s.pool == nil {
		return false, errors.New("permission service not configured")
	}
	n := strings.ToUpper(strings.TrimSpace(code))
	if n == "" {
		return false, nil
	}
	var exists bool
	if err := s.pool.QueryRow(ctx, `select exists(select 1 from permissions where name=$1)`, n).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (s *PermissionService) ValidateCodesExist(ctx context.Context, codes []string) error {
	if s.pool == nil {
		return errors.New("permission service not configured")
	}
	normalized := make([]string, 0, len(codes))
	seen := map[string]struct{}{}
	for _, c := range codes {
		v := strings.ToUpper(strings.TrimSpace(c))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		normalized = append(normalized, v)
	}
	if len(normalized) == 0 {
		return nil
	}

	rows, err := s.pool.Query(ctx, `select name from permissions where name = any($1::text[])`, normalized)
	if err != nil {
		return err
	}
	defer rows.Close()

	found := map[string]struct{}{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		name = strings.ToUpper(strings.TrimSpace(name))
		if name != "" {
			found[name] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, c := range normalized {
		if _, ok := found[c]; !ok {
			return errors.New("unknown permission")
		}
	}
	return nil
}
