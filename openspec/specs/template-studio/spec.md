# template-studio Specification

## Purpose

This specification covers Template Studio, the dedicated local-only editor for creating and authoring Peaky Template draft Revisions. It includes the full-screen editor UI, Pillar/Question management, preview mode, local auto-save, and fail-closed publication boundaries.

## Requirements

### Requirement: Pillar Creation Modal

The Template Studio SHALL provide a modal dialog for creating new pillars that includes onboarding content for first-time users.

#### Scenario: Opening pillar creation modal

- **WHEN** user clicks "Add pillar" button
- **THEN** a modal dialog opens with pillar creation form
- **AND** the modal displays a collapsible "How pillars work" section
- **AND** the section contains a pyramid diagram showing pillar progression
- **AND** the diagram shows: Operations → Security → Reliability → Clarity
- **AND** each pillar level includes brief description (e.g., "Deployment, observability, processes")

#### Scenario: Pillar diagram collapse preference

- **WHEN** user collapses the "How pillars work" section
- **THEN** the collapse state is saved to localStorage
- **AND** on subsequent modal opens, the section remains collapsed
- **AND** user can expand the section again at any time

#### Scenario: Creating pillar from modal

- **WHEN** user enters pillar name and description in the modal
- **AND** clicks "Create Pillar" button
- **THEN** the pillar is created with provided name and description
- **AND** the modal closes
- **AND** the new pillar becomes the active pillar

### Requirement: Question Pre-population

The Template Studio SHALL pre-populate new questions with example Leading Practice and Resource content.

#### Scenario: New question defaults

- **WHEN** user adds a new question
- **THEN** the question is created with one default Leading Practice
- **AND** the default practice text is "Run regular customers pain point review"
- **AND** the question is created with one default Resource link
- **AND** the default resource title is "Knowledge Hub"
- **AND** the default resource URL is "<https://www.adyen.com/knowledge-hub>"

### Requirement: Input Validation Feedback

The Template Studio SHALL show validation errors instead of silently truncating input.

#### Scenario: Character limit exceeded

- **WHEN** user types text that exceeds the character limit
- **THEN** the input displays an error state (red border or similar)
- **AND** an error message shows "Maximum X characters"
- **AND** the input value is NOT truncated
- **AND** user can see and edit the full text to reduce length

#### Scenario: Character limit compliance

- **WHEN** user reduces text to within the character limit
- **THEN** the error state is removed
- **AND** the input returns to normal styling

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

### Requirement: Pillar Navigation Sidebar

The Template Studio SHALL provide a space-efficient pillar navigation sidebar.

#### Scenario: Expanded sidebar display

- **WHEN** the pillar sidebar is expanded
- **THEN** each pillar shows its name and question count
- **AND** the active pillar is visually highlighted
- **AND** pillars can be reordered via drag-and-drop
- **AND** a "Structure" tab shows all pillars for overview and bulk reordering
- **AND** an "Add Pillar" option is available

#### Scenario: Collapsed sidebar display

- **WHEN** the pillar sidebar is collapsed
- **THEN** only pillar icons or abbreviated names are shown
- **AND** tooltips reveal full pillar names on hover
- **AND** clicking a pillar icon activates that pillar

#### Scenario: Pillar management

- **WHEN** managing pillars in the sidebar
- **THEN** pillars can be added with a name and slug
- **AND** pillars can be renamed inline
- **AND** pillars can be deleted (with confirmation if questions exist)
- **AND** pillar order affects question slug IDs
- **AND** the delete pillar button is always visible (not hover-only)

### Requirement: Question List View

The Template Studio SHALL display questions in a list format with collapsed and expanded states.

#### Scenario: Question list display

- **WHEN** viewing questions for a pillar
- **THEN** questions are displayed as cards in a vertical list
- **AND** each card shows a drag handle for reordering
- **AND** questions can be reordered via drag-and-drop
- **AND** an "Add Question" input is displayed at the bottom of the list

#### Scenario: Add question input area

- **WHEN** hovering over the add question area
- **THEN** the cursor changes to text input cursor across the entire bordered area
- **AND** the clickable area includes the full width and padding of the container
- **AND** clicking anywhere in the bordered area focuses the input

#### Scenario: Collapsed question card

- **WHEN** a question card is in collapsed state
- **THEN** the card displays the question text (truncated if long)
- **AND** shows the risk level badge with appropriate color
- **AND** shows the leading practices count (e.g., "3 Leading Practices")
- **AND** shows the dynamic slug ID (e.g., "REL-1", "SEC-2")
- **AND** clicking the card expands it for editing

#### Scenario: Expanded question card

- **WHEN** a question card is expanded
- **THEN** the full question editor is displayed
- **AND** a smooth CSS animation transitions the card from collapsed to expanded state
- **AND** the expanded card fills available space appropriately
- **AND** the animation enhances UX by making the transition feel natural
- **AND** the card shows all metadata fields
- **AND** a "Done" button collapses the card
- **AND** a "Delete Question" action is available

#### Scenario: Dynamic slug ID generation

- **WHEN** questions are displayed or reordered
- **THEN** slug IDs are generated in format `{PILLAR_SLUG}-{ORDER}`
- **AND** IDs update automatically when questions are reordered
- **AND** a visual indicator shows "IDs will update" during drag operations

### Requirement: Question Editor

The Template Studio SHALL provide a comprehensive editor for question content and metadata.

#### Scenario: Metadata sections visual grouping

- **WHEN** viewing the question editor
- **THEN** metadata sections (Why Important, Leading Practices, Resources) are visually distinct
- **AND** optional: subtle background color or border groups metadata sections together
- **AND** visual styling helps distinguish metadata from main question content
- **AND** consistent styling across all metadata sections aids comprehension

#### Scenario: Question text editing

- **WHEN** editing a question
- **THEN** the question text field is a single-row input that auto-expands when text overflows
- **AND** the field does NOT support Bold or Italic formatting
- **AND** a character counter is displayed showing current/max characters (e.g., "45/120")
- **AND** the character counter is positioned consistently with other text areas
- **AND** character counter turns orange at 80% capacity and red at 95%
- **AND** a maximum of 120 characters is enforced with validation (not truncation)
- **AND** exceeding the limit shows an error message

#### Scenario: Risk level selection

- **WHEN** editing a question
- **THEN** a dropdown allows selecting risk level
- **AND** options include: Critical (red), High (orange), and Medium (yellow)
- **AND** the selected risk appears as a colored badge

#### Scenario: Why Important section

- **WHEN** editing question metadata
- **THEN** a "Why it's important" textarea is displayed
- **AND** the section header includes an info icon (ⓘ) with tooltip
- **AND** the tooltip explains "This content appears when customers click 'More information' on the question"
- **AND** the field supports rich text (HTML) formatting with toolbar
- **AND** a toolbar provides Bold, Italic, Numbered List, and Unordered List formatting buttons
- **AND** list items can be indented using Tab (increase indent) and Shift+Tab (decrease indent)
- **AND** nested sub-items are supported through indenting
- **AND** a character counter shows current/max characters (e.g., "350/1000")
- **AND** character counter turns orange at 80% capacity and red at 95%
- **AND** a maximum of 1000 characters is enforced with validation (not truncation)
- **AND** exceeding the limit shows an error message
- **AND** the field auto-expands as content grows
- **AND** the field is collapsible for quick overview
- **AND** content is stored as HTML

#### Scenario: Leading practices editing

- **WHEN** editing leading practices
- **THEN** the section header includes an info icon (ⓘ) with tooltip
- **AND** the tooltip explains "This content appears when customers click 'More information' on the question"
- **AND** practices are displayed as a reorderable list
- **AND** each practice has a text input with character counter
- **AND** character counters show current/max (e.g., "85/200")
- **AND** character counter turns orange at 80% capacity and red at 95%
- **AND** a maximum of 200 characters per practice is enforced with validation (not truncation)
- **AND** each practice has a bold red trash can icon for deletion
- **AND** the delete icon has a "Delete practice" tooltip
- **AND** the delete icon is visually distinct from "clear input" actions
- **AND** practices can be reordered via drag-and-drop with drag handles
- **AND** drag handles are visible on hover
- **AND** visual feedback is shown during drag operations
- **AND** an "Add Practice" button adds new items
- **AND** practices support rich text (HTML) formatting

#### Scenario: Helpful links editing

- **WHEN** editing helpful links (Resources)
- **THEN** the section header includes an info icon (ⓘ) with tooltip
- **AND** the tooltip explains "This content appears when customers click 'More information' on the question"
- **AND** links are displayed as title + URL pairs
- **AND** each link has a drag handle for reordering
- **AND** drag handles are visible on hover
- **AND** links can be reordered via drag-and-drop
- **AND** visual feedback is shown during drag operations
- **AND** each link can be edited or removed
- **AND** an "Attach Resource" button adds new links
- **AND** link previews show the domain

### Requirement: Template Preview Mode

The Template Studio SHALL provide a preview mode showing how the template will appear in assessments.

#### Scenario: Preview activation

- **WHEN** clicking the Preview button or FAB
- **THEN** a preview panel or modal opens
- **AND** the panel shows the template as it would appear in the Assessment view
- **AND** pillar navigation is available within the preview
- **AND** mock answers are displayed to demonstrate the full UX

#### Scenario: Preview display

- **WHEN** viewing the preview
- **THEN** questions display with Yes/No/N/A answer options
- **AND** the information icon shows question metadata using the MoreInfoPanel slideover
- **AND** styling matches the actual Assessment page
- **AND** a close button returns to the editor

#### Scenario: N/A selection in preview

- **WHEN** user clicks the N/A button in preview mode
- **THEN** a slideover panel opens (not a modal) for N/A reason selection
- **AND** the slideover does not conflict with the preview modal
- **AND** user can select a reason and confirm
- **AND** the N/A state is reflected in the preview

#### Scenario: Information panel in preview

- **WHEN** user clicks the info icon (ⓘ) on a question in preview mode
- **THEN** the MoreInfoPanel slideover opens from the right side
- **AND** the panel shows "Why is this important?", Leading Practices, and Helpful Links
- **AND** the panel uses the same component as the Assessment page

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

### Requirement: Question Editor View Modes

The Template Studio SHALL provide two view modes for editing questions: Guided Mode (default) and Compact Mode (opt-in).

#### Scenario: Default to Guided Mode

- **WHEN** user expands a question card for the first time
- **THEN** the question editor displays in Guided Mode
- **AND** sections are shown one at a time in vertical layout

#### Scenario: Guided Mode section navigation

- **WHEN** editing a question in Guided Mode
- **THEN** the editor shows sections in order: Question, Why This Matters, Leading Practices, Resources
- **AND** a step indicator displays current step (e.g., "Step 1 of 4")
- **AND** a progress bar shows visual completion progress
- **AND** Next/Back buttons navigate between sections
- **AND** a Skip button allows skipping optional sections (Why This Matters, Leading Practices, Resources)

#### Scenario: Guided Mode section labels

- **WHEN** viewing each section in Guided Mode
- **THEN** Question section shows "(Required)" label
- **AND** Why This Matters section shows "(Recommended)" label
- **AND** Leading Practices section shows "(Optional)" label
- **AND** Resources section shows "(Optional)" label

#### Scenario: Guided Mode final step

- **WHEN** user reaches the last section (Resources) in Guided Mode
- **THEN** the Next button is replaced with a Done button
- **AND** clicking Done collapses the question card

#### Scenario: Compact Mode layout

- **WHEN** user switches to Compact Mode
- **THEN** the question editor displays the current 2-column layout
- **AND** all sections are visible simultaneously
- **AND** the Done button is visible at the bottom

### Requirement: View Mode Toggle

The Template Studio SHALL provide a toggle to switch between Guided and Compact modes.

#### Scenario: Toggle location

- **WHEN** a question card is expanded
- **THEN** a view mode toggle appears in the card header area
- **AND** the toggle displays the current mode label ("Guided" or "Compact")

#### Scenario: Toggle interaction

- **WHEN** user clicks the view mode toggle
- **THEN** the editor immediately switches to the other mode
- **AND** if switching from Guided to Compact, all sections become visible
- **AND** if switching from Compact to Guided, the first section (Question) is shown

### Requirement: View Mode Persistence

The Template Studio SHALL persist the user's view mode preference.

#### Scenario: Preference storage

- **WHEN** user changes the view mode
- **THEN** the preference is saved to localStorage with key "templateStudio.viewMode"
- **AND** the value is either "guided" or "compact"

#### Scenario: Preference restoration

- **WHEN** user returns to Template Studio in a new session
- **THEN** the previously selected view mode is restored
- **AND** all expanded question cards use the restored preference

#### Scenario: Global preference application

- **WHEN** user sets a view mode preference
- **THEN** the preference applies to all questions across all pillars
- **AND** the preference applies to all templates the user edits

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

### Requirement: Question Type Selection

The Template Studio SHALL allow authors to select the question type during question creation.

#### Scenario: Guided Mode type selection step

- **WHEN** a user adds a new question in Guided Mode
- **THEN** the first step displays a type selector
- **AND** the selector shows "Yes/No" and "Checklist" options
- **AND** "Yes/No" is selected by default
- **AND** selecting a type enables the "Next" button

#### Scenario: Compact Mode type selector

- **WHEN** a question card is expanded in Compact Mode
- **THEN** a type dropdown appears at the top of the left column
- **AND** the dropdown shows "Yes/No" and "Checklist" options
- **AND** changing the type immediately updates the editor layout

#### Scenario: Type selection persists

- **WHEN** a user selects a question type and saves
- **THEN** the type is stored with the question
- **AND** reopening the editor shows the selected type

### Requirement: Checklist Items Editor

The Template Studio SHALL provide an editor for managing checklist items when type is "checklist".

#### Scenario: Guided Mode checklist items step

- **WHEN** a user selects "Checklist" type in Guided Mode
- **THEN** Step 2 becomes "Checklist Items"
- **AND** the step shows at least three item input fields
- **AND** each item has a drag handle for reordering
- **AND** an "Add item" button is available
- **AND** a validation message shows "Required: at least 3 items"

#### Scenario: Compact Mode checklist items section

- **WHEN** a question has type "checklist" in Compact Mode
- **THEN** the right column displays "Checklist Items" section
- **AND** the section replaces "Leading Practices" for this question
- **AND** a helper text explains "These are the items reviewers will check off"
- **AND** items are displayed as reorderable list with checkboxes

#### Scenario: Leading Practices section hidden for checklists

- **WHEN** a question has type "checklist"
- **THEN** the "Leading Practices" section is not displayed
- **AND** checklist items serve as the leading practices

#### Scenario: Checklist item text input

- **WHEN** editing a checklist item
- **THEN** a text input accepts up to 250 characters
- **AND** a character counter shows current/max
- **AND** exceeding the limit shows validation error

#### Scenario: Checklist item reordering

- **WHEN** dragging a checklist item to a new position
- **THEN** the item moves to the new position
- **AND** the `order` values are updated automatically
- **AND** visual feedback shows during drag

#### Scenario: Checklist item deletion

- **WHEN** a checklist question has 4+ items and user deletes one
- **THEN** the item is removed
- **AND** remaining items retain their order

#### Scenario: Checklist item minimum validation

- **WHEN** a checklist question has fewer than 3 items
- **THEN** the "Done" button shows validation error
- **AND** an error message displays "Checklist requires at least 3 items"

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
