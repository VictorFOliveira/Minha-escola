#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo $ENV_FILE nao encontrado." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${APP_DOMAIN:?APP_DOMAIN obrigatorio}"
: "${APP_URL:?APP_URL obrigatorio}"
: "${DATABASE_URL:?DATABASE_URL obrigatorio}"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ ",${COMPOSE_PROFILES:-}," == *",local-db,"* ]]; then
  "${compose[@]}" --profile local-db up -d db
fi

"${compose[@]}" build web migrate
"${compose[@]}" --profile ops run --rm migrate
"${compose[@]}" up -d --remove-orphans web caddy

for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error "$APP_URL/api/health/ready" >/dev/null; then
    echo "Deploy concluido: readiness verde em $APP_URL"
    exit 0
  fi
  sleep 2
done

echo "Readiness nao ficou verde." >&2
"${compose[@]}" logs --tail=200 web caddy >&2 || true
exit 1
