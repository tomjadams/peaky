#!/usr/bin/env bash
set -euo pipefail

pid_file="$1"
port="${2:-3000}"
host="${3:-localhost}"

cleanup() {
  rm -f "$pid_file"
  echo "[watch] Stopping Docker services..."
  ./scripts/stop-watch-services.sh
}

trap cleanup EXIT

watcher_started_at="$(ps -p "$$" -o lstart=)"
NUXT_SYNC_BACKEND_URL=http://localhost:3001 \
  NUXT_SSE_BACKEND_URL=http://localhost:3002 \
  "$PWD/node_modules/.bin/nuxt" dev --host "$host" --port "$port" &
nuxt_pid=$!
nuxt_started_at="$(ps -p "$nuxt_pid" -o lstart= 2>/dev/null || true)"
printf '%s|%s|%s|%s\n' "$$" "$watcher_started_at" "$nuxt_pid" "$nuxt_started_at" > "$pid_file"

status=0
wait "$nuxt_pid" || status=$?
case "$status" in
  0 | 130 | 143) exit 0 ;;
  *) exit "$status" ;;
esac
