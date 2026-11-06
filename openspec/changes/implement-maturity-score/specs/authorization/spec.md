# Authorization Specification

## ADDED Requirements

### Requirement: Provider Operation Authorization

Every future provider network operation MUST require server-side integration capability and an actor authorized for the owning review.
**ID:** REQ-007

#### Scenario: Handoff UI availability is insufficient

- **WHEN** the client requests a provider operation while the handoff UI is available but the server integration capability is disabled
- **THEN** the server SHALL reject the request without invoking a provider adapter
- **ID:** AC-021

### Requirement: Advisor Override Authorization

The initial server policy SHALL authorize maturity override creation, supersession, and revocation when the actor is currently assigned to the owning review with persisted role `reviewer` and has review edit access. Product surfaces SHALL label that role Advisor without changing its persisted value. Any additional authority MUST come from an explicit server-side action policy.
**ID:** REQ-008

#### Scenario: Current Advisor mutates an override

- **WHEN** a currently assigned `reviewer` with edit access to the owning review creates, supersedes, or revokes a maturity override
- **THEN** the server SHALL authorize the action through an action-specific override policy
- **AND** it SHALL preserve the actor and authorization outcome with the append-only transition
- **ID:** AC-022

#### Scenario: Review edit access alone is insufficient

- **WHEN** an actor has review edit access but is not a currently assigned `reviewer`
- **THEN** the server SHALL reject the override mutation
- **AND** no override transition SHALL be written
- **ID:** AC-023

#### Scenario: Override authorization is action-aware and participant-derived

- **WHEN** the server authorizes a maturity override creation, supersession, or revocation
- **THEN** the authorization call MUST carry the specific override action rather than a bare view or edit capability check
- **AND** it MUST resolve the actor's current persisted review-participant role through a server-side review-participants lookup
- **AND** an authorization path that can only answer view or edit capability, without an action parameter or a participant lookup, MUST NOT be treated as sufficient to authorize the mutation
- **ID:** AC-024
