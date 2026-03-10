#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

die() { printf '%s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

script_dir() { cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P; }
repo_root() { cd -- "$(script_dir)/.." && pwd -P; }

app_env="${APP_ENV:-}"
config_path="${CONFIG_PATH:-}"
bin_path=""

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
    --bin)
      [[ $# -ge 2 ]] || die "missing value for --bin"
      bin_path="$2"
      shift 2
      ;;
    -h|--help)
      cat >&2 <<'USAGE'
Usage:
  scripts/db-migrate.sh [--env dev|test|prod] [--config PATH] [--bin PATH]

Notes:
  - Uses MIGRATE_ONLY=1 and executes the gateway bootstrap migrations safely.
  - Postgres connectivity must be configured via the chosen config file.
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

if [[ -z "${config_path}" ]]; then
  app_env="$(printf '%s' "${app_env:-dev}" | tr '[:upper:]' '[:lower:]')"
  case "$app_env" in
    dev|test|prod) ;;
    *) die "invalid env: ${app_env}" ;;
  esac
  config_path="$root/config/config.${app_env}.yaml"
fi
[[ -f "$config_path" ]] || die "config not found: $config_path"

export CONFIG_PATH="$config_path"
export MIGRATE_ONLY=1

if [[ -n "${bin_path}" ]]; then
  [[ -x "$bin_path" ]] || die "binary not executable: $bin_path"
  "$bin_path"
  exit 0
fi

if [[ -x "$root/dist/bin/safescholar-gateway" ]]; then
  "$root/dist/bin/safescholar-gateway"
  exit 0
fi

need_cmd go
go run ./cmd/server
