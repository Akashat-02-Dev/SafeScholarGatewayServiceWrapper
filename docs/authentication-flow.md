## Overview

SafeScholar uses JWT access tokens (RS256) for API authentication and supports:

- Password-based login (`/api/auth/login`)
- OAuth/OIDC login for Google, Microsoft, and Apple (`/api/oauth/*`)

Sessions are tracked server-side to enable logout and session revocation.

## Token Types

JWTs carry both registered claims and application claims:

- Registered: `iss`, `sub`, `aud`, `iat`, `nbf`, `exp`
- Application:
  - `sid` (session id)
  - `tid` (token id)
  - `roles` (string array)
  - `permissions` (string array)
  - `institution` (institution id)

Claim structure: [TokenClaims](file:///d:/AdroitBI/Safe-Scholar/internal/security/jwtManager.go#L27-L34)

Token types are represented by `TokenType` and are stored in the JWT `jti` field (`RegisteredClaims.ID`):

- `access`
- `refresh`
- `service`

Implementation: [jwtManager.go](file:///d:/AdroitBI/Safe-Scholar/internal/security/jwtManager.go)

## Password Login Flow

Endpoint: `POST /api/auth/login` ([router.go](file:///d:/AdroitBI/Safe-Scholar/internal/gateway/router.go#L104-L152))

### Steps

1. Client sends email/password.
2. Gateway enforces login attempt throttling (account + IP) when Redis is configured.
3. Password is verified using Argon2id (and bcrypt hashes are supported for verification compatibility).
4. User must be `active`.
5. Gateway loads user roles and permissions.
6. Gateway creates a server-side session with an expiry aligned to the refresh token TTL.
7. Gateway issues an access token and refresh token (RS256 signed) and records token metadata in `jwt_tokens`.
8. A `LOGIN_SUCCESS` audit event is written.

Core implementation:

- [AuthService.Login](file:///d:/AdroitBI/Safe-Scholar/internal/auth/authService.go#L53-L206)
- [HashPassword / VerifyPassword](file:///d:/AdroitBI/Safe-Scholar/internal/security/hashing.go)
- [TokenGenerator.IssueUserTokens](file:///d:/AdroitBI/Safe-Scholar/internal/auth/tokenGenerator.go#L30-L58)
- [SessionManager.Create](file:///d:/AdroitBI/Safe-Scholar/internal/auth/sessionManager.go#L40-L90)
- Schema: [migrations.go](file:///d:/AdroitBI/Safe-Scholar/infrastructure/database/migrations.go#L94-L180)

### Output

The login response returns:

- `accessToken`: required for authenticated API calls
- `refreshToken`: currently issued and persisted, but no dedicated refresh endpoint is exposed by the gateway router
- `expiresInSeconds`: access token TTL seconds

## OAuth/OIDC Login Flow

Endpoints:

- `GET /api/oauth/{provider}/start`
- `GET /api/oauth/{provider}/callback`

Provider support is configured via YAML (enable/disable per provider). Implementation: [oauthService.go](file:///d:/AdroitBI/Safe-Scholar/internal/oauth/oauthService.go)

### Start

1. Gateway generates a cryptographically random state value.
2. State is stored in Redis (if configured) for the configured TTL.
3. Gateway sets a state cookie:
   - `HttpOnly: true`
   - `Secure: true`
   - `SameSite: Lax`
   - `Path: /api/oauth/`
4. Client is redirected to the provider authorization URL.

### Callback

1. Gateway validates state (cookie + Redis).
2. Gateway exchanges the authorization code for tokens.
3. Gateway verifies the OIDC `id_token` against the provider’s issuer and client id.
4. Gateway links or creates a local user with an `oauth_accounts` record.
5. Gateway creates a session and issues tokens (same as password login).
6. An `OAUTH_LOGIN_SUCCESS` audit event is written with provider metadata.

## Token Validation at Request Time

Authentication is enforced via middleware:

- Parses `Authorization: Bearer <token>`
- Validates token signature (RS256) + issuer/audience + expiry + leeway
- Enforces token type must be `access`
- Optionally consults the session store:
  - checks `tid` against a Redis blacklist
  - validates `sid` session is not expired/revoked and matches institution scope

Implementation:

- [AuthMiddleware](file:///d:/AdroitBI/Safe-Scholar/internal/middleware/authMiddleware.go)
- [TokenValidator.ValidateAccessToken](file:///d:/AdroitBI/Safe-Scholar/internal/auth/tokenValidator.go#L17-L48)
- [SessionManager.Validate](file:///d:/AdroitBI/Safe-Scholar/internal/auth/sessionManager.go#L92-L143)

## Logout / Session Revocation

Endpoint: `POST /api/auth/logout`

Behavior:

- Revokes the server-side session (sets `sessions.revoked_at` and clears the Redis cache entry).
- Adds the current token id (`tid`) to a Redis blacklist for a short TTL.

Implementation: [AuthService.Logout](file:///d:/AdroitBI/Safe-Scholar/internal/auth/authService.go#L208-L214)

## Service-to-Service Identity (Internal)

The gateway can also issue short-lived service tokens (token type `service`) intended for internal communication:

- [TokenGenerator.IssueServiceToken](file:///d:/AdroitBI/Safe-Scholar/internal/auth/tokenGenerator.go#L60-L69)

Outbound adapters can attach these tokens to downstream requests (HTTP and gRPC adapters) to represent gateway service identity.
