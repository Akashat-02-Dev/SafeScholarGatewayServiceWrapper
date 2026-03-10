## Overview

SafeScholar uses role-based access control (RBAC) enforced at the gateway layer.

- Users are assigned roles (`user_roles`)
- Roles are assigned permissions (`role_permissions`)
- Permissions are evaluated against per-route requirements
- Delegation policies allow limited admin capabilities to certain roles

## Permission Model

Permissions are strings representing granular actions. Examples:

- `MANAGE_USERS`
- `MANAGE_ROLES`
- `VIEW_WORKSHEET`

Permissions are stored in the `permissions` table and referenced by `role_permissions`.

### Immutable Permission Set

The gateway bootstraps a baseline set of immutable permission codes at startup:

- Source: [PermissionService.ImmutableDefinitions](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/permissionService.go#L22-L38)
- Bootstrap invocation: [bootstrapRunner.go](file:///d:/AdroitBI/Safe-Scholar/cmd/bootstrap/bootstrapRunner.go#L13-L30)

Current immutable definitions:

- `VIEW_DASHBOARD`
- `MANAGE_USERS`
- `MANAGE_ROLES`
- `MANAGE_PERMISSIONS`
- `VIEW_WORKSHEET`
- `VIEW_ASSESSMENT`
- `MODERATE_CONTENT`

## Role Model

Roles are institution-scoped by default (`roles.institution_id`). A role may be marked as `is_system=true` to represent a system role.

Role constraints:

- Role names are unique per institution: `roles_institution_name_uq`
- Role operations enforce institution isolation for non-sysadmin actors

## Route-Level Enforcement

The gateway associates a `RequiredPermission` with each route (or route prefix).

- Route registry: [routeRegistry.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/routeRegistry.go)
- RBAC middleware: [RBACMiddleware](file:///d:/AdroitBI/Safe-Scholar/internal/middleware/rbacMiddleware.go)
- Policy engine: [PolicyEngine.Allowed](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/policyEngine.go#L9-L25)

Rules:

- If a route has no required permission, access is allowed (subject to auth requirement).
- If a required permission is present:
  - unauthenticated → `401`
  - authenticated without permission → `403`
- `SUPER_ADMIN` permission implies allow-all.

## Admin Operations

Admin APIs are exposed under `/api/admin/*` and are protected by both authentication and route-level permissions.

Endpoints:

- `GET /api/admin/roles` (requires `MANAGE_ROLES`)
- `POST /api/admin/roles` (requires `MANAGE_ROLES`)
- `POST /api/admin/roles/assign-permission` (requires `MANAGE_PERMISSIONS`)
- `POST /api/admin/users/assign-role` (requires `MANAGE_USERS`)

Implementation:

- Routing: [router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go#L267-L343)
- Business logic: [roleService.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go)

### Privilege Escalation Prevention

When assigning a permission to a role, non-sysadmin actors must already possess the permission they are attempting to assign. This prevents an actor from granting permissions beyond their own authority.

Implementation: [AssignPermissionToRole](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go#L105-L175)

## Delegated Administration

Delegation policies allow specific roles to be treated as administrators for specific scopes within an institution.

Storage:

- `delegation_policies(institution_id, delegator_role_id, scope, created_by, created_at)`

Supported scopes are evaluated as strings (for example `role_admin`).

Implementation:

- [delegationService.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/delegationService.go)
- Role service checks: [canManageRoles](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go#L396-L412), [canManagePermissions](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go#L413-L421), [canManageUsers](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go#L422-L432)

## Audit Logging

RBAC administrative actions are audited, including role creation and user/role/permission assignments.

- Logger: [auditLogger.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/auditLogger.go)
- `audit_logs` schema: [migrations.go](file:///d:/AdroitBI/Safe-Scholar/infrastructure/database/migrations.go#L182-L194)
