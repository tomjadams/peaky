## MODIFIED Requirements

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
