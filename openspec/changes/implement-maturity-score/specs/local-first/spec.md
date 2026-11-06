# Local-First Specification

## ADDED Requirements

### Requirement: Review-Scoped Handoff Synchronization

The sync engine SHALL synchronize ordered handoff practice snapshots, external work-item references, current practice associations, and replacement history under the review authorization root. Device-only handoff sequence and completion history SHALL remain outside that sync contract.
**ID:** REQ-011

#### Scenario: Replayed handoff event is idempotent

- **WHEN** the client receives the same handoff event more than once
- **THEN** the local state SHALL match a single application of the event
- **AND** no duplicate history record SHALL be created
- **ID:** AC-018

#### Scenario: Local lifecycle never enters the outbox

- **WHEN** the client starts or completes a local handoff lifecycle
- **THEN** it SHALL write `local_review_handoffs` through the local-only mutation path
- **AND** `local_handoff_id` SHALL remain absent from practice outbox fields and inbound payload handling
- **AND** no lifecycle entity type SHALL be registered in the Go or PostgreSQL sync contract
- **ID:** AC-024

### Requirement: Degraded Sync Handoff Behavior

The handoff experience SHALL distinguish local draft editing from operations that claim shared uniqueness.
**ID:** REQ-012

#### Scenario: Draft editing remains available

- **WHEN** sync is degraded or unavailable
- **THEN** users SHALL be able to select, remove, and reorder practices in a local draft
- **AND** the UI SHALL identify the draft as not yet shared
- **ID:** AC-019

#### Scenario: Confirmation is disabled

- **WHEN** sync health cannot guarantee a current shared association view
- **THEN** the existing-ticket form SHALL remain openable so the requirement is discoverable
- **AND** association and replacement confirmation SHALL remain disabled
- **AND** the form SHALL explain that duplicate prevention needs a current shared view
- **ID:** AC-020

### Requirement: Bounded Handoff Synchronization

The sync engine SHALL validate every handoff field of a mutation against the versioned character, count, and URL limits defined by the improvement-plans `Versioned Handoff Limits` requirement before applying any field from that mutation.
**ID:** REQ-013

#### Scenario: Oversized mutation is rejected atomically

- **WHEN** a pushed handoff mutation exceeds any versioned character, count, or URL limit
- **THEN** the server SHALL reject every field in that mutation with a validation error
- **AND** it SHALL persist no truncated or partial handoff state
- **ID:** AC-021

#### Scenario: Boundary-sized mutation synchronizes

- **WHEN** a handoff mutation is exactly at every applicable versioned field and count limit and is otherwise valid
- **THEN** the sync engine SHALL process it through normal authorization and HLC conflict resolution
- **ID:** AC-022

#### Scenario: Draft-maximal mutation fits the push contract

- **WHEN** a handoff draft that is exactly at every applicable versioned field and count limit is pushed
- **THEN** its serialized push payload SHALL remain within the existing push contract caps of 500 events per push and 100 fields per event (`services/internal/syncengine/push.go:27-28`)
- **AND** the server SHALL NOT reject that push for exceeding either cap
- **AND** no spec-valid handoff draft SHALL become permanently unsyncable through repeated outbox retries of a cap rejection
- **ID:** AC-023
