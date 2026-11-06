#!/usr/bin/env bash
# CI drift gate: verify that applying all goose migrations to an empty MySQL
# database produces the same schema as applying services/schema.sql directly.
#
# Prerequisites:
#   - MySQL 8.0 reachable at $MYSQL_DSN (default: root:peaky@tcp(127.0.0.1:3306)/)
#   - goose installed: go install github.com/pressly/goose/v3/cmd/goose@latest
#   - mysql client available on PATH
#
# Exit codes:
#   0  schemas match (no drift)
#   1  schemas differ (drift detected) or tool not found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_SQL="$SERVICES_DIR/schema.sql"
MIGRATIONS_DIR="$SERVICES_DIR/migrations"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-peaky}"
MYSQL_DSN="${MYSQL_USER}:${MYSQL_PASSWORD}@tcp(${MYSQL_HOST}:${MYSQL_PORT})/"

DB_MIGRATIONS="peaky_drift_migrations_$$"
DB_FRESH="peaky_drift_fresh_$$"

cleanup() {
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    -e "DROP DATABASE IF EXISTS \`$DB_MIGRATIONS\`; DROP DATABASE IF EXISTS \`$DB_FRESH\`;" \
    2>/dev/null || true
}
trap cleanup EXIT

# ── 1. Create two empty databases ─────────────────────────────────────────────

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  -e "CREATE DATABASE \`$DB_MIGRATIONS\`; CREATE DATABASE \`$DB_FRESH\`;"

# ── 2. Apply goose migrations to DB_MIGRATIONS ───────────────────────────────

goose -dir "$MIGRATIONS_DIR" \
  mysql "${MYSQL_USER}:${MYSQL_PASSWORD}@tcp(${MYSQL_HOST}:${MYSQL_PORT})/${DB_MIGRATIONS}" \
  up

# ── 3. Apply schema.sql directly to DB_FRESH ────────────────────────────────

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  "$DB_FRESH" < "$SCHEMA_SQL"

# ── 4. Dump both schemas (tables only, no data) ───────────────────────────────

# Use --no-data --skip-comments --compact for clean structural diff
dump_schema() {
  local db="$1"
  mysqldump \
    -h "$MYSQL_HOST" -P "$MYSQL_PORT" \
    -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    --no-data \
    --skip-comments \
    --compact \
    --skip-set-charset \
    "$db"
}

DUMP_MIGRATIONS=$(dump_schema "$DB_MIGRATIONS")
DUMP_FRESH=$(dump_schema "$DB_FRESH")

# ── 5. Diff ──────────────────────────────────────────────────────────────────

if diff <(echo "$DUMP_MIGRATIONS") <(echo "$DUMP_FRESH") > /dev/null 2>&1; then
  echo "[drift-gate] OK: migrations and schema.sql produce identical schemas."
  exit 0
else
  echo "[drift-gate] FAIL: schema drift detected!"
  echo ""
  echo "Diff (migrations vs schema.sql):"
  diff <(echo "$DUMP_MIGRATIONS") <(echo "$DUMP_FRESH") || true
  echo ""
  echo "Fix: ensure every change to services/schema.sql has a corresponding"
  echo "     goose migration in services/migrations/."
  exit 1
fi
