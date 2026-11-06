# reviews Specification

## Purpose

This specification covers the review domain - viewing review details, managing assessment sessions, tracking history, and comparing changes over time. Includes both UI components and API endpoints for review-related functionality.

## Requirements

### Requirement: Review Details Page

The application SHALL provide a dedicated page for viewing review status, progress, and metadata before entering the assessment flow.

#### Scenario: Review details header

- **WHEN** viewing the review details page
- **THEN** the page displays the review name as the main heading
- **AND** displays template names using readability-first inline text/chips (1-3 template labels)
- **AND** displays a status badge (draft, in-progress, completed)
- **AND** provides a prominent "Continue Assessment" button
- **AND** includes breadcrumb navigation: "Teams / [Team Name] / [Review Name]" for team reviews, "Products / [Product Name] / [Review Name]" for product reviews

#### Scenario: Review metric cards

- **WHEN** viewing the review details page
- **THEN** metric cards are displayed with gradient borders for visual distinction
- **AND** cards show: Overall Progress (%), Items Needing Attention (count), Questions Answered (X of Y), Last Activity (relative date)
- **AND** the Items Needing Attention card shows a sub-label splitting follow-up and not-assessed counts
- **AND** the Items Needing Attention card is clickable and navigates to the contextual `/plan` page for the review
- **AND** Last Activity card shows who performed the last action if available
- **AND** cards match the styling of Application Details metric cards

#### Scenario: Pillars breakdown table

- **WHEN** viewing the review details page with pillars
- **THEN** a "Pillars" section displays a data table
- **AND** the table shows columns: Pillar Name, Progress, Questions (answered/total), Actions Needed
- **AND** the Progress column shows a visual progress bar with percentage
- **AND** rows are clickable for future pillar navigation
- **AND** the table uses the reusable DataTable component

#### Scenario: Pillars empty state

- **WHEN** the review has no pillars loaded
- **THEN** an appropriate empty or loading state is displayed
- **AND** the empty state uses consistent styling with other empty states

#### Scenario: Reviewers display

- **WHEN** viewing the review details page
- **THEN** assigned reviewers are displayed as an avatar group
- **AND** avatars show stacked circles with initials
- **AND** hovering reveals a tooltip or popover with full names
- **AND** if no reviewers are assigned, an appropriate empty state is shown

#### Scenario: History section placeholder

- **WHEN** viewing the review details page
- **THEN** a "History" section is displayed
- **AND** the section shows a placeholder indicating lineage features are coming
- **AND** the placeholder uses appropriate styling and iconography

#### Scenario: Continue Assessment action

- **WHEN** a user clicks "Continue Assessment"
- **THEN** the application navigates to the assessment page
- **AND** the assessment page loads with the review's current state
- **AND** the route is `/:context/:contextId/reviews/:reviewId/assessment` where context is `teams` or `products`

#### Scenario: Review details navigation

- **WHEN** clicking a review from a Team Details or Product Details page
- **THEN** the application navigates to the Review Details page (not directly to assessment)
- **AND** the route is `/teams/:teamId/reviews/:reviewId` for team reviews
- **AND** the route is `/products/:productId/reviews/:reviewId` for product reviews

#### Scenario: Command palette integration

- **WHEN** the command palette is open on the Review Details page
- **THEN** a "Continue Assessment" command is available
- **AND** a "View Improvement Plan" command is available
- **AND** pillar jump commands are available (e.g., "Go to Security pillar")
- **AND** commands navigate appropriately

### Requirement: Assessment Session History

The application SHALL display assessment session history on the Review Details page, showing chronological progress snapshots.

#### Scenario: History section display

- **WHEN** viewing the Review Details page
- **THEN** a "History" section is displayed below the Breakdown section
- **AND** the section shows a timeline of assessment sessions
- **AND** sessions are ordered chronologically (most recent on right)
- **AND** the section shows an empty state when no sessions exist

#### Scenario: Timeline visualization

- **WHEN** viewing the History section with sessions
- **THEN** a horizontal timeline displays session nodes
- **AND** each node shows the date below
- **AND** progress percentage is shown below the date
- **AND** delta indicators (+N answers) are shown between nodes
- **AND** the current/latest session is visually highlighted

#### Scenario: Timeline interaction

- **WHEN** clicking on a timeline node
- **THEN** the corresponding session card is expanded
- **AND** the timeline node shows selected state
- **AND** the view scrolls to the session card if needed

### Requirement: Session Cards

The application SHALL display expandable session cards showing who made changes and what changed.

#### Scenario: Collapsed session card display

- **WHEN** viewing a session card in collapsed state
- **THEN** the card shows the session date and time
- **AND** shows the author's name
- **AND** shows a brief summary (e.g., "+5 answers, 3 pillars affected")
- **AND** shows a "Compare" button for diff selection

#### Scenario: Expanded session card display

- **WHEN** a session card is expanded
- **THEN** the card shows per-pillar progress deltas
- **AND** each pillar shows before and after percentages
- **AND** pillars with changes are visually distinct from unchanged pillars
- **AND** the optional session note is displayed if present

#### Scenario: Session card interaction

- **WHEN** clicking on a collapsed session card
- **THEN** the card expands with a smooth animation
- **AND** clicking again collapses the card
- **AND** keyboard navigation is supported (Enter to toggle)

### Requirement: Session Comparison Diff View

The application SHALL provide a diff view for comparing any two assessment sessions.

#### Scenario: Diff selection mode

- **WHEN** clicking "Compare" on a session card
- **THEN** the session enters comparison selection mode
- **AND** clicking "Compare" on a second session shows the diff view
- **AND** the UI indicates which sessions are selected for comparison
- **AND** clicking elsewhere cancels the selection

#### Scenario: Diff view display

- **WHEN** two sessions are selected for comparison
- **THEN** a diff panel opens showing changes between sessions
- **AND** changes are grouped by pillar
- **AND** each pillar shows overall progress delta badge
- **AND** individual question changes are listed within pillars

#### Scenario: Question-level diff rendering

- **WHEN** viewing question changes in the diff
- **THEN** added answers are styled with green text/background
- **AND** removed/changed answers show the old value with red text/strikethrough
- **AND** evidence changes are shown with appropriate styling
- **AND** unchanged questions are collapsed or hidden by default

#### Scenario: Diff view navigation

- **WHEN** the diff view is open
- **THEN** users can close the diff view to return to normal history view
- **AND** users can select a different session pair without closing first
- **AND** keyboard shortcut (Escape) closes the diff view

### Requirement: Session Creation Policy

The application SHALL only create assessment sessions when meaningful changes have been made.

#### Scenario: Session created on save with changes

- **WHEN** a user clicks "Save Progress" in the assessment
- **AND** at least one answer has changed since the last session
- **THEN** a new session is created with the current snapshot
- **AND** the session appears in the history timeline

#### Scenario: No session created for view-only visits

- **WHEN** a user opens an assessment without making changes
- **AND** navigates away or closes the page
- **THEN** no new session is created
- **AND** the history timeline remains unchanged

#### Scenario: No session created when save has no changes

- **WHEN** a user clicks "Save Progress" in the assessment
- **AND** no answers have changed since the last session
- **THEN** no new session is created
- **AND** the user receives feedback that there are no changes to save

#### Scenario: Change detection comparison

- **WHEN** determining if changes exist
- **THEN** the backend compares current answers against the last session snapshot
- **AND** only answer value changes count (not just opening/viewing questions)
- **AND** evidence and attachment changes also count as meaningful changes

### Requirement: Review-Centric Architecture

The application MUST use a review-centric approach for data organization and routing.

#### Scenario: Review-based URL structure

- **WHEN** implementing URL routing
- **THEN** the application uses subject-context routes under `/teams/:teamId/reviews/:reviewId` or `/products/:productId/reviews/:reviewId`
- **AND** both facades resolve the same review core and scope all pillar and question data to `reviewId`
- **AND** invalid review IDs are handled gracefully

#### Scenario: Review data endpoint

- **WHEN** a client requests data for a specific review
- **THEN** the API returns the review details including template information
- **AND** includes metadata about the review (status, progress, etc.)
- **AND** returns appropriate HTTP status codes

#### Scenario: Review pillar relationship

- **WHEN** a client requests pillar data within a review
- **THEN** the API returns pillar data specific to that review
- **AND** includes review-specific progress for each pillar
- **AND** maintains the relationship between review, template, and pillars

### Requirement: Deep Linking Support

The application MUST support deep linking to specific reviews, pillars, and questions.

#### Scenario: Review deep linking

- **WHEN** a user navigates to a URL with an review ID parameter
- **THEN** the application loads the specified review
- **AND** displays the review's data and associated pillars
- **AND** handles invalid review IDs gracefully

#### Scenario: Pillar deep linking

- **WHEN** a user navigates to a URL with review and pillar parameters
- **THEN** the application loads the specified review and activates the specified pillar
- **AND** displays the questions for that pillar within the review context
- **AND** handles invalid pillar IDs gracefully

#### Scenario: Question deep linking

- **WHEN** a user navigates to a URL with review, pillar, and question parameters
- **THEN** the application loads the specified review, pillar, and scrolls to the specified question
- **AND** may highlight or focus the specified question
- **AND** handles invalid question IDs gracefully

### Requirement: Actions Needed Calculation

The backend and local read model MUST calculate items needing attention based on assessment answers, checklist completeness, and N/A state.

#### Scenario: Items from unanswered questions

- **WHEN** calculating items needing attention for a review
- **THEN** each unanswered question counts as one not-assessed item
- **AND** not-assessed items are included in the items-needing-attention total
- **AND** questions marked as "Not Applicable" do not count as not-assessed items

#### Scenario: Items from negative answers

- **WHEN** calculating items needing attention for a review
- **THEN** each yes/no question answered "No" counts as one follow-up item
- **AND** follow-up items are included in the items-needing-attention total
- **AND** the calculation excludes inactive questions

#### Scenario: Items from checklist gaps

- **WHEN** calculating items needing attention for a checklist question
- **THEN** unchecked checklist items that are not marked N/A create one checklist gap item for the question
- **AND** the item includes counts for checked, N/A, and still-needs-review checklist items
- **AND** a checklist question with every item checked or marked N/A does not count as an active item needing attention

#### Scenario: Documented N/A exceptions

- **WHEN** calculating items needing attention for questions marked N/A
- **THEN** N/A questions are excluded from the primary total
- **AND** N/A questions are available as documented exceptions in the plan filters
- **AND** N/A reasons are preserved for user review

#### Scenario: Attention count breakdown

- **WHEN** displaying review-level attention counts
- **THEN** the system provides separate counts for follow-up, checklist gaps, not assessed, and documented exceptions
- **AND** the primary count is the sum of follow-up, checklist gaps, and not-assessed items
- **AND** documented exceptions are not included in the primary count

### Requirement: Multi-Pillar Support

The application MUST provide comprehensive data for all pillars (Security, Infrastructure, Reliability, and Operations).

#### Scenario: Security pillar data

- **WHEN** a client requests Security pillar data
- **THEN** the API returns all Security-related questions and information
- **AND** includes appropriate metadata for the Security pillar

#### Scenario: Infrastructure pillar data

- **WHEN** a client requests Infrastructure pillar data
- **THEN** the API returns all Infrastructure-related questions and information
- **AND** includes appropriate metadata for the Infrastructure pillar

#### Scenario: Reliability pillar data

- **WHEN** a client requests Reliability pillar data
- **THEN** the API returns all Reliability-related questions and information
- **AND** includes appropriate metadata for the Reliability pillar

#### Scenario: Operations pillar data

- **WHEN** a client requests Operations pillar data
- **THEN** the API returns all Operations-related questions and information
- **AND** includes appropriate metadata for the Operations pillar

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

### Requirement: Product Review Listing

The application SHALL list product-scoped reviews on the product details page.

#### Scenario: Reviews table display

- **WHEN** viewing a product with reviews
- **THEN** a data table shows all reviews with columns: Name, Status, Progress, Updated
- **AND** status uses badge with appropriate color
- **AND** progress shows percentage with progress bar

#### Scenario: No reviews empty state

- **WHEN** a product has no reviews
- **THEN** an empty state is displayed with "No reviews yet" message and "Start New Review" button

### Requirement: Reviews API (Product-scoped)

The application SHALL provide API endpoints for product review retrieval.

#### Scenario: List product reviews

- **WHEN** requesting `GET /api/products/:id/reviews`
- **THEN** a list of reviews for the product is returned
- **AND** each review includes id, name, status, progress, updatedAt
- **AND** reviews are sorted by updatedAt descending

#### Scenario: Get product review details

- **WHEN** requesting `GET /api/products/:productId/reviews/:reviewId`
- **THEN** the review details are returned including template information and pillar progress breakdown

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

### Requirement: Shared Review Core Behind Subject Facades

The review domain SHALL support a shared review core independent of whether the owning subject is a team, product, or future organization.

#### Scenario: Team and product review facades resolve the same review core

- **WHEN** a user navigates to a team-scoped review route or a product-scoped review route
- **THEN** both routes resolve the same shared review core behavior for assessment, history, and scoring
- **AND** the user-facing route context remains team- or product-specific for navigation clarity
