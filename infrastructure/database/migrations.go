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
	}
}
