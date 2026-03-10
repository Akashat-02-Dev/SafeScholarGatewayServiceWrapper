#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

die() { printf '%s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

script_dir() { cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P; }
repo_root() { cd -- "$(script_dir)/.." && pwd -P; }

test_server=true
test_ui=true
race=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --server-only)
      test_server=true
      test_ui=false
      shift
      ;;
    --ui-only)
      test_server=false
      test_ui=true
      shift
      ;;
    --skip-server)
      test_server=false
      shift
      ;;
    --skip-ui)
      test_ui=false
      shift
      ;;
    --race)
      race=true
      shift
      ;;
    -h|--help)
      cat >&2 <<'USAGE'
Usage:
  scripts/test.sh [--race] [--server-only|--ui-only|--skip-server|--skip-ui]
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

if [[ "$test_server" == "true" ]]; then
  need_cmd go
  fmt_out="$(gofmt -l . | tr -d '\r')"
  if [[ -n "$fmt_out" ]]; then
    printf '%s\n' "$fmt_out" >&2
    die "gofmt required"
  fi

  go vet ./...
  if [[ "$race" == "true" ]]; then
    go test -race -count=1 ./...
  else
    go test -count=1 ./...
  fi
fi

if [[ "$test_ui" == "true" ]]; then
  need_cmd node
  need_cmd npm
  cd -- "$root/ui"
  if [[ ! -d node_modules ]]; then
    npm ci --silent
  fi
  npm run --silent lint
  npm run --silent build
fi
