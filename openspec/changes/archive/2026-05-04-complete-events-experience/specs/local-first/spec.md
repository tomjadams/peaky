## ADDED Requirements

### Requirement: Member-Facing System Page

The application SHALL expose a `/system` page available to all authenticated members (not admin-only) that surfaces the state of the local-first engine — database health, schema version, OPFS storage, sync state, recent system activity, and a single recovery action.

#### Scenario: Page is accessible to any authenticated member

- **WHEN** an authenticated member navigates to `/system`
- **THEN** the page loads regardless of whether the member is an admin
- **AND** the page renders identically for admin and non-admin members
- **AND** no admin-only state appears on the page

#### Scenario: Page follows existing /events shell conventions

- **WHEN** the page renders
- **THEN** the shell uses the same outer classes as `/events` (`ml-20 flex flex-1 flex-col lg:mx-32`)
- **AND** the inner container is `max-w-8xl mx-auto space-y-6`
- **AND** the title is "System" rendered with `text-default text-2xl font-bold`
- **AND** the subtitle is "How Peaky is running on this device." rendered with `text-muted mt-1 text-sm`
- **AND** the header includes a `UButton` with `icon="i-lucide-refresh-cw"` for refresh

#### Scenario: Emergency banner appears when bootstrap failed

- **WHEN** `useState('local-db-error')` is non-null on page mount
- **THEN** a `UAlert` with `color="error"` `variant="subtle"` renders between the header and the status tiles
- **AND** the alert contains a "Recreate local DB" button and a "Try again" button
- **AND** the alert text reassures the member that server data is safe

### Requirement: System Page Status Tiles

The `/system` page SHALL display four status tiles in a single horizontal row at desktop breakpoints, summarising Database, Schema, Storage, and Sync state for at-a-glance reading.

#### Scenario: Four tiles render in a responsive grid

- **WHEN** the page renders at viewport width ≥1280px
- **THEN** the tiles render in `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4`
- **AND** each tile is a `UCard` with consistent height

#### Scenario: Each tile shows headline, support line, and learn-more

- **WHEN** any status tile renders
- **THEN** the tile contains exactly one big-word state (e.g. "Healthy", "Up to date", "In sync")
- **AND** one supporting line in `text-muted text-sm` when the state carries diagnostic value (e.g. "0 pending", "Last sync 3m ago", "85% used") OR no support line on the healthy path when the colour + headline are the whole signal (e.g. Schema tile reads "Up to date" with no version number — sequential migration counts read as semver to engineers and erode trust to non-engineers, see design.md D11)
- **AND** an optional "What is this? ⌄" expander closed by default
- **AND** an optional contextual link (e.g. "View history →", "View events →")

#### Scenario: Tile values are computed from the events table

- **WHEN** the page mounts or the Refresh button is clicked
- **THEN** the Schema tile reads the latest `ClientSchemaMigrated.v1` event and the migrations table
- **AND** the Database tile reads the latest `LocalDbReady.v1` or `LocalDbMigrationFailed.v1` event
- **AND** the Storage tile reads the latest `OpfsStorageMeasured.v1` event (or triggers a measurement if none exists)
- **AND** the Sync tile reads the latest `SyncCycleSucceeded.v1` / `SyncCycleFailed.v1` event and the local outbox depth

#### Scenario: Failure-state tiles communicate the problem

- **WHEN** the local database is in an error state
- **THEN** the Database tile shows "Error" with the failed migration id in the support line
- **AND** the Schema tile shows "Stuck" with the count of pending migrations in the support line ("N updates pending")
- **AND** the Sync tile shows "Paused" with "Will retry when DB is OK"

### Requirement: System Page Recent Activity

The `/system` page SHALL display a list of recent system events (source = `peaky.system`) limited to a small number of rows, with a link to `/events` for the full feed.

#### Scenario: Recent activity is filtered to peaky.system

- **WHEN** the recent activity table renders
- **THEN** it queries the events table with `source = "peaky.system"`
- **AND** rows are sorted by `time` descending
- **AND** at most 10 rows are shown

#### Scenario: Footer links to the full /events page

- **WHEN** the recent activity table renders
- **THEN** the footer contains a link "See full history in Events →" pointing to `/events?source=peaky.system`
- **AND** rows are scoped to the current browser session via the latest `LocalDbInitializing.v1` time as a `gte` lower bound (so a returning user with months of history doesn't see "did nothing happen since I last looked?")

### Requirement: System Page Recovery Actions

The `/system` page SHALL expose two recovery actions — Clear cache (lighter step, preserves identity) and Recreate local DB (heavier step, clears the local database) — both with explicit copy stating that server data is safe. The page SHALL NOT expose any power-user maintenance tools (raw SQL, snapshot export, sync cursor reset, forced bootstrap).

The two actions are ordered Clear cache first, Recreate local DB second, because the lighter step covers the more common cause (stale browser cache after a release) and the heavier step is the recovery hatch when the local database itself is genuinely stuck.

#### Scenario: Maintenance section is recovery-only

- **WHEN** the page renders
- **THEN** the maintenance section contains exactly two action cards: `Clear cache` and `Recreate local DB`, in that order
- **AND** no Run-SQL button is present
- **AND** no Snapshot-export button is present
- **AND** no Reset-cursor or Force-bootstrap button is present
- **AND** Clear cache uses an `info` button colour and Recreate local DB uses a `warning` button colour, signalling the relative danger to the reader

#### Scenario: Clear cache action — what it clears

- **WHEN** the user confirms the Clear cache modal
- **THEN** every service-worker registration scoped to the origin is unregistered
- **AND** every Cache Storage entry is deleted
- **AND** localStorage keys matching PWA / Workbox patterns (`workbox-`, `vite-pwa-`, `service-worker`, `sw-`, `pwa-`, and the bootstrap-error key) are removed
- **AND** `peaky:current-actor` (auth identity) and `orr:*` / `peaky:*` UI prefs are PRESERVED — clearing them would log the user out, which is a worse outcome than the cache staleness this action exists to fix
- **AND** sessionStorage is cleared entirely (it is ephemeral by design)
- **AND** IndexedDB / OPFS are NOT touched (the Recreate Local DB action owns that path)

#### Scenario: Clear cache action — feedback signal

- **WHEN** the user opens the Clear cache modal
- **THEN** the modal shows a pre-flight count of service-worker registrations and Cache Storage entries about to be cleared
- **AND** on confirm, a toast announces "Clearing cache… Reloading with fresh browser state in a moment."
- **AND** the page reloads with a cache-busting query parameter so the browser HTTP cache is bypassed too
- **AND** the helper returns numeric counts plus a `freedBytes` delta from `navigator.storage.estimate()` so any future surface (or test) can avoid the "nothing happened" UX that broke the previous attempt

#### Scenario: Recreate local DB safety copy is explicit and non-alarming

- **WHEN** the Recreate local DB card renders
- **THEN** the description text contains the sentence "This affects only your browser — your data on the server is safe and re-downloads automatically the next time you sign in."
- **AND** the heading uses a soft warning glyph (e.g. `⚠`), not a destructive red banner

#### Scenario: Confirmation modal blocks accidental recreate

- **WHEN** the user clicks "Recreate local DB"
- **THEN** a `UModal` appears showing the current count of unsynced outbox items (if any)
- **AND** the modal offers both "Sync now" and "Recreate anyway"
- **AND** "Recreate anyway" is the secondary action style, not the primary

#### Scenario: Recreate uses the existing localStorage flag flow

- **WHEN** the user confirms recreate
- **THEN** the page sets `LOCAL_STORAGE_CLEAR_FLAG` and reloads, reusing the existing plugin pre-init flow
- **AND** on the next mount after reload, `LocalDbRecreated.v1` is emitted with `triggeredBy: "user"`

### Requirement: Educational Copy Layer

The `/system` page SHALL include plain-language educational copy that explains technical terms (OPFS, schema migration, sync cycle) without alarming or overwhelming non-engineering members.

#### Scenario: Each tile has a "What is this?" expander

- **WHEN** any status tile renders
- **THEN** the tile contains a `UCollapsible` labelled "What is this? ⌄"
- **AND** the expander is collapsed by default
- **AND** when expanded, it shows static educational copy in `text-muted text-xs`

#### Scenario: Copy avoids unfamiliar acronyms in headlines

- **WHEN** a member who is not an engineer reads the page top-to-bottom
- **THEN** no headline uses the words "OPFS", "WAL", "WASM", "outbox", or "cursor"
- **AND** acronyms only appear inside expanders with explanations

#### Scenario: Tier-the-danger framing across the page

- **WHEN** the page renders
- **THEN** the visual hierarchy progresses from safe-to-read content (header, status tiles, recent activity) to local-only-impact content (maintenance section)
- **AND** no power-user actions appear in this work; the tier-3 region is absent

### Requirement: Security Exclusions On The System Page

The `/system` page SHALL deliberately omit features that would harm exfiltration traceability or invite accidental misuse, regardless of how often they are requested.

#### Scenario: No local DB snapshot export

- **WHEN** the page renders
- **THEN** no UI element exports the local database to a file
- **AND** no UI element copies database contents to the clipboard

#### Scenario: No raw SQL execution

- **WHEN** the page renders
- **THEN** no UI element accepts arbitrary SQL or executes user-supplied queries
- **AND** the existing dev-only `peakyDB.execSQL()` is not surfaced to members

#### Scenario: No sync cursor reset or force-bootstrap

- **WHEN** the page renders
- **THEN** no UI element manually resets the sync cursor
- **AND** no UI element triggers a forced re-bootstrap independent of the Recreate-DB flow
