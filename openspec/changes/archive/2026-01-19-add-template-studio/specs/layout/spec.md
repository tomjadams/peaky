## ADDED Requirements

### Requirement: Templates List Page

The application SHALL provide a page for viewing and managing all ORR templates.

#### Scenario: Templates table display
- **WHEN** viewing the Templates List page at `/templates`
- **THEN** a DataTable displays all available templates
- **AND** columns include: Name, Version, Status, Reviews Using, Actions
- **AND** the Status column shows color-coded badges (draft=gray, active=green, archived=slate)
- **AND** the Reviews Using column shows the count of reviews currently using each template
- **AND** breadcrumb navigation shows "Dashboard / Templates"

#### Scenario: Template actions
- **WHEN** viewing a template row
- **THEN** an "Edit" action is available
- **AND** clicking Edit navigates to `/templates/:id/edit`
- **AND** a "Create Template" button is displayed above the table
- **AND** clicking Create Template navigates to `/templates/new/edit`

#### Scenario: Template filtering and sorting
- **WHEN** viewing the Templates List page
- **THEN** templates can be sorted by name, version, status, or reviews count
- **AND** a search input allows filtering templates by name
- **AND** status filter buttons allow filtering by draft, active, or archived

### Requirement: Template Studio Page

The application SHALL provide a dedicated full-screen editor for creating and editing ORR templates with a focused, distraction-free experience.

#### Scenario: Studio layout structure
- **WHEN** viewing the Template Studio at `/templates/:id/edit`
- **THEN** the page displays a full-screen editor layout
- **AND** a collapsible left sidebar shows pillar navigation
- **AND** the main area displays the question editor for the active pillar
- **AND** the main content is positioned vertically toward the center of the viewport (not at top)
- **AND** the layout provides comfortable editing position with content "in front of user"
- **AND** the sidebar can collapse to show only pillar icons for maximum editing space
- **AND** sidebar collapse state persists across page reloads
- **AND** space is allocated for pillar descriptions/subtitles in sidebar (implementation deferred)

#### Scenario: Studio header display
- **WHEN** editing a template
- **THEN** the header displays the template name (editable inline)
- **AND** shows a status badge (draft, active, archived)
- **AND** shows an auto-save indicator ("Saving...", "Saved X mins ago", "Unsaved changes")
- **AND** includes "Save Draft" and "Publish" action buttons
- **AND** displays the template version

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

### Requirement: Question List View

The Template Studio SHALL display questions in a list format with collapsed and expanded states.

#### Scenario: Question list display
- **WHEN** viewing questions for a pillar
- **THEN** questions are displayed as cards in a vertical list
- **AND** each card shows a drag handle for reordering
- **AND** questions can be reordered via drag-and-drop
- **AND** an "Add Question" input is displayed at the bottom of the list

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
- **THEN** the question text field supports rich text (HTML) formatting
- **AND** a toolbar provides Bold and Italic formatting buttons
- **AND** a character counter is displayed showing current/max characters (e.g., "120/300")
- **AND** the character counter is positioned consistently with other text areas
- **AND** the text field auto-grows with content
- **AND** character counter turns orange at 80% capacity and red at 95%
- **AND** a maximum of 300 characters is enforced with soft validation

#### Scenario: Risk level selection
- **WHEN** editing a question
- **THEN** a dropdown allows selecting risk level
- **AND** options include: Critical (red), High (orange), Medium (yellow), Low (gray)
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
- **AND** a character counter shows current/max characters (e.g., "350/800")
- **AND** character counter turns orange at 80% capacity and red at 95%
- **AND** a maximum of 800 characters is enforced with soft validation
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
- **AND** a maximum of 200 characters per practice is enforced
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
- **AND** the information icon shows question metadata
- **AND** styling matches the actual Assessment page
- **AND** a close button returns to the editor

### Requirement: Auto-Save and State Management

The Template Studio SHALL automatically save changes and manage unsaved state.

#### Scenario: Auto-save behavior
- **WHEN** editing any template content
- **THEN** changes are auto-saved after 2 seconds of inactivity
- **AND** the save status indicator updates to show "Saving..."
- **AND** after successful save, shows "Saved X mins ago"
- **AND** if save fails, shows error notification

#### Scenario: Unsaved changes warning
- **WHEN** navigating away with unsaved changes
- **THEN** a confirmation dialog warns about unsaved changes
- **AND** users can choose to stay and save or discard changes
- **AND** the dialog prevents accidental data loss

#### Scenario: Manual save
- **WHEN** clicking "Save Draft"
- **THEN** changes are immediately saved
- **AND** the save status indicator updates
- **AND** success or error feedback is displayed

### Requirement: Markdown Export/Import

The Template Studio SHALL provide Markdown export/import as a secondary option for power users.

#### Scenario: Markdown export/import button
- **WHEN** viewing the Template Studio header
- **THEN** a Markdown button is available in the top toolbar
- **AND** clicking the button opens a modal or panel
- **AND** the modal allows exporting template content as Markdown
- **AND** the modal allows importing Markdown to populate template content
- **AND** this feature is for power users or bulk editing workflows

### Requirement: Template Publishing

The Template Studio SHALL allow publishing templates to make them available for use.

#### Scenario: Publish action
- **WHEN** clicking "Publish" on a draft template
- **THEN** a confirmation dialog appears
- **AND** the dialog summarizes what will be published
- **AND** confirms the user wants to make the template active

#### Scenario: Publish validation
- **WHEN** publishing a template
- **THEN** all Markdown content is validated for safety
- **AND** required fields are checked (template name, at least one pillar, at least one question)
- **AND** validation errors are displayed with specific messages
- **AND** the publish is blocked until errors are resolved

#### Scenario: Successful publish
- **WHEN** a template passes validation and is published
- **THEN** the status changes to "active"
- **AND** the template becomes available for review selection
- **AND** success feedback is displayed
- **AND** the backend logs the publish action (no-op in MVP)

### Requirement: Template Studio Navigation Integration

The Template Studio pages SHALL integrate with the application's navigation system.

#### Scenario: Templates link in sidebar
- **WHEN** viewing the main navigation sidebar
- **THEN** a "Templates" link is displayed
- **AND** clicking the link navigates to `/templates`
- **AND** the link shows active state when on template pages

#### Scenario: Template Studio breadcrumbs
- **WHEN** editing a template
- **THEN** breadcrumbs show "Dashboard / Templates / [Template Name]"
- **AND** "Templates" links back to the Templates List
- **AND** the template name shows as current page (not linked)

#### Scenario: Command palette integration
- **WHEN** the command palette is open in Template Studio
- **THEN** "Save Template" command is available
- **AND** "Preview Template" command is available
- **AND** "Publish Template" command is available (if draft)
- **AND** "Go to [Pillar]" commands are available for each pillar
