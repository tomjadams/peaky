# auditing Specification

## Purpose

This specification defines Peaky's append-only domain and system event
envelopes, actor provenance, event persistence lifecycle, and operator-facing
audit timeline. It covers durable event evidence and save/checkpoint history;
the bounded field-level edit feed is specified separately by `recent-changes`.

## Requirements

### Requirement: Append-Only Audit Events

The system SHALL record significant first-party and machine-led mutations as append-only audit events except for the explicit Preview reset and temporarily local-only Template authoring boundaries defined by this change.
**ID:** REQ-001

#### Scenario: Events include HLC for causal ordering

- **WHEN** the system records an audit event
- **THEN** the event includes an `hlc` column with compact `wallclock:counter` format
- **AND** `actor_id` provides the HLC comparison tiebreaker
- **AND** events can be ordered causally across actors
- **ID:** AC-001

#### Scenario: Server validates CloudEvents envelope

- **WHEN** the Go API receives or stores an event
- **THEN** it validates the CloudEvents v1.0.2 envelope with the Go CloudEvents SDK
- **AND** malformed events are rejected with a structured error
- **ID:** AC-002

#### Scenario: Server event persistence uses PostgreSQL

- **WHEN** the server persists or queries synchronized events
- **THEN** PostgreSQL is the durable store and authorization is applied before records are returned
- **AND** client-local events remain SQLite-only while no dedicated typed-event transport exists
- **ID:** AC-003

#### Scenario: Replayed events are distinguishable from local events

- **WHEN** `LocalMutation.replay()` inserts an event
- **THEN** it has `status = 'synced'` and `source = 'peaky.sync'`
- **AND** `LocalMutation.commit()` events have `status = 'pending'` and `source = 'peaky.client'`
- **ID:** AC-004

#### Scenario: Template Revision migration is a bounded destructive exception

- **WHEN** SQLite migration 0016 or PostgreSQL Goose migration 008 performs the approved Preview reset
- **THEN** it deletes only the enumerated Template/Review audit and replay records plus every event correlated through a non-null `review_id`, regardless of that event's type or entity type
- **AND** migration audit logs and unrelated domain/system events with a null `review_id` remain
- **AND** ordinary runtime entity deletion does not gain permission to delete audit history
- **ID:** AC-005

#### Scenario: Local-only Template authoring is a bounded no-event exception

- **WHEN** `LocalMutation.localOnly()` persists Template, draft Revision, Pillar, or Question authoring state before issue #137 enables transport
- **THEN** one SQLite transaction writes state without an audit event, outbox row, or push trigger
- **AND** the UI identifies the draft as local-only rather than audited or synchronized
- **AND** other significant runtime mutations retain the append-only audit contract
- **ID:** AC-006

### Requirement: Actor Classification

The system SHALL distinguish user, integration, and system actors in audit history.

#### Scenario: Human action shows user actor context

- **WHEN** a user performs an audited action
- **THEN** the resulting audit event identifies the actor as a user
- **AND** the event links the action to the authenticated user identity used at the time

#### Scenario: Integration action shows machine actor context

- **WHEN** a machine-led `/integrations/*` action performs an audited change
- **THEN** the resulting audit event identifies the actor as an integration
- **AND** the event is attributable to the integration token or integration identity rather than a human session

### Requirement: Visible Automation Provenance

The application SHALL expose provenance for machine-generated draft answers in the review UI.

#### Scenario: Imported draft answer shows provenance metadata

- **WHEN** an integration fills a draft answer on a review
- **THEN** the review UI shows that the answer came from automation
- **AND** the UI exposes the source system, timestamp, and any recorded confidence value

#### Scenario: Imported draft answer exposes evidence references

- **WHEN** an imported draft answer includes supporting evidence references
- **THEN** the user can inspect those evidence references from the review history or answer context
- **AND** the evidence remains linked to the underlying audit trail

### Requirement: Event-Derived Review History

The application SHALL derive review history from audit events instead of relying on bespoke mutable session state.

#### Scenario: Review history shows concrete question-level changes

- **WHEN** a user inspects review history
- **THEN** the history view shows the concrete questions, fields, or notes that changed
- **AND** the information is derived from the underlying audit events for those changes

#### Scenario: Save milestones remain possible without mutable session truth

- **WHEN** the product defines an explicit save or checkpoint action
- **THEN** that action is represented as an audit event or event grouping marker
- **AND** later history views derive milestones from those immutable events rather than from a separately mutated session record

### Requirement: Operator-Facing Admin Event Timeline

The system SHALL expose an operator-facing event timeline for admins.

#### Scenario: Admin feed merges lifecycle and review event sources

- **WHEN** an admin requests the Admin Events feed
- **THEN** the response includes the merged lifecycle-audit and review-event streams needed for operator inspection
- **AND** the feed preserves actor, subject, status, and summary information for each event

#### Scenario: Local-first pending events remain visible in the admin surface

- **WHEN** the browser has local-first events that have not synced yet
- **THEN** the Admin Events UI shows those pending local events alongside the remote feed
- **AND** the local events remain distinguishable from the synced server-side timeline

#### Scenario: Admin feed supports live-tail updates

- **WHEN** an admin enables live tail on the Admin Events surface
- **THEN** the system streams newly recorded remote audit events without requiring a full page reload

### Requirement: Audit Events Table Naming

The persisted SQLite table that stores typed audit and system events SHALL be named `events`, reflecting its actual scope (domain events, lifecycle events, system events).

#### Scenario: Schema migration renames domain_events to events

- **WHEN** the rename migration applies on a client database
- **THEN** the table previously named `domain_events` is renamed to `events`
- **AND** all rows are preserved
- **AND** indexes are renamed from the `domain_events_*` prefix to the `events_*` prefix

#### Scenario: Drizzle schema exports the table as `events`

- **WHEN** application code imports the audit table via Drizzle
- **THEN** the export name is `events` (not `domainEvents`)
- **AND** the underlying SQL table name is `events`
- **AND** no production code path references the legacy `domain_events` name

#### Scenario: Documentation reflects the renamed table

- **WHEN** a reader consults `site/docs/development/walkthroughs/codebase/events.md` or `walkthroughs/local-first/auditing.md`
- **THEN** every reference to the table uses the name `events`
- **AND** the historical name `domain_events` is mentioned only inside an explicit "renamed in change `rename-domain-events-table`" note, if at all

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

#### Scenario: Separate event push transport remains absent

- **WHEN** the codebase needs to push events to a server
- **THEN** no event push transport exists in this work
- **AND** event status remains independent from the domain outbox until a dedicated transport is designed

#### Scenario: Current client-local status lifecycle

- **WHEN** an event is inserted locally while no dedicated event transport exists
- **THEN** `pending` identifies an event eligible for a future transport but does not transition to `synced` or `failed` today
- **AND** `local` is a terminal device-only status that is never eligible for transport
- **AND** replayed server events may be inserted as `synced`
- **AND** the domain outbox provides no event-delivery guarantee

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
