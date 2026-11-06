## ADDED Requirements

### Requirement: Template Studio Question Authoring Page

The application SHALL provide a dedicated full-screen editor for creating and editing Peaky templates with a focused, distraction-free question-authoring experience.
**ID:** REQ-001

#### Scenario: Studio layout structure

- **WHEN** viewing Template Studio at `/templates/:id/edit`
- **THEN** the page displays a full-screen editor layout
- **AND** a collapsible left sidebar shows pillar navigation
- **AND** the main area displays the question editor for the active pillar
- **AND** the main content is positioned vertically toward the center of the viewport
- **AND** the sidebar can collapse to show only pillar icons
- **AND** sidebar collapse state persists across page reloads
- **ID:** AC-001

#### Scenario: Question editor display

- **WHEN** a user opens Template Studio
- **THEN** pillar tabs and the question editor are displayed
- **AND** no Questions/Rules mode toggle or Rules navigation action is rendered
- **ID:** AC-002

#### Scenario: Studio header display

- **WHEN** editing a Template
- **THEN** the header displays the editable Template name and lifecycle status
- **AND** shows the auto-save indicator and supported Template actions
- **AND** displays the Template version
- **ID:** AC-003

## MODIFIED Requirements

### Requirement: Markdown Export/Import

Template Studio SHALL export and import supported Template metadata, pillars, questions, checklist items, leading practices, and helpful links as Markdown.
**ID:** REQ-003

#### Scenario: Markdown export/import button

- **WHEN** viewing the Template Studio header
- **THEN** a Markdown action opens the import/export surface
- **AND** export contains the supported Template structure
- **AND** import can populate the supported Template structure
- **ID:** AC-004

#### Scenario: Legacy Rules Markdown is rejected

- **WHEN** imported Markdown contains a `## Rules` section
- **THEN** the import is rejected before applying any imported Template state
- **AND** the user receives an error stating that Template Rules are no longer supported
- **ID:** AC-005

### Requirement: Local-First Template Draft Authoring

Template Studio SHALL support local-first draft authoring for editable Template metadata, pillars, and questions.
**ID:** REQ-004

#### Scenario: Template draft loads from local state

- **WHEN** a user opens an editable Template draft already replicated locally
- **THEN** Template Studio hydrates from the local database first
- **AND** the last known draft state remains available during temporary server unavailability
- **ID:** AC-006

#### Scenario: Draft edits commit locally before sync

- **WHEN** a user edits Template metadata, pillars, or questions in draft mode
- **THEN** the mutation commits locally first
- **AND** the change is queued for background synchronization
- **ID:** AC-007

### Requirement: Structured Template Collaboration

Template Studio SHALL model Template drafts as structured metadata, pillar, and question authoring units so non-overlapping edits do not become whole-draft conflicts.
**ID:** REQ-005

#### Scenario: Independent template units sync independently

- **WHEN** different authors edit different pillars or questions in the same draft
- **THEN** synchronization treats those units independently
- **AND** the draft does not require whole-template conflict review for non-overlapping changes
- **ID:** AC-008

#### Scenario: Ordering does not depend on raw array indexes

- **WHEN** users add adjacent questions or reorder authoring units within the same pillar
- **THEN** the draft model preserves stable identity and durable ordering metadata
- **AND** synchronization can reconcile nearby inserts without rewriting the entire draft as one blob
- **ID:** AC-009

#### Scenario: Same-entity template collisions require explicit review

- **WHEN** concurrent offline or delayed-sync edits change the same question or other supported Template authoring unit
- **THEN** the system preserves both sides for explicit conflict review instead of silently overwriting one side
- **AND** the user is shown conflict markers plus resolution guidance
- **ID:** AC-010

### Requirement: Markdown Import And Export For Template Drafts

Template Studio SHALL support Markdown import and export for Template-draft authoring workflows outside the app without serializing removed Rules data.
**ID:** REQ-006

#### Scenario: Draft export preserves template structure

- **WHEN** a user exports a Template draft to Markdown
- **THEN** export preserves Template metadata, pillars, questions, checklist items, leading practices, and helpful links
- **AND** export does not contain a Rules section
- **ID:** AC-011

#### Scenario: Markdown import reuses the same conflict-review model

- **WHEN** a user imports supported Markdown that touches Template units changed locally or remotely since the import base
- **THEN** the system marks affected units with explicit conflict markers instead of silently merging them
- **AND** the import flow directs the user to the conflict-review path
- **ID:** AC-012

#### Scenario: Publishing commits locally before synchronization

- **WHEN** a user publishes a valid local Template draft
- **THEN** the local draft becomes active in the same local transaction that emits the publish event and queues synchronization
- **AND** the user does not wait for remote confirmation before the local active state is visible
- **ID:** AC-013

## REMOVED Requirements

### Requirement: Template Studio Page

**Reason**: The old requirement mixed the supported question editor with the removed Questions/Rules mode system.
**Migration**: Replace it with `Template Studio Question Authoring Page`; remove the Rules route, toggle, canvas, and toolbar while preserving the question-authoring layout and header actions.
**ID:** REQ-007

### Requirement: Template Rule Sets Storage

**Reason**: Rules Manager has no runtime evaluator and is being removed before the Template model migration and Template Sync work.
**Migration**: Remove `ruleSets` from Template models, validation, local persistence, API schemas, and Markdown; forward migrations intentionally delete persisted Rules rows.
**ID:** REQ-002
