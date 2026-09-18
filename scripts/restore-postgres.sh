#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL precisa estar definida}"

PG_DATABASE_URL="$(
  DATABASE_URL="$DATABASE_URL" node -e '
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete("schema");
    process.stdout.write(url.toString());
  '
)"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Uso: ./scripts/restore-postgres.sh caminho/backup.dump" >&2
  exit 1
fi

if [ "${ALLOW_DATABASE_RESTORE:-}" != "YES_I_KNOW" ]; then
  echo "Restauração bloqueada. Defina ALLOW_DATABASE_RESTORE=YES_I_KNOW." >&2
  exit 2
fi

echo "Restaurando $BACKUP_FILE"
pg_restore   --dbname="$PG_DATABASE_URL"   --clean   --if-exists   --no-owner   --no-privileges   "$BACKUP_FILE"

echo "Restauração concluída. Execute npm run db:migrate:deploy em seguida."
