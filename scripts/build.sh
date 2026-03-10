#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

die() { printf '%s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

script_dir() { cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P; }
repo_root() { cd -- "$(script_dir)/.." && pwd -P; }

out_dir=""
build_server=true
build_ui=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      [[ $# -ge 2 ]] || die "missing value for --out"
      out_dir="$2"
      shift 2
      ;;
    --server-only)
      build_server=true
      build_ui=false
      shift
      ;;
    --ui-only)
      build_server=false
      build_ui=true
      shift
      ;;
    --skip-server)
      build_server=false
      shift
      ;;
    --skip-ui)
      build_ui=false
      shift
      ;;
    -h|--help)
      cat >&2 <<'USAGE'
Usage:
  scripts/build.sh [--out DIR] [--server-only|--ui-only|--skip-server|--skip-ui]
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

if [[ -z "${out_dir}" ]]; then
  out_dir="$root/dist"
fi
mkdir -p -- "$out_dir"

git_rev="unknown"
if command -v git >/dev/null 2>&1; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git_rev="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi
fi
build_time="$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)"

if [[ "${build_server}" == "true" ]]; then
  need_cmd go
  GOFLAGS="${GOFLAGS:--mod=readonly}"
  export GOFLAGS
  export CGO_ENABLED="${CGO_ENABLED:-0}"

  bin_dir="$out_dir/bin"
  mkdir -p -- "$bin_dir"
  bin_path="$bin_dir/safescholar-gateway"

  go build -trimpath -ldflags="-s -w" -o "$bin_path" ./cmd/server
  printf 'built server: %s (rev=%s time=%s)\n' "$bin_path" "$git_rev" "$build_time" >&2
fi

if [[ "${build_ui}" == "true" ]]; then
  need_cmd node
  need_cmd npm
  cd -- "$root/ui"
  npm ci --silent
  npm run --silent build
  ui_out="$out_dir/ui"
  rm -rf -- "$ui_out"
  mkdir -p -- "$ui_out"
  if [[ -d "$root/ui/dist" ]]; then
    cp -R -- "$root/ui/dist/." "$ui_out/"
  else
    die "ui build did not produce ui/dist"
  fi
  printf 'built ui: %s (rev=%s time=%s)\n' "$ui_out" "$git_rev" "$build_time" >&2
fi
