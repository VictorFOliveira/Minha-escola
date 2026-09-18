#!/usr/bin/env bash
set -euo pipefail

: "${APP_URL:?APP_URL precisa estar definida}"
BASE="${APP_URL%/}"

check() {
  local path="$1"
  local expected="$2"
  local status
  status="$(curl --silent --show-error --output /tmp/minha-escola-smoke-body --write-out '%{http_code}' "$BASE$path")"
  if [ "$status" != "$expected" ]; then
    echo "Smoke falhou: $path retornou $status; esperado $expected" >&2
    cat /tmp/minha-escola-smoke-body >&2 || true
    exit 1
  fi
}

check "/api/health" "200"
check "/api/health/ready" "200"
check "/login" "200"

echo "Smoke test publico: OK"
