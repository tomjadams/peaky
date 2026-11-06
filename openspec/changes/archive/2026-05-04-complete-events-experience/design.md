## Context

Peaky persists every domain mutation as a typed `DomainEventEnvelope` in a local SQLite table. The envelope is CloudEvents v1.0.2-aligned, the catalog has 27 typed events, and `peaky.system` is reserved as a source for non-user-driven activity. One system event already exists (`ClientSchemaMigrated.v1`), emitted by the migration runner on success. A separate `_migration_log` table records every migration attempt outside the main chain so failures survive a broken schema.

What's missing is the surface that exposes this to humans. There is no `/system` page. The "raw details" pane in the admin events feed only shows the `data` payload because `domainEventToAdminRecord` (`app/admin/localEvents.ts:404`) drops every CloudEvents envelope field — and three of those fields (`specversion`, `dataschema`, `client_id`) aren't even persisted, so the pane couldn't show them today even if the formatter wanted to. The migration runner emits success events but not failures. Sync cycles, entitlement refreshes, OPFS quota measurements, and DB initialization happen silently. `window.peakyDB` exists in dev only.

The events table is already commented as "intentionally decoupled from localOutbox" but the runtime treats them as a pair: `LocalMutation.commit()` writes both inside one transaction, and the events table never gets its own status pipeline beyond the default `pending` value (which today is meaningless because nothing ever flips it). Before the future Rust sync engine adds an event push transport, we want events to have a clean independent status lifecycle so the engine can plug in without unwinding outbox entanglement.

## Goals / Non-Goals

**Goals:**

- Persist the full CloudEvents envelope, not a lossy subset.
- Add the missing system events with success/failure pairs so every operationally-relevant moment in the local engine is visible.
- Decouple events from the outbox at the write path so the future Rust engine can push events independently.
- Ship a member-facing `/system` page that anyone can use to self-serve diagnose engine state.
- Make the page educational without overwhelming non-engineers.
- Strip PowerSync from the roadmap and codify the Rust-engine direction.

**Non-Goals:**

- Building the SharedWorker multi-tab corruption guard (deferred, paired with formal verification on the roadmap).
- Building a server-side admin pull events API (decision deferred — could be a custom API or Looker).
- Building any event push transport — the Rust engine owns that.
- Renaming `domain_events` → `events` (sibling change `rename-domain-events-table` ships in a parallel worktree).
- Power-user tools (raw SQL, snapshot export, cursor reset). Add per job-to-be-done as needs arise.

## Decisions

### D1. Persist the full CloudEvents envelope

Add three columns to the events table:

```text
column         type     notes
─────────      ────     ─────
specversion    TEXT     NOT NULL DEFAULT '1.0' — CloudEvents required core attribute
dataschema     TEXT     NULLable — URL to JSON Schema for data payload
client_id      TEXT     NULLable — browser session identifier
```

`LocalMutation.commit()` writes them. The admin formatter exposes the full envelope under `details` so operators can see source/actor/version/schema/status without leaving the page.

This is a forward-only migration — we accept a new migration row in `_migrations` and a new entry in `_migration_log`. Editing earlier migrations in place was considered and rejected: this very feature is about making schema evolution visible and trustworthy; editing a committed migration to support that feature would be philosophically inconsistent. Discipline first, even pre-production.

### D2. Decouple events from outbox at the write path

The atomicity guarantee is preserved. Both writes still happen in a single transaction in `LocalMutation.commit()`. What changes is the **status pipeline**:

```text
BEFORE                                    AFTER
──────                                    ─────
LocalMutation.commit()                    LocalMutation.commit()
  ├─ stateWrite(tx)                          ├─ stateWrite(tx)
  ├─ INSERT domain_events                    ├─ INSERT events
  │     status: "pending"                    │     status: "local" or "pending"
  │     (never advances)                     │     (advanced by event pusher
  │                                          │      when one exists — Rust engine)
  └─ INSERT local_outbox                     └─ INSERT local_outbox
        status: "pending"                          status: "pending"
        (advanced by SyncEngine.pushChanges)       (unchanged — outbox path
                                                    untouched)

SyncEngine.pushChanges()                  SyncEngine.pushChanges()
  reads outbox, advances outbox.status      reads outbox, advances outbox.status
  ALSO incidentally drains nothing on       does NOT touch events.status
  events because no event push exists       (explicit no-op)
```

Concretely: the `eventStatus` enum gains a `local` value. `EventCatalogEntry` gains an optional `local?: boolean`. When `LocalMutation.commit()` inserts an event whose catalog entry has `local: true`, it inserts with `status: "local"`. Otherwise `status: "pending"`. Today no pusher advances `pending → synced`; the Rust engine will. This is documented as a stub.

### D3. `local: true` marker semantics

```text
catalog entry                             status on insert    pushed to server later?
─────────────                             ────────────────    ───────────────────────
local: true                               "local"             never (by design)
local omitted / false                     "pending"           yes (when pusher exists)
```

System events split between the two: lifecycle and storage events are `local: true` (DB initialization on a specific browser is meaningless to other actors), while sync ops events default to push-eligible because postmortems require knowing which browser session synced what.

| Event | local? | Why |
|-------|--------|-----|
| `LocalDbInitializing.v1` | yes | per-browser ephemeral |
| `LocalDbReady.v1` | yes | per-browser ephemeral |
| `LocalDbBootstrapStarted.v1` | yes | per-browser ephemeral |
| `LocalDbRecreated.v1` | yes | per-browser destructive action |
| `LocalDbMigrationFailed.v1` | yes | per-browser failure mode |
| `ClientSchemaMigrated.v1` | yes | already local-only by current behaviour; flip the flag explicit |
| `OpfsQuotaWarning.v1` | yes | per-browser storage state |
| `OpfsStorageMeasured.v1` | yes | per-browser snapshot |
| `SyncCycleStarted.v1` | no | postmortem signal |
| `SyncCycleSucceeded.v1` | no | postmortem signal |
| `SyncCycleFailed.v1` | no | postmortem signal |
| `EntitlementsRefreshed.v1` | no | postmortem signal |

### D4. System event taxonomy — success and failure pairs

Pattern: every operation gets both. `Started` events let `/system` show "in progress" states; `Succeeded` / `Failed` close them out. Events store enough context for diagnosis: durations, error messages (sanitised), counts.

```text
LIFECYCLE                  STORAGE                  SYNC OPS
─────────                  ───────                  ────────
LocalDbInitializing        OpfsQuotaWarning         SyncCycleStarted
LocalDbReady               OpfsStorageMeasured      SyncCycleSucceeded
LocalDbBootstrapStarted                             SyncCycleFailed
LocalDbRecreated                                    EntitlementsRefreshed
LocalDbMigrationFailed
ClientSchemaMigrated  ← already exists
```

Each new event follows the existing pattern:

1. Interface in `app/services/events/DomainEvent.ts`
2. Added to the `DomainEvent` union
3. Zod schema with `.describe()` on every field in `app/services/events/schemas/system.ts`
4. Catalog entry in `app/services/events/schemas/index.ts` with `local: true` where applicable
5. JSON Schema regenerated via `pnpm events:schemas`
6. Display formatter in `app/admin/formatters.ts`

Emission points:

- DB lifecycle: `app/local-db/bootstrap.ts` and `app/plugins/local-db.client.ts`
- Migrations: `app/local-db/migrations.ts` (already does success — add failure)
- Sync cycles: `app/services/sync/SyncEngine.ts` start/end of `runSyncCycle`, separate from existing console.warn paths
- OPFS storage: a new measurement helper invoked on `/system` page mount + periodically by the sync cycle
- Recreate: `app/plugins/local-db.client.ts` after `clearLocalData()` reload, or fronted via a service that the page calls

Because system events are emitted from non-mutation contexts (no `stateWrite`), they bypass `LocalMutation.commit()` and use a thin helper that inserts into `events` directly with `actorType: "system"`, `actorId: "system"`, `source: "peaky.system"`. The migration runner already does this inline in `emitSchemaMigratedEvent`; we lift that into a reusable `emitSystemEvent()` helper.

### D5. `/system` page layout

Two states. Same skeleton, different signal density.

#### Happy-path layout

```text
┌─ /system ─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                    │
│   System                                                                          [↻ Refresh]      │
│   How Peaky is running on this device.                                                             │
│                                                                                                    │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐  │
│   │  ●  Database         │  │  ◇  Schema           │  │  ◫  Storage          │  │  ⇅  Sync          │  │
│   │     Healthy          │  │     Up to date       │  │     4.2 MB           │  │     In sync       │  │
│   │  Ready · 2 min ago   │  │  v12 of 12           │  │  of ~100 MB quota    │  │  0 pending        │  │
│   │  Cold start: 230 ms  │  │  2 migrations        │  │                      │  │  Last 14:32       │  │
│   │   What is this? ⌄    │  │   View history →     │  │   What's OPFS? ⌄     │  │   View events →   │  │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └──────────────────┘  │
│                                                                                                    │
│   ── Recent system activity ──────────────────────────────────────────────────────────────────────  │
│                                                                                                    │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │  When        Event                            Detail                                Status   │ │
│   │  14:32:11   ⇅ Sync cycle succeeded            0 events pushed · 0 pulled            local    │ │
│   │  14:02:45   ◇ Schema migrated to v12          0001_init, 0002_add_event_status      local    │ │
│   │  14:02:44   ● Local database ready            cold start · OPFS                     local    │ │
│   │                                                                  See all in Events →          │ │
│   └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                    │
│   ── Maintenance ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                                    │
│   ┌──────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │   ⚠  Recreate local database                                                                 │ │
│   │   Use this if Peaky feels stuck, slow, or out of date on this device.                        │ │
│   │   This affects only your browser — your data on the server is safe and re-downloads.         │ │
│   │   [  Recreate local DB  ]    Last recreated: never                                           │ │
│   └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Error-state layout

```text
   System                                                                          [↻ Refresh]
   How Peaky is running on this device.

   ┌──────────────────────────────────────────────────────────────────────────────────────┐
   │  ⚠  Local database is having trouble                                                  │
   │  Peaky couldn't open your local database. Your server data is safe.                   │
   │  Most often this fixes itself by recreating the local copy.                           │
   │  Error: Migration 0007_add_event_status failed at 14:02:44                            │
   │  [  Recreate local DB  ]   [  Try again  ]                                            │
   └──────────────────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐
   │  ⊘  Database         │  │  ◇  Schema           │  │  ◫  Storage          │  │  ⇅  Sync      │
   │     Error            │  │     Stuck at v6      │  │     12.1 MB          │  │     Paused    │
   │  Failed to start     │  │  6 of 12             │  │  of ~100 MB          │  │  Will retry   │
   │  Migration 0007      │  │  2 pending           │  │                      │  │               │
   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  └──────────────┘
```

### D6. Educational copy

Each tile has a collapsed "What is this? ⌄" expander with plain-language copy:

| Tile | Copy |
|------|------|
| Database | "Peaky stores a copy of your work in your browser so you can keep working when offline. We use SQLite, the same engine that powers your phone's contacts and messages apps." |
| Schema | "The shape of your local data. When we ship updates that need new fields or tables, you'll see a small migration run on your next visit." |
| Storage | "Your browser gives Peaky a small amount of private storage that no other site can see. This number is how much of that allowance Peaky is currently using." |
| Sync | "Your work is saved locally first, then sent to the server in the background. 'In sync' means the server has everything this browser has." |

The maintenance section's "this affects only your browser" sentence is non-negotiable — it's the difference between members confidently using the recovery action and members fearing data loss.

### D7. No power-user tools in this work

The page exposes exactly **one** action: Recreate local DB. Run-SQL, snapshot export, cursor reset, and force-bootstrap stay in `peakyDB` (dev-only) or in the Rust engine surface later. Reasoning:

- Snapshot export — security: it makes data exfiltration harder to trace and lets a member walk away with collaborator IDs. Server-side "purge my data" remains a future option.
- Run SQL — even gated, an unfamiliar power tool on a member-facing page invites accidents and creates support load.
- Cursor reset / force re-bootstrap — masks symptoms of real bugs by making them disappear; valuable for support diagnosis but not for self-serve.

Add JBTBD features later when a real need emerges.

### D8. Roadmap rewrite

`site/docs/development/roadmap.md` currently has a Stage 2 dedicated to "PowerSync Streams + remote Postgres" and a long Stage 2 implementation guide. Strip both. Replace with:

- Stage 2: Build a custom Rust sync engine. Streams remote data into local SQLite, replaces remote-bridge composables, enables event push.
- Roadmap items added:
  - "Admin pull events API" (status: undecided — custom API vs Looker analytics)
  - "SharedWorker multi-tab corruption guard" (paired note: see formal verification)
  - "Formal verification with FizzBee" (paired with the guard — expected to surface more issues)

The PowerSync section under "Stage 2 — PowerSync implementation guide" is removed entirely. The "remote bridges" inventory inside it stays as a useful map of where remote-coupled reads still exist; we move that section under Stage 2 — Rust sync engine cutover.

## Testing strategy

```text
LAYER                   TEST                                              RUN
─────                   ────                                              ───
Unit (Vitest)           system event Zod schemas parse + reject           pnpm test
                        emitSystemEvent helper writes correct shape
                        catalog includes every DomainEvent type
                        local-flag insertion sets status correctly

Integration (Vitest)    LocalMutation.commit persists full envelope       pnpm test:integration
                        outbox push does not advance event.status
                        migration failure emits LocalDbMigrationFailed
                        SyncEngine emits SyncCycleStarted/Succeeded/Failed
                        bootstrap emits LocalDbInitializing → LocalDbReady

E2E (Playwright)        /system page loads and shows healthy tiles        pnpm test:e2e
                        emergency banner appears when bootstrap fails
                        Recreate local DB clears OPFS and reloads
                        recent activity shows source=peaky.system events
                        confirmation modal blocks accidental recreate

A11y                    /system page passes axe-core checks                pnpm test:a11y
                        status tiles announce state to screen readers
                        emergency banner has role="alert"
```

The system event taxonomy gets a contract test (extending `tests/unit/services/events/schemas.test.ts`) verifying every new type has a catalog entry, schema, and JSON Schema artifact.

For the failure-injection scenarios (migration failure, OPFS unavailable, bootstrap timeout), use the existing `useState('local-db-error')` and dependency-injection seams; the `peakyDB` debug helpers don't need new escape hatches.

## Security Considerations

Reference: `site/docs/development/walkthroughs/local-first/security.md`.

1. **No new server endpoints.** This work is client-only. `/api/events` and `/api/admin/events` are unchanged. The future Rust event push endpoint is explicitly out of scope.

2. **New columns persisted in OPFS.** `dataschema` and `client_id` are URL-shaped strings and a session UUID respectively — no PII. `specversion` is a constant. The browser is untrusted as always; nothing here introduces new attack surface.

3. **No access-control changes.** `/system` is gated by the same authenticated-member check as the rest of the app. There is no admin-only state on the page; no entitlement checks needed.

4. **No user-supplied content rendered as HTML.** Event details are rendered as `<pre>` JSON via `JSON.stringify`. Education copy is static. No injection vector.

5. **No new `window.*` globals.** `peakyDB` already exists and is dev-gated; we do not extend it. The Recreate-DB action calls existing `peakyDB.clearLocalData()` semantics from a Vue component with `import.meta.dev`-equivalent feature surfaced via a dedicated service helper (so prod members can use it). The localStorage flag pattern (`LOCAL_STORAGE_CLEAR_FLAG`) is already exposed; we reuse it.

6. **Snapshot export deliberately excluded.** Security review: making member data exportable from the browser harms exfiltration traceability and could leak collaborator IDs. If a "delete my local data + clear server" feature is needed later, it ships server-side with audit trail.

7. **Sync ops events sync to server when the Rust engine lands.** `SyncCycleSucceeded.v1` and friends carry actor and timing data. They do not carry payload content. Sanitise error strings on `SyncCycleFailed.v1` (no stack traces with file paths or values).

## Risks / Trade-offs

```text
RISK                                         MITIGATION
────                                         ──────────
Members run Recreate-DB and lose local       Confirmation modal with explicit
work that hadn't synced yet                  pending-outbox count: "You have N
                                             unsynced changes that will be lost.
                                             [Sync now] [Recreate anyway]"

System event volume — emitting Sync          local: true on most lifecycle events
events on every cycle bloats the table       keeps them out of the eventual push;
                                             retention policy in /system page can
                                             drop very old peaky.system rows
                                             (deferred — defer until volume is real)

OPFS quota measurement requires              Wrap navigator.storage.estimate() in a
navigator.storage.estimate, not              try/catch; show "Unknown" on failure.
guaranteed in all browsers                   Emit OpfsStorageMeasured with a
                                             "supported: false" field if API absent.

Status tiles depend on a freshness signal    Tiles are computed from
that's stale if events stop firing           lastEventByType() — pure read of the
                                             events table. Refresh button forces a
                                             re-measurement (storage, sync state).

Educational copy invites scope creep —       Copy ships in this work as final-ish.
"can we add tooltips for X?"                 Treat additions as future copy PRs,
                                             not feature PRs.
```

## Migration Plan

This is forward-only. New SQL migration adds the three columns; no backfill needed (existing rows get `specversion = '1.0'` via DEFAULT, others stay NULL). The migration runner already handles fresh installs (bundled) and upgrades (incremental) per `site/docs/development/walkthroughs/local-first/upgrades.md`.

Rollback strategy: drop the migration row from `_migrations` and revert the schema in a follow-up migration if needed. Pre-production, no data preservation is required.

Deploy order:

1. Land this change. New columns persist; new system events emit; `/system` ships.
2. Land `rename-domain-events-table` (sibling, parallel worktree). Mechanical rename.
3. Future: land Rust event pusher, which advances `pending → synced` for non-`local` events.

The two changes can ship in either order. The rename touches the same table this change extends, so whichever lands second rebases its migration ID.

## Open Questions

- **`/system` route placement in the nav** — do we add it under "Settings" or as a top-level sidebar item alongside `/events`? Recommend top-level given members may need it for self-service when something is wrong (less navigation when stressed). Confirm with whoever owns sidebar IA.
- **OPFS quota threshold for `OpfsQuotaWarning.v1`** — fire at 80% used? 90%? Need a number. Recommend 80% based on browser warning patterns.
- **Status tile freshness window** — if the last `SyncCycleSucceeded.v1` is older than 5 minutes, do we show the Sync tile as "Stale" or "In sync"? Recommend stale-after = 2× the sync interval (currently 60s), so 2 minutes.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Page shell | n/a | — | `ml-20 flex flex-1 flex-col lg:mx-32` | Match `/events` shell |
| Inner container | n/a | — | `max-w-8xl mx-auto space-y-6` | |
| Page header title | n/a (h1) | — | `text-default text-2xl font-bold` | |
| Page header subtitle | n/a (p) | — | `text-muted mt-1 text-sm` | |
| Refresh button | `UButton` | `color="neutral"` `variant="outline"` `icon="i-lucide-refresh-cw"` | — | |
| Emergency banner | `UAlert` | `color="error"` `variant="subtle"` | — | Conditional on `useState('local-db-error')` |
| Status tile | `UCard` | — | `flex flex-col gap-2 p-4` | 4-up grid on desktop |
| Tile health dot | `UBadge` | `size="sm"` color from status | — | green=healthy, yellow=warn, red=error |
| Tile big word | n/a (span) | — | `text-default text-lg font-semibold` | |
| Tile support line | n/a (p) | — | `text-muted text-sm` | |
| "What is this?" expander | `UCollapsible` | — | `text-muted text-xs` | Closed by default |
| Recent activity table | existing `DataTable` | — | — | Reuses `/events` pattern |
| Maintenance card | `UCard` | — | `flex flex-col gap-3 p-6` | |
| Recreate button | `UButton` | `color="warning"` `variant="solid"` | — | Triggers confirm modal |
| Confirm modal | `UModal` | — | — | Shows pending outbox count |

### Spatial Composition

- Container widths: same as `/events` — `max-w-8xl mx-auto` inner, `ml-20 lg:mx-32` shell.
- Gaps and spacing: `space-y-6` between sections, `gap-4` between status tiles within their grid.
- Status tile grid: `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4` (stacks on mobile, 2-up on tablet, 4-up on desktop).
- Stretch behavior: tiles stretch equally; recent-activity DataTable expands to full container width.
- Visual hierarchy: header → emergency banner (when present) → status tiles (glance) → recent activity (scannable) → maintenance (deliberate).

### Visual Assertions

- **AND** the page header reads "System" with subtitle "How Peaky is running on this device."
- **AND** the four status tiles render in a single row at desktop breakpoints (≥1280px).
- **AND** each status tile shows exactly one big-word state (e.g., "Healthy", "Up to date", "In sync", or their failure equivalents) plus one supporting line.
- **AND** when `useState('local-db-error')` is non-null, an emergency `UAlert` appears between the header and the status tiles, containing a "Recreate local DB" button and a "Try again" button.
- **AND** the recent system activity table is filtered to events where `source = peaky.system` and shows at most 10 rows, with a "See all in Events →" link in its footer pointing to `/events?source=peaky.system`.
- **AND** the maintenance section has exactly one button labeled "Recreate local DB" (no Run SQL, no Export, no Reset cursor, no Force re-bootstrap).
- **AND** clicking "Recreate local DB" opens a confirm modal that displays the count of unsynced outbox items and offers both "Sync now" and "Recreate anyway".
- **AND** every status tile exposes a "What is this? ⌄" expander that, when opened, shows the educational copy from D6 in `text-muted text-xs`.
- **AND** the page renders identically for admin and non-admin members; no admin-only state appears.

---

## Realised design (post-merge addendum)

This section captures the deltas between the design above and what
actually shipped on `feat/complete-events-experience`. The goals,
non-goals, and core decisions (D1–D8) all held; the deltas are
reshapes, polish, and edge cases the original design didn't anticipate.
For the full per-commit walk see `tasks.md` "Deviations from original
plan".

### D2.1 — Event catalog: keyed map with required `local` and per-key entityType

The original D1 ("persist the full envelope") and D2 ("decouple events
from outbox") landed as designed. The catalog mechanism is what changed.

The catalog is now a keyed object constrained by `satisfies
EventCatalogMap`, with `local` required (no optional default) and
`entityType` carried per-entry, narrowed to the matching DomainEvent
member's entityType via `Extract`. Six guarantees flow from this:

1. The key MUST be a real member of `DomainEvent["type"]` — typo →
   compile error.
2. Every member of `DomainEvent["type"]` MUST appear as a key — forget
   to register → compile error.
3. `local` is required — no silent push-eligible default.
4. `sources` is constrained to the known CloudEvents source values.
5. `entityType` is narrowed per-key — wrong entityType for a type →
   compile error.
6. `createEvent` and `emitSystemEvent` look up `entityType` from the
   catalog (`getCatalogEntityType<T>`) instead of accepting it as an
   argument. 38 call sites no longer pass entityType — drift between
   the type and entityType arguments is impossible.

This was discovered during the manual review when a parallel literal
string at the call site (`createEvent("ReviewAnswerRecorded.v1",
"review_answer", ...)`) was found to be drift-prone — the type and
entityType arguments could go out of sync without the compiler
catching it. The fix is in this PR rather than a follow-up because
"easier to do the right thing, harder to do the wrong thing" was an
explicit user goal for this change.

### D6.1 — /system Sync tile gains a `not-yet-synced` state

Original D6 mapped Sync to four states: `in-sync`, `stale`, `paused`,
`failed`. The `lastSyncAt: null && pendingCount > 0` case was assumed
to be transient — but on a fresh install with offline edits, that
state can persist indefinitely until the first connection. Showing
"In sync · 5 pending" in green during that window was contradictory.

The shipped state machine has five states. `not-yet-synced` is
returned when `latest === null && pendingCount > 0`; renders neutral
with "Not synced yet · waiting for first sync". The `in-sync` state
remains for the vacuous case (no sync events AND no pending).

### D6.2 — Recent Activity is session-scoped

The original design said the Recent Activity table is a slice of the
events table filtered to `source = peaky.system`, limited to 10 rows.
That's mechanically what shipped, but with a `gte` lower bound: the
table only shows events emitted since the latest
`LocalDbInitializing.v1` (one fires per page bootstrap, so this scopes
to the current browser session).

Without this, returning users with months of history would interpret
old events at the top of the table as "did nothing happen since I last
looked?". The cross-session view is one click away via the "See full
history in Events" link.

### D6.3 — Tile order is failure-priority, not alphabetical

D6 listed the tiles as Database / Schema / Storage / Sync. Shipped
order: Database / Sync / Storage / Schema. Sync is what most users
care about most often ("did my edits go up?"); Schema is what they
almost never have an opinion about. Visual hierarchy follows the
"what would they look at first if something felt wrong" principle.

### D9 — Categorisation: peaky.system events go to `system`, not `lifecycle`

Not in the original design, surfaced when the user reviewed the live
`/events` feed during the implementation. The admin formatter
(`eventToAdminRecord`) was routing all peaky.system events through
`LifecycleAdminEvent` because it only special-cased
`entityType === "schema"`. The "lifecycle" category is reserved for
user-facing review/product/template archive/restore/delete; surfacing
DB lifecycle / OPFS / sync ops there pollutes the lifecycle filter.

The shipped dispatch routes `source === "peaky.system"`,
`entityType === "schema"`, and `entityType === "local_db"` to
`SystemAdminEvent` (category: "system").

### D10 — Acronym-aware label formatting

Not in the original design. The PascalCase splitter in
`formatAdminEventLabel` was rendering `LocalDbInitializing.v1` as
"Local Db Initializing". An ACRONYMS set (`db`, `opfs`, `url`, `api`,
`json`, `http`, `id`) and a slightly wider split regex
(`[\s._-]+` instead of `[._-]`) make the same input render as
"Local DB Initializing". Catches `OpfsStorageMeasured.v1` →
"OPFS Storage Measured" symmetrically.

### D11 — Schema tile hides version numbers on the healthy path

Original D6 had the Schema tile showing "Up to date · v10 of 10" when
healthy and "Stuck at v3" when amber. The numbers are sequential
migration counts, not semver — a high "v10" reads as "10 versions?"
to non-technical users (eroding trust) and implies semver to technical
users (10 major versions, untrue). Both readings undermine the
signal the tile is trying to give.

Shipped behaviour:

- Healthy: tile reads "Up to date" with no support line. The whole
  signal is the green colour + headline.
- Stuck: tile reads "Stuck" + "N updates pending" — the gap count
  carries diagnostic value ("how far behind am I?") without exposing
  a misleading absolute version number.

Considered showing a date instead ("Schema as of Apr 2026") but
migration IDs are sequential prefixes (`0010_<name>`) with no embedded
date, so a date-based label would need either a date field on each
migration definition or a git-derived lookup. Rejected as more moving
parts for the same outcome — hiding the noise is enough.

### D12 — Clear cache action added before Recreate Local DB

Original D5 layout had the Maintenance section as one card (Recreate
local DB). Real-world support traffic showed the more common cause of
"Peaky feels broken" was a stale browser cache after a release — fixable
without touching the local database. Pre-disabling-PWA, the team had to
walk users through Chrome's clear-cache UI + hard refresh + opening an
incognito window to test. A previous in-app attempt (in the command
palette) was reported as "didn't quite work".

Diagnosis: the previous attempt lacked numeric feedback, so users
clicked it and weren't sure if it ran. Plus the localStorage clear was
absent, leaving Workbox metadata behind to keep the SW alive.

Shipped behaviour:

- New `SystemClearCacheCard.vue` sits BEFORE Recreate local DB. Pre-
  flight modal counts the SW registrations + cache entries about to
  clear; toast announces the work; cache-busted hard reload closes the
  loop.
- Helper rebuild in `app/utils/browserCache.ts` returns a rich result:
  `{ cacheCount, serviceWorkerCount, localStorageKeysCleared,
  sessionStorageCleared, freedBytes }`. The numeric feedback is the
  fix for "nothing happened" UX.
- localStorage clear is **selective**: patterns matching `workbox-`,
  `vite-pwa-`, `service-worker`, `sw-`, `pwa-`, and the bootstrap-error
  key go. `peaky:current-actor` (auth) and UI prefs (`peaky:*` /
  `orr:*`) are PRESERVED. Wiping them would log the user out, which is
  a worse outcome than the cache staleness this action exists to fix.
  (Migrating the residual `orr:*` keys to `peaky:*` is tracked in
  GitHub issue #16.)
- IndexedDB / OPFS are deliberately NOT touched. The Recreate Local DB
  action owns that path; this is the lighter recovery step on purpose.
- Six unit tests in `tests/unit/utils/browserCache.test.ts` lock the
  contract: SWs unregistered, caches deleted, selective localStorage
  preservation, sessionStorage wiped, freedBytes computed, idempotent
  on second click.

The two recovery actions are now ordered Clear cache → Recreate by
relative danger, with `info` colour vs `warning` colour buttons giving
the visual signal.

### D13 — Test helpers gated on `VERCEL_ENV`, not `import.meta.dev`

Not in the original design. Discovered when running E2E against the
Vercel preview deployment: 91 of 173 tests failed because
`window.__peakySeed` (E2E seed) and `window.peakyDB` (debug) were
guarded by `import.meta.dev`, so production builds (which the Vercel
preview is) hid them. Page snapshots for every failure showed the
unauthenticated empty state — no way for tests to bootstrap fixture
data.

Shipped behaviour:

- New `runtimeConfig.public.testHelpersEnabled` in `nuxt.config.ts`,
  computed at build time as `process.env.VERCEL_ENV !== "production"`.
  True in local dev (env unset), true on preview (VERCEL_ENV=preview),
  false in real production.
- `app/plugins/test-seed.client.ts` and `app/plugins/local-db.client.ts`
  swap their `import.meta.dev` guards for the runtime-config check.
- Result: `pnpm test:e2e` against the preview goes from 91 failures →
  1 unrelated SSE-bypass failure (raw browser `EventSource` doesn't
  include the `x-vercel-protection-bypass` header — pre-existing,
  separate fix).
- Security posture preserved: real production
  (`VERCEL_ENV=production`) still hides both helpers, so the
  spec's "no SQL / no export / no cursor reset" exclusions hold for
  the audience the spec was protecting (members on production).

This decision is what makes E2E-against-preview a reliable workflow
instead of a "you have to run local dev" workaround. The single
command from now on:

    PLAYWRIGHT_BASE_URL=<preview-url> pnpm test:e2e

### D14 — Breadcrumb resolver: self-healing path-segment derivation

User noticed `/system` displayed "Teams > System" in the breadcrumb.
Root cause: `getDefaultRootBreadcrumb` had a hardcoded allow-list of
top-level paths and a silent fallback to "Teams" for anything else.
Adding a new top-level route (`/system`, `/events`, future ones) would
inherit the wrong root forever.

Shipped behaviour:

- The function now derives the root label from the FIRST path segment.
  `/system` → "System"; `/events` → "Events"; `/foo/bar` → "Foo".
- A small `TOP_LEVEL_LABEL_OVERRIDES` map handles edge cases where the
  auto-derived label needs adjusting (today only `/schemas` →
  "Event Schemas"). Adding a new route requires zero changes to the
  resolver — the URL is the source of truth.
- Tests pin the contract: `tests/unit/ui/breadcrumbMiddleware.test.ts`
  asserts every known top-level route AND that no fallback to "Teams"
  can happen (regression guard against the previous silent-fallback
  pattern).

Tangential to the events-experience scope but landed in this PR
because it was discovered during the docs screenshot review (the
broken breadcrumb was visible in the captured /system hero).
