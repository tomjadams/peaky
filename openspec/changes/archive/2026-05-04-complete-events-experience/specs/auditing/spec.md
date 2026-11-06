## ADDED Requirements

### Requirement: CloudEvents Envelope Persistence

The system SHALL persist the full CloudEvents v1.0.2 envelope for every domain and system event, including the previously-dropped `specversion`, `dataschema`, and `client_id` core attributes.

#### Scenario: Domain event write persists every envelope field

- **WHEN** `LocalMutation.commit()` writes a domain event
- **THEN** the events table row contains `id`, `type`, `specversion`, `source`, `dataschema` (when present on the envelope), `actor_id`, `actor_type`, `entity_type`, `entity_id`, `review_id` (when present), `client_id` (when present), `time`, `data`, `status`, and `synced_at`
- **AND** `specversion` is `"1.0"` by default
- **AND** no envelope field built by `createEvent()` is silently dropped at insert time

#### Scenario: System event write persists every envelope field

- **WHEN** `emitSystemEvent()` writes a system event from a non-mutation context (DB bootstrap, sync cycle, OPFS measurement, migration runner)
- **THEN** the events table row contains the same envelope fields as a domain event
- **AND** `actor_id` is `"system"`, `actor_type` is `"system"`, and `source` is `"peaky.system"`

#### Scenario: Migration adds the missing columns without backfill

- **WHEN** the schema migration that introduces `specversion`, `dataschema`, and `client_id` runs against an existing client database
- **THEN** existing rows receive `specversion = '1.0'` via column DEFAULT and `NULL` for `dataschema` and `client_id`
- **AND** the migration is recorded in `_migrations` and `_migration_log` like any other migration

### Requirement: Event Status Pipeline Decoupled From Outbox

The events table SHALL maintain its own status lifecycle independent of `local_outbox`. The outbox push cycle SHALL NOT advance event status.

#### Scenario: Outbox push leaves event status untouched

- **WHEN** `SyncEngine.runSyncCycle()` pushes outbox items to the server
- **THEN** the events table is not modified by the push or its response handling
- **AND** event rows retain whatever status they were inserted with (`local` or `pending`)

#### Scenario: Atomicity of state, event, and outbox writes is preserved

- **WHEN** `LocalMutation.commit()` runs its three-step write
- **THEN** the state-table write, the events-table insert, and the local_outbox insert all execute in a single SQLite transaction
- **AND** any failure rolls back all three together

#### Scenario: Event push transport is a documented stub

- **WHEN** the codebase needs to push events to a server
- **THEN** no event push transport exists in this work
- **AND** a stub or comment in the sync layer references the future Rust sync engine roadmap entry

### Requirement: Local-Only Event Marker

The event catalog SHALL support a `local` flag on `EventCatalogEntry` that, when set, causes events of that type to be inserted with `status: "local"` and excluded from any future event push transport.

#### Scenario: Catalog entry marked local stores with status local

- **WHEN** an event whose catalog entry has `local: true` is inserted
- **THEN** the row has `status = "local"`
- **AND** any future event pusher MUST skip rows with `status = "local"`

#### Scenario: Catalog entry without local flag stores with status pending

- **WHEN** an event whose catalog entry has no `local` flag (or `local: false`) is inserted
- **THEN** the row has `status = "pending"`
- **AND** the row becomes eligible for push when an event push transport exists

#### Scenario: Status enum extension

- **WHEN** the schema migration runs
- **THEN** the `eventStatus` enum gains the value `"local"` alongside the existing `"pending"`, `"synced"`, `"failed"`

### Requirement: System Event Taxonomy

The system SHALL emit typed system events for every operationally-relevant moment in the local engine, with success and failure pairs where applicable. Each new event SHALL appear in `DomainEvent.ts`, the union, the Zod catalog, and the regenerated JSON Schema artifacts.

#### Scenario: DB lifecycle events emit on bootstrap

- **WHEN** the local database begins initializing
- **THEN** `LocalDbInitializing.v1` is emitted
- **AND** when the database is ready, `LocalDbReady.v1` is emitted with the cold-start duration in ms

#### Scenario: Migration failure emits an event

- **WHEN** a migration fails during `applyMigration()` or `applyMigrationBundle()`
- **THEN** `LocalDbMigrationFailed.v1` is emitted with the failed migration ID and a sanitised error message
- **AND** the existing `_migration_log` row is still recorded (the event does not replace the audit table)

#### Scenario: Recreate-DB action emits an event

- **WHEN** the user successfully completes the "Recreate local DB" flow
- **THEN** `LocalDbRecreated.v1` is emitted on the first ready signal of the freshly-recreated database
- **AND** the event includes a `triggeredBy: "user"` field

#### Scenario: Sync cycle events bracket every cycle

- **WHEN** `SyncEngine.runSyncCycle()` begins
- **THEN** `SyncCycleStarted.v1` is emitted
- **AND** when the cycle completes successfully, `SyncCycleSucceeded.v1` is emitted with `eventsPushed`, `eventsPulled`, and `durationMs`
- **AND** when the cycle fails, `SyncCycleFailed.v1` is emitted with a sanitised error message and the same timing fields

#### Scenario: Entitlement refresh emits an event

- **WHEN** `SyncEngine.refreshEntitlements()` succeeds
- **THEN** `EntitlementsRefreshed.v1` is emitted with `hasDowngrades` and the count of changes

#### Scenario: OPFS storage measurement emits an event

- **WHEN** the `/system` page mounts or the user clicks Refresh on it
- **THEN** `OpfsStorageMeasured.v1` is emitted with `usageBytes`, `quotaBytes`, and `supported: boolean`
- **AND** when measured usage exceeds 80% of quota, `OpfsQuotaWarning.v1` is emitted in addition

#### Scenario: All new system events have `local: true`

- **WHEN** the catalog is inspected for system events whose source is `peaky.system` AND whose entity type relates to per-browser state (DB lifecycle, OPFS, recreate)
- **THEN** the catalog entry has `local: true`
- **AND** sync ops events (`SyncCycle*`, `EntitlementsRefreshed`) do not have `local: true` so they become eligible for future push

### Requirement: Full Envelope In Admin Event Detail Panel

The admin events feed and `/events` detail panel SHALL expose every CloudEvents envelope field, not just the `data` payload, so operators and members can correlate events using `source`, `actorType`, `specversion`, `dataschema`, and `status`.

#### Scenario: Detail panel renders source, actorType, and version

- **WHEN** the user opens an event detail panel from `/events` or `/admin/events`
- **THEN** the rendered details JSON includes `id`, `type`, `specversion`, `source`, `dataschema`, `actorId`, `actorType`, `entityType`, `entityId`, `reviewId` (when present), `clientId` (when present), `time`, `status`, and `data`
- **AND** the formatter in `app/admin/localEvents.ts` does not silently drop any envelope field

#### Scenario: System events display in the admin feed

- **WHEN** events of source `peaky.system` exist in the events table
- **THEN** the admin feed renders them with category `system`
- **AND** the formatted action label uses the existing `formatAdminEventLabel` helper to produce a human-readable name (e.g. "Local Db Ready")
