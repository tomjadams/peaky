## ADDED Requirements

### Requirement: Review as Template Container

The system SHALL treat a Review as a container that holds 1-3 template assessments.

#### Scenario: Review-template join entity

- **WHEN** storing or retrieving review data
- **THEN** a ReviewTemplate join entity links each review to its templates
- **AND** each ReviewTemplate tracks independent progress per template
- **AND** a review MUST have at least 1 and at most 3 templates

#### Scenario: Per-template progress

- **WHEN** viewing review progress
- **THEN** each template within the review has its own progress percentage
- **AND** each template has its own pillar breakdown
- **AND** overall review progress is aggregated across all templates

#### Scenario: Template version locking

- **WHEN** a review is created with a template
- **THEN** the ReviewTemplate records the template version at creation time
- **AND** this enables future version-lock capabilities (not yet implemented)

### Requirement: Review Creation Wizard

The system SHALL provide a multi-step wizard for creating new reviews under a team.

#### Scenario: Wizard step 1 - template selection

- **WHEN** navigating to `/teams/:teamId/reviews/new`
- **THEN** Step 1 displays all available published templates
- **AND** the user can select 1-3 templates
- **AND** selecting more than 3 templates shows a validation message
- **AND** a progress indicator shows the current step (1 of 3)

#### Scenario: Wizard step 2 - application linking

- **WHEN** proceeding from Step 1 to Step 2
- **THEN** Step 2 displays available applications by name only (no status badges)
- **AND** a helper text explains that linking helps track readiness per application over time
- **AND** the user can select zero or more applications via checkboxes
- **AND** a search input filters applications by name
- **AND** a "Skip" option allows proceeding without linking applications
- **AND** the progress indicator shows step 2 of 3

#### Scenario: Wizard step 3 - confirmation

- **WHEN** proceeding from Step 2 to Step 3
- **THEN** Step 3 displays a summary of selected templates and applications
- **AND** the user can provide a review name
- **AND** a "Create Review" button submits the review
- **AND** the progress indicator shows step 3 of 3

#### Scenario: Wizard navigation

- **WHEN** using the wizard
- **THEN** "Back" buttons allow returning to previous steps
- **AND** "Cancel" returns to the Team Details page
- **AND** step state is preserved when navigating back

#### Scenario: Wizard breadcrumbs

- **WHEN** using the review wizard
- **THEN** breadcrumbs show: Teams / [Team Name] / New Review

### Requirement: Review Creation API

The backend SHALL provide an API endpoint for creating reviews.

#### Scenario: Create review endpoint

- **WHEN** a POST request is made to `/api/teams/:teamId/reviews`
- **THEN** the request body includes name, templateIds (1-3), and optional applicationIds
- **AND** the endpoint validates templateIds length (1-3)
- **AND** the endpoint creates the review with ReviewTemplate join records
- **AND** returns the created review object with 201 status

#### Scenario: Review creation validation

- **WHEN** creating a review with invalid data
- **THEN** missing or empty templateIds returns 400
- **AND** more than 3 templateIds returns 400
- **AND** invalid teamId returns 404

## MODIFIED Requirements

### Requirement: Review Data Model

The application MUST use a team-centric approach for review ownership.

#### Scenario: Review ownership

- **WHEN** storing or retrieving review data
- **THEN** each review includes a teamId field (required)
- **AND** each review includes an orgId field (derived from team)
- **AND** applications are linked via an optional N:M relationship (applicationIds array)
- **AND** legacy root fields (`applicationId`, `templateId`, `templateName`, `pillars`) MAY be present as temporary compatibility fields for existing `/applications/*` flows

#### Scenario: Review data structure

- **WHEN** review data is returned
- **THEN** each review includes:
  - id: unique identifier
  - name: review display name
  - teamId: owning team
  - orgId: derived from team's organization
  - templateIds: array of 1-3 template IDs
  - templateNames: array of template display names
  - applicationIds: optional array of linked application IDs
  - status: current review status
  - createdAt, updatedAt: timestamps
  - templates: array of ReviewTemplate objects with per-template progress
  - assessors: team members
  - reviewers: advisors (max 2)

### Requirement: Review Details Page

The application SHALL provide a dedicated page for viewing review status, progress, and metadata before entering the assessment flow.

#### Scenario: Review details header

- **WHEN** viewing the review details page
- **THEN** the page displays the review name as the main heading
- **AND** displays template names using readability-first inline text/chips (1-3 template labels)
- **AND** displays a status badge (draft, in-progress, completed)
- **AND** provides a prominent "Continue Assessment" button
- **AND** includes breadcrumb navigation: "Teams / [Team Name] / [Review Name]"

#### Scenario: Review details navigation

- **WHEN** clicking a review from the Team Details page
- **THEN** the application navigates to the Review Details page
- **AND** the route is `/teams/:teamId/reviews/:reviewId`

## REMOVED Requirements

### Requirement: Review-Application Relationship

**Reason**: Reviews are no longer owned by applications. They are owned by teams, with applications as an optional N:M association.
**Migration**: Replace `applicationId` (required, 1:1) with `teamId` (required) + `applicationIds` (optional, N:M).
