## ADDED Requirements

### Requirement: Client-Local Source of Truth

The application SHALL use a client-local database as the primary source of truth for first-party editing sessions for reviews, products, and template drafts.

#### Scenario: Previously synced editable data loads locally

- **WHEN** a user opens an editable review, product, or template draft that has already been synced at least once
- **THEN** the application loads the last known editable state from the local database
- **AND** the page renders without requiring a fresh network round-trip first

#### Scenario: Local edits commit before remote sync completes

- **WHEN** a user edits an answer, note, product field, or template draft field
- **THEN** the change is committed to the local database immediately
- **AND** the visible UI updates before remote synchronization completes

#### Scenario: Local data survives refresh and transient outages

- **WHEN** the browser refreshes or the network is temporarily unavailable
- **THEN** previously stored editable data remains available locally
- **AND** unsynced changes remain queued for later synchronization

### Requirement: Outbox-Based Background Synchronization

The application SHALL synchronize local mutations through an outbox and cursor-based push/pull protocol.

#### Scenario: Local edits enqueue background sync work

- **WHEN** a local-first edit is committed to the client-local database
- **THEN** the system records a pending outbox item for synchronization
- **AND** the outbox item includes enough metadata to retry safely

#### Scenario: Client pushes pending changes by cursor

- **WHEN** the client regains connectivity and has pending outbox items
- **THEN** it pushes the queued changes to the remote sync endpoint
- **AND** the remote endpoint responds with accepted or rejected results plus cursor advancement information

#### Scenario: Client pulls remote changes by cursor

- **WHEN** the client requests remote changes after its last known remote cursor
- **THEN** the remote sync endpoint returns only changes after that cursor
- **AND** the client applies them to local state without requiring a full refetch by default

### Requirement: Entitlement Snapshots For Offline Editing

The application SHALL use cached entitlement snapshots to govern offline editing windows.

#### Scenario: Offline editing uses cached entitlements

- **WHEN** the user is offline but has a non-expired entitlement snapshot
- **THEN** the application allows offline edits only for resources permitted by that snapshot
- **AND** the snapshot remains valid for the configured multi-day offline window

#### Scenario: Reconnect downgrades revoked access to read-only

- **WHEN** the client reconnects and refreshed entitlements revoke previously cached edit permissions
- **THEN** the affected locally stored data remains visible but becomes read-only
- **AND** unsynced edits for the revoked resources are moved into a needs-review queue instead of being silently discarded

### Requirement: Selective Replication Boundaries

The application SHALL distinguish between fully replicated editable content and metadata-only discovery content.

#### Scenario: Editable first-party content is fully replicated

- **WHEN** a resource is editable by the current user under the local entitlement snapshot
- **THEN** its working state is fully replicated to the local database
- **AND** the local copy is sufficient for offline reads and writes

#### Scenario: Broad discovery surfaces use metadata-only replication

- **WHEN** the user can browse content outside their editable scope for discovery or learning
- **THEN** the application stores metadata needed for listing, filtering, and search locally
- **AND** the full editable body is not replicated by default for the entire company dataset

### Requirement: Non-Production Sync Simulator

The system SHALL provide a non-production remote sync simulator for protocol rehearsal before Postgres-backed sync exists.

#### Scenario: Simulator validates the future sync contract

- **WHEN** the client communicates with the remote simulator
- **THEN** it uses the same bootstrap, push, and pull-by-cursor contract planned for future production sync
- **AND** the simulator is sufficient to validate multi-device, reconnect, and conflict semantics

#### Scenario: Simulator cold starts do not imply durability

- **WHEN** the simulator loses its in-memory state on cold start
- **THEN** the client treats that as a simulator reset condition rather than durable remote state
- **AND** the user experience makes it clear that the simulator is not a production durability milestone
