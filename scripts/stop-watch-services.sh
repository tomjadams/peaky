#!/usr/bin/env bash
set -euo pipefail

docker compose exec -T postgres sh -c 'pg_ctl stop -D "$PGDATA" -m fast' >/dev/null 2>&1 || true
docker compose stop --timeout 30
