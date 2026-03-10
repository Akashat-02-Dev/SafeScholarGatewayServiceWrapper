## Overview

SafeScholar Gateway is a Go HTTP service that provides:

- A single external entrypoint for clients (web UI and other clients)
- Authentication endpoints (password login + OAuth OIDC login)
- RBAC enforcement at the gateway layer
- Reverse-proxy routing to internal backend services (worksheet, assessment, moderation)
- Centralized security middleware (rate limiting, security headers, CORS, request logging)

The gateway is designed to run behind HTTPS and to communicate with downstream services over HTTPS (optionally mTLS).

## High-Level Components

### Gateway HTTP Server

- Entry binary: [main.go](file:///d:/AdroitBI/Safe-Scholar/cmd/server/main.go)
- Router and route registry: [router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go), [routeRegistry.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/routeRegistry.go)
- Reverse proxy: [serviceProxy.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/serviceProxy.go)

### Authentication & Session Management

- Auth service: [authService.go](file:///d:/AdroitBI/Safe-Scholar/internal/auth/authService.go)
- JWT token issuance: [tokenGenerator.go](file:///d:/AdroitBI/Safe-Scholar/internal/auth/tokenGenerator.go)
- JWT access token validation: [tokenValidator.go](file:///d:/AdroitBI/Safe-Scholar/internal/auth/tokenValidator.go)
- Session store (Postgres + Redis cache, token blacklist in Redis): [sessionManager.go](file:///d:/AdroitBI/Safe-Scholar/internal/auth/sessionManager.go)
- JWT signing/verifying (RS256): [jwtManager.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/jwtManager.go)

### OAuth (OIDC)

- OAuth/OIDC flows: [oauthService.go](file:///d:/AdroitBI/Safe-Scholar/internal/oauth/oauthService.go)
- Providers supported: Google, Microsoft, Apple (enabled via config)

### RBAC

- Permission bootstrap (immutable permission codes): [permissionService.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/permissionService.go)
- Policy engine (permission allow checks): [policyEngine.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/policyEngine.go)
- Admin operations (role CRUD, role assignment, role-permission mapping, delegation checks): [roleService.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/roleService.go), [delegationService.go](file:///d:/AdroitBI/Safe-Scholar/internal/rbac/delegationService.go)

### Security Utilities

- Password hashing (Argon2id primary; bcrypt verify supported): [hashing.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/hashing.go)
- Encryption utilities (AES-256-GCM + env key loading helpers): [encryption.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/encryption.go)
- Audit logging to Postgres: [auditLogger.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/auditLogger.go)
- Redis-backed token bucket rate limiter: [rateLimiter.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/rateLimiter.go)

### Data Stores

- Postgres: core persistence (users, roles, permissions, sessions, jwt_tokens, audit_logs, services)
- Redis: session cache, auth attempt limits, JWT blacklist, gateway rate limiting

Database schema/migrations are maintained in: [migrations.go](file:///d:/AdroitBI/Safe-Scholar/infrastructure/database/migrations.go)

## Request Lifecycle

### Route Resolution

- Requests are matched against a route registry and annotated with route metadata (service name, required permission, whether auth is required).
- Route matching and metadata injection: [RouteMatchMiddleware](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go)

### Middleware Chain

The gateway applies a consistent middleware stack to all routes:

- Host validation (allowed hostnames)
- Request body size limit
- Route match + route metadata context
- Structured logging
- Security headers
- CORS
- Auth (Bearer token parsing + access token verification)
- Rate limiting (Redis token bucket)
- RBAC enforcement based on route metadata

Implementation: [NewRouter](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go#L33-L64)

### Downstream Service Proxying

For proxied routes, the gateway:

- Resolves a base URL from the service registry (static config first, then DB-backed lookup)
- Forwards the request to the downstream base URL and strips the configured prefix
- Removes client credentials from outbound requests (Authorization, Cookie) and injects safe identity/correlation headers

Implementation: [ServiceProxy.Forward](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/serviceProxy.go)

## Security Model

### Identity

- Client identity is established through JWT access tokens (RS256) supplied in `Authorization: Bearer <token>`.
- JWT access tokens are validated for issuer, audience, method, expiration, and token type.
- Session validity is enforced by validating the `sid` claim against the session store and by consulting a Redis token blacklist.

### Authorization

- Route-level RBAC: routes define a `RequiredPermission` and the middleware enforces it against the user’s permission set.
- Sysadmin bypass: `SUPER_ADMIN` permission implies allow-all at the policy engine layer.

### Tenant / Institution Isolation

- Persistence layer uses row-level security policies keyed off a per-request application context (`app.institution_id`).
- Most reads/writes should be executed with the correct institution context applied via the database helper.

### Audit Trail

- Security-relevant events are written to `audit_logs` (login success/failure, OAuth login, role and permission changes, etc.).
- Audit events include: timestamp, actor user id, institution id, correlation id, user agent, IP (when available), and metadata.

## Configuration

Runtime configuration is loaded from YAML (`CONFIG_PATH`, else derived from `APP_ENV`):

- Loader + validation: [config.go](file:///d:/AdroitBI/Safe-Scholar/config/config.go)
- Environments: `dev`, `test`, `prod`

## Operational Tooling

Scripts under `scripts/` provide consistent build/test/deploy/migrate automation:

- [scripts/build.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/build.sh)
- [scripts/test.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/test.sh)
- [scripts/db-migrate.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/db-migrate.sh)
- [scripts/deploy.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/deploy.sh)
- [scripts/run-local.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/run-local.sh)
