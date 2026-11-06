## ADDED Requirements

### Requirement: Sync Push Authorization

The sync service MUST authorize every pushed mutation against the actor and affected entity before accepting any field.
**ID:** REQ-001

#### Scenario: Editable mutation is accepted

- **WHEN** an authenticated actor pushes an allowed operation for an entity they can edit
- **THEN** the service evaluates the operation through the entity authorization policy before applying its fields
- **ID:** AC-001

#### Scenario: Revoked edit access is terminal

- **WHEN** an actor pushes an entity mutation after edit access has been revoked
- **THEN** the service rejects the mutation as `access_revoked`
- **AND** no rejected field is written to server state
- **ID:** AC-002

#### Scenario: Child mutation uses its authorization root

- **WHEN** a pushed child entity derives authorization from a parent subject
- **THEN** the service resolves and authorizes the canonical root before applying the child mutation
- **ID:** AC-003

### Requirement: Sync Pull Authorization

The sync pull service MUST restrict event disclosure at query time to canonical roots the requesting actor may view.
**ID:** REQ-002

#### Scenario: Entitled roots constrain the query

- **WHEN** an actor requests sync events after a cursor
- **THEN** the repository query includes only events stamped with roots the actor may view
- **AND** unauthorized rows are excluded before pagination
- **ID:** AC-004

#### Scenario: Empty scope fails closed

- **WHEN** the actor has no viewable synchronization roots
- **THEN** the pull response contains no domain events
- **AND** the query does not fall back to an unscoped result
- **ID:** AC-005

### Requirement: SSE Subscription Authorization

The SSE service MUST derive catalog-family subscriptions from the authenticated actor's entitlements rather than accepting arbitrary client-selected channels.
**ID:** REQ-003

#### Scenario: Subscription families derive from entitlements

- **WHEN** an actor opens the SSE stream
- **THEN** the server resolves the actor's permitted catalog families
- **AND** notifications outside those families are not delivered
- **ID:** AC-006

#### Scenario: Non-admin cannot subscribe to admin events

- **WHEN** a non-admin requests an admin-only event stream
- **THEN** the server rejects the subscription with an authorization error
- **ID:** AC-007
