## Why

Power users have zero visibility into the local engine. DB initialization, schema version, applied migrations, sync state, OPFS storage, and error recovery all live in `console.log` or in `window.peakyDB` (dev-only). A support engineer or curious member cannot self-serve diagnose "why is Peaky stuck?" or "am I on the latest version?". When the local database fails to bootstrap today, a `useState('local-db-error')` value is set and persisted in localStorage, but no member-facing recovery surface exists.

We also have a structural wart: events were designed CloudEvents v1.0.2-aligned, but the persisted `domain_events` table dropped `specversion`, `dataschema`, and `client_id`. The admin event detail panel only shows the `data` payload because the formatter never received the rest of the envelope. This was called out in the roadmap as the "Admin Events v2" tax.

Finally, events and the outbox are conceptually decoupled (`shared/db/schema/event.ts` even comments "intentionally decoupled from localOutbox") but at the write path they still share a transaction commit shape and the events table never gets its own status pipeline. Before we build our own Rust sync engine, we want events to have a clean, independent lifecycle so the future engine can push them through their own auth and rate-limit boundaries.

This change closes those gaps and makes the previously-invisible local engine state observable to all members through a new `/system` page that follows the existing `/events` shell conventions.

## What Changes

1. **Persist the full CloudEvents envelope.** Add `specversion`, `dataschema`, `client_id` columns to the events table via a new migration. `LocalMutation.commit()` writes the full envelope; the admin detail panel's "Raw Details" exposes every envelope field, not just `data`.

2. **Decouple events from outbox at the write path.** Events and outbox remain in the same transaction (atomicity preserved), but their status pipelines are independent. The outbox push cycle does not advance event status. Event push transport is deferred to the Rust sync engine — this work leaves a no-op event pusher with a roadmap link.

3. **Add a `local: true` marker to `EventCatalogEntry`.** Events flagged `local` are inserted with `status: "local"` and skipped by future event pushers. Events without the flag default to `status: "pending"` and become eligible for sync. This lets us flip individual event types from local-only to syncable without touching the runtime.

4. **System event taxonomy with success/failure pairs.** Add 11 system events:
   - Lifecycle: `LocalDbInitializing.v1`, `LocalDbReady.v1`, `LocalDbBootstrapStarted.v1`, `LocalDbRecreated.v1`, `LocalDbMigrationFailed.v1` (today's runner emits success only)
   - Storage: `OpfsQuotaWarning.v1`, `OpfsStorageMeasured.v1`
   - Sync ops: `SyncCycleStarted.v1`, `SyncCycleSucceeded.v1`, `SyncCycleFailed.v1`, `EntitlementsRefreshed.v1`

5. **Member-facing `/system` page.** Available to all authenticated members (not admin-only), educational, glanceable. Shell follows `/events` conventions. Layout (locked in design.md):
   - Title + subtitle + Refresh
   - Conditional emergency banner (init error, OPFS unavailable, migration failed)
   - 4 status tiles: Database / Schema / Storage / Sync — one-word headline + supporting line + optional "What is this?" expander
   - Recent system activity table (slice of events filtered by `source = peaky.system`)
   - Maintenance section: ONE button — "Recreate local DB" — with explicit "this affects only your browser, your server data is safe" copy

6. **Educational copy patterns.** "What is this?" expanders explain Database / Schema / Storage / Sync in plain language for a heterogeneous audience (PMs, VPs, Compliance, engineers). Tier-the-danger framing across the page.

7. **Roadmap cleanup.** Strip all PowerSync references from `site/docs/development/roadmap.md`. Add: "Build our own simple sync engine in Rust" (replaces Stage 2), "Admin pull events API" (decision deferred — custom API vs Looker), "SharedWorker multi-tab corruption guard", "Formal verification with FizzBee" (grouped with the guard).

**Deliberately out of scope** (deferred to roadmap):

- SharedWorker multi-tab corruption guard runtime change
- Server-side admin pull events API
- Formal verification with FizzBee
- Run SQL UI, snapshot export, reset-cursor UI, and other power tools (job-to-be-done features added per need; export deliberately excluded for security/exfil traceability)
- Rename `domain_events` → `events` ships as a sibling change (`rename-domain-events-table`) in a parallel worktree

## Capabilities

### New Capabilities

None. This work extends two existing capabilities.

### Modified Capabilities

- `auditing`: persisted envelope adopts full CloudEvents shape; system event taxonomy adds 11 typed events with success/failure pairs; events get an independent status pipeline decoupled from outbox; `EventCatalogEntry` gains a `local` flag; admin detail panel exposes the full envelope.
- `local-first`: a new member-facing `/system` page surfaces engine status, schema version, OPFS storage, sync state, recent system activity, and a single "Recreate local DB" recovery action. Educational copy patterns make terms like OPFS, schema version, and migration approachable for non-engineers. Security-sensitive actions (snapshot export, raw SQL, cursor reset) are deliberately excluded.

## Impact

- **Database schema**: new migration adds 3 columns to the events table (`specversion`, `dataschema`, `client_id`); status enum gains a `local` value.
- **Domain events module** (`app/services/events/`): `EventCatalogEntry` gains `local?: boolean`; new system schemas and types under `schemas/system.ts` and `DomainEvent.ts`; JSON Schema generator emits new files.
- **Mutation layer**: `LocalMutation.commit()` persists full envelope; system event helpers added for emitting from non-mutation contexts (DB bootstrap, sync cycle, OPFS measurement).
- **Sync layer**: `SyncEngine` emits sync-cycle events; entitlement refresh emits its own event; no event push transport added.
- **Bootstrap**: `app/local-db/bootstrap.ts` and `app/plugins/local-db.client.ts` emit `LocalDbInitializing.v1` / `LocalDbReady.v1` / `LocalDbBootstrapStarted.v1` / `LocalDbRecreated.v1`; migration runner additionally emits `LocalDbMigrationFailed.v1` on failure.
- **New page** at `/system` with composable, components, and educational copy.
- **Admin formatter** (`app/admin/localEvents.ts`): `domainEventToAdminRecord` exposes the full envelope in `details`.
- **Documentation**: `site/docs/development/roadmap.md` rewritten (PowerSync stripped, new items added); `site/docs/development/walkthroughs/codebase/events.md` updated for the new taxonomy and decoupling notes.
- **Sibling change**: `rename-domain-events-table` (parallel worktree) renames the table and updates all references; this proposal expects to land before or after the rename without ordering constraints.
