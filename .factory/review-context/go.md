# Go Review Context

## Scope

Go code under `services/`, especially the sync engine, SSE fan-out,
authorization boundary, and binary composition.

## Project invariants

- HLC conflict resolution is deterministic and per field. The complete wire
  value, including actor ID, supplies the lexicographic tiebreaker.
- Pull queries enforce entitlements in SQL. Push authorization uses the actor
  from middleware, never `actorId` from an event payload.
- SSE sends cursor pointers only. Fan-out channels are buffered and use
  non-blocking drop-with-warning semantics so one slow client cannot stall all
  clients.
- Push and pull cursors remain independent. Persistence deduplicates event IDs
  and fields, but push has no event-ID replay fast path; an exact populated
  replay may be reported as an HLC conflict.
- Request batch and per-event field counts are bounded.

## Project conventions

- `services/internal/` is feature-first. Small features such as `catalog`,
  `events`, `attachment`, and `sse` are single packages. `syncengine` is an
  intentional multi-package bounded context with its HTTP layer at the top and
  `conflict`, `entity`, `repo`, and generated `db` subpackages.
- Role files sit beside the handlers they serve: `routes.go`, handler files,
  `models.go`, and `repo.go` when those concerns exist. Do not force empty
  layers onto small cohesive features.
- Routes belong in each feature's `routes.go`; `main.go` only assembles
  dependencies and calls `RegisterRoutes`. Intentional exception:
  binary-specific `/__health` remains inline in each `main.go`.
- Authorization contracts and entitlement types live in `internal/authz`.
  Persistence ports live in `syncengine/repo/ports.go`.
- `internal/syncengine/db/` is generated. Edit
  `internal/syncengine/repo/queries.sql` and run `make gen:sqlc`.
- The three binaries stay independent: `peaky-api` serves HTTP APIs,
  `peaky-sse` serves SSE only, and `peaky-ctl` performs migrate/seed work.
- Constructor injection through small consumer-owned interfaces is preferred;
  hidden global state and `init()` are not used.
- Intentional exception to generic handler extraction: the push handler may
  keep batch orchestration inline when extraction would merely pass five or
  more dependencies through intermediate functions.

## Deterministic coverage

Do not duplicate checks already enforced by `services/.golangci.yml`:
preallocation, unchecked errors and assertions, HTTP context, response/SQL row
closure, `rows.Err`, common `gosec` findings, error wrapping, error-chain use,
test-helper marking, domain imports of Fuego, and unrelated feature imports in
`peaky-sse` or `peaky-ctl`.

Relevant gates are `make go:fmt`, `make go:vet`, `make lint:go`,
`make test:go`, and `make test:go:integration`.

## References

- `site/docs/development/golang.md`
- `services/.golangci.yml`
- `services/internal/syncengine/`
- `services/cmd/`
