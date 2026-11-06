## ADDED Requirements

### Requirement: Template Publication Freeze

Template Studio and every publication entry point MUST fail closed until MR B installs server-authoritative publication.
**ID:** REQ-012

#### Scenario: Publication controls are hidden

- **WHEN** public runtime config reports `templatePublishingEnabled = false`
- **THEN** Template Studio renders no Publish button or command
- **AND** draft authoring, save, preview, and Markdown actions remain available
- **ID:** AC-022

#### Scenario: Direct client publication is write-free

- **WHEN** a caller invokes a client publication service during the freeze
- **THEN** it returns `{ success: false, code: 'template_write_unavailable' }` before state, event, outbox, timestamp, or optimistic UI mutation
- **ID:** AC-023

#### Scenario: Nitro publication is write-free

- **WHEN** a caller invokes a Nitro publication endpoint during the freeze or enables the rollout flag before MR B installs publication
- **THEN** the endpoint returns HTTP 503 with code `template_write_unavailable` before reading or mutating Template, Revision, or fixture state
- **AND** the removed legacy draft-to-active path is never executed
- **ID:** AC-024

#### Scenario: Revision publication fields are immutable during freeze

- **WHEN** any local or remote mutation attempts to change Revision status, `revisionNumber`, `publishedAt`, `publishedByActorId`, or retirement state
- **THEN** the operation returns the stable `template_write_unavailable` result before state, event, outbox, timestamp, or fixture writes
- **ID:** AC-032

#### Scenario: Public and private publication gates cannot drift

- **WHEN** Nuxt configuration is built or started
- **THEN** private and public `templatePublishingEnabled` values derive from the same parsed `NUXT_TEMPLATE_PUBLISHING_ENABLED` source with false default
- **AND** an independent public override cannot enable UI controls without the matching private value
- **ID:** AC-035

### Requirement: Template Owner Team Selection

Template Studio SHALL require one valid owning Team before the first save of a new Template.
**ID:** REQ-013

#### Scenario: New Template selects owner Team

- **WHEN** an actor creates a Template with a successfully persisted `directory_groups` snapshot
- **THEN** the creation flow requires one Team from that snapshot, including the last stored snapshot while offline
- **AND** first save atomically persists Template, owner Team, Template/Revision creators, and matching initial updater actor IDs
- **AND** no new snapshot freshness TTL is applied
- **ID:** AC-025

#### Scenario: Missing Team snapshot prevents first save

- **WHEN** no directory-group snapshot exists, no Team is selected, or the selected ID is absent from that snapshot
- **THEN** first save is rejected with field-level feedback
- **AND** no partial Template or Revision row is persisted
- **ID:** AC-026

### Requirement: Remote Template Write Freeze

The backend MUST keep deterministic Template fixture reads available while rejecting every remote Template mutation until a trusted server authority exists.
**ID:** REQ-016

#### Scenario: Remote Template creation is unavailable

- **WHEN** any actor calls a remote Template creation endpoint during the freeze
- **THEN** the endpoint returns HTTP 503 with code `template_write_unavailable` before creating Template, Revision, owner, actor-provenance, event, or fixture state
- **ID:** AC-027

#### Scenario: Remote Template update is unavailable

- **WHEN** any actor calls a remote Template metadata or draft-content update endpoint during the freeze
- **THEN** the endpoint returns HTTP 503 with code `template_write_unavailable` before reading or mutating Template, Revision, event, or fixture state
- **ID:** AC-028

#### Scenario: Remote Template lifecycle is unavailable

- **WHEN** any actor calls remote Template archive, restore, whole-draft delete, or permanent-delete endpoints during the freeze
- **THEN** the endpoint returns HTTP 503 with code `template_write_unavailable` before authorization-dependent state mutation
- **AND** Template lifecycle controls are absent from the management UI
- **ID:** AC-029

#### Scenario: Deterministic fixture reads remain available

- **WHEN** a client requests the Template catalog or a deterministic published fixture Revision
- **THEN** the read endpoint returns the new aggregate/Revision projection without creating or updating remote draft state
- **ID:** AC-030

## MODIFIED Requirements

### Requirement: Template Studio Question Authoring Page

The application SHALL provide a full-screen editor for the one locally stored draft Revision of an active Template.
**ID:** REQ-001

#### Scenario: Studio layout structure

- **WHEN** viewing Template Studio at `/templates/:id/edit` for a Template with a draft
- **THEN** the page displays a full-screen editor layout
- **AND** a collapsible left sidebar shows Pillar navigation
- **AND** the main area displays the Question editor for the active Pillar and remains vertically positioned toward the center
- **AND** the sidebar can collapse to abbreviated navigation and its state persists across reloads
- **ID:** AC-001

#### Scenario: Question editor display

- **WHEN** a user opens an editable draft Revision
- **THEN** Pillar tabs and the Question editor are displayed
- **AND** no Questions/Rules mode toggle or Rules navigation action is rendered
- **ID:** AC-002

#### Scenario: Studio header display

- **WHEN** editing a draft Revision
- **THEN** the header displays current Template/draft name, Template lifecycle, Draft Revision status, auto-save state, and supported actions
- **AND** it does not display a fabricated Revision number or publication control
- **ID:** AC-003

### Requirement: Auto-Save and State Management

Template Studio SHALL save draft Revision changes locally and report local-only durability truthfully.
**ID:** REQ-008

#### Scenario: Auto-save behavior

- **WHEN** editable draft content remains idle for two seconds
- **THEN** one local SQLite transaction persists the Template/draft metadata and affected authored units
- **AND** the indicator shows Saving and then Saved with elapsed local-save time
- **AND** a failed save shows an error notification without claiming persistence or synchronization
- **ID:** AC-014

#### Scenario: Unsaved changes warning

- **WHEN** a user navigates away before a pending local save completes
- **THEN** a confirmation warns about unsaved changes and offers stay/save or discard choices
- **AND** accidental navigation does not silently lose the in-memory edits
- **ID:** AC-015

#### Scenario: Manual save

- **WHEN** a user selects Save Draft
- **THEN** pending draft changes persist immediately to local SQLite
- **AND** the save-status indicator and success/error feedback update without claiming remote synchronization
- **ID:** AC-016

### Requirement: Template Studio Navigation Integration

Template Studio SHALL integrate draft authoring actions with navigation while publication is frozen.
**ID:** REQ-009

#### Scenario: Templates link in sidebar

- **WHEN** viewing primary navigation
- **THEN** a Templates link opens `/templates` and shows active route state on Template pages
- **ID:** AC-017

#### Scenario: Template Studio breadcrumbs

- **WHEN** editing a Template draft
- **THEN** breadcrumbs show `Dashboard / Templates / [Current Template Name]`
- **AND** Templates links back to the management list
- **ID:** AC-018

#### Scenario: Command palette integration

- **WHEN** the Template Studio command palette is open during the publication freeze
- **THEN** Save, Preview, Markdown, and Pillar navigation commands are available
- **AND** no Publish command is registered
- **ID:** AC-019

### Requirement: Local-First Template Draft Authoring

Template Studio SHALL persist editable Template metadata, Pillars, and Questions in one local draft Revision without claiming transport before issue #137.
**ID:** REQ-004

#### Scenario: Template draft loads from local state

- **WHEN** a user opens an existing local draft Revision
- **THEN** Template Studio hydrates from local SQLite before any network request
- **AND** the last local state remains available during transient server unavailability
- **ID:** AC-006

#### Scenario: Draft edits commit locally without outbox

- **WHEN** a user edits Template metadata, Pillars, or Questions during the interim transport freeze
- **THEN** the mutation commits atomically to local SQLite
- **AND** it creates no legacy `template_draft*` or new Template Revision outbox row
- **AND** the UI identifies the draft as local-only
- **ID:** AC-007

#### Scenario: Archived Template draft is immutable locally

- **WHEN** any local mutation attempts to change the draft or current metadata of an archived Template
- **THEN** the service rejects the mutation before state, event, or outbox effects
- **AND** Template Studio renders that content read-only
- **ID:** AC-031

### Requirement: Markdown Import And Export For Template Drafts

Template Studio SHALL import and export the complete authored content of a draft Revision without serializing removed Rules data or assigning publication metadata.
**ID:** REQ-006

#### Scenario: Draft export preserves Template structure

- **WHEN** a user exports a draft Revision to Markdown
- **THEN** export preserves draft metadata, Pillars, Questions, Question types, checklist items, leading practices, and helpful links
- **AND** it contains no Rules section or fabricated Revision number
- **ID:** AC-011

#### Scenario: Markdown import replaces the mutable draft structure

- **WHEN** supported Markdown is imported through Template Studio
- **THEN** the parsed metadata, Pillars, Questions, Question types, and checklist items replace the current in-memory draft structure
- **AND** the normal local draft save reconciles those structured rows atomically without publication metadata, event, outbox, or push effects
- **AND** legacy Markdown containing a Rules section is rejected before partial draft state is applied
- **AND** import is accepted only while the Revision is draft
- **ID:** AC-012

### Requirement: Structured Template Collaboration

Template Studio SHALL store draft metadata, Pillars, and Questions as independently identified and durably ordered local units that preserve future collaboration boundaries without claiming synchronization in this change.
**ID:** REQ-005

#### Scenario: Independent Template units persist independently

- **WHEN** an author edits one Pillar or Question in the shared local draft
- **THEN** the local transaction targets that authored unit rather than replacing the whole draft as one blob
- **AND** no remote synchronization claim or outbox entry is produced
- **ID:** AC-008

#### Scenario: Ordering does not depend on raw array indexes

- **WHEN** users add adjacent Questions or reorder authored units within a Pillar
- **THEN** the draft model preserves stable row identity and durable ordering metadata
- **AND** local persistence does not rewrite unrelated authored units
- **ID:** AC-009

#### Scenario: Remote collision behavior remains deferred

- **WHEN** Template authoring transport is frozen
- **THEN** the application does not present remote same-unit conflict markers or claim cross-author convergence
- **AND** issue #137 remains responsible for explicit conflict evidence and resolution guidance
- **ID:** AC-010

### Requirement: Checklist Question Validation

Template Studio SHALL validate checklist Questions before local draft save while publication is unavailable.
**ID:** REQ-017

#### Scenario: Item count validation

- **WHEN** saving a checklist Question
- **THEN** the system requires at least three non-empty items
- **AND** a failed minimum reports a specific validation error without persisting invalid state
- **ID:** AC-033

#### Scenario: Empty item text validation

- **WHEN** a checklist item contains empty text
- **THEN** the item shows a validation error
- **AND** the Question cannot be marked complete or saved as valid
- **ID:** AC-034

## REMOVED Requirements

### Requirement: Template Update Compatibility API

**Reason**: Remote draft updates would create a second process-local authority beside the SQLite-only draft Revision.
**Migration**: Calls return the stable Template-write-unavailable outcome under REQ-016; local Studio authoring persists only in SQLite until a trusted server path exists.
**ID:** REQ-010

### Requirement: Template Creation Compatibility API

**Reason**: Remote creation would split Template identity/ownership from the local-only draft and cannot be made atomic with SQLite.
**Migration**: Calls return the stable Template-write-unavailable outcome under REQ-016; new Templates and drafts are created locally during the freeze.
**ID:** REQ-011

### Requirement: Template Publishing

**Reason**: The existing requirement promotes a mutable draft to active locally and contradicts immutable server-authoritative Revisions.
**Migration**: Publication is fail-closed under REQ-012 until MR B specifies and installs the authoritative transition.
**ID:** REQ-014

### Requirement: Template Publish Compatibility API

**Reason**: The compatibility endpoint mutates an in-memory flattened Template and cannot satisfy the new Revision invariants.
**Migration**: Calls return unavailable without writes under REQ-012; MR B owns the replacement endpoint.
**ID:** REQ-015
