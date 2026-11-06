## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/1>
> MR: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/7>

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in RFC style using `glab` CLI describing the problem and approach from `design.md`
- [x] 0.3 Create feature branch `feat/backend-sync-engine`
- [x] 0.4 Create MR using conventional commit + template `.gitlab/merge_request_templates/default.md`

## 1. Schema Pipeline

> Can be done in isolation — no dependencies on Go server or client changes

- [x] 1.1 Write `services/schema.sql` with all server-relevant tables (subjects, templates, reviews, events, field_versions) — `field_versions` is sync-eligible (pulled to client for change feed). Reference existing Drizzle schemas for column parity
- [x] 1.2 Write `services/migrations/001_initial.sql` (goose format) matching schema.sql
- [x] 1.3 Write codegen script (`scripts/generate-drizzle-from-sql.ts`) that reads `services/schema.sql` and emits `shared/db/schema/*.ts` with Drizzle `sqliteTable()` definitions
- [x] 1.4 Write property-based tests for the codegen script covering all 6 type mappings (VARCHAR, TEXT, INT, DATETIME(6), JSON, BOOLEAN) plus indexes, unique constraints, and foreign keys
- [x] 1.5 Write CI drift gate test: apply all goose migrations to empty MySQL → dump schema → compare against `schema.sql` applied fresh
- [x] 1.6 Add `gen:db:mysql` and `gen:schemas` scripts to `package.json`
- [x] 1.7 Verify generated Drizzle schemas match existing hand-written schemas (diff parity check)

## 2. Go API Server Scaffolding

> dependencies: Schema Pipeline (needs schema.sql for SQLc)

- [x] 2.1 Initialize Go module at `services/go.mod` (`github.com/peaky-team/peaky/services` or similar)
- [x] 2.2 Set up `cmd/peaky-api/main.go` with Fuego HTTP server, graceful shutdown, health endpoint
- [x] 2.3 Configure SQLc (`services/sqlc.yaml`) to read `schema.sql` + query files → generate to `internal/db/`
- [x] 2.4 Write SQLc query files: `queries/sync.sql`, `queries/events.sql`, `queries/reviews.sql`
- [x] 2.5 Integrate goose for MySQL migrations at startup (embed migration files, run on boot)
- [x] 2.6 Set up ports & adapters: define the `SyncRepo`/`EventRepo` persistence ports and the `Authorizer` authorization port (now in package `internal/authz`)
- [x] 2.7 Write in-memory fake implementations of repository interfaces for unit tests
- [x] 2.8 Write `Dockerfile.peaky-api` (multi-stage Go build)

## 3. Simulated Actor Registry & Middleware

> dependencies: Go API Server Scaffolding

- [x] 3.1 Write `internal/middleware/actor.go` — extract `x-actor-id`, `x-actor-email`, `x-actor-name` from headers, attach to request context
- [x] 3.2 Write `internal/authz/registry.go` — load actors from `testdata/actors.json`, implement the `Authorizer` interface
- [x] 3.3 Create `testdata/actors.json` with 5 seeded actors (actor_dev, actor_alice, actor_bob, actor_carol, actor_admin) with scoped entitlements
- [x] 3.4 Write unit tests for actor middleware (header extraction, default fallback, missing header)
- [x] 3.5 Write unit tests for actor registry (lookup, entitlement scoping, unknown actor)

## 4. HLC Conflict Resolution Engine

> dependencies: Go API Server Scaffolding

- [x] 4.1 Write `internal/syncengine/conflict/hlc.go` — HLC parse, compare, generate functions
- [x] 4.2 Write `internal/syncengine/conflict/fieldversions.go` — field_versions table operations, per-field accept/reject loop
- [x] 4.3 Write unit tests for HLC: lexicographic comparison, monotonicity, padding, actor tiebreaker
- [x] 4.4 Write unit tests for field-level conflict resolution: newer wins, older rejected, non-overlapping fields accepted independently, identical HLC uses actor_id tiebreaker

## 5. Sync Handlers (Go)

> dependencies: HLC Conflict Resolution, Actor Registry

- [x] 5.1 Write the bootstrap handler in `internal/syncengine/handler.go` — returns actor, scoped entitlements, cursors. Replace `simulatorVersion` with `engineVersion: "go/1.0"`
- [x] 5.2 Write `internal/syncengine/push.go` — validate push body, iterate events, per-field HLC comparison against field_versions, write accepted fields to state tables, return accepted/rejected with fieldConflicts
- [x] 5.3 Write `internal/syncengine/pull.go` — cursor-based query scoped by entitlements (WHERE clause, not post-filter), return events with hasMore pagination. Include `field_versions` as a sync-eligible entity type (scoped to active reviews)
- [x] 5.4 Write the entitlements handler in `internal/syncengine/handler.go` — return current entitlements snapshot, detect downgrades (Phase 1: no simulated changes, same as current simulator)
- [x] 5.5 Write unit tests for each handler using in-memory fakes (no MySQL)
- [x] 5.6 Write Go integration tests (build tag `//go:build integration`): bootstrap → push → pull round-trip, two-actor conflict resolution, cursor advancement, entitlement-scoped pull

## 6. Attachment & Catalog Endpoints

> Can be done in parallel with Sync Handlers

- [x] 6.1 Write `GET /api/attachments/:id` handler — validate entitlement, serve presigned URL or stream
- [x] 6.2 Move catalog/directory mirror to Go — load bundled `catalog-directory-mirror.snapshot.json` at startup, serve `/api/catalog-directory-mirror`, `/groups`, `/users`, `/components`, `/meta` with cache headers
- [x] 6.3 Write unit tests for attachment entitlement check (authorized → 200, unauthorized → 403)
- [x] 6.4 Write unit tests for catalog endpoints (correct JSON shape, cache headers)

## 7. Docker & Makefile

> dependencies: Go API Server Scaffolding, Dockerfile

- [x] 7.1 Rewrite `docker-compose.yml` — MySQL 8.0 (`peaky-mysql`) + Go API (`peaky-api`), health checks, named volume for MySQL data
- [x] 7.2 Update `Makefile`: `make watch` → docker compose up -d (mysql wait healthy, peaky-api) + `NUXT_SYNC_BACKEND_URL=http://localhost:3001 pnpm run dev`
- [x] 7.3 Add `make test:go` (unit), `make test:go:integration` (with Docker MySQL)
- [x] 7.4 Verify full stack startup: `make dev && make watch` from clean clone

## 8. Client-Side Changes — Sync Core

> dependencies: Sync Handlers (need Go backend to test against)

- [x] 8.1 Write HLC clock module (`app/services/sync/HLCClock.ts`) — generate `wallclock:counter:actorId`, ensure monotonicity, ~30 lines
- [x] 8.2 Write unit tests for HLC clock: monotonicity, counter increment on same wallclock, format, lexicographic ordering
- [x] 8.3 Write SQLite migration: outbox schema change `payload TEXT` → `fields TEXT`
- [x] 8.4 Write SQLite migration: add `field_versions` table (entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
- [x] 8.5 Write `LocalMutation.draft()` — state write + outbox entry, NO audit event (auto-save path)
- [x] 8.6 Write `LocalMutation.commit()` — state write + outbox entry + audit event with status='pending' (checkpoint/milestone path)
- [x] 8.7 Write `LocalMutation.replay()` — state write + audit event (status='synced', source='peaky.sync'), no outbox entry
- [x] 8.8 Update mutation services (AnswerMutations, NoteMutations, ReviewMutations, AttachmentMutations, ProductMutations) to stamp fields with HLC and call `draft()` for auto-save, `commit()` for checkpoint
- [x] 8.9 Update `SyncEngine.pushChanges()` to send structured `fields` array and `upsert`/`delete` operations
- [x] 8.10 Write inbound event handlers (Strategy pattern): `ReviewAnswerHandler`, `ReviewNoteHandler`, `AttachmentHandler`, `ReviewHandler`, `ProductHandler`, `FieldVersionHandler` — each registers by entityType, applies via `LocalMutation.replay()`
- [x] 8.11 Update `SyncEngine.pullChanges()` to iterate pulled events and dispatch to inbound event handlers
- [x] 8.12 Write local TTL cleanup module (`app/services/sync/LocalTTL.ts`) — periodic sweep on startup or post-sync: `DELETE FROM events WHERE time < now - TTL`, `DELETE FROM field_versions WHERE updated_at < now - TTL`. Default `LOCAL_TTL_DAYS = 14`, configurable
- [x] 8.13 Remove per-page REST data fetching from composables (useTeams, useTeamDetails, useProductDetails, etc.) — pages read local SQLite only
- [x] 8.14 Write unit tests for `LocalMutation.draft()`: state written, outbox entry created, NO audit event
- [x] 8.15 Write unit tests for `LocalMutation.commit()`: state written, outbox entry created, audit event with status='pending'
- [x] 8.16 Write unit tests for `LocalMutation.replay()`: state written, audit event has status='synced', no outbox entry created
- [x] 8.17 Write unit tests for each inbound event handler: correct table upserted, entityId parsed correctly, `FieldVersionHandler` writes to local `field_versions`
- [x] 8.18 Write unit tests for LocalTTL: rows older than TTL deleted, rows within TTL preserved, configurable TTL value

## 9. Client-Side Changes — UI/UX

> dependencies: Client-Side Changes — Sync Core (needs draft/commit/replay + field_versions)

### Sync status indicator

- [x] 9.1 Write `useSyncStatus` composable — reads SyncEngine state (connection status, outbox count, last sync timestamp), exposes reactive `status: 'online' | 'syncing' | 'offline'`
- [x] 9.2 Write `SyncStatusIndicator.vue` — icon-only indicator: green dot (online/synced), spinning sky dot (syncing), dimmed dot (offline). Placed in top header bar after command palette trigger
- [x] 9.3 Add hover tooltip to indicator — shows status label, outbox queue count (when non-empty), last sync timestamp
- [x] 9.4 Write unit tests for `useSyncStatus`: maps SyncEngine states correctly, outbox count reactive
- [x] 9.5 Write unit tests for `SyncStatusIndicator.vue`: renders correct icon/color per state, tooltip content matches state

### Auto-save & checkpoint UX

- [x] 9.6 Replace current "Save" button with "Save checkpoint" — calls `commit()`, records milestone event with summary ("12 questions answered in Infrastructure pillar")
- [x] 9.7 Wire field-level auto-save — each answer/note change calls `draft()` immediately (no explicit save needed for individual fields)
- [x] 9.8 Write unit tests for checkpoint button: calls `commit()` with correct summary, disables while saving

### Milestones timeline (rename from History)

- [x] 9.9 Rename "History" section on review details page to "Milestones"
- [x] 9.10 Update milestone entries to reflect commit-only events — show checkpoint summaries, status changes, lifecycle events (not individual field changes)
- [x] 9.11 Write unit tests for milestones component: renders only commit/replay events, excludes draft-only changes

### Change feed

- [x] 9.12 Add "Recent changes" component on review details page — reads local `field_versions` table, shows "Alice changed Q3 answer: No → Yes (2 min ago)" style entries, grouped by actor
- [x] 9.13 Add TTL notice: "Showing last 14 days of activity" when local data is TTL-bounded; when online, link to "View full history" (fetches from server, graceful degradation offline)
- [x] 9.14 Wire change feed to `field_versions` composable — reactive query on local SQLite, scoped to current review
- [x] 9.15 Write unit tests for change feed component: renders field changes with actor, timestamp, old→new values, groups correctly
- [x] 9.16 Write unit tests for TTL notice: shown when oldest entry is near TTL boundary, hidden when full history available

## 10. OpenAPI Spec & Type Generation

> Can be done in parallel with Sync Handlers

- [x] 10.1 ~~Write `services/sync-api.yaml`~~ — superseded by Fuego: OpenAPI 3.1 spec is auto-generated from Go handler types at runtime (`GET /docs/openapi.yaml`)
- [x] 10.2 ~~Configure oapi-codegen~~ — superseded: migrated from Echo + oapi-codegen to Fuego to eliminate spec drift; handlers are the spec
- [x] 10.3 ~~Configure openapi-typescript~~ — superseded: TS types generated directly from the live spec endpoint instead of a static YAML file
- [x] 10.4 Wire Fuego route registration and Scalar UI (`internal/apiui/scalar.go`)

## 11. Events — HLC & CloudEvents

> dependencies: Go API Server Scaffolding

- [x] 11.1 Add `hlc` column to events table in `schema.sql` and `001_initial.sql`
- [x] 11.2 Integrate `github.com/cloudevents/sdk-go` for envelope validation in Go
- [x] 11.3 Write `GET /api/events` handler — return raw CloudEvent records from MySQL (no derivation)
- [x] 11.4 Write unit tests for CloudEvents envelope validation (valid accepted, malformed rejected)

## 12. Adversarial Reviews

> Run after all implementation tasks are complete. One pass over the full change.

- [x] 12.1 Run `ts-reviewer` on sync core modules: `app/services/sync/HLCClock.ts`, `app/services/sync/SyncEngine.ts`, `app/services/sync/SyncEngine-helpers.ts`, `app/services/sync/LocalTTL.ts`, `app/services/local-mutation.ts` (draft/commit/replay paths), `app/services/entity/AnswerMutations.ts`, `app/services/entity/NoteMutations.ts`, `app/services/entity/ReviewMutations.ts`, `app/services/entity/AttachmentMutations.ts`, `app/services/entity/ProductMutations.ts`, `scripts/generate-drizzle-from-sql.ts`
- [x] 12.2 Run `ts-reviewer` on new composables: `app/composables/useSyncStatus.ts`, `app/composables/useFieldVersions.ts` (or wherever the change feed composable lands)
- [x] 12.3 Run `test-reviewer` on all new test files in `services/` (Go) and `tests/` (TS) — including LocalTTL tests, draft/commit/replay tests, sync status tests, change feed tests
- [x] 12.4 Run `security-reviewer` on all sync handlers (`internal/syncengine/*.go`), actor middleware (`internal/middleware/actor.go`), attachment handler, `LocalMutation` (all three write paths — draft/commit/replay), and `LocalTTL.ts` (verify TTL sweep doesn't leak data timing)
- [x] 12.5 Run `sqlite-reviewer` on the outbox migration (payload → fields), `field_versions` client migration, generated Drizzle schemas, and TTL cleanup queries
- [x] 12.6 Run `ui-review` on `SyncStatusIndicator.vue`, checkpoint button, milestones timeline, and change feed components — verify semantic colors, dark mode, hover states, tooltip accessibility
- [x] 12.7 Run `vue-reviewer` on `SyncStatusIndicator.vue`, milestone timeline component, change feed component — check reactive patterns, component extraction signals, template complexity
- [x] 12.8 Address all review findings

## 13. Go Service Adversarial Review

> No existing Go reviewer skill — run these manually after all Go code is written.
> Goal: correctness, low-allocation hot paths, Lambda cold-start budget, no goroutine leaks.

- [x] 13.1 Run `go vet ./...` inside `services/` — catch misuse of sync primitives, unreachable code, printf format mismatches
- [x] 13.2 Run `staticcheck ./...` (install: `go install honnef.co/go/tools/cmd/staticcheck@latest`) — catches deprecated API use, ineffectual assignments, missing error checks
- [x] 13.3 Run `golangci-lint run` with `memory`-oriented linters enabled: `govet`, `staticcheck`, `ineffassign`, `prealloc`, `noctx`, `bodyclose`, `sqlclosecheck`, `rowserrcheck`, `exhaustruct` — config at `services/.golangci.yml`
- [x] 13.4 Run `go build -gcflags="-m=2" ./cmd/peaky-api/...` and review escape analysis output — every heap escape on a hot path (push handler, HLC compare, field loop) must be justified or eliminated
- [x] 13.5 Run `go test -race ./...` — data race detector on all unit and integration tests; zero races allowed
- [x] 13.6 Check binary size: `CGO_ENABLED=0 go build -ldflags="-w -s" -trimpath -o /tmp/peaky-api ./cmd/peaky-api` — target under 20 MB uncompressed
- [x] 13.7 Cold-start smoke test on Lambda: deploy container to a 128 MB Lambda function with Lambda Web Adapter, invoke once cold, measure init duration — target under 200 ms
- [x] 13.8 Memory baseline: run `docker stats peaky-api` after `make watch` with zero traffic — target under 30 MB RSS at idle
- [x] 13.9 Address all findings from 13.1–13.8 before MR approval

## Housekeeping

- [x] Run `make mr` — all quality gates must pass before submitting MR
- [x] Update decision log `site/docs/development/decisions.md`
- [x] Update GitLab issue with task completions

## Manual tasks

- [x] Manual review of areas ordered by ROI
  - [x] Two-actor conflict resolution E2E (alice + bob editing same question)
  - [x] Full sync cycle: edit → push → pull on second browser → verify field-level merge
  - [x] `make watch` cold start from clean clone
  - [x] Schema drift: modify schema.sql, forget migration, verify CI catches it
  - [x] Auto-save UX: edit answer → observe no explicit save needed → verify sync indicator shows "All changes saved"
  - [x] Checkpoint UX: click "Save checkpoint" → verify milestone appears in Milestones timeline
  - [x] Change feed: two actors edit same review → verify change feed shows both actors' field-level changes with correct timestamps
  - [x] TTL: set LOCAL_TTL_DAYS=1, create old events, verify cleanup sweep removes them, verify "Showing last N days" notice appears
  - [x] Offline: disconnect → edit answers (auto-save queues in outbox) → verify indicator shows "Offline — changes queued" → reconnect → verify sync completes

## 14. Consolidated Dockerfile

- [x] 14.1 Create `services/Dockerfile` with shared builder + named targets (`api`, `ctl`, `sse`)
- [x] 14.2 Update `docker-compose.yml` to use `context: ./services` + `target:` for all services
- [x] 14.3 Delete `Dockerfile.peaky-api` and `Dockerfile.peaky-ctl` (replaced by `services/Dockerfile`)
- [x] 14.4 Update `Makefile` watch target to build `api sse ctl` from new Dockerfile
- [x] 14.5 Verify `docker compose build api ctl` produces identically-sized images as before

## 15. SSE Fan-Out Service (peaky-sse)

> dependencies: PG LISTEN/NOTIFY (PostgreSQL already in use), actor registry

### Go service

- [x] 15.1 Create `cmd/peaky-sse/main.go` — Fuego HTTP server on `$PORT`, health self-probe subcommand, graceful shutdown
- [x] 15.2 Write `internal/sse/hub.go` — in-memory Hub: single PG LISTEN connection, actor→stream map, channel accumulation on connect, fan-out on NOTIFY, deregister on disconnect
- [x] 15.3 Write `internal/sse/handler.go` — `GET /api/sse/events` endpoint: validate actor, register stream with Hub, write SSE response (Content-Type: text/event-stream, Cache-Control: no-cache), heartbeat goroutine, stream cleanup on close
- [x] 15.4 Update `internal/app/config.go` — add `SSEConfig` (PG_DSN, PORT, ACTORS_FILE)
- [x] 15.5 Write Go unit tests for Hub: subscribe adds LISTEN, disconnect removes, fan-out delivers only to entitled streams, duplicate channel accumulation is idempotent
- [x] 15.6 Wire `pg_notify` call in `internal/syncengine/push.go` — after accepted events, resolve owning subject, call `pg_notify('sync:{type}:{id}', cursor_json)`
- [x] 15.7 Write unit tests for notify call: accepted push fires notify, rejected-only push does not fire notify, batch with mixed results fires notify once

### Infrastructure

- [x] 15.8 Add `sse` target to `services/Dockerfile` (already scaffolded in 14.1)
- [x] 15.9 Add `sse` service to `docker-compose.yml` (port 3002, PG_DSN, health probe)
- [x] 15.10 Add `NUXT_SSE_BACKEND_URL` to `nuxt.config.ts` routeRules proxy (`/api/sse/**`)
- [x] 15.11 Update `make watch` to start `sse` alongside `api`

### Client

- [x] 15.12 Install `@microsoft/fetch-event-source` (enables `Authorization` header on SSE — native `EventSource` cannot set headers)
- [x] 15.13 Write `app/composables/sync/useSseClient.ts` — opens one `fetchEventSource` connection on app mount, on message calls `runSyncCycle()` immediately, on error falls back silently (30s poll continues)
- [x] 15.14 Register `useSseClient()` in `app/layouts/default.vue` alongside `useSyncClient()`
- [x] 15.15 Write unit tests for `useSseClient`: SSE message triggers immediate sync cycle, SSE error does not stop polling, connection opens only on client (not SSR)
