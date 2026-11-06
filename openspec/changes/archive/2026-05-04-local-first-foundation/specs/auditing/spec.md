## ADDED Requirements

### Requirement: Append-Only Audit Events

The system SHALL record significant first-party and machine-led mutations as append-only audit events.

#### Scenario: Human edits create audit events

- **WHEN** a user creates or edits a review, answer, note, product, template draft, or attachment
- **THEN** the system records an append-only audit event describing the action
- **AND** the event is retained independently from any derived current-state tables

#### Scenario: Audit events keep changed data separate from optional metadata

- **WHEN** the system records an audit event
- **THEN** the event stores the changed business facts in explicit event data fields
- **AND** optional import, source, or runtime context can be stored separately as event metadata without overloading the same field

#### Scenario: System and machine actions create audit events

- **WHEN** an integration or system process performs a change such as draft-answer import, entitlement downgrade handling, or score recomputation
- **THEN** the system records an append-only audit event for that action
- **AND** the event uses the correct non-human actor classification

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
