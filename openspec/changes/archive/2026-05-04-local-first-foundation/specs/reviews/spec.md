## ADDED Requirements

### Requirement: Review Workspace Projection

The backend SHALL provide a review workspace projection for full assessment hydration.

#### Scenario: Workspace returns assessment-ready review state

- **WHEN** a client requests a review workspace
- **THEN** the response includes the review metadata, owning subject context, selected template versions, current answer state, note state, attachment metadata, capability flags, and the latest readiness or maturity details needed to render the assessment experience
- **AND** the client does not need separate initial reads for pillars, questions, answers, and permissions to hydrate the review screen

#### Scenario: Workspace projection remains valid for local-first reads

- **WHEN** a review workspace has already been replicated locally
- **THEN** the client can rehydrate the assessment screen from the local projection
- **AND** later remote synchronization updates the projection incrementally instead of forcing a full refetch

### Requirement: Shared Review Core Behind Subject Facades

The review domain SHALL support a shared review core independent of whether the owning subject is a team, product, or future organization.

#### Scenario: Team and product review facades resolve the same review core

- **WHEN** a user navigates to a team-scoped review route or a product-scoped review route
- **THEN** both routes resolve the same shared review core behavior for assessment, history, and scoring
- **AND** the user-facing route context remains team- or product-specific for navigation clarity
