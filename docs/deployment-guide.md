## Scope

This guide describes how to deploy the SafeScholar gateway service securely.

Artifacts and configuration in this repository assume:

- Go gateway service (this repo root)
- Optional UI app under `ui/`
- Postgres for persistence
- Redis for rate limiting + session caching + auth throttling + token blacklist

## Build Artifacts

Use the provided build automation:

- Script: [scripts/build.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/build.sh)

Examples:

```bash
./scripts/build.sh --server-only
./scripts/build.sh --ui-only
./scripts/build.sh --out /tmp/safescholar-dist
```

Output:

- Gateway binary: `dist/bin/safescholar-gateway`
- UI build output: `dist/ui/`

## Configuration

The gateway loads YAML configuration via:

- `CONFIG_PATH` (explicit path), or
- `APP_ENV` (`dev|test|prod`) → `config/config.<env>.yaml`

Implementation: [config.go](file:///d:/AdroitBI/Safe-Scholar/config/config.go)

### Required Secrets and Key Material

JWT (RS256) requires:

- `jwt.privateKeyPemFile` (RSA private key PEM)
- `jwt.publicKeyPemFile` (RSA public key PEM)

Server TLS is strongly recommended and can be required in dev:

- `server.tlsCertFile`
- `server.tlsKeyFile`

OAuth provider secrets are configured per provider in the YAML under `oauth.*`.

### Sysadmin Bootstrap

On first start, if no sysadmin exists, the gateway bootstraps a sysadmin user from environment variables defined by config:

- `bootstrap.sysAdminEmailEnv`
- `bootstrap.sysAdminPasswordEnv`
- `bootstrap.sysAdminFirstNameEnv`
- `bootstrap.sysAdminLastNameEnv`

Implementation: [create_sys_admin.go](file:///d:/AdroitBI/Safe-Scholar/cmd/bootstrap/create_sys_admin.go)

## Database Migrations

Migrations are applied at startup by default. For controlled rollouts, use the dedicated migration script:

- Script: [scripts/db-migrate.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/db-migrate.sh)
- Migration engine: [ApplyMigrations](file:///d:/AdroitBI/Safe-Scholar/infrastructure/database/migrations.go#L21-L63)

Examples:

```bash
./scripts/db-migrate.sh --env prod
./scripts/db-migrate.sh --config /etc/safescholar/config.yaml
./scripts/db-migrate.sh --bin /opt/safescholar-gateway/current
```

Safety behavior:

- Sets `MIGRATE_ONLY=1` so only migrations run and the HTTP server does not start.
- Skips sysadmin bootstrap and permission bootstrap during migration-only runs.

## Deployment (SSH + systemd)

Script:

- [scripts/deploy.sh](file:///d:/AdroitBI/Safe-Scholar/scripts/deploy.sh)

Environment variables:

- `DEPLOY_HOST` (required)
- `DEPLOY_PATH` (required, e.g. `/opt/safescholar-gateway`)
- `DEPLOY_SERVICE` (required, systemd unit name)
- `DEPLOY_USER` (optional)
- `DEPLOY_SSH_KEY` (optional)
- `DEPLOY_USE_SUDO` (optional: `1/true/yes`)

Example:

```bash
export DEPLOY_HOST=gateway.example.com
export DEPLOY_USER=deploy
export DEPLOY_PATH=/opt/safescholar-gateway
export DEPLOY_SERVICE=safescholar-gateway.service
./scripts/deploy.sh
```

Behavior:

- Uploads a timestamped release under `$DEPLOY_PATH/releases/<timestamp>/`
- Updates `$DEPLOY_PATH/current` symlink atomically
- Restarts the systemd service and prints status

## Running the Service

The gateway binary reads configuration using `CONFIG_PATH`/`APP_ENV` and expects connectivity to:

- Postgres (connection string in config)
- Redis (addr + optional auth/TLS in config)

Startup path (high-level):

- Load config
- Connect Postgres
- Apply migrations + bootstrap permissions + bootstrap sysadmin (unless `MIGRATE_ONLY=1`)
- Connect Redis
- Initialize JWT manager, auth services, OAuth (optional), RBAC services
- Start HTTP server (TLS if configured)

Entry: [main.go](file:///d:/AdroitBI/Safe-Scholar/cmd/server/main.go)

## Secure Defaults Checklist

- Use HTTPS externally; set `server.tlsCertFile` and `server.tlsKeyFile`.
- Protect JWT RSA private key permissions (readable only by the service user).
- Use strong Postgres credentials and enforce TLS in production where possible.
- Use Redis authentication and TLS when deploying across networks.
- Configure CORS allow-list for your UI origin(s).
- Enable audit logging (`audit.enabled: true`) and retain audit logs per policy.
- Keep `rateLimit.enabled: true` and tune for expected traffic.
- Ensure downstream service base URLs use HTTPS and are not internet-exposed.
