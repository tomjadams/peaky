# local-first Specification

## Purpose

TBD - created by archiving change local-first-foundation. Update Purpose after archive.

## Requirements

### Requirement: Client-Local Source of Truth

The application SHALL use client-local SQLite as the primary source of truth for editable Reviews, Products, and Template draft Revisions while reporting each domain's transport state accurately.
**ID:** REQ-007

#### Scenario: Previously stored editable data loads locally

- **WHEN** a user opens an editable Review, Product, or Template draft Revision already present locally
- **THEN** the page renders from SQLite before a fresh network round-trip
- **ID:** AC-001

#### Scenario: Local edits commit before remote work

- **WHEN** a user edits Review or Product state or Template draft content
- **THEN** the visible state commits locally before any remote operation
- **AND** Template draft authoring does not imply remote transport during its freeze
- **ID:** AC-002

#### Scenario: Local data survives refresh and transient outages

- **WHEN** the browser refreshes or temporarily loses network connectivity
- **THEN** stored editable state remains available
- **AND** only domains with enabled transport retain outbox work for later synchronization
- **ID:** AC-003

### Requirement: Outbox-Based Background Synchronization

The application SHALL use outbox and cursor-based push/pull for enabled entity transports while keeping Template draft transport disabled until issue #137.
**ID:** REQ-008

#### Scenario: Enabled local edits enqueue HLC work

- **WHEN** an enabled local-first mutation commits
- **THEN** it records a pending outbox item whose fields are JSON `{name, value, hlc}` objects
- **AND** HLC uses `{wallclock_ms}:{counter_padded_4}:{actorId}` format
- **ID:** AC-004

#### Scenario: Client pushes field-level events

- **WHEN** the client pushes pending outbox work
- **THEN** each event uses `upsert | delete` and a per-field HLC array
- **AND** enabled entity payloads retain the existing full-field push contract
- **AND** disabled Template authoring types are absent
- **ID:** AC-005

#### Scenario: Client pulls and replays remote changes

- **WHEN** the client pulls an enabled entity event
- **THEN** `LocalMutation.replay()` atomically applies domain state and inserts synced audit evidence
- **AND** replay creates no outbox echo
- **ID:** AC-006

#### Scenario: Replayed events are marked synced

- **WHEN** `LocalMutation.replay()` inserts audit evidence for a pulled change
- **THEN** the event has `status = 'synced'` and `source = 'peaky.sync'`
- **AND** the pending-event push pipeline never requeues it
- **ID:** AC-016

#### Scenario: Inbound handlers dispatch by entity type

- **WHEN** a pulled enabled entity event arrives
- **THEN** its registered handler applies it to the correct local state table
- **AND** new enabled entity types remain extensible through explicit handler registration
- **AND** unknown or frozen Template authoring types are not presented as successfully replayed
- **ID:** AC-007

#### Scenario: Inbound handlers honor delete operations

- **WHEN** a pulled enabled entity delete arrives
- **THEN** the registered handler deletes the row without attempting an empty-field upsert
- **AND** replay records synced audit evidence while append-oriented FieldVersion handling ignores the delete
- **ID:** AC-017

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

The application SHALL distinguish enabled field transports, temporarily local-only Template drafts, and metadata-only discovery content without overstating aggregate completeness.
**ID:** REQ-009

#### Scenario: Enabled transported fields are replayable

- **WHEN** an actor may edit a Review or Product under a current entitlement snapshot
- **THEN** every field and aggregate reference explicitly registered in that entity's transport can replay on a fresh entitled client
- **AND** the system does not claim untransported scope, association, participant, or domain-projection fields are reconstructed
- **ID:** AC-009

#### Scenario: Template drafts remain local-only during freeze

- **WHEN** an actor edits a Template draft Revision before issue #137 lands
- **THEN** SQLite retains the edit without outbox or synced-status claims
- **AND** clearing local data can remove that unpublished work
- **ID:** AC-010

#### Scenario: Broad discovery uses metadata-only replication

- **WHEN** an actor can browse content outside editable scope
- **THEN** the client stores listing/search metadata without broadly replicating full editable bodies
- **ID:** AC-011

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

### Requirement: Client-Side HLC Clock

The application SHALL maintain a client-side Hybrid Logical Clock for stamping outbox fields with causally-ordered timestamps.

#### Scenario: HLC is monotonically increasing

- **WHEN** the HLC clock generates a new timestamp
- **THEN** the wallclock component is `max(Date.now(), lastWallclock)`
- **AND** if the wallclock equals the previous wallclock, the counter increments
- **AND** the resulting HLC is lexicographically greater than any previously generated HLC

#### Scenario: HLC format is sortable

- **WHEN** the HLC clock generates a timestamp
- **THEN** the format is `{wallclock_ms}:{counter_padded_4}:{actorId}`
- **AND** two HLCs can be compared as strings for correct causal ordering

### Requirement: Data Reaches Client Through Declared Channels

The application SHALL use sync as the server-data channel for enabled domains and SHALL declare the temporary deterministic Template fixture-read exception without claiming Template draft transport.
**ID:** REQ-010

#### Scenario: Returning user renders available local state

- **WHEN** a returning user loads a Team, Product, or Review page with already replicated local state
- **THEN** the page renders that available state from SQLite before background sync deltas
- **AND** missing aggregate portions are not described as fully reconstructed
- **ID:** AC-012

#### Scenario: First-visit enabled domains populate through sync

- **WHEN** a first-time user loads the app
- **THEN** lightweight bootstrap returns actor, entitlements, and cursors without domain data
- **AND** enabled domain events populate SQLite through background pull
- **ID:** AC-013

#### Scenario: Bootstrap remains non-blocking

- **WHEN** the app starts
- **THEN** SQLite loads and applies migrations before lightweight bootstrap
- **AND** rendering and initial pull proceed without blocking on a complete domain download
- **ID:** AC-014

#### Scenario: Template fixture reads are an explicit exception

- **WHEN** a client needs deterministic published Template fixture metadata or content before Template sync exists
- **THEN** the read-only Template API supplies the aggregate/published Revision projection
- **AND** remote draft bodies and every Template mutation remain unavailable
- **ID:** AC-015
