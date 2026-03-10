## Conventions

### Base URL

- Dev example: `https://localhost:8443` (see [config.dev.yaml](file:///d:/AdroitBI/Safe-Scholar/config/config.dev.yaml))

### Authentication

- Authenticated requests use `Authorization: Bearer <access_token>`.
- Most API endpoints require authentication; see each endpoint below.

### RBAC Permissions

The gateway enforces a route-level `RequiredPermission` for selected endpoints and all proxied service routes.

Canonical permission codes are bootstrapped into the database by:

- [PermissionService.ImmutableDefinitions](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/permissionService.go#L22-L38)

### Correlation IDs

- Clients may provide `X-Request-Id`.
- The gateway generates/propagates correlation IDs and logs them.

### Errors

The gateway uses standard HTTP status codes. Response bodies for errors may be empty.

- `400 Bad Request`: malformed request
- `401 Unauthorized`: missing/invalid authentication (or inactive session)
- `403 Forbidden`: authenticated but lacking required permission
- `404 Not Found`: no matching route
- `405 Method Not Allowed`: incorrect method for a route
- `502 Bad Gateway`: downstream service failure when proxying

## Public Endpoints

### GET /healthz

- Auth: not required
- Purpose: liveness/readiness probe

Response:

```
200 OK
ok
```

## Authentication Endpoints

Routes are implemented in [router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go).

### POST /api/auth/login

- Auth: not required
- Rate limited: yes (global gateway limiter + auth-specific attempt controls)

Request JSON:

```json
{
  "email": "user@example.com",
  "password": "CorrectHorseBatteryStaple"
}
```

Response JSON:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresInSeconds": 900
}
```

Status codes:

- `200 OK` success
- `400 Bad Request` invalid JSON body
- `401 Unauthorized` invalid credentials

### POST /api/auth/logout

- Auth: required (access token)

Response:

- `204 No Content` success
- `401 Unauthorized` missing/invalid token

Behavior:

- Revokes the user session (`sessions.revoked_at`) and removes the session cache entry
- Blacklists the current access token id in Redis for a short window

Implementation: [AuthService.Logout](file:///d:/AdroitBI/Safe-Scholar/internal/auth/authService.go#L208-L214)

### GET /api/auth/me

- Auth: required (access token)

Response JSON:

```json
{
  "userId": "uuid",
  "institutionId": "uuid",
  "email": "user@example.com",
  "firstName": "First",
  "lastName": "Last",
  "isSysAdmin": false,
  "roles": ["teacher"],
  "permissions": ["VIEW_WORKSHEET","VIEW_ASSESSMENT"]
}
```

Status codes:

- `200 OK` success
- `401 Unauthorized` missing/invalid token or inactive user

## OAuth Endpoints (OIDC)

Implemented in [router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go) and [oauthService.go](file:///d:/AdroitBI/Safe-Scholar/internal/oauth/oauthService.go).

### GET /api/oauth/{provider}/start

Providers:

- `google`
- `microsoft`
- `apple`

Auth: not required

Behavior:

- Generates an OAuth state value and stores it (Redis when configured)
- Sets an `HttpOnly` + `Secure` state cookie scoped to `/api/oauth/`
- Redirects to the provider authorization URL

Responses:

- `302 Found` redirect to provider
- `400 Bad Request` provider disabled or state generation failure

### GET /api/oauth/{provider}/callback?code=...&state=...

Auth: not required

Behavior:

- Validates the OAuth state against cookie + Redis
- Exchanges authorization code for tokens and verifies the OIDC `id_token`
- Creates (or links) a local user account and provider identity
- Issues session + tokens and returns them as JSON

Response JSON:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresInSeconds": 900
}
```

Status codes:

- `200 OK` success
- `401 Unauthorized` invalid callback/state/token

## Admin (RBAC Management) Endpoints

All admin endpoints require authentication and a specific permission.

Routes are defined in [routeRegistry.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/routeRegistry.go#L16-L38) and handled in [router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go#L267-L343).

### GET /api/admin/roles

- Auth: required
- Required permission: `MANAGE_ROLES`

Response JSON:

```json
{
  "roles": [
    {
      "roleId": "uuid",
      "name": "teacher",
      "description": "Teacher role",
      "isSystem": false
    }
  ]
}
```

Status codes:

- `200 OK` success
- `401 Unauthorized` missing/invalid token
- `403 Forbidden` insufficient permissions

### POST /api/admin/roles

- Auth: required
- Required permission: `MANAGE_ROLES`

Request JSON:

```json
{
  "name": "teacher",
  "description": "Teacher role"
}
```

Response JSON:

```json
{
  "roleId": "uuid"
}
```

Status codes:

- `201 Created` success
- `400 Bad Request` invalid JSON body
- `403 Forbidden` insufficient permissions

### POST /api/admin/roles/assign-permission

- Auth: required
- Required permission: `MANAGE_PERMISSIONS`

Request JSON:

```json
{
  "roleId": "uuid",
  "permissionCode": "VIEW_WORKSHEET"
}
```

Response:

- `204 No Content` success
- `400 Bad Request` invalid JSON body
- `403 Forbidden` insufficient permissions (or escalation prevented)

Notes:

- The service prevents privilege escalation by disallowing assignment of permissions the actor does not already have (unless sysadmin).

### POST /api/admin/users/assign-role

- Auth: required
- Required permission: `MANAGE_USERS`

Request JSON:

```json
{
  "userId": "uuid",
  "roleId": "uuid"
}
```

Response:

- `204 No Content` success
- `400 Bad Request` invalid JSON body
- `403 Forbidden` insufficient permissions

## Proxied Service Routes

The gateway forwards requests to downstream services based on path prefixes:

- `/api/worksheet/*` → service name `worksheet` (strip prefix `/api/worksheet`)
- `/api/assessment/*` → service name `assessment` (strip prefix `/api/assessment`)
- `/api/moderation/*` → service name `moderation` (strip prefix `/api/moderation`)

Route definitions: [routeRegistry.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/routeRegistry.go#L30-L38)

Auth/RBAC:

- Auth: required for all proxied routes
- Required permission:
  - Worksheet: `VIEW_WORKSHEET`
  - Assessment: `VIEW_ASSESSMENT`
  - Moderation: `MODERATE_CONTENT`

Request forwarding rules:

- Removes inbound `Authorization` and `Cookie` before proxying
- Injects identity headers to downstream when authenticated:
  - `X-User-Id`, `X-Institution-Id`, `X-Session-Id`, `X-Token-Id`
- Injects a correlation header (`X-Request-Id`) when available

Implementation: [ServiceProxy.Forward](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/serviceProxy.go#L25-L84)
