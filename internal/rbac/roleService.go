package rbac

import (
	"context"
	"errors"
	"strings"
	"time"

	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/security"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoleService struct {
	pool         *pgxpool.Pool
	policyEngine *PolicyEngine
	auditLogger  *security.AuditLogger
	delegation   *DelegationService
	permissions  *PermissionService
}

type ActorContext struct {
	UserID        string
	InstitutionID string
	IsSysAdmin    bool
	RoleIDs       []string
	RoleNames     []string
	Permissions   []string
	CorrelationID string
	IP            string
	UserAgent     string
}

type RoleSummary struct {
	RoleID      string `json:"roleId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsSystem    bool   `json:"isSystem"`
}

func NewRoleService(pool *pgxpool.Pool, auditLogger *security.AuditLogger, delegation *DelegationService) *RoleService {
	return &RoleService{
		pool:         pool,
		policyEngine: NewPolicyEngine(),
		auditLogger:  auditLogger,
		delegation:   delegation,
		permissions:  NewPermissionService(pool),
	}
}

func (s *RoleService) CreateRole(ctx context.Context, actor ActorContext, name, description string) (string, error) {
	if s.pool == nil {
		return "", errors.New("role service not configured")
	}
	n := strings.ToLower(strings.TrimSpace(name))
	if n == "" {
		return "", errors.New("role name required")
	}
	if len(n) > 64 {
		return "", errors.New("role name too long")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageRoles(ctx, actor)
		if err != nil {
			return "", err
		}
		if !can || !s.policyEngine.Allowed(actor.Permissions, "CREATE_ROLE") {
			return "", errors.New("forbidden")
		}
		if strings.TrimSpace(actor.InstitutionID) == "" {
			return "", errors.New("institution required")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return "", err
	}

	var roleID string
	err = tx.QueryRow(ctx, `
insert into roles(institution_id, name, description, is_system_role, created_by)
values (nullif($1,''), $2, nullif($3,''), false, nullif($4,''))
returning role_id`, actor.InstitutionID, n, strings.TrimSpace(description), actor.UserID).Scan(&roleID)
	if err != nil {
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}

	s.audit(ctx, actor, "ROLE_CREATED", "role", roleID, map[string]any{"name": n})

	return roleID, nil
}

func (s *RoleService) AssignPermissionToRole(ctx context.Context, actor ActorContext, roleID, permissionCode string) error {
	if s.pool == nil {
		return errors.New("role service not configured")
	}
	rid := strings.TrimSpace(roleID)
	code := strings.ToUpper(strings.TrimSpace(permissionCode))
	if rid == "" || code == "" {
		return errors.New("roleId and permission required")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageRoles(ctx, actor)
		if err != nil {
			return err
		}
		canPerms, err := s.canManagePermissions(ctx, actor)
		if err != nil {
			return err
		}
		if !can || !canPerms || !s.policyEngine.Allowed(actor.Permissions, "ASSIGN_PERMISSION") {
			return errors.New("forbidden")
		}
		if !s.policyEngine.Allowed(actor.Permissions, code) {
			return errors.New("privilege escalation prevented")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return err
	}

	roleInst, isSystem, err := loadRoleMeta(ctx, tx, rid)
	if err != nil {
		return err
	}
	if !actor.IsSysAdmin {
		if isSystem || roleInst != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
	}
	if s.permissions != nil {
		ok, err := s.permissions.Exists(ctx, code)
		if err != nil {
			return err
		}
		if !ok {
			return errors.New("unknown permission")
		}
	}

	var permID string
	if err := tx.QueryRow(ctx, `select permission_id from permissions where name=$1`, code).Scan(&permID); err != nil {
		return errors.New("unknown permission")
	}

	_, err = tx.Exec(ctx, `insert into role_permissions(role_id, permission_id) values ($1,$2) on conflict (role_id, permission_id) do nothing`, rid, permID)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	s.audit(ctx, actor, "ROLE_PERMISSION_ASSIGNED", "role", rid, map[string]any{"permission": code})

	return nil
}

func (s *RoleService) RemovePermissionFromRole(ctx context.Context, actor ActorContext, roleID, permissionCode string) error {
	if s.pool == nil {
		return errors.New("role service not configured")
	}
	rid := strings.TrimSpace(roleID)
	code := strings.ToUpper(strings.TrimSpace(permissionCode))
	if rid == "" || code == "" {
		return errors.New("roleId and permission required")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageRoles(ctx, actor)
		if err != nil {
			return err
		}
		canPerms, err := s.canManagePermissions(ctx, actor)
		if err != nil {
			return err
		}
		if !can || !canPerms || !s.policyEngine.Allowed(actor.Permissions, "ASSIGN_PERMISSION") {
			return errors.New("forbidden")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return err
	}

	roleInst, isSystem, err := loadRoleMeta(ctx, tx, rid)
	if err != nil {
		return err
	}
	if !actor.IsSysAdmin {
		if isSystem || roleInst != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
	}

	if _, err := tx.Exec(ctx, `
delete from role_permissions rp
using permissions p
where rp.permission_id = p.permission_id
  and rp.role_id = nullif($1,'')::uuid
  and p.name = $2`, rid, code); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	s.audit(ctx, actor, "ROLE_PERMISSION_REMOVED", "role", rid, map[string]any{"permission": code})
	return nil
}

func (s *RoleService) AssignRoleToUser(ctx context.Context, actor ActorContext, userID, roleID string) error {
	if s.pool == nil {
		return errors.New("role service not configured")
	}
	uid := strings.TrimSpace(userID)
	rid := strings.TrimSpace(roleID)
	if uid == "" || rid == "" {
		return errors.New("userId and roleId required")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageUsers(ctx, actor)
		if err != nil {
			return err
		}
		if !can || !s.policyEngine.Allowed(actor.Permissions, "ASSIGN_ROLE") {
			return errors.New("forbidden")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return err
	}

	roleInst, isSystem, err := loadRoleMeta(ctx, tx, rid)
	if err != nil {
		return err
	}
	if !actor.IsSysAdmin {
		if isSystem || roleInst != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
		uInst, err := loadUserInstitution(ctx, tx, uid)
		if err != nil {
			return err
		}
		if strings.TrimSpace(uInst) != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
	}

	_, err = tx.Exec(ctx, `insert into user_roles(user_id, role_id) values ($1,$2) on conflict (user_id, role_id) do nothing`, uid, rid)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	s.audit(ctx, actor, "USER_ROLE_ASSIGNED", "user", uid, map[string]any{"roleId": rid})

	return nil
}

func (s *RoleService) UnassignRoleFromUser(ctx context.Context, actor ActorContext, userID, roleID string) error {
	if s.pool == nil {
		return errors.New("role service not configured")
	}
	uid := strings.TrimSpace(userID)
	rid := strings.TrimSpace(roleID)
	if uid == "" || rid == "" {
		return errors.New("userId and roleId required")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageUsers(ctx, actor)
		if err != nil {
			return err
		}
		if !can || !s.policyEngine.Allowed(actor.Permissions, "ASSIGN_ROLE") {
			return errors.New("forbidden")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return err
	}

	roleInst, isSystem, err := loadRoleMeta(ctx, tx, rid)
	if err != nil {
		return err
	}
	if !actor.IsSysAdmin {
		if isSystem || roleInst != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
		uInst, err := loadUserInstitution(ctx, tx, uid)
		if err != nil {
			return err
		}
		if strings.TrimSpace(uInst) != strings.TrimSpace(actor.InstitutionID) {
			return errors.New("forbidden")
		}
	}

	if _, err := tx.Exec(ctx, `delete from user_roles where user_id = nullif($1,'')::uuid and role_id = nullif($2,'')::uuid`, uid, rid); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	s.audit(ctx, actor, "USER_ROLE_REMOVED", "user", uid, map[string]any{"roleId": rid})
	return nil
}

func (s *RoleService) ListRoles(ctx context.Context, actor ActorContext) ([]RoleSummary, error) {
	if s.pool == nil {
		return nil, errors.New("role service not configured")
	}
	if !actor.IsSysAdmin {
		can, err := s.canManageRoles(ctx, actor)
		if err != nil {
			return nil, err
		}
		if !can || !s.policyEngine.Allowed(actor.Permissions, "CREATE_ROLE") {
			return nil, errors.New("forbidden")
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: actor.InstitutionID}); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `
select role_id, name, coalesce(description,''), is_system_role
from roles
where institution_id is null or institution_id::text = nullif($1,'')
order by is_system_role desc, name asc`, actor.InstitutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]RoleSummary, 0, 16)
	for rows.Next() {
		var r RoleSummary
		if err := rows.Scan(&r.RoleID, &r.Name, &r.Description, &r.IsSystem); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *RoleService) canManageRoles(ctx context.Context, actor ActorContext) (bool, error) {
	if s.delegation == nil {
		return true, nil
	}
	return s.delegation.CanManageRoles(ctx, actor.InstitutionID, actor.UserID)
}

func (s *RoleService) canManagePermissions(ctx context.Context, actor ActorContext) (bool, error) {
	if s.delegation == nil {
		return true, nil
	}
	return s.delegation.CanManagePermissions(ctx, actor.InstitutionID, actor.UserID)
}

func (s *RoleService) canManageUsers(ctx context.Context, actor ActorContext) (bool, error) {
	if s.delegation == nil {
		return true, nil
	}
	return s.delegation.CanManageUsers(ctx, actor.InstitutionID, actor.UserID)
}

func loadRoleMeta(ctx context.Context, tx pgx.Tx, roleID string) (string, bool, error) {
	var inst string
	var isSystem bool
	err := tx.QueryRow(ctx, `select coalesce(institution_id::text,''), is_system_role from roles where role_id = nullif($1,'')::uuid`, roleID).Scan(&inst, &isSystem)
	if err != nil {
		return "", false, errors.New("role not found")
	}
	return strings.TrimSpace(inst), isSystem, nil
}

func loadUserInstitution(ctx context.Context, tx pgx.Tx, userID string) (string, error) {
	var inst string
	if err := tx.QueryRow(ctx, `select coalesce(institution_id::text,'') from users where user_id = nullif($1,'')::uuid`, userID).Scan(&inst); err != nil {
		return "", errors.New("user not found")
	}
	return strings.TrimSpace(inst), nil
}

func (s *RoleService) audit(ctx context.Context, actor ActorContext, action, resourceType, resourceID string, metadata map[string]any) {
	if s.auditLogger == nil {
		return
	}
	_ = s.auditLogger.Log(ctx, security.AuditEvent{
		UserID:     actor.UserID,
		Action:     action,
		Resource:   resourceType,
		ResourceID: resourceID,
		IPAddress:  strings.TrimSpace(actor.IP),
		CreatedAt:  time.Now().UTC(),
		Metadata:   withCorrelation(metadata, actor.CorrelationID),
	})
}

func withCorrelation(meta map[string]any, correlationID string) map[string]any {
	cid := strings.TrimSpace(correlationID)
	if cid == "" {
		return meta
	}
	if meta == nil {
		meta = map[string]any{}
	}
	meta["correlationId"] = cid
	return meta
}
