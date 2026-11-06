# recent-changes Specification

## Purpose

This specification covers the bounded recent operational history of answer
edits shown on Review Details. It defines field-level transitions, editing
bursts, checklist diffs, conflict visibility, workspace enrichment, local-first
refresh, pagination, and retention semantics. It is distinct from permanent
compliance audit evidence and assessment-session checkpoints.

## Requirements

### Requirement: Review-Scoped Recent Answer History

The application SHALL present accepted answer changes for the selected review as a recent operational history ordered from newest to oldest.
**ID:** REQ-001

#### Scenario: Feed identifies each answer transition

- **WHEN** the Recent Changes feed renders an answer change
- **THEN** the entry shows the change time, actor, question context, previous value, and current value
- **AND** changes from another review are excluded
- **ID:** AC-001

#### Scenario: First answer has an explicit empty origin

- **WHEN** an answer has no previous value
- **THEN** the transition renders from `new` to the current answer
- **ID:** AC-002

### Requirement: Current State And Recent History Remain Distinct

The system SHALL use `field_versions` as the current winning field state and `field_version_events` as append-only recent edit history.
**ID:** REQ-002

#### Scenario: Server echo does not duplicate local history

- **WHEN** a locally committed field event later returns through synchronization
- **THEN** the history contains one row for that event and field
- **AND** uniqueness is enforced by event and field identity
- **ID:** AC-003

#### Scenario: Semantically unchanged JSON is not recorded

- **WHEN** a checklist write is semantically equal to the current JSON value
- **THEN** no additional recent-history row is inserted
- **ID:** AC-004

### Requirement: Five-Second Editing Bursts

The feed SHALL group only adjacent edits to the same answer field by the same actor when each edit occurs within five seconds of the preceding edit.
**ID:** REQ-003

#### Scenario: Same-actor burst preserves its trail

- **WHEN** adjacent same-actor edits to one answer occur within the grouping window
- **THEN** the feed shows one entry with the first previous value and final current value
- **AND** the intermediate values remain available as an ordered trail
- **ID:** AC-005

#### Scenario: Actor and field boundaries prevent grouping

- **WHEN** the actor or answer field changes between adjacent history rows
- **THEN** the rows render as separate entries regardless of elapsed time
- **ID:** AC-006

#### Scenario: Inactivity starts a new entry

- **WHEN** more than five seconds elapse after the preceding edit
- **THEN** the next edit starts a separate feed entry
- **ID:** AC-007

### Requirement: Answer-Type-Aware Diffs

The feed SHALL render directional diffs appropriate to the answer type without redefining the canonical assessment answer model.
**ID:** REQ-004

#### Scenario: Yes-No-NA transition is readable

- **WHEN** a Yes/No/N/A answer changes
- **THEN** the entry renders the previous and current labels in `previous → current` order
- **ID:** AC-008

#### Scenario: Checklist transition exposes item details

- **WHEN** a checklist answer changes
- **THEN** the entry shows previous and current completion counts derived from checked plus per-item N/A items
- **AND** an inspectable detail view identifies checked, N/A, unchecked, and unchanged-current items
- **AND** the detail distinguishes N/A-to-checked, checked-to-N/A, and unchanged-N/A transitions
- **ID:** AC-009

### Requirement: Workspace Enrichment With Graceful Fallback

The feed SHALL enrich answer history with review-workspace question, pillar, template, and checklist labels when that context is available.
**ID:** REQ-005

#### Scenario: Workspace context resolves

- **WHEN** the selected review workspace contains the changed question
- **THEN** the feed renders the question text and its pillar and template context
- **ID:** AC-010

#### Scenario: Workspace context is unavailable

- **WHEN** workspace enrichment fails or no longer contains the changed question
- **THEN** the history entry remains visible using stable identifiers
- **AND** the feed does not discard the underlying change
- **ID:** AC-011

### Requirement: Overridden Change Visibility

The feed SHALL identify the exact local history event associated with a terminal HLC-conflict rejection as overridden.
**ID:** REQ-006

#### Scenario: Rejected event is marked overridden

- **WHEN** an outbox event reaches terminal failure with an HLC conflict
- **AND** its event identifier matches a recent-history row
- **THEN** that history entry displays an `Overridden` status
- **ID:** AC-012

#### Scenario: Grouped entry preserves conflict state

- **WHEN** any history row within an editing burst is overridden
- **THEN** the grouped feed entry retains the overridden status
- **ID:** AC-013

### Requirement: Reactive Local-First History

The feed SHALL refresh after accepted local writes and remote pulls without requiring a page reload.
**ID:** REQ-007

#### Scenario: Local answer appears before remote confirmation

- **WHEN** an assessment answer commits successfully to the local database
- **THEN** its recent-history entry becomes visible before server synchronization completes
- **ID:** AC-014

#### Scenario: Pulled answer appears after synchronization

- **WHEN** a sync pull applies a remote answer event for the selected review
- **THEN** the feed refreshes and includes the resulting history entry
- **ID:** AC-015

### Requirement: Complete Pagination And Configured Retention

The feed SHALL paginate complete grouped entries and SHALL identify its
configured local retention window without presenting the history as permanent
compliance evidence.
**ID:** REQ-008

#### Scenario: Pagination does not split an editing burst

- **WHEN** loading the next page would cross rows belonging to one grouped burst
- **THEN** all rows required for that grouped entry are consumed together
- **ID:** AC-016

#### Scenario: Retention semantics are explicit

- **WHEN** the Recent Changes surface explains its history window
- **THEN** it identifies fourteen days as the configured local edit-history window
- **AND** it does not describe the feed as permanent audit or assessment-session history
- **AND** invoking `sweepLocalTTL` permanently deletes `field_version_events` rows whose `updatedAt` is older than the fourteen-day cutoff without archiving them
- **AND** the surface does not claim the window is enforced automatically while no production startup or post-sync caller invokes that sweep
- **ID:** AC-017
