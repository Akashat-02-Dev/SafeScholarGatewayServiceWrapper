package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Migration struct {
	Name string
	SQL  string
}

func ApplyMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	if pool == nil {
		return errors.New("postgres pool required")
	}

	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	if _, err := tx.Exec(ctx, schemaMigrationsDDL()); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	for _, m := range migrations() {
		checksum := checksumSQL(m.SQL)
		var existingChecksum string
		err := tx.QueryRow(ctx, `select coalesce(checksum,'') from schema_migrations where name=$1`, m.Name).Scan(&existingChecksum)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("check schema_migrations: %w", err)
		}
		if err == nil {
			if strings.TrimSpace(existingChecksum) != strings.TrimSpace(checksum) {
				return fmt.Errorf("migration checksum mismatch for %s", m.Name)
			}
			continue
		}

		if _, err := tx.Exec(ctx, m.SQL); err != nil {
			return fmt.Errorf("apply migration %s: %w", m.Name, err)
		}
		if _, err := tx.Exec(ctx, `insert into schema_migrations(name, checksum, applied_at) values ($1,$2,now())`, m.Name, checksum); err != nil {
			return fmt.Errorf("record migration %s: %w", m.Name, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func schemaMigrationsDDL() string {
	return `
create table if not exists schema_migrations (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null
);
`
}

func checksumSQL(s string) string {
	h := sha256.Sum256([]byte(strings.TrimSpace(s)))
	return hex.EncodeToString(h[:])
}

func migrations() []Migration {
	return []Migration{
		{
			Name: "001_core_tables",
			SQL: `
create extension if not exists pgcrypto;

create table if not exists institutions (
  institution_id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists users (
  user_id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(institution_id),
  email varchar(255) unique not null,
  password_hash text,
  first_name varchar(100),
  last_name varchar(100),
  status varchar(50) not null default 'active',
  is_sys_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  last_login timestamptz
);

create table if not exists roles (
  role_id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(institution_id),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references users(user_id)
);

create unique index if not exists roles_institution_name_uq on roles(institution_id, name);

create table if not exists permissions (
  permission_id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  created_at timestamptz not null default now(),
  immutable boolean not null default true
);

create table if not exists role_permissions (
  role_id uuid not null references roles(role_id) on delete cascade,
  permission_id uuid not null references permissions(permission_id) on delete restrict,
  primary key(role_id, permission_id)
);

create table if not exists user_roles (
  user_id uuid not null references users(user_id) on delete cascade,
  role_id uuid not null references roles(role_id) on delete cascade,
  primary key(user_id, role_id)
);

create table if not exists delegation_policies (
  policy_id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(institution_id),
  delegator_role_id uuid references roles(role_id),
  scope text not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(user_id)
);

create table if not exists oauth_accounts (
  oauth_account_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  email text,
  created_at timestamptz not null default now(),
  unique(provider, provider_subject)
);

create table if not exists sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(user_id) on delete cascade,
  institution_id uuid references institutions(institution_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb
);

create table if not exists jwt_tokens (
  token_id uuid primary key default gen_random_uuid(),
  user_id uuid references users(user_id),
  session_id uuid,
  token_type text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb
);

create index if not exists jwt_tokens_user_idx on jwt_tokens(user_id);

create table if not exists audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(institution_id),
  actor_user_id uuid references users(user_id),
  action text not null,
  resource_type text,
  resource_id text,
  ip inet,
  user_agent text,
  correlation_id text,
  created_at timestamptz not null default now(),
  metadata jsonb
);

create table if not exists services (
  service_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_url text not null,
  mTLS_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table institutions enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table delegation_policies enable row level security;
alter table oauth_accounts enable row level security;
alter table sessions enable row level security;
alter table jwt_tokens enable row level security;
alter table audit_logs enable row level security;
alter table services enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='institutions' and policyname='institutions_isolation') then
    create policy institutions_isolation on institutions using (true);
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='users_isolation') then
    create policy users_isolation on users using (
      current_setting('app.allow_login', true) = 'true'
      or is_sys_admin = true
      or institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='roles' and policyname='roles_isolation') then
    create policy roles_isolation on roles using (
      institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles_isolation') then
    create policy user_roles_isolation on user_roles using (
      exists(
        select 1
        from users u
        where u.user_id = user_roles.user_id
          and (
            u.is_sys_admin = true
            or u.institution_id::text = current_setting('app.institution_id', true)
          )
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='role_permissions' and policyname='role_permissions_isolation') then
    create policy role_permissions_isolation on role_permissions using (
      exists(
        select 1
        from roles r
        where r.role_id = role_permissions.role_id
          and (
            r.institution_id::text = current_setting('app.institution_id', true)
            or r.institution_id is null
          )
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='sessions' and policyname='sessions_isolation') then
    create policy sessions_isolation on sessions using (
      institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='delegation_policies' and policyname='delegation_isolation') then
    create policy delegation_isolation on delegation_policies using (
      institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='oauth_accounts' and policyname='oauth_isolation') then
    create policy oauth_isolation on oauth_accounts using (
      exists(
        select 1
        from users u
        where u.user_id = oauth_accounts.user_id
          and (
            current_setting('app.allow_login', true) = 'true'
            or u.is_sys_admin = true
            or u.institution_id::text = current_setting('app.institution_id', true)
          )
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='jwt_tokens' and policyname='jwt_tokens_isolation') then
    create policy jwt_tokens_isolation on jwt_tokens using (
      user_id is null
      or exists(
        select 1
        from users u
        where u.user_id = jwt_tokens.user_id
          and (
            current_setting('app.allow_login', true) = 'true'
            or u.is_sys_admin = true
            or u.institution_id::text = current_setting('app.institution_id', true)
          )
      )
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='audit_isolation') then
    create policy audit_isolation on audit_logs using (
      institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='services' and policyname='services_access') then
    create policy services_access on services using (true);
  end if;
end
$$;
`,
		},
		{
			Name: "002_align_schema_to_spec",
			SQL: `
do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='domain') then
    alter table institutions add column domain varchar(255);
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='updated_at') then
    alter table institutions add column updated_at timestamptz;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='roles' and column_name='is_system')
    and not exists(select 1 from information_schema.columns where table_name='roles' and column_name='is_system_role') then
    alter table roles rename column is_system to is_system_role;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='permissions' and column_name='code')
    and not exists(select 1 from information_schema.columns where table_name='permissions' and column_name='name') then
    alter table permissions rename column code to name;
  end if;
  if exists(select 1 from information_schema.columns where table_name='permissions' and column_name='immutable') then
    alter table permissions drop column immutable;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='permissions' and column_name='module') then
    alter table permissions add column module varchar(120);
  end if;
end
$$;

create unique index if not exists permissions_name_uq on permissions(name);

do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='role_permissions' and column_name='role_permission_id') then
    alter table role_permissions add column role_permission_id uuid default gen_random_uuid();
  end if;
  if not exists(select 1 from information_schema.columns where table_name='role_permissions' and column_name='created_at') then
    alter table role_permissions add column created_at timestamptz not null default now();
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.table_constraints where table_name='role_permissions' and constraint_type='PRIMARY KEY') then
    alter table role_permissions drop constraint if exists role_permissions_pkey;
  end if;
end
$$;

alter table role_permissions add constraint role_permissions_pkey primary key (role_permission_id);
create unique index if not exists role_permissions_role_perm_uq on role_permissions(role_id, permission_id);

do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='user_roles' and column_name='user_role_id') then
    alter table user_roles add column user_role_id uuid default gen_random_uuid();
  end if;
  if not exists(select 1 from information_schema.columns where table_name='user_roles' and column_name='assigned_by') then
    alter table user_roles add column assigned_by uuid references users(user_id);
  end if;
  if not exists(select 1 from information_schema.columns where table_name='user_roles' and column_name='assigned_at') then
    alter table user_roles add column assigned_at timestamptz not null default now();
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.table_constraints where table_name='user_roles' and constraint_type='PRIMARY KEY') then
    alter table user_roles drop constraint if exists user_roles_pkey;
  end if;
end
$$;

alter table user_roles add constraint user_roles_pkey primary key (user_role_id);
create unique index if not exists user_roles_user_role_uq on user_roles(user_id, role_id);

drop policy if exists delegation_isolation on delegation_policies;
do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='delegator_user_id') then
    alter table delegation_policies add column delegator_user_id uuid references users(user_id);
  end if;
  if not exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='delegate_user_id') then
    alter table delegation_policies add column delegate_user_id uuid references users(user_id);
  end if;
  if not exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='max_role_level') then
    alter table delegation_policies add column max_role_level int;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='institution_id') then
    alter table delegation_policies drop column institution_id;
  end if;
  if exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='delegator_role_id') then
    alter table delegation_policies drop column delegator_role_id;
  end if;
  if exists(select 1 from information_schema.columns where table_name='delegation_policies' and column_name='created_by') then
    alter table delegation_policies drop column created_by;
  end if;
end
$$;

create policy delegation_isolation on delegation_policies using (
  exists(
    select 1
    from users u
    where u.user_id = delegation_policies.delegator_user_id
      and (
        u.is_sys_admin = true
        or u.institution_id::text = current_setting('app.institution_id', true)
      )
  )
);

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='oauth_accounts' and column_name='provider_subject')
    and not exists(select 1 from information_schema.columns where table_name='oauth_accounts' and column_name='provider_user_id') then
    alter table oauth_accounts rename column provider_subject to provider_user_id;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='oauth_accounts' and column_name='access_token') then
    alter table oauth_accounts add column access_token text;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='oauth_accounts' and column_name='refresh_token') then
    alter table oauth_accounts add column refresh_token text;
  end if;
end
$$;

drop policy if exists sessions_isolation on sessions;
do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='sessions' and column_name='token_id') then
    alter table sessions add column token_id uuid;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='sessions' and column_name='ip_address') then
    alter table sessions add column ip_address varchar(64);
  end if;
  if not exists(select 1 from information_schema.columns where table_name='sessions' and column_name='user_agent') then
    alter table sessions add column user_agent text;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='sessions' and column_name='revoked') then
    alter table sessions add column revoked boolean not null default false;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='sessions' and column_name='revoked_at') then
    update sessions set revoked=true where revoked_at is not null and revoked=false;
    alter table sessions drop column revoked_at;
  end if;
  if exists(select 1 from information_schema.columns where table_name='sessions' and column_name='metadata') then
    alter table sessions drop column metadata;
  end if;
  if exists(select 1 from information_schema.columns where table_name='sessions' and column_name='institution_id') then
    alter table sessions drop column institution_id;
  end if;
end
$$;

create policy sessions_isolation on sessions using (
  exists(
    select 1
    from users u
    where u.user_id = sessions.user_id
      and (
        current_setting('app.allow_login', true) = 'true'
        or u.is_sys_admin = true
        or u.institution_id::text = current_setting('app.institution_id', true)
      )
  )
);

do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='jwt_tokens' and column_name='revoked') then
    alter table jwt_tokens add column revoked boolean not null default false;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='jwt_tokens' and column_name='revoked_at') then
    update jwt_tokens set revoked=true where revoked_at is not null and revoked=false;
    alter table jwt_tokens drop column revoked_at;
  end if;
  if exists(select 1 from information_schema.columns where table_name='jwt_tokens' and column_name='metadata') then
    alter table jwt_tokens drop column metadata;
  end if;
end
$$;

drop policy if exists audit_isolation on audit_logs;
do $$
begin
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='actor_user_id')
    and not exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='user_id') then
    alter table audit_logs rename column actor_user_id to user_id;
  end if;
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='resource_type')
    and not exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='resource') then
    alter table audit_logs rename column resource_type to resource;
  end if;
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='resource_id') then
    if not exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='resource_id_text') then
      alter table audit_logs rename column resource_id to resource_id_text;
    end if;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='resource_id') then
    alter table audit_logs add column resource_id uuid;
  end if;
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='ip')
    and not exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='ip_address') then
    alter table audit_logs rename column ip to ip_address;
  end if;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='ip_address') then
    alter table audit_logs alter column ip_address type varchar(64) using coalesce(ip_address::text,'');
  end if;
end
$$;

do $$
begin
  update audit_logs set resource_id = nullif(resource_id_text,'')::uuid
  where resource_id is null and resource_id_text is not null and resource_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
exception when others then
  null;
end
$$;

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='institution_id') then
    alter table audit_logs drop column institution_id;
  end if;
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='user_agent') then
    alter table audit_logs drop column user_agent;
  end if;
  if exists(select 1 from information_schema.columns where table_name='audit_logs' and column_name='correlation_id') then
    alter table audit_logs drop column correlation_id;
  end if;
end
$$;

create policy audit_isolation on audit_logs using (
  exists(
    select 1
    from users u
    where u.user_id = audit_logs.user_id
      and (
        u.is_sys_admin = true
        or u.institution_id::text = current_setting('app.institution_id', true)
      )
  )
);

do $$
begin
  if exists(select 1 from information_schema.columns where table_name='services' and column_name='name')
    and not exists(select 1 from information_schema.columns where table_name='services' and column_name='service_name') then
    alter table services rename column name to service_name;
  end if;
  if exists(select 1 from information_schema.columns where table_name='services' and column_name='base_url')
    and not exists(select 1 from information_schema.columns where table_name='services' and column_name='endpoint') then
    alter table services rename column base_url to endpoint;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='services' and column_name='protocol') then
    alter table services add column protocol varchar(16) not null default 'http';
  end if;
  if not exists(select 1 from information_schema.columns where table_name='services' and column_name='status') then
    alter table services add column status varchar(32) not null default 'active';
  end if;
  if exists(select 1 from information_schema.columns where table_name='services' and column_name='mTLS_required') then
    alter table services drop column mTLS_required;
  end if;
end
$$;

create table if not exists rate_limits (
  rate_limit_id uuid primary key default gen_random_uuid(),
  identifier varchar(255) not null,
  request_count int not null,
  window_start timestamptz not null,
  window_end timestamptz not null
);
`,
		},
		{
			Name: "003_system_roles_rls",
			SQL: `
drop policy if exists roles_isolation on roles;
create policy roles_isolation on roles using (
  institution_id is null
  or institution_id::text = current_setting('app.institution_id', true)
);
`,
		},
		{
			Name: "004_institution_approval_requests",
			SQL: `
create table if not exists institution_approval_requests (
  request_id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(institution_id) on delete cascade,
  user_id uuid not null references users(user_id) on delete cascade,
  requested_role varchar(50) not null,
  status varchar(50) not null default 'PENDING',
  reviewed_by uuid references users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_approval_requests_tenant on institution_approval_requests(institution_id, status);

alter table institution_approval_requests enable row level security;

drop policy if exists approval_requests_isolation on institution_approval_requests;
create policy approval_requests_isolation on institution_approval_requests using (
  institution_id::text = current_setting('app.institution_id', true)
);
`,
		},
		{
			Name: "005_custom_bots",
			SQL: `
create table if not exists custom_bots (
  bot_id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(institution_id) on delete cascade,
  teacher_id uuid not null references users(user_id) on delete cascade,
  name text not null,
  system_prompt text not null,
  source_document_ids text[],
  allowed_topics text[],
  strictness_level int not null default 5,
  created_at timestamptz not null default now()
);

alter table custom_bots enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='custom_bots' and policyname='custom_bots_isolation') then
    create policy custom_bots_isolation on custom_bots using (
      institution_id::text = current_setting('app.institution_id', true)
    );
  end if;
end
$$;
`,
		},
		{
			Name: "006_trial_onboarding_governance",
			SQL: `
do $$
begin
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='is_trial') then
    alter table institutions add column is_trial boolean not null default false;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='trial_starts_at') then
    alter table institutions add column trial_starts_at timestamptz;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='trial_ends_at') then
    alter table institutions add column trial_ends_at timestamptz;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='max_teachers') then
    alter table institutions add column max_teachers integer not null default 10;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='max_students') then
    alter table institutions add column max_students integer not null default 100;
  end if;
  if not exists(select 1 from information_schema.columns where table_name='institutions' and column_name='trial_status') then
    alter table institutions add column trial_status varchar(50) not null default 'none';
  end if;
end
$$;
`,
		},
		{
			Name: "007_plugins_and_resilience_governance",
			SQL: `
create table if not exists system_plugins (
  plugin_id varchar(64) primary key,
  name text not null,
  category varchar(64) not null,
  version varchar(32) not null default '1.0.0',
  description text,
  enabled boolean not null default true,
  target_service varchar(64) not null default 'ai-orchestrator',
  endpoint_prefix text not null,
  required_permission varchar(64),
  failure_threshold integer not null default 3,
  timeout_seconds integer not null default 20,
  cooldown_seconds integer not null default 30,
  fallback_mode varchar(64) not null default 'graceful_fallback',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tenant_plugin_overrides (
  institution_id uuid not null references institutions(institution_id) on delete cascade,
  plugin_id varchar(64) not null references system_plugins(plugin_id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(institution_id, plugin_id)
);

alter table system_plugins enable row level security;
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='system_plugins' and policyname='system_plugins_access') then
    create policy system_plugins_access on system_plugins using (true);
  end if;
end
$$;

alter table tenant_plugin_overrides enable row level security;
do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='tenant_plugin_overrides' and policyname='tenant_plugin_overrides_access') then
    create policy tenant_plugin_overrides_access on tenant_plugin_overrides using (true);
  end if;
end
$$;

insert into system_plugins (plugin_id, name, category, version, description, enabled, target_service, endpoint_prefix, required_permission, failure_threshold, timeout_seconds, cooldown_seconds, fallback_mode)
values
  ('lesson_planner', 'AI Lesson Planner', 'ai_education', '1.0.0', 'Australian curriculum aligned lesson planning engine for Prep to Year 5', true, 'ai-orchestrator', '/api/v1/ai/educator/lesson-planner', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'graceful_fallback'),
  ('socratic_tutor', 'Socratic AI Tutor', 'ai_education', '1.0.0', 'Interactive Socratic teaching dialog with Australian student guardrails', true, 'ai-orchestrator', '/api/v1/ai/student/socratic-tutor', 'EXECUTE_AI_TUTOR', 3, 20, 30, 'graceful_fallback'),
  ('quiz_me', 'Quiz Me Interactive', 'ai_education', '1.0.0', 'Real-time adaptive curriculum mastery quiz generator with immediate feedback', true, 'ai-orchestrator', '/api/v1/ai/student/quiz-me', 'EXECUTE_AI_TUTOR', 3, 20, 30, 'graceful_fallback'),
  ('quiz_generator', 'Quiz & Assessment Generator', 'ai_education', '1.0.0', 'Diagnostic and formative quiz creation with scoring rubric options', true, 'ai-orchestrator', '/api/v1/ai/student/quiz-generator', 'EXECUTE_AI_TUTOR', 3, 25, 30, 'graceful_fallback'),
  ('writing_feedback', 'Writing Feedback Assessor', 'ai_education', '1.0.0', 'Detailed formative rubric evaluation of student written submissions', true, 'ai-orchestrator', '/api/v1/ai/student/writing-feedback', 'EXECUTE_AI_TUTOR', 3, 25, 30, 'graceful_fallback'),
  ('text_leveler', 'Lexile & Text Leveler', 'ai_education', '1.0.0', 'Differentiates complex texts to student reading levels across Year levels', true, 'ai-orchestrator', '/api/v1/ai/educator/leveler', 'USE_TEXT_LEVELER', 3, 20, 30, 'graceful_fallback'),
  ('video_question_maker', 'Video Assessment Generator', 'ai_education', '1.0.0', 'Generates time-stamped comprehension questions from video materials', true, 'ai-orchestrator', '/api/v1/ai/educator/video-question-maker', 'USE_VIDEO_ASSESSOR', 3, 30, 30, 'graceful_fallback'),
  ('iep_generator', 'IEP & Rubric Generator', 'ai_education', '1.0.0', 'Individualized Education Plan generator with scaffolding and adjustments', true, 'ai-orchestrator', '/api/v1/ai/educator/iep-generator', 'GENERATE_IEP_RUBRIC', 3, 30, 30, 'graceful_fallback'),
  ('report_card_generator', 'Report Card Comment Composer', 'ai_education', '1.0.0', 'Synthesizes formative grades into curriculum-compliant report card comments', true, 'ai-orchestrator', '/api/v1/ai/educator/report-card', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'graceful_fallback'),
  ('ismg_rubric_generator', 'ISMG Assessment Rubric', 'ai_education', '1.0.0', 'Instrument-Specific Marking Guide rubric generator for Australian standards', true, 'ai-orchestrator', '/api/v1/ai/educator/ismg-rubric', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'graceful_fallback'),
  ('worksheet_generator', 'Printable Worksheet Builder', 'ai_education', '1.0.0', 'Generates differentiated printable classroom exercises and worksheets', true, 'ai-orchestrator', '/api/v1/ai/educator/worksheet-generator', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'graceful_fallback'),
  ('assessment_generator', 'Curriculum Assessment Creator', 'ai_education', '1.0.0', 'Formal formative and summative assessment generation with answer keys', true, 'ai-orchestrator', '/api/v1/ai/educator/assessment-generator', 'GENERATE_LESSON_PLAN', 3, 30, 30, 'graceful_fallback'),
  ('district_knowledge_bot', 'District Knowledge Assistant', 'ai_education', '1.0.0', 'RAG assistant grounded in district curriculum documents and policies', true, 'ai-orchestrator', '/api/v1/ai/educator/district-knowledge-bot', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'graceful_fallback'),
  ('character_bot', 'Historical Character Persona', 'ai_education', '1.0.0', 'Immersive roleplay with historical figures and literary characters', true, 'ai-orchestrator', '/api/v1/ai/student/character-bot', 'EXECUTE_AI_TUTOR', 3, 20, 30, 'graceful_fallback'),
  ('custom_bot', 'Custom AI Bot Studio', 'ai_education', '1.0.0', 'Educator-created targeted learning and subject tutor personas', true, 'ai-orchestrator', '/api/v1/ai/student/custom-bot', 'EXECUTE_AI_TUTOR', 3, 20, 30, 'graceful_fallback'),
  ('speech_audio', 'Speech & Audio Processing', 'ai_education', '1.0.0', 'Audio transcription and sovereign voice synthesis engine', true, 'ai-orchestrator', '/api/v1/audio/transcribe', 'EXECUTE_AI_TUTOR', 3, 30, 30, 'graceful_fallback'),
  ('rag_ingestion', 'District Curriculum Vector Ingestion', 'integration', '1.0.0', 'Processes and vectorizes district curriculum guidelines and lesson plans', true, 'ai-orchestrator', '/api/v1/rag/ingest', 'MANAGE_DISTRICT_AI_KNOWLEDGE', 3, 40, 30, 'fail_fast'),
  ('worksheet_service', 'Worksheet Microservice Proxy', 'microservice', '1.0.0', 'Dedicated backend microservice for worksheet persistence and tracking', true, 'worksheet', '/api/worksheet/', 'VIEW_WORKSHEET', 3, 15, 30, 'fail_fast'),
  ('assessment_service', 'Assessment Microservice Proxy', 'microservice', '1.0.0', 'Dedicated backend microservice for formal student exam assessment submissions', true, 'assessment', '/api/assessment/', 'VIEW_ASSESSMENT', 3, 15, 30, 'fail_fast'),
  ('moderation_service', 'AI Safety Moderation Microservice', 'microservice', '1.0.0', 'Real-time profanity, PII scrubbing and content moderation proxy', true, 'moderation', '/api/moderation/', 'MODERATE_CONTENT', 3, 10, 30, 'graceful_fallback'),
  ('lms_integration', 'LMS OneRoster Export Service', 'integration', '1.0.0', 'Canvas, Moodle, and Blackboard gradebook and roster synchronization', true, 'lms-integration', '/api/v1/lms/export', 'GENERATE_LESSON_PLAN', 3, 25, 30, 'fail_fast'),
  ('live_oversight', 'Live Classroom Oversight & Freeze', 'governance', '1.0.0', 'Real-time WebSocket telemetry stream and emergency student session freeze control', true, 'internal', '/api/v1/admin/oversight/stream', 'GENERATE_LESSON_PLAN', 3, 15, 30, 'fail_fast')
on conflict (plugin_id) do nothing;
`,
		},
		{
			Name: "008_custom_plugin_extensibility",
			SQL: `
alter table system_plugins add column if not exists is_system boolean not null default false;
alter table system_plugins add column if not exists custom_fallback_payload text;
alter table system_plugins add column if not exists target_url text;

update system_plugins set is_system = true where plugin_id in (
  'lesson_planner', 'socratic_tutor', 'quiz_me', 'quiz_generator', 'writing_feedback',
  'text_leveler', 'video_question_maker', 'iep_generator', 'report_card_generator',
  'ismg_rubric_generator', 'worksheet_generator', 'assessment_generator',
  'district_knowledge_bot', 'character_bot', 'custom_bot', 'speech_audio',
  'rag_ingestion', 'worksheet_service', 'assessment_service', 'moderation_service',
  'lms_integration', 'live_oversight'
);
`,
		},
		{
			Name: "009_signup_approval_revamp",
			SQL: `
alter table institution_approval_requests add column if not exists request_type varchar(50) not null default 'USER';
alter table institution_approval_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table institution_approval_requests add column if not exists rejection_reason text;
alter table institution_approval_requests add column if not exists reviewed_at timestamptz;

create index if not exists idx_approval_requests_type_status on institution_approval_requests(request_type, status);
create index if not exists idx_approval_requests_inst_status on institution_approval_requests(institution_id, status);

alter table users add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table institutions add column if not exists institute_type varchar(100);
alter table institutions add column if not exists registration_code varchar(100);
alter table institutions add column if not exists contact_phone varchar(50);
alter table institutions add column if not exists address text;

drop policy if exists approval_requests_isolation on institution_approval_requests;
create policy approval_requests_isolation on institution_approval_requests using (
  current_setting('app.allow_login', true) = 'true'
  or institution_id::text = current_setting('app.institution_id', true)
  or current_setting('app.is_sys_admin', true) = 'true'
);
`,
		},
		{
			Name: "010_profile_and_approval_workflow",
			SQL: `
create index if not exists idx_approval_requests_user_id on institution_approval_requests(user_id, status);

drop policy if exists approval_requests_isolation on institution_approval_requests;
create policy approval_requests_isolation on institution_approval_requests using (
  current_setting('app.allow_login', true) = 'true'
  or user_id::text = current_setting('app.user_id', true)
  or institution_id::text = current_setting('app.institution_id', true)
  or current_setting('app.is_sys_admin', true) = 'true'
);
`,
		},
	}
}

