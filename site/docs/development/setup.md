# Setup

Peaky's dev stack has two layers:

- **Browser** — local SQLite via WASM + OPFS (no setup needed; boots automatically)
- **Backend** — PostgreSQL 17 + Go services (`peaky-api`, `peaky-sse`) running in Docker

You need Docker running before `make watch`.

## Prerequisites

| Tool | Minimum | Check | Install |
|------|---------|-------|---------|
| Node.js | 20 | `node --version` | [nodejs.org](https://nodejs.org) |
| pnpm | 9 | `pnpm --version` | `corepack enable pnpm` |
| Go | 1.26 | `go version` | [go.dev/dl](https://go.dev/dl/) |
| Docker Desktop | any | `docker info` | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Python 3.10 + uv | — | — | `make docs` only — `curl -LsSf https://astral.sh/uv/install.sh \| sh` |

## Install and start

```bash
pnpm install   # installs Node deps + registers Git hooks
make watch     # starts PostgreSQL + Go services + Nuxt dev server
```

`make watch` does the following in sequence:

1. Builds and starts the `postgres` Docker container (waits for healthy)
2. Builds `api`, `sse`, `ctl` Docker images
3. Runs `peaky-ctl migrate` — applies pending DDL migrations
4. Runs `peaky-ctl seed` — inserts demo data (idempotent)
5. Starts `peaky-api` (port 3001) and `peaky-sse` (port 3002)
6. Waits for `peaky-api` to be healthy, then starts Nuxt on `http://localhost:3000`

Nuxt proxies `/api/sync/**` → `peaky-api` and `/api/sse/**` → `peaky-sse` automatically during dev.

## Key make targets

| Command | What it does |
|---------|-------------|
| `make watch` | Full dev stack: Postgres + Go services (Docker) + Nuxt dev server |
| `make dev` | Bootstrap deps only (Node + Python); does not start servers |
| `make test` | TypeScript unit tests (~18s, no Docker) |
| `make test:go` | Go unit tests (~0.5s, in-memory fakes — no Docker) |
| `make test:go:integration` | Go tests against real Postgres (requires Docker) |
| `make test:integration` | Integration tests against a live Nuxt server (~25s) |
| `make test:e2e` | E2E browser tests via Playwright (~3m) |
| `make mr` | Full quality gate — TS lint → docs → typecheck → audit → unit → Go fmt/vet/tests → integration |
| `make go:fmt` | Format Go source files |
| `make go:vet` | Run `go vet` on all Go packages |
| `make lint-fix` | Auto-fix TS/Vue lint issues |
| `make typecheck` | TypeScript type check |
| `make build` | Production Nuxt build |
| `make db-seed` | Re-run demo data seed (idempotent) |

Run `make help` for the complete list.

## Git hooks

Git hooks are registered automatically by `pnpm install` via Husky. No manual setup needed.

| Hook | Trigger | What it runs |
|------|---------|--------------|
| `pre-commit` | `git commit` | `lint-staged` (oxlint → eslint → oxfmt on staged TS/Vue, rumdl on staged markdown); if any `services/**/*.go` are staged → `go vet ./...` + `go test ./...` |
| `pre-push` | `git push` | `pnpm typecheck` + `make test`; if any `services/**/*.go` are in the push diff → `go vet ./...` + `go test ./...` |

The Go gate is scoped to what changed — it adds ~0.5s when Go files are staged and is a no-op otherwise.

## Environment variables

No `.env` is required. `make watch` injects `NUXT_SYNC_BACKEND_URL` and `NUXT_SSE_BACKEND_URL` automatically via the Nuxt dev proxy. The Go services read `PG_DSN`, `ACTORS_FILE`, `PORT`, and `LOG_LEVEL` from `docker-compose.yml`.

For optional configuration (OIDC/Okta and deployment flags) see comments in `nuxt.config.ts`.

## Verify the setup

After `make watch` completes:

1. **Browser** — open `http://localhost:3000`; the dashboard loads, `LocalDbReady` appears in the browser console
2. **API** — `curl http://localhost:3001/__health` returns `{"status":"ok","service":"peaky-api"}`
3. **SSE** — `curl http://localhost:3002/__health` returns `{"status":"ok","service":"peaky-sse"}`
4. **Interactive API docs** — `http://localhost:3001/docs`

If the browser console shows a migration error, hard-refresh (`⌘⇧R` / `Ctrl+Shift+R`). The dev server recreates the OPFS database on errors automatically.

If a Go service fails to start, check `docker compose logs api` or `docker compose logs sse`.
