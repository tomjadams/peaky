<!-- PEAKY TASK GUIDELINES -->

## Status as of 2026-04-30

All ten task groups (1–10) plus housekeeping landed across 22 commits on
`feat/complete-events-experience` (PR #14). The sibling rename change
`rename-domain-events-table` shipped first as PR #13 (`0947882`); this
branch builds on it, so all references are to the renamed `events`
table.

**What deviated from the original plan** is documented at the bottom of
this file under "Deviations from original plan". The short version: a
manual review halfway through the work surfaced six follow-ups (E2E
seeding through `__peakySeed` instead of HTML state, a keyed catalog
refactor, full envelope wiring through the admin slideover, system-
event entityType naming, OPFS measurement split from emission, and a
session-scoping fix for `/system` Recent Activity). Three reviewer
passes (`ts-reviewer`, `test-reviewer`, `ux-reviewer`) at the end
produced one more substantive change set: an entityType-from-catalog
refactor, two `/system` UX blocker fixes (session scoping invisible,
sync tile lying), and a categorisation fix where DB lifecycle events
were landing in the user-facing "lifecycle" filter instead of "system".

## Prerequisites

> Issue: heitorlessa/orr-sample#11
> PR: heitorlessa/orr-sample#14

- [x] 0.1 Create GitHub issue in RFC style describing the problem and approach summarised from `design.md`
- [x] 0.2 Create feature branch named `feat/complete-events-experience`
- [x] 0.3 Open draft PR linked to the issue using a conventional-commit title (`feat(events): complete events experience`)
- [x] 0.4 Confirm sibling change `rename-domain-events-table` lands ahead in scheduling, OR coordinate the migration ID for whichever ships second (rename landed first as PR #13)

## 1. Schema migration — full CloudEvents envelope

> dependencies: none

- [x] 1.1 Author SQL migration adding `specversion TEXT NOT NULL DEFAULT '1.0'`, `dataschema TEXT`, `client_id TEXT` to `domain_events` (or `events` if the rename has landed)
- [x] 1.2 Add `'local'` to the `eventStatus` enum in `shared/db/schema/event.ts` and the migration
- [x] 1.3 Run `pnpm db:migrations:generate` to embed the migration content
- [x] 1.4 Add an integration test in `tests/integration/migrations.test.ts` that asserts the migration adds the expected columns and the new enum value
- [x] 1.5 Update `shared/db/schema/event.ts` Drizzle definitions to expose the new columns and `local` status
- [x] 1.6 Run `ts-reviewer` on schema and migration files
- [x] 1.7 Run `test-reviewer` on the migration tests
- [x] 1.8 Address review findings

## 2. Event catalog — `local` flag and write-path plumbing

> dependencies: 1

- [x] 2.1 Extend `EventCatalogEntry` in `app/services/events/schemas/index.ts` with optional `local?: boolean`
- [x] 2.2 Update `LocalMutation.commit()` in `app/services/local-mutation.ts` to look up the catalog entry for `event.type`, set `status` to `"local"` when `local: true`, otherwise `"pending"`, and persist the full envelope (`specversion`, `dataschema`, `client_id`)
- [x] 2.3 Add a thin `emitSystemEvent()` helper in `app/services/events/` that inserts directly into `events` for non-mutation contexts (DB bootstrap, sync cycle, OPFS measurement) — actor `system`, source `peaky.system`, status from catalog flag
- [x] 2.4 Refactor `emitSchemaMigratedEvent()` in `app/local-db/migrations.ts` to use `emitSystemEvent()`
- [x] 2.5 Add a unit test verifying that catalog `local: true` ⇒ inserted row has `status = "local"`, otherwise `status = "pending"`
- [x] 2.6 Add a unit test verifying `LocalMutation.commit()` persists every envelope field (no silent drops)
- [x] 2.7 Run `ts-reviewer` on TS changes
- [x] 2.8 Run `test-reviewer` on new tests
- [x] 2.9 Address review findings

## 3. System event taxonomy — interfaces, schemas, catalog

> dependencies: 2

- [x] 3.1 Add interfaces in `app/services/events/DomainEvent.ts` for `LocalDbInitializing`, `LocalDbReady`, `LocalDbBootstrapStarted`, `LocalDbRecreated`, `LocalDbMigrationFailed`, `OpfsQuotaWarning`, `OpfsStorageMeasured`, `SyncCycleStarted`, `SyncCycleSucceeded`, `SyncCycleFailed`, `EntitlementsRefreshed`
- [x] 3.2 Extend the `DomainEvent` discriminated union with the new types
- [x] 3.3 Add Zod schemas for each new event in `app/services/events/schemas/system.ts`, with `.describe()` on every field; reuse `shared.ts` field builders where applicable
- [x] 3.4 Register every new event in the `EVENT_CATALOG` in `app/services/events/schemas/index.ts` with appropriate `sources` and `local` flag (per the table in design.md §D3)
- [x] 3.5 Run `pnpm events:schemas` to regenerate JSON Schema artifacts and commit the new files
- [x] 3.6 Extend `tests/unit/services/events/schemas.test.ts` to verify every new `DomainEvent` type has a catalog entry, schema, and JSON Schema artifact
- [x] 3.7 Add a contract test asserting all `peaky.system` lifecycle/storage events have `local: true` in the catalog
- [x] 3.8 Run `ts-reviewer` on TS changes
- [x] 3.9 Run `test-reviewer` on new tests
- [x] 3.10 Address review findings

## 4. System event emission integrations

> dependencies: 3

- [x] 4.1 Emit `LocalDbInitializing.v1` and `LocalDbReady.v1` from `app/local-db/bootstrap.ts` (with cold-start duration in ms on `LocalDbReady`)
- [x] 4.2 Emit `LocalDbBootstrapStarted.v1` from `app/plugins/local-db.client.ts` at the start of the warmup callback chain
- [x] 4.3 Emit `LocalDbMigrationFailed.v1` from `app/local-db/migrations.ts` (`applyMigration` and `applyMigrationBundle` catch blocks) with sanitised error message
- [x] 4.4 Emit `LocalDbRecreated.v1` on the first `LocalDbReady` after a `LOCAL_STORAGE_CLEAR_FLAG` reload, with `triggeredBy: "user"`
- [x] 4.5 Emit `SyncCycleStarted.v1` / `SyncCycleSucceeded.v1` / `SyncCycleFailed.v1` from `app/services/sync/SyncEngine.ts` `runSyncCycle()` (durations, counts, sanitised errors)
- [x] 4.6 Emit `EntitlementsRefreshed.v1` from `SyncEngine.refreshEntitlements()`
- [x] 4.7 Add an OPFS measurement helper that calls `navigator.storage.estimate()` (guarded with try/catch and `supported: false` fallback) and emits `OpfsStorageMeasured.v1`; emit `OpfsQuotaWarning.v1` when `usage / quota > 0.8`
- [x] 4.8 Sanitise error strings on all `*Failed.v1` events to strip stack traces, file paths, and embedded values
- [x] 4.9 Add integration tests covering each emission path (success and failure scenarios per design.md §Testing strategy)
- [x] 4.10 Run `ts-reviewer` on TS changes
- [x] 4.11 Run `test-reviewer` on integration tests
- [x] 4.12 Run `security-reviewer` on the error sanitisation logic
- [x] 4.13 Address review findings

## 5. Verify outbox push does not advance event status

> dependencies: 2
> can be done in parallel with: 3, 4

- [x] 5.1 Audit `app/services/sync/SyncEngine.ts` `pushChanges()` — confirm no writes to `events` (or `domain_events`) table beyond the new sync-cycle emissions added in task 4.5
- [x] 5.2 Add a regression integration test that inserts a `pending` event, runs `SyncEngine.runSyncCycle()`, and asserts the event row's `status` and `synced_at` are unchanged
- [x] 5.3 Add a code comment near `pushChanges()` documenting the deliberate decoupling and pointing to the Rust sync engine roadmap entry
- [x] 5.4 Run `ts-reviewer` on TS changes
- [x] 5.5 Run `test-reviewer` on the regression test
- [x] 5.6 Address review findings

## 6. Admin formatter — full envelope in details

> dependencies: 1, 3

- [x] 6.1 Update `domainEventToAdminRecord` in `app/admin/localEvents.ts` to spread the full envelope (`specversion`, `dataschema`, `source`, `actorType`, `entityType`, `entityId`, `reviewId`, `clientId`, `time`, `status`) into `details`, alongside the existing `parsedData`
- [x] 6.2 Update the admin event details slideover (`AdminEventDetailsSlideover.vue` or similar) so the JSON pane shows the full envelope view, not just `data`
- [x] 6.3 Add a unit test for `domainEventToAdminRecord` asserting no envelope field is silently dropped
- [x] 6.4 Add a Playwright assertion at `/admin/events` and `/events` that the detail panel displays `source`, `actorType`, and `specversion` for at least one record
- [x] 6.5 Run `ts-reviewer` on TS changes
- [x] 6.6 Run `vue-reviewer` on the slideover changes
- [x] 6.7 Run `test-reviewer` on new tests
- [x] 6.8 Address review findings

## 7. /system page — composable and components

> dependencies: 3, 4

- [x] 7.1 Create `app/composables/system/useSystemStatus.ts` that exposes reactive `database`, `schema`, `storage`, `sync` summaries derived from the latest `peaky.system` events and the local outbox depth
- [x] 7.2 Create a status-tile component (`app/components/system/SystemStatusTile.vue`) using `UCard` with slots for headline, support line, contextual link, and a `UCollapsible` "What is this?" expander
- [x] 7.3 Create a recent-activity component (`app/components/system/SystemRecentActivity.vue`) reusing the existing `DataTable` pattern from `/events`, filtered to `source = peaky.system`, limited to 10 rows, with footer link to `/events?source=peaky.system`
- [x] 7.4 Create a maintenance card (`app/components/system/SystemMaintenanceCard.vue`) with the single "Recreate local DB" button, safety copy from design.md §D6, and confirmation `UModal`
- [x] 7.5 Create an emergency banner component (`app/components/system/SystemEmergencyBanner.vue`) consuming `useState('local-db-error')` and offering "Recreate local DB" / "Try again" actions
- [x] 7.6 Add unit tests for `useSystemStatus` covering happy-path, error-state, OPFS-unsupported, and stale-sync scenarios
- [x] 7.7 Add component tests for tile, recent-activity, maintenance, and emergency-banner components
- [x] 7.8 Run `ts-reviewer` on TS changes
- [x] 7.9 Run `vue-reviewer` on new Vue components
- [x] 7.10 Run `ui-review` on the new components for semantic colours and visual design alignment
- [x] 7.11 Run `test-reviewer` on new tests
- [x] 7.12 Address review findings

## 8. /system page — route, layout, and integration

> dependencies: 7

- [x] 8.1 Create `app/pages/system.vue` following the shell conventions from `app/pages/events.vue` (header, subtitle, refresh, ml-20/lg:mx-32 outer, max-w-8xl inner, space-y-6)
- [x] 8.2 Wire emergency banner above status tiles (conditional on `local-db-error`)
- [x] 8.3 Wire 4-tile responsive grid: `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4`
- [x] 8.4 Wire recent-activity section beneath tiles
- [x] 8.5 Wire maintenance section beneath recent activity
- [x] 8.6 Add `/system` to the sidebar navigation as a top-level entry (visible to all members)
- [x] 8.7 Add `definePageMeta({ breadcrumb: { label: "System" } })`
- [x] 8.8 Add Playwright E2E covering the happy-path render, the error-state banner, the recreate flow with confirmation modal, and the unsynced-outbox count display
- [x] 8.9 Add a Playwright assertion that no Run-SQL, Snapshot-export, or Reset-cursor element is present on `/system`
- [x] 8.10 Add a `playwright.a11y` test confirming `/system` passes axe-core checks
- [x] 8.11 Run `vue-reviewer` on the page
- [x] 8.12 Run `ui-review` on the page
- [x] 8.13 Run `test-reviewer` on E2E and a11y tests
- [x] 8.14 Run `ux-reviewer` on the completed `/system` user flow
- [x] 8.15 Address review findings

## 9. Roadmap rewrite

> dependencies: none
> can be done in parallel with: any other group

- [x] 9.1 Edit `site/docs/development/roadmap.md` — strip "Stage 2 — PowerSync implementation guide" entirely
- [x] 9.2 Replace Stage 2 with "Build a custom Rust sync engine"; preserve the "remote bridges" inventory under the new heading as a cutover map
- [x] 9.3 Add roadmap items: "Admin pull events API (undecided: custom API vs Looker analytics)", "SharedWorker multi-tab corruption guard", "Formal verification with FizzBee"
- [x] 9.4 Group SharedWorker guard and FizzBee under the same section; note the expectation that formal verification will surface additional issues to harden against
- [x] 9.5 Update Admin Events v2/v3 horizons — mark the v2 "Raw Details envelope wart" item as resolved by this change

## 9a. Walkthroughs — keep architecture documentation in sync with the change

> dependencies: 4, 8
> can be done in parallel with: 9

- [x] 9a.1 Update `site/docs/development/walkthroughs/codebase/events.md` — document the full CloudEvents envelope persistence (new `specversion` / `dataschema` / `client_id` columns), the `local: true` catalog marker and what it means for status, the new system event taxonomy with success/failure pairs, the deliberate write-path decoupling between events and `local_outbox`, and add a "see also: /system page" cross-reference
- [x] 9a.2 Update `site/docs/development/walkthroughs/local-first/auditing.md` — refresh the diagrams that show the events-vs-outbox split to mention the independent status pipelines; add the new system event types to any taxonomy table
- [x] 9a.3 Update `site/docs/development/walkthroughs/local-first/failure-domains.md` — document `LocalDbMigrationFailed.v1` as the canonical failure signal (paired with `_migration_log` rows), and the `/system` page as the recovery surface
- [x] 9a.4 Update `site/docs/development/walkthroughs/local-first/upgrades.md` — document the `/system` page Recreate-DB flow as the supported recovery path (replacing the dev-only `peakyDB.clearLocalData()` mention) and reference `LocalDbRecreated.v1`
- [x] 9a.5 Update `site/docs/development/walkthroughs/local-first/architecture.md` — add the `/system` page to the runtime layers diagram and explain its role as the member-facing engine surface
- [x] 9a.6 Update `site/docs/development/walkthroughs/local-first/security.md` — document the deliberate exclusions on `/system` (no SQL, no export, no cursor reset) and the rationale (exfil traceability, accidental misuse)
- [x] 9a.7 Update `site/docs/development/walkthroughs/local-first/index.md` — add `/system` to the reading map alongside the other local-first pages
- [x] 9a.8 Update `site/docs/development/walkthroughs/local-first/data-model.md` and `api.md` if they describe event status or the events table contract — refresh accordingly
- [x] 9a.9 Update `site/docs/development/walkthroughs/codebase/architecture.md` and `index.md` — add the `/system` page entry point and the new system event sources
- [x] 9a.10 Cross-link walkthroughs to each other where the new content intersects (auditing ↔ failure-domains ↔ upgrades ↔ security)
- [x] 9a.11 Run a final read-through of all updated walkthroughs in sequence to verify cross-references are correct and no concept is left undefined
- [x] 9a.12 Address documentation review findings

## 10. Member-page navigation and education polish

> dependencies: 8

- [x] 10.1 Confirm `/system` link copy in the sidebar reads "System" (not "Diagnostics" or "Health")
- [x] 10.2 Walk through the page as a non-engineer persona — confirm no headline uses "OPFS", "WAL", "WASM", "outbox", or "cursor"; confirm acronyms only appear inside expanders with explanations
- [x] 10.3 Confirm the maintenance card's safety sentence renders verbatim: "This affects only your browser — your data on the server is safe and re-downloads automatically the next time you sign in."
- [x] 10.4 Confirm the recreate confirmation modal shows the unsynced-outbox count and offers both "Sync now" and "Recreate anyway"
- [x] 10.5 Run `ux-reviewer` on the polished flow
- [x] 10.6 Address review findings

## Housekeeping

- [x] H.1 Run `pnpm validate` — lint, typecheck, formatter must pass
- [x] H.2 Run `pnpm test:run` and `pnpm test:integration` — all green
- [x] H.3 Run `pnpm test:e2e` and `pnpm test:a11y` — all green
- [x] H.4 Update decision log `site/docs/development/decisions.md` with: (a) the `local: true` marker for events, (b) the deliberate decoupling of event status from outbox push, (c) the security exclusions on `/system` (no export, no SQL, no cursor reset), (d) the PowerSync removal in favour of Rust sync engine
- [x] H.5 Update GitHub issue with task completions and link to merged PR
- [x] H.6 Mark sibling change `rename-domain-events-table` as ready to rebase against this work's migration IDs (or vice versa)

## Manual tasks

- [x] M.1 Manual review of areas ordered by ROI
  - [ ] M.1.1 `/system` page rendering at three breakpoints (mobile, tablet, desktop)
  - [ ] M.1.2 Recreate-DB flow end-to-end: trigger, confirmation modal, reload, ready, `LocalDbRecreated.v1` visible in `/events`
  - [ ] M.1.3 Migration failure simulation — verify emergency banner, `LocalDbMigrationFailed.v1` event, and recovery via Recreate-DB
  - [ ] M.1.4 Education copy spot-check with one non-engineering reader (PM, designer, or compliance reviewer)

## Deviations from original plan

The original tasks.md and design.md both pre-date the manual review and
the post-implementation reviewer round. Listing what shipped differently
so future readers don't conclude the design drifted by accident.

### A. Event catalog reshape (new in this change)

Original 2.1 said "Extend `EventCatalogEntry` with optional `local?:
boolean`". Shipped change: the catalog itself was restructured.

- The `EVENT_CATALOG` is now a **keyed object** (`{ "ReviewAnswer
  Recorded.v1": {...}, ... }`) constrained by `satisfies
  EventCatalogMap`, not an array. The key IS the event-type literal,
  so a typo or rename of an event surfaces as a compile-time mismatch
  with the `DomainEvent` discriminated union.
- `local` is **required**, not optional with default. No silent
  push-eligible default. (Refactor: `8d489f5`.)
- `entityType` was added to each catalog entry, narrowed via
  `Extract<DomainEvent, { type: K }>["entityType"]`. `createEvent` and
  `emitSystemEvent` no longer accept `entityType` as an argument — they
  call `getCatalogEntityType<T>(type)` from the catalog. Eliminates 38
  parallel literal-string call sites that used to duplicate the type
  registry. (Refactor: `950b0bd`.)
- Added the iterable `EVENT_CATALOG_ENTRIES` projection for table
  rendering / JSON-Schema generation, distinct from the keyed catalog
  used by lookups. (Refactor: `f46fe6f`.)

### B. /system Recent Activity is session-scoped

The original plan (task 7.3) said "filtered to `source = peaky.system`,
limited to 10 rows". The plan didn't anticipate that returning users
would interpret months-old events at the top of the table as "did
nothing actually happen since I last looked?". Shipped change:

- Recent Activity scopes to the **current browser session** via the
  latest `LocalDbInitializing.v1` time as a `gte` lower bound. (Fix:
  `287c024`.)
- Header subtitle communicates the scope ("This browser session only");
  link reads "See full history in Events". (Fix: `5e692d4`.)
- Logic extracted into `useSystemRecentActivity` for direct unit
  testing — the regression-prone behaviour now has 18 tests pinning the
  gte predicate. (Test: `48e6cc4`.)

### C. /system Sync tile semantics

Original tile copy in design.md §D6 mapped sync state to "in-sync /
stale / paused / failed". Manual review found a semantic gap: a fresh
session with pending edits and no successful sync was being labelled
"in sync · 5 pending" — green, contradictory. Shipped change:

- Added a `not-yet-synced` SyncState. Returned only when no sync cycle
  has ever completed AND the outbox is non-empty. Renders neutral with
  "Not synced yet · waiting for first sync". The "in-sync" branch
  remains for the vacuous case (nothing to sync, nothing pending).
  (Fix: `5e692d4`.)
- Tile order changed from Database / Schema / Storage / Sync to
  Database / Sync / Storage / Schema, ordered by failure priority. Sync
  is what most users actually care about. (Polish: `026fadc`.)

### D. Local DB events recategorised

Original plan placed all `peaky.system` events under the existing
`lifecycle` category. Shipped change: a categorisation fix routes
`source === "peaky.system"` and `entityType ∈ {schema, local_db}` to
the `system` admin category instead, so Local DB lifecycle events stop
polluting the user-facing lifecycle filter. (Fix: `49b95dc`.)

The same change adds an `ACRONYMS` set to `formatAdminEventLabel` so
`LocalDbInitializing.v1` renders as "Local DB Initializing" and
`OpfsStorageMeasured.v1` as "OPFS Storage Measured" — the camelCase
splitter was producing "Local Db" / "Opfs", which the user flagged as
wrong terminology.

### E. /system polish that wasn't in the original task list

- Surface `lastRefreshedAt` next to the Refresh button as "Updated 12s
  ago" so users can tell whether data is fresh. (Polish: `026fadc`.)
- Drop the always-"local" Status column from Recent Activity — every
  row in a session-scoped feed is `peaky.system` with `local: true`,
  so the badge added noise without information. (Polish: `026fadc`.)
- Remove the hardcoded "Last recreated: never" line from the
  Maintenance card — there's no underlying telemetry, so it was a
  constant string masquerading as a status indicator. (Polish:
  `026fadc`.)

### F. Test infra deltas

- `useState` shim in `tests/unit/composables/system/useSystemStatus.test.ts`
  was rewritten to use Nuxt's auto-imported memoised useState directly;
  the previous shim returned a fresh `{ value: init() }` per call,
  which made the entire `dbError`-takes-precedence branch unreachable
  from tests. (Test: `ff8354e`.)
- `withDatabase` mock now keys seeded rows by `${eventType}::${source}`
  tuples and asserts both predicates structurally. The previous mock
  ignored the `source = "peaky.system"` filter — anyone removing it
  would have shipped a green test. (Test: `ff8354e`.)

### G. Decision-log entries

Two decisions were added during the work that weren't anticipated in the
original design.md but are now in `site/docs/development/decisions.md`:

- The deliberate decoupling of event status from outbox push (designed,
  but the comment-trail and decision-log entry are new).
- The `not-yet-synced` SyncState as the right answer to "first run with
  pending edits".

The user-guide power-user pages also deviate from this change's
original scope: `site/docs/user-guide/power-user/events.md` was
refreshed (event names corrected from `AnswerRecorded.v1` →
`ReviewAnswerRecorded.v1`, source values corrected from `"ui"` →
`peaky.client/system/sync`, GDPR section rewritten to match the actual
`redactEventPii` path), and a new `site/docs/user-guide/power-user/
system.md` page was added.

### H. Clear cache action added before Recreate Local DB

User-driven addition partway through the PR. Original D5 had the
Maintenance section as a single Recreate-DB card; the team had a prior
attempt at a cache-clear button (in the command palette) that was
reported as "didn't quite work" because it lacked numeric feedback and
left Workbox metadata in localStorage.

Shipped:

- New `app/components/system/SystemClearCacheCard.vue` (lighter
  recovery step; sits before Recreate local DB in the actions
  section). (Commit: `20d3bd8`.)
- `app/utils/browserCache.ts` rebuilt to return rich result
  `{ cacheCount, serviceWorkerCount, localStorageKeysCleared,
  sessionStorageCleared, freedBytes }`. Selective localStorage clear
  preserves `peaky:current-actor` and UI prefs; sessionStorage wiped
  entirely; IndexedDB / OPFS untouched.
- 6 unit tests (`tests/unit/utils/browserCache.test.ts`) lock the
  contract.
- Spec L4 updated from "exactly one button" to "two recovery actions
  (Clear cache → Recreate local DB)" with new scenarios for the
  Clear-cache flow.
- Design.md addendum entry D12 records the rationale (numeric feedback
  - selective clear were what the previous attempt missed).

### I. Test helpers gated on `VERCEL_ENV` instead of `import.meta.dev`

Discovered when running E2E against the Vercel preview deployment:
91 of 173 tests failed because `window.__peakySeed` and `window.peakyDB`
were guarded by `import.meta.dev`, so production builds (which the
preview is) hid them. Tests had no way to seed fixtures.

Shipped:

- New `runtimeConfig.public.testHelpersEnabled` in `nuxt.config.ts`,
  build-time computed as `process.env.VERCEL_ENV !== "production"`.
- `app/plugins/test-seed.client.ts` and `app/plugins/local-db.client.ts`
  swap their `import.meta.dev` guards for the runtime-config check.
- Result: `pnpm test:e2e` against preview now passes 127, with 1
  unrelated SSE-bypass failure (raw `EventSource` doesn't include the
  `x-vercel-protection-bypass` header — pre-existing, separate fix).
- Security posture preserved on real production (`VERCEL_ENV=production`
  still hides both helpers).
- Design.md addendum entry D13 captures the rationale.

Also added a wizard-only e2e test (`tests/e2e/empty-state-flows.spec.ts`)
that exercises product creation end-to-end WITHOUT the `seed` fixture.
Found while reviewing this PR's E2E coverage — every other product/
team test took the seeded shortcut, so the wizard could regress and
127 green tests wouldn't notice.

### J. Breadcrumb resolver: self-healing path-segment derivation

User caught while reviewing the docs hero screenshot — the `/system`
page showed "Teams > System" in the breadcrumb because
`getDefaultRootBreadcrumb` had a hardcoded silent fallback to "Teams"
for any unrecognised path. `/events` and any future top-level route
inherited the same bug.

Shipped:

- The resolver now derives the root label from the FIRST path segment
  of the URL (`/system` → "System"; `/events` → "Events").
- Small `TOP_LEVEL_LABEL_OVERRIDES` map handles only the cases where
  auto-derive needs adjusting (`/schemas` → "Event Schemas").
- Tests in `tests/unit/ui/breadcrumbMiddleware.test.ts` pin the contract
  and explicitly assert the silent-fallback regression can't return.
- Design.md addendum D14 records the rationale.

Tangential to the events-experience scope but landed in this PR
because the broken breadcrumb was visible in the captured /system
hero screenshot.

### K. Documentation infrastructure additions

Not in original tasks; landed during the doc-quality pass:

- `site/docs/stylesheets/docs.css` gained an opt-in `.health-cards`
  CSS class for paired "Healthy rhythm" vs "Signs of trouble" grid
  cards (subtle green/amber leading edges + tints, both light and
  dark variants).
- `scripts/docs/capture-{system,events}-screenshots.spec.ts` capture
  hero + targeted card + per-tile screenshots from the Vercel preview,
  via a new opt-in `docs` Playwright project (`testDir:
  ./scripts/docs`). Helper file `_capture-helpers.ts` exports
  `fullPageScreenshotWithFixedElements` to fix the
  `position: fixed; height: 100vh` sidebar truncation bug.
- `.factory/droids/docs-reviewer.md` was rewritten to distinguish
  user-guide tier (no developer vocabulary, lead-and-stop pattern,
  health-cards) from maintainer tier (technical vocabulary OK,
  three load-bearing diagram patterns expected).
