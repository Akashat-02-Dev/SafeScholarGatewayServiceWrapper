#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

die() { printf '%s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

script_dir() { cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P; }
repo_root() { cd -- "$(script_dir)/.." && pwd -P; }

bin_path=""
build_first=true
target="${DEPLOY_TARGET:-ssh}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bin)
      [[ $# -ge 2 ]] || die "missing value for --bin"
      bin_path="$2"
      shift 2
      ;;
    --no-build)
      build_first=false
      shift
      ;;
    --target)
      [[ $# -ge 2 ]] || die "missing value for --target"
      target="$2"
      shift 2
      ;;
    -h|--help)
      cat >&2 <<'USAGE'
Usage:
  scripts/deploy.sh [--bin PATH] [--no-build] [--target ssh]

SSH env vars:
  DEPLOY_HOST           required (e.g. gateway.example.com)
  DEPLOY_USER           optional (default: current user)
  DEPLOY_PATH           required (e.g. /opt/safescholar-gateway)
  DEPLOY_SERVICE        required systemd unit (e.g. safescholar-gateway.service)
  DEPLOY_SSH_KEY        optional identity file
  DEPLOY_USE_SUDO       optional (1/true enables sudo for systemctl)
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

case "$target" in
  ssh) ;;
  *) die "unsupported deploy target: $target" ;;
esac

if [[ "$build_first" == "true" && -z "$bin_path" ]]; then
  need_cmd bash
  bash "$root/scripts/build.sh" --skip-ui
fi

if [[ -z "$bin_path" ]]; then
  if [[ -x "$root/dist/bin/safescholar-gateway" ]]; then
    bin_path="$root/dist/bin/safescholar-gateway"
  else
    die "binary not found; pass --bin or run scripts/build.sh first"
  fi
fi
[[ -x "$bin_path" ]] || die "binary not executable: $bin_path"

need_cmd ssh
need_cmd scp

deploy_host="${DEPLOY_HOST:-}"
deploy_user="${DEPLOY_USER:-}"
deploy_path="${DEPLOY_PATH:-}"
deploy_service="${DEPLOY_SERVICE:-}"
ssh_key="${DEPLOY_SSH_KEY:-}"
use_sudo="${DEPLOY_USE_SUDO:-}"

[[ -n "$deploy_host" ]] || die "DEPLOY_HOST required"
[[ -n "$deploy_path" ]] || die "DEPLOY_PATH required"
[[ -n "$deploy_service" ]] || die "DEPLOY_SERVICE required"

remote="${deploy_host}"
if [[ -n "$deploy_user" ]]; then
  remote="${deploy_user}@${deploy_host}"
fi

ssh_opts=()
scp_opts=()
if [[ -n "$ssh_key" ]]; then
  ssh_opts+=("-i" "$ssh_key")
  scp_opts+=("-i" "$ssh_key")
fi

ts="$(date -u '+%Y%m%d%H%M%S' 2>/dev/null || echo now)"
rel_dir="${deploy_path%/}/releases/${ts}"
remote_bin="${rel_dir}/safescholar-gateway"

ssh "${ssh_opts[@]}" "$remote" "mkdir -p '$rel_dir' && chmod 755 '$rel_dir'"
scp "${scp_opts[@]}" "$bin_path" "$remote:$remote_bin"
ssh "${ssh_opts[@]}" "$remote" "chmod 755 '$remote_bin'"
ssh "${ssh_opts[@]}" "$remote" "ln -sfn '$remote_bin' '${deploy_path%/}/current'"

systemctl_cmd="systemctl restart '$deploy_service'"
if [[ "${use_sudo,,}" == "1" || "${use_sudo,,}" == "true" || "${use_sudo,,}" == "yes" ]]; then
  systemctl_cmd="sudo $systemctl_cmd"
fi
ssh "${ssh_opts[@]}" "$remote" "$systemctl_cmd"
ssh "${ssh_opts[@]}" "$remote" "sleep 1 && ${systemctl_cmd/restart/status}"

printf 'deployed %s to %s:%s\n' "$bin_path" "$remote" "$remote_bin" >&2
