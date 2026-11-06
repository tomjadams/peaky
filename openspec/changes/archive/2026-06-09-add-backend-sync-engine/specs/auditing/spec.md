## MODIFIED Requirements

### Requirement: Append-Only Audit Events

The system SHALL record significant first-party and machine-led mutations as append-only audit events, with HLC timestamps for causal ordering and CloudEvents v1.0.2 envelope format on the server.

#### Scenario: Events include HLC for causal ordering

- **WHEN** the system records an audit event
- **THEN** the event includes an `hlc` column with the compact `wallclock:counter` format
- **AND** the `actor_id` column provides the tiebreaker for HLC comparison
- **AND** events can be ordered causally across actors (not just chronologically by ISO `time`)

#### Scenario: Server validates CloudEvents envelope

- **WHEN** the Go API server receives or stores an event
- **THEN** it validates the event against the CloudEvents v1.0.2 specification using the Go CloudEvents SDK (`github.com/cloudevents/sdk-go`)
- **AND** malformed events are rejected with a structured error

#### Scenario: Server stores and serves raw events in Phase 1

- **WHEN** a client requests events
- **THEN** the server returns raw CloudEvent records from MySQL
- **AND** no activity feed derivation, summary generation, or admin-specific presentation is applied
- **AND** complex event presentation is deferred until Cedar defines the permission model

#### Scenario: Replayed events are distinguishable from local events

- **WHEN** an event is inserted by `LocalMutation.replay()`
- **THEN** the event has `status = 'synced'` and `source = 'peaky.sync'`
- **AND** when an event is inserted by `LocalMutation.commit()`
- **THEN** the event has `status = 'pending'` and `source = 'peaky.client'`
- **AND** the audit trail shows the origin of every event
