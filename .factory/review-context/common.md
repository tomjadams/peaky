# Peaky Review Context

## Scope

Shared architecture and trust boundaries for all Peaky reviewers. Peaky is a
local-first operational-readiness application: browser SQLite via SQLocal and
OPFS is the immediate source of truth, while PostgreSQL is an
eventually-consistent server replica.

## Project invariants

- User-visible reads and writes work offline. UI state is updated from local
  data immediately; synchronization runs in the background.
- Every synchronized field is resolved independently using its HLC. Conflict
  resolution is deterministic, including the actor-ID tiebreaker.
- Client identity is untrusted. Authorization uses the actor from middleware,
  never an event payload, and entitlement restrictions are applied in
  PostgreSQL queries before rows leave the database. Phase 1 currently trusts
  spoofable `x-actor-*` headers behind the internal network boundary.
- SSE and PostgreSQL `LISTEN/NOTIFY` carry cursor pointers only, never domain
  data. Clients pull authorized changes after receiving a pointer.
- Push and pull cursors are independent. `localCursor` advances only after a
  successful push; `remoteCursor` advances only after a successful pull.
  Bootstrap deliberately leaves `remoteCursor` null so a new or cleared client
  performs a full, idempotent pull.
- Sync replay is expected. Persistence deduplicates event IDs and fields, while
  migration bookkeeping must tolerate retries without unrecoverable startup
  loops. Push currently has no event-ID replay fast path, so an exact populated
  replay may be reported as an HLC conflict.

## Project conventions

- Browser application: Nuxt 4, Vue 3, TypeScript, Drizzle, SQLite WASM/OPFS.
- Server services: Go/Fuego, PostgreSQL, sqlc, and separate `peaky-api`,
  `peaky-sse`, and `peaky-ctl` binaries.
- Python is confined to the CI automation toolkit under `scripts/ci/`.

## References

- `README.md`
- `AGENTS.md`
- `DESIGN.md` (sync cursor and bootstrap sections)
- `site/docs/development/walkthroughs/local-first/security.md`

## How to evolve this context

Keep only Peaky-specific guidance and cite repository sources. Move
deterministic rules into linting, generation, or tests, then remove them here.
Remove stale guidance when architecture or constraints change.
