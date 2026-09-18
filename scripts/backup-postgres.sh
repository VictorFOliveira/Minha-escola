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

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

OUTPUT="$BACKUP_DIR/minha-escola-$TIMESTAMP.dump"

echo "Gerando backup PostgreSQL em $OUTPUT"
pg_dump   --dbname="$PG_DATABASE_URL"   --format=custom   --no-owner   --no-privileges   --file="$OUTPUT"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUTPUT" > "$OUTPUT.sha256"
fi

find "$BACKUP_DIR" -type f -name 'minha-escola-*.dump' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'minha-escola-*.dump.sha256' -mtime +"$RETENTION_DAYS" -delete

echo "Backup concluído."
