package rbac

import (
	"context"
	"errors"
	"strings"

	"safescholar/gateway/infrastructure/database"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DelegationService struct {
	pool *pgxpool.Pool
}

func NewDelegationService(pool *pgxpool.Pool) *DelegationService {
	return &DelegationService{pool: pool}
}

const (
	DelegationScopeRoleAdmin       = "role_admin"
	DelegationScopePermissionAdmin = "permission_admin"
	DelegationScopeUserAdmin       = "user_admin"
)

func (s *DelegationService) CanManageRoles(ctx context.Context, institutionID, actorUserID string) (bool, error) {
	return s.hasScope(ctx, institutionID, actorUserID, DelegationScopeRoleAdmin)
}

func (s *DelegationService) CanManagePermissions(ctx context.Context, institutionID, actorUserID string) (bool, error) {
	return s.hasScope(ctx, institutionID, actorUserID, DelegationScopePermissionAdmin)
}

func (s *DelegationService) CanManageUsers(ctx context.Context, institutionID, actorUserID string) (bool, error) {
	return s.hasScope(ctx, institutionID, actorUserID, DelegationScopeUserAdmin)
}

func (s *DelegationService) hasScope(ctx context.Context, institutionID, actorUserID string, scope string) (bool, error) {
	if s.pool == nil {
		return false, errors.New("delegation service not configured")
	}
	inst := strings.TrimSpace(institutionID)
	if inst == "" {
		return false, nil
	}
	uid := strings.TrimSpace(actorUserID)
	if uid == "" {
		return false, nil
	}
	scope = strings.ToLower(strings.TrimSpace(scope))
	if scope == "" {
		return false, nil
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: inst}); err != nil {
		return false, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
select exists(
  select 1
  from delegation_policies dp
  where dp.delegate_user_id = nullif($1,'')::uuid
    and lower(dp.scope) = lower($2)
)`, uid, scope).Scan(&exists); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return exists, nil
}
