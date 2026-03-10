#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

die() { printf '%s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }
have_cmd() { command -v "$1" >/dev/null 2>&1; }

script_dir() { cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P; }
repo_root() { cd -- "$(script_dir)/.." && pwd -P; }

app_env="${APP_ENV:-dev}"
config_path="${CONFIG_PATH:-}"
start_server=true
start_ui=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      [[ $# -ge 2 ]] || die "missing value for --env"
      app_env="$2"
      shift 2
      ;;
    --config)
      [[ $# -ge 2 ]] || die "missing value for --config"
      config_path="$2"
      shift 2
      ;;
    --server-only)
      start_server=true
      start_ui=false
      shift
      ;;
    --ui-only)
      start_server=false
      start_ui=true
      shift
      ;;
    --skip-ui)
      start_ui=false
      shift
      ;;
    --skip-server)
      start_server=false
      shift
      ;;
    -h|--help)
      cat >&2 <<'USAGE'
Usage:
  scripts/run-local.sh [--env dev|test|prod] [--config PATH] [--server-only|--ui-only|--skip-ui|--skip-server]

Notes:
  - Generates dev TLS certs and JWT keys when using the default dev config and missing key files.
  - Requires Postgres and Redis to be running as configured in the chosen config file.
USAGE
      exit 2
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

root="$(repo_root)"
cd -- "$root"

app_env="$(printf '%s' "$app_env" | tr '[:upper:]' '[:lower:]')"
case "$app_env" in
  dev|test|prod) ;;
  *) die "invalid env: $app_env" ;;
esac

if [[ -z "${config_path}" ]]; then
  config_path="$root/config/config.${app_env}.yaml"
fi
[[ -f "$config_path" ]] || die "config not found: $config_path"

export APP_ENV="$app_env"
export CONFIG_PATH="$config_path"

rand_token() {
  if have_cmd openssl; then
    openssl rand -base64 24 | tr -d '\n' | tr '/+' 'Aa' | cut -c1-24
    return 0
  fi
  if [[ -r /dev/urandom ]]; then
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24
    return 0
  fi
  printf 'ChangeMeLocalPassword123!'
}

ensure_sysadmin_env() {
  if [[ -z "${SYS_ADMIN_EMAIL:-}" ]]; then
    export SYS_ADMIN_EMAIL="admin@localhost"
  fi
  if [[ -z "${SYS_ADMIN_PASSWORD:-}" ]]; then
    export SYS_ADMIN_PASSWORD="$(rand_token)"
    printf 'SYS_ADMIN_PASSWORD=%s\n' "$SYS_ADMIN_PASSWORD" >&2
  fi
  export SYS_ADMIN_FIRST_NAME="${SYS_ADMIN_FIRST_NAME:-Local}"
  export SYS_ADMIN_LAST_NAME="${SYS_ADMIN_LAST_NAME:-Admin}"
}

ensure_dev_crypto_material() {
  [[ "$app_env" == "dev" ]] || return 0
  [[ "$config_path" == *"config.dev.yaml" ]] || return 0

  jwt_dir="$root/config/dev_jwt"
  tls_dir="$root/config/dev_tls"
  priv="$jwt_dir/private.pem"
  pub="$jwt_dir/public.pem"
  cert="$tls_dir/server.crt"
  key="$tls_dir/server.key"

  if [[ ! -f "$priv" || ! -f "$pub" ]]; then
    need_cmd openssl
    mkdir -p -- "$jwt_dir"
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$priv" >/dev/null 2>&1
    chmod 600 "$priv" || true
    openssl rsa -pubout -in "$priv" -out "$pub" >/dev/null 2>&1
    printf 'generated jwt keys: %s %s\n' "$priv" "$pub" >&2
  fi

  if [[ ! -f "$cert" || ! -f "$key" ]]; then
    need_cmd openssl
    mkdir -p -- "$tls_dir"
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -keyout "$key" -out "$cert" -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
      -addext "keyUsage=digitalSignature,keyEncipherment" \
      -addext "extendedKeyUsage=serverAuth" >/dev/null 2>&1
    chmod 600 "$key" || true
    printf 'generated tls cert/key: %s %s\n' "$cert" "$key" >&2
  fi
}

check_deps() {
  if [[ "$start_server" == "true" ]]; then
    need_cmd go
  fi
  if [[ "$start_ui" == "true" ]]; then
    need_cmd node
    need_cmd npm
  fi
}

check_services() {
  if have_cmd pg_isready; then
    pg_isready >/dev/null 2>&1 || printf 'warning: postgres not ready (pg_isready failed)\n' >&2
  fi
  if have_cmd redis-cli; then
    redis-cli ping >/dev/null 2>&1 || printf 'warning: redis not ready (redis-cli ping failed)\n' >&2
  fi
}

check_deps
ensure_dev_crypto_material
ensure_sysadmin_env
check_services

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

if [[ "$start_server" == "true" ]]; then
  go run ./cmd/server &
  pids+=("$!")
  printf 'gateway running (pid=%s)\n' "${pids[-1]}" >&2
fi

if [[ "$start_ui" == "true" ]]; then
  cd -- "$root/ui"
  if [[ ! -d node_modules ]]; then
    npm ci --silent
  fi
  npm run --silent dev -- --host "${UI_HOST:-0.0.0.0}" --port "${UI_PORT:-5173}" &
  pids+=("$!")
  printf 'ui running (pid=%s)\n' "${pids[-1]}" >&2
fi

wait -n "${pids[@]}"
