# templates Specification

## Purpose

This specification covers template catalog, status, selection, details, and
usage during review creation. Template authoring behavior belongs to the
`template-studio` specification; catalog actions may navigate there without
duplicating its editing contract.

## Requirements

### Requirement: Template And Revision Domain Model

The system SHALL represent a Template as stable catalog identity and authored content as Template Revisions.
**ID:** REQ-001

#### Scenario: Template stores aggregate metadata

- **WHEN** a Template is persisted or returned
- **THEN** it contains stable identity, current name and description, `active | archived` lifecycle status, one `ownerTeamId`, immutable `createdByActorId`, mutable `updatedByActorId`, and creation/update timestamps
- **AND** `updatedByActorId` starts as the creator and changes only with aggregate-metadata updates
- **AND** it contains no draft, published, version-label, or current-Revision pointer field
- **ID:** AC-001

#### Scenario: Revision stores complete authored content

- **WHEN** a Template Revision is persisted or returned
- **THEN** it contains its own identity, `templateId`, metadata snapshot, `draft | published | retired` status, nullable `revisionNumber`, nullable `revisionSummary`, immutable `createdByActorId`, mutable-while-draft `updatedByActorId`, nullable `publishedByActorId`, and timestamps
- **AND** `updatedByActorId` starts as the creator and follows the last draft metadata/Pillar/Question editor
- **AND** draft requires null `revisionNumber`, `publishedAt`, and `publishedByActorId`
- **AND** published/retired requires a positive `revisionNumber` plus non-null immutable `publishedAt` and `publishedByActorId`
- **AND** its Pillars reference the Revision while Questions reference their Pillar and derive Revision ownership transitively
- **ID:** AC-002

#### Scenario: One draft and one published Revision

- **WHEN** Revisions are stored for one Template
- **THEN** database constraints permit at most one `draft` Revision and at most one `published` Revision
- **AND** no redundant current-Revision pointer is persisted
- **ID:** AC-003

#### Scenario: Revision content becomes immutable

- **WHEN** a Revision has `published` or `retired` status
- **THEN** attempts to change its metadata, Pillars, Questions, number, summary, creator, updater, publisher, or timestamps are rejected without partial writes
- **ID:** AC-004

#### Scenario: Question identity is Revision-specific

- **WHEN** equivalent-looking Questions exist in different Revisions
- **THEN** each Revision contains distinct Question row identities
- **AND** the system does not infer cross-Revision lineage from text or copied structure
- **ID:** AC-005

### Requirement: Revision Identification Metadata

The system SHALL identify immutable Revisions with constrained numeric metadata rather than free-form version labels.
**ID:** REQ-002

#### Scenario: Draft has no Revision number

- **WHEN** a Revision has `draft` status
- **THEN** `revisionNumber` is null
- **AND** the UI does not present the draft as `vN`
- **ID:** AC-006

#### Scenario: Published and retired numbers are valid

- **WHEN** a Revision has `published` or `retired` status
- **THEN** `revisionNumber` is a positive integer unique within its Template
- **AND** human-facing displays derive the label as `v{revisionNumber}`
- **ID:** AC-007

#### Scenario: Revision summary is normalized

- **WHEN** `revisionSummary` is persisted
- **THEN** surrounding whitespace is removed, empty input becomes null, and non-null input is at most 120 characters
- **AND** the summary does not participate in identity, ordering, or uniqueness
- **ID:** AC-008

### Requirement: Revision Snapshot Presentation

The application SHALL present Revision snapshots wherever a Review selects or consumes Template content.
**ID:** REQ-003

#### Scenario: Authoring surfaces use current metadata

- **WHEN** a user manages a Template or edits its draft in Template Studio
- **THEN** the surface displays current Template and draft-Revision metadata
- **AND** editing draft name or description updates Template metadata and the draft atomically without modifying published snapshots
- **ID:** AC-009

#### Scenario: Review surfaces use immutable metadata

- **WHEN** a user selects a current published Revision or opens an existing Review
- **THEN** the surface displays the exact selected Revision name, description, number, Pillars, and Questions
- **AND** later Template or draft metadata edits do not change that presentation
- **ID:** AC-010

### Requirement: Template Status Indicators

The application SHALL display Template aggregate and Revision status indicators without conflating lifecycle with publication.
**ID:** REQ-004

#### Scenario: Active Template indicator

- **WHEN** a Template has `active` status
- **THEN** the management surface displays an Active lifecycle indicator using the semantic success color
- **AND** the indicator meets accessible contrast requirements
- **AND** draft-only Templates are not labelled published or made review-selectable
- **ID:** AC-011

#### Scenario: Archived Template indicator

- **WHEN** a Template has `archived` status
- **THEN** the management surface displays an Archived lifecycle indicator
- **AND** its draft is read-only and none of its Revisions appears in new-Review selection
- **ID:** AC-012

#### Scenario: Revision status indicator

- **WHEN** a Revision status is displayed
- **THEN** the surface labels it Draft, Published, or Retired independently of Template lifecycle
- **ID:** AC-013

### Requirement: Template Selection Page

The application SHALL provide a page for selecting current published Template Revisions when creating a new Review.
**ID:** REQ-005

#### Scenario: Template selection display

- **WHEN** viewing the Template selection page
- **THEN** the page displays only the one `published` Revision of each `active` Template
- **AND** draft and retired Revisions and Revisions of archived Templates are absent
- **AND** each consistently styled card uses Revision snapshot name, description, Revision number, Pillar count, and Question count
- **AND** breadcrumb navigation preserves the current Team or Product Review-creation context
- **ID:** AC-014

#### Scenario: Multi-template selection

- **WHEN** selecting Template Revisions
- **THEN** users can select between one and three distinct Revisions
- **AND** selected Revisions are visually highlighted
- **AND** attempting to select more than three shows a validation message
- **ID:** AC-015

#### Scenario: Template selection confirmation

- **WHEN** selected Revisions are confirmed at final Review creation
- **THEN** the Review persists the exact ordered immutable Revision IDs
- **AND** pre-confirmation selection state remains ephemeral
- **ID:** AC-016

#### Scenario: Template selection cancellation

- **WHEN** a user cancels Review creation before final confirmation
- **THEN** the application returns to the current Team or Product details page
- **AND** no Review or Revision selection is persisted
- **ID:** AC-017

### Requirement: Templates List Page

The application SHALL provide a management page for stable Templates and their current draft/published Revision state.
**ID:** REQ-006

#### Scenario: Templates table display

- **WHEN** viewing `/templates`
- **THEN** the table displays current Template name, `active | archived` lifecycle, draft availability, current published `vN` or no published Revision, Review usage, and actions
- **AND** Template lifecycle and Revision status use distinct indicators
- **AND** breadcrumbs show `Dashboard / Templates`
- **ID:** AC-019

#### Scenario: Template actions

- **WHEN** the current actor has a locally stored draft and a current cached edit entitlement for an active Template
- **THEN** an Edit action opens that draft in `/templates/:id/edit`
- **AND** actors without that local editable scope receive aggregate metadata without a remote draft body
- **AND** Create Template navigates to `/templates/new/edit` and begins a new local active Template with one draft after required owner-Team selection
- **ID:** AC-020

#### Scenario: Template filtering and sorting

- **WHEN** viewing the Templates List page
- **THEN** users can search current Template metadata and filter lifecycle by active or archived
- **AND** users can sort by name, lifecycle, current Revision number, or Review usage
- **ID:** AC-021

### Requirement: Template Detail API

The backend SHALL return stable Template identity separately from deterministic published Revision snapshots and SHALL not expose remote draft bodies during the authority freeze.
**ID:** REQ-007

#### Scenario: Get Template by ID

- **WHEN** `/api/templates/:id` receives an existing deterministic fixture Template ID
- **THEN** it returns aggregate metadata plus the current published Revision projection when present
- **AND** the published projection includes complete Pillars and Questions
- **AND** it returns no remote draft Revision body and a missing Template returns 404
- **ID:** AC-022

#### Scenario: Template response structure

- **WHEN** Template aggregate data is returned
- **THEN** it uses the fields defined by REQ-001 AC-001
- **AND** Revision content is never flattened into Template lifecycle fields
- **ID:** AC-023

#### Scenario: Pillar response structure

- **WHEN** a Pillar is returned within a Revision
- **THEN** it contains stable row identity, Revision identity, slug, name, description, durable order, and ordered Questions
- **ID:** AC-024

#### Scenario: Question response structure

- **WHEN** a Question is returned within a Pillar
- **THEN** it contains its Revision-specific row identity, durable order, type, text, risk level, importance, checklist items, leading practices, and helpful links
- **ID:** AC-025

### Requirement: Template Statistics API

The backend SHALL provide deterministic, non-authoritative Template usage statistics for local and process-local fixture behavior during Preview.
**ID:** REQ-009

#### Scenario: Get Template stats

- **WHEN** a GET request is made to `/api/templates/:id/stats`
- **THEN** the response includes `reviewsCount`, `applicationsCount`, and `organizationsCount`
- **AND** new Templates with no local/demo usage return zeros
- **AND** every count is labelled or documented as local/demo-derived rather than an authoritative PostgreSQL aggregate
- **ID:** AC-028

### Requirement: Templates List Enhancement

The backend SHALL include sortable, non-authoritative local/demo Review usage in the Templates list response.
**ID:** REQ-010

#### Scenario: Templates list with local usage

- **WHEN** a GET request is made to `/api/templates`
- **THEN** each Template includes a `reviewsCount` derived from current local/process-fixture Review state
- **AND** the count does not claim authoritative active-Review coverage across clients
- **AND** Templates can be sorted by `reviewsCount`
- **ID:** AC-029

### Requirement: Question Severity Levels

The system SHALL support only meaningful action-plan severity levels for template questions.

#### Scenario: Supported severity values

- **WHEN** a question severity is stored, returned, or edited
- **THEN** the supported non-empty values are `critical`, `high`, and `medium`
- **AND** `low` is not a supported severity value
- **AND** every question has a severity level (null severity is not supported in the plan model)

#### Scenario: Severity display

- **WHEN** severity is displayed in plan, assessment, or template authoring UI
- **THEN** Critical, High, and Medium are the available severity labels
- **AND** no Low option is displayed

#### Scenario: Existing low-severity data

- **WHEN** existing data contains `low` question severity
- **THEN** the migration converts that value to `medium`
- **AND** the migrated question remains available in templates and reviews
- **AND** the conversion from low to medium is intentional to avoid the type-system complexity of nullable severity across projection, filtering, and display

### Requirement: Templates List Filtering

The Templates list endpoint SHALL filter aggregate lifecycle independently from Revision publication state.
**ID:** REQ-008

#### Scenario: Filter by Template lifecycle

- **WHEN** `/api/templates?status=active` or `/api/templates?status=archived` is requested
- **THEN** only Templates with that aggregate lifecycle are returned
- **AND** any other status filter is rejected while omitting the filter returns all Templates
- **ID:** AC-026

#### Scenario: Include Revision and non-authoritative usage summary

- **WHEN** Templates are returned from the management list
- **THEN** each item identifies local draft availability and its deterministic current published fixture Revision number when present
- **AND** any Review usage count is labelled as local/demo-derived rather than an authoritative PostgreSQL aggregate
- **ID:** AC-027
