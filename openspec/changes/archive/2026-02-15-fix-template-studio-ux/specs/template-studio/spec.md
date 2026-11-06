## ADDED Requirements

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
- **AND** the default resource URL is "https://www.adyen.com/knowledge-hub"

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

## MODIFIED Requirements

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
