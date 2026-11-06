## MODIFIED Requirements

### Requirement: Review Data Model

The application MUST use the canonical subject model for Review ownership and exact immutable Template Revision references for assessment content.
**ID:** REQ-001

#### Scenario: Review ownership

- **WHEN** storing or retrieving Review data
- **THEN** each Review contains a required `subjectId` referencing a Team, Product, or Organization subject
- **AND** subject type is resolved from the subject rather than duplicated
- **AND** applications remain component associations rather than Review owners
- **ID:** AC-001

#### Scenario: Review data structure

- **WHEN** Review data is returned
- **THEN** it includes stable identity, name, subject identity, lifecycle, timestamps, and ordered `templateRevisionId` selections
- **AND** current answers, participants, notes, and attachment metadata remain Review-scoped projections
- **ID:** AC-002

### Requirement: Review as Template Container

The system SHALL treat a Review as a container holding one to three exact Template Revision assessments.
**ID:** REQ-002

#### Scenario: Review-Revision join entity

- **WHEN** Review state is stored locally
- **THEN** `review_template_selections` links the Review to immutable Template Revisions through `template_revision_id`
- **AND** the composite key is `(review_id, template_revision_id)` with one unique contiguous position `0..2` per Review
- **AND** the Review contains one to three distinct Revisions belonging to one to three distinct Templates
- **ID:** AC-003

#### Scenario: Per-Revision progress

- **WHEN** viewing Review progress
- **THEN** each selected Revision has its own progress and Pillar breakdown
- **AND** overall progress aggregates all selected Revisions
- **ID:** AC-004

#### Scenario: Revision locking

- **WHEN** a Review is created
- **THEN** its exact ordered Revision IDs never change
- **AND** later Template/draft edits, publication, retirement, or archive do not alter its content
- **AND** edits to already-enabled Review fields remain valid and synchronizable while immutable local selection rows remain unchanged and are not newly transported by #140
- **ID:** AC-005

### Requirement: Review Creation Wizard (Team)

The system SHALL provide the existing three-step Team Review wizard using exact current published Revision selections.
**ID:** REQ-003

#### Scenario: Wizard step 1 - Revision selection

- **WHEN** navigating to `/teams/:teamId/reviews/new`
- **THEN** Step 1 displays only current published Revisions of active Templates using Revision snapshot metadata
- **AND** one to three Revisions can be selected and a fourth selection shows validation feedback
- **AND** the progress indicator shows step 1 of 3
- **ID:** AC-006

#### Scenario: Wizard step 2 - application linking

- **WHEN** proceeding from Step 1 to Step 2
- **THEN** available applications are displayed by name without status badges
- **AND** helper text explains that linking tracks readiness over time
- **AND** checkboxes and search support zero or more selections
- **AND** Skip proceeds without application links and the progress indicator shows step 2 of 3
- **ID:** AC-007

#### Scenario: Wizard step 3 - confirmation

- **WHEN** proceeding from Step 2 to Step 3
- **THEN** the summary displays selected Revision snapshot names/numbers and applications
- **AND** the user can provide a Review name and Create Review persists only after final confirmation
- **AND** the progress indicator shows step 3 of 3
- **ID:** AC-008

#### Scenario: Wizard navigation

- **WHEN** using Back or Cancel
- **THEN** Back preserves step state and Cancel returns to Team Details without creating a Review
- **ID:** AC-009

#### Scenario: Wizard breadcrumbs

- **WHEN** using the Team Review wizard
- **THEN** breadcrumbs show `Teams / [Team Name] / New Review`
- **ID:** AC-010

### Requirement: Review Creation Wizard (Product)

The system SHALL provide the existing two-step Product Review wizard using exact current published Revision selections.
**ID:** REQ-004

#### Scenario: Wizard step order

- **WHEN** starting `/products/:productId/reviews/new`
- **THEN** the wizard displays Revision Selection followed by Scope and Confirm
- **ID:** AC-011

#### Scenario: Revision selection

- **WHEN** viewing Step 1
- **THEN** the interface matches Team Review Revision-selection behavior
- **AND** one to three current published Revision snapshot cards can be selected
- **ID:** AC-012

#### Scenario: Scope and confirmation

- **WHEN** viewing Step 2
- **THEN** Full Product is selected by default and preselects all `product.componentRefs`
- **AND** Specific Applications reveals a picker restricted to those component references
- **AND** the user can provide a Review name and sees selected Revision/scope metadata before creation
- **ID:** AC-013

#### Scenario: Wizard breadcrumbs

- **WHEN** using the Product Review wizard
- **THEN** breadcrumbs show `Products / [Product Name] / New Review`
- **ID:** AC-014

### Requirement: Review Creation API

The application SHALL create canonical Reviews locally with exact Revision IDs while keeping existing Nitro creation routes explicitly process-local fixture compatibility rather than durable or synchronized authority.
**ID:** REQ-005

#### Scenario: Canonical local Review creation

- **WHEN** `ReviewMutations.create()` receives a valid subject, name, scope, and one to three exact current published Revision IDs
- **THEN** one SQLite transaction creates the Review and ordered composite-key selection rows
- **AND** this change makes no new claim that those selections synchronize across clients
- **ID:** AC-028

#### Scenario: Create Team Review compatibility endpoint

- **WHEN** `POST /api/teams/:teamId/reviews` receives a valid name, one to three `templateRevisionIds`, and optional application IDs
- **THEN** it resolves deterministic fixture Revisions and creates only the process-local fixture Review representation
- **AND** it returns status 201 without claiming browser SQLite, PostgreSQL, or synchronization persistence
- **ID:** AC-015

#### Scenario: Create Product Review compatibility endpoint

- **WHEN** `POST /api/products/:id/reviews` receives a valid name, one to three `templateRevisionIds`, and scope/application IDs
- **THEN** it creates only a process-local Product Review fixture with draft status, progress 0, and exact Revision references
- **AND** it returns 201 or 404 when the fixture Product does not exist without claiming durable persistence
- **ID:** AC-016

#### Scenario: Review creation validation

- **WHEN** creation has zero or more than three Revision IDs, duplicate Revision or parent Template IDs, missing/draft/retired Revisions, an archived parent Template, an invalid subject, or invalid scope associations
- **THEN** local creation and compatibility fixture creation reject the request without partial Review or selection rows
- **AND** the fully offline stale-availability race remains explicitly deferred rather than solved through sync in this change
- **ID:** AC-017

### Requirement: Review Workspace Projection

The backend and client-local repository SHALL hydrate a Review from its exact selected Revision snapshots.
**ID:** REQ-006

#### Scenario: Workspace returns assessment-ready Review state

- **WHEN** a Review workspace is requested
- **THEN** it includes Review/subject metadata, ordered selected Revision snapshots, answers, notes, attachment metadata, capabilities, and readiness/maturity details
- **AND** it uses no fabricated Revision IDs or mutable Template metadata
- **AND** the initial workspace does not require separate reads for Pillars, Questions, answers, or permissions
- **ID:** AC-018

#### Scenario: Workspace projection remains valid for local-first reads

- **WHEN** a Review and exact selection rows exist locally
- **THEN** the assessment rehydrates from SQLite using exact Revision IDs
- **AND** later transported Review updates incrementally update their existing projection fields rather than forcing a full workspace refetch
- **AND** #140 does not claim immutable selection rows themselves replay through sync
- **ID:** AC-019
