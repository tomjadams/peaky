#!/usr/bin/env bash
set -euo pipefail

pid_file="$1"
worktree="$2"

cleanup() {
  rm -f "$pid_file"
  ./scripts/stop-watch-services.sh
}

process_started_at() {
  ps -p "$1" -o lstart= 2>/dev/null || true
}

is_expected_watcher() {
  [[ "$(process_started_at "$watcher_pid")" == "$watcher_started_at" ]]
}

is_expected_nuxt() {
  local command
  command="$(ps -p "$nuxt_pid" -o command= 2>/dev/null || true)"
  [[ "$(process_started_at "$nuxt_pid")" == "$nuxt_started_at" ]] || return 1
  case "$command" in
    *"$worktree"/node_modules/*/nuxt/bin/nuxt.mjs\ dev*) return 0 ;;
    *) return 1 ;;
  esac
}

stop_nuxt() {
  if is_expected_nuxt; then
    echo "[stop-watch] Stopping Nuxt..."
    kill -TERM "$nuxt_pid" 2>/dev/null || true
  fi
}

if [[ ! -f "$pid_file" ]]; then
  echo "[stop-watch] No active watch session found"
  cleanup
  exit 0
fi

pid_state="$(cat "$pid_file" 2>/dev/null || true)"
watcher_pid=""
watcher_started_at=""
nuxt_pid=""
nuxt_started_at=""
IFS='|' read -r watcher_pid watcher_started_at nuxt_pid nuxt_started_at <<< "$pid_state" || true
if ! [[ "$watcher_pid" =~ ^[0-9]+$ && "$nuxt_pid" =~ ^[0-9]+$ && -n "$watcher_started_at" && -n "$nuxt_started_at" ]]; then
  echo "[stop-watch] Watch state is invalid; cleaning up services"
  cleanup
  exit 0
fi

if is_expected_nuxt; then
  stop_nuxt
else
  echo "[stop-watch] Watch state is stale; leaving unrelated processes untouched"
fi

for _ in $(seq 1 30); do
  if ! is_expected_watcher; then
    stop_nuxt
    sleep 1
    if is_expected_nuxt; then
      kill -KILL "$nuxt_pid" 2>/dev/null || true
    fi
    cleanup
    exit 0
  fi
  sleep 1
done

if is_expected_nuxt; then
  kill -KILL "$nuxt_pid" 2>/dev/null || true
fi
if is_expected_watcher; then
  kill -TERM "$watcher_pid" 2>/dev/null || true
fi
echo "[stop-watch] Watch cleanup timed out; stopping Docker services..."
cleanup
