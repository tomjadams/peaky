## MODIFIED Requirements

### Requirement: Lifecycle Authorization For Peaky-Owned Subjects

The system SHALL enforce explicit lifecycle authorization rules for Products, Templates, Template drafts, and Reviews.
**ID:** REQ-004

#### Scenario: Product lifecycle is owner-or-admin controlled

- **WHEN** an actor requests Product archive, restore, or permanent delete
- **THEN** the system allows the action only if the actor is an admin, the Product manager, or the engineering lead for that Product
- **ID:** AC-008

#### Scenario: Template lifecycle writes are frozen

- **WHEN** any actor requests Template archive, restore, permanent delete, or whole-draft deletion before a trusted server Template authority exists
- **THEN** the system returns HTTP 503 with code `template_write_unavailable` without changing state
- **AND** neither admin role, creator identity, `ownerTeamId`, nor draft-edit entitlement bypasses the freeze
- **ID:** AC-009

#### Scenario: Team review lifecycle respects reviewer ownership

- **WHEN** an actor requests Team-Review archive or restore
- **THEN** the system allows the action only if the actor is an admin or one of the Review reviewers
- **ID:** AC-010

#### Scenario: Product review lifecycle respects Product ownership

- **WHEN** an actor requests Product-Review archive or restore
- **THEN** the system allows the action only if the actor is an admin or one of the owning Product actors
- **ID:** AC-011

#### Scenario: Permanent Review delete remains admin-only

- **WHEN** an actor requests permanent Review deletion
- **THEN** the system allows the action only if the actor is an admin
- **ID:** AC-012

### Requirement: Destructive Actions Need Explicit Confirmation

The system SHALL require lifecycle authorization, archived state, and typed confirmation for available permanent-delete operations while Template deletion is frozen.
**ID:** REQ-005

#### Scenario: Available permanent delete requires archived state

- **WHEN** an actor requests permanent delete for a Product or Review
- **THEN** the system rejects the request unless the record is already archived
- **ID:** AC-013

#### Scenario: Product delete requires typed confirmation

- **WHEN** an authorized actor requests permanent delete for an archived Product
- **THEN** the system compares the trimmed, case-sensitive provided name with the current Product name
- **AND** a mismatch is rejected without deleting state
- **ID:** AC-014

#### Scenario: Template delete remains unavailable

- **WHEN** any actor requests permanent deletion of a draft-only or published-history Template during the local-only authority freeze
- **THEN** the system returns HTTP 503 with code `template_write_unavailable` without evaluating local reference counts or deleting state
- **ID:** AC-015

## ADDED Requirements

### Requirement: Template Team Ownership And Actor Provenance

The system SHALL persist exactly one owning Team for each Template while keeping Team ownership, creator/updater/publisher provenance, and draft-edit authorization independent.
**ID:** REQ-006

#### Scenario: Explicit Team ownership is required

- **WHEN** a new Template is first saved
- **THEN** `ownerTeamId` contains one stable ID selected from the last successfully persisted directory-group snapshot
- **AND** missing or unknown Team IDs are rejected
- **ID:** AC-016

#### Scenario: External Team identity remains stable

- **WHEN** the directory mirror is refreshed or the owning Team is temporarily absent
- **THEN** the Template retains its textual `ownerTeamId` without cascade deletion
- **AND** presentation falls back to the stable ID when no display name resolves
- **ID:** AC-017

#### Scenario: Actor provenance fields grant no permission

- **WHEN** Template or Revision creator, updater, or publisher actor IDs are persisted or returned
- **THEN** they identify creation, latest mutable update, or publication provenance only
- **AND** none grants lifecycle or draft-edit authorization
- **ID:** AC-018

#### Scenario: Edit permission does not grant lifecycle permission

- **WHEN** a non-admin actor can edit a Template draft
- **THEN** that entitlement does not permit Template archive, restore, permanent delete, or whole-draft delete
- **ID:** AC-019

#### Scenario: Owning Team is immutable during this stage

- **WHEN** any client or endpoint attempts to change `ownerTeamId` after Template creation
- **THEN** the mutation is rejected before local or remote state changes
- **AND** ownership transfer remains deferred to a trusted server-authority follow-up
- **ID:** AC-020
