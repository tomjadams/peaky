# assessment Specification (Delta)

## Purpose

Extends the assessment specification with pillar notes and attachments capabilities.

## Requirements

### Requirement: Pillar Notes Section

The application SHALL provide a notes section at the bottom of each pillar for capturing context and observations.

#### Scenario: Notes section display

- **WHEN** viewing a pillar in the assessment view
- **THEN** a "Notes" section appears below all questions
- **AND** the section is separated from questions by a dashed line
- **AND** the section is collapsible with expand/collapse toggle
- **AND** the section defaults to collapsed state if empty
- **AND** the section defaults to expanded state if content exists

#### Scenario: Notes anchor in pillar header

- **WHEN** viewing a pillar header
- **THEN** a notes icon button appears in the header actions
- **AND** clicking the icon smooth-scrolls to the notes section
- **AND** clicking the icon expands the notes section if collapsed
- **AND** the icon shows an indicator dot when notes have content

#### Scenario: Notes content editing

- **WHEN** editing pillar notes
- **THEN** a rich text editor is displayed (markdown)
- **AND** the editor toolbar includes Bold, Italic, Bullet List, and Link buttons
- **AND** links can be added inline within the markdown content
- **AND** the editor reuses the Template Studio's RichTextEditor component
- **AND** placeholder text reads "Add context, observations, or follow-up notes for this pillar..."

#### Scenario: Notes persistence

- **WHEN** a user saves pillar notes
- **THEN** the content is stored as markdown
- **AND** the content is associated with the specific review and pillar
- **AND** the `updated_at` timestamp is refreshed
- **AND** different reviews have independent notes for the same pillar

### Requirement: Pillar Attachments

The application SHALL allow users to attach files to pillar notes.

#### Scenario: Attachment upload zone

- **WHEN** the notes section is expanded
- **THEN** an attachment upload zone is displayed below the editor
- **AND** the zone supports drag-and-drop file upload
- **AND** the zone supports click-to-browse file selection
- **AND** the zone displays accepted file types: "PDF, XLSX, PNG up to 10MB"

#### Scenario: Attachment validation

- **WHEN** a user attempts to upload a file
- **THEN** files larger than 10MB are rejected with error message
- **AND** files with unsupported types are rejected with error message
- **AND** accepted types are: PDF, XLSX, XLS, PNG, JPG, JPEG
- **AND** validation errors display as toast notifications

#### Scenario: Attachment upload feedback

- **WHEN** a file is being uploaded
- **THEN** a progress indicator is displayed
- **AND** the upload zone shows visual feedback during drag-over
- **AND** successful uploads add the file to the attachments list
- **AND** failed uploads show an error toast with retry option

#### Scenario: Attachment list display

- **WHEN** attachments exist for a pillar
- **THEN** attachments are displayed as cards in a grid layout
- **AND** each card shows a file type icon (PDF=red, XLSX=green, images=blue)
- **AND** each card shows the filename (truncated if long)
- **AND** each card shows the file size in human-readable format
- **AND** each card shows the uploader's name
- **AND** clicking a card initiates file download

#### Scenario: Attachment deletion

- **WHEN** hovering over an attachment card
- **THEN** a delete button appears
- **AND** clicking delete shows a confirmation prompt
- **AND** confirming deletion removes the file from storage and database
- **AND** the attachment disappears from the list

#### Scenario: Attachment authorship

- **WHEN** a user uploads an attachment
- **THEN** the current user is recorded as `created_by`
- **AND** the user's display name appears on the attachment card
- **AND** authorship is display-only (no edit permissions logic)

### Requirement: Save Button Relocation

The application SHALL move the save functionality to the pillar level.

#### Scenario: Save button placement

- **WHEN** viewing a pillar's notes section
- **THEN** a "Save Progress" button appears at the bottom of the notes section
- **AND** the button saves both question answers and pillar notes
- **AND** the button is the primary save mechanism for the pillar

### Requirement: Celebration Animation

The application SHALL provide positive feedback when users add detailed notes.

#### Scenario: First note celebration

- **WHEN** a user saves pillar notes for the first time (content was empty)
- **THEN** a subtle celebration animation plays (confetti/sparkle)
- **AND** a toast message appears: "Notes saved!"
- **AND** the animation auto-dismisses after 2 seconds
- **AND** subsequent saves do not trigger the celebration

#### Scenario: Accessibility of celebration

- **WHEN** the celebration animation plays
- **THEN** it does not include flashing that could trigger seizures
- **AND** screen readers announce "Notes saved successfully"
- **AND** the animation is purely decorative and does not block interaction

### Requirement: Smooth Transitions

The application SHALL provide polished animations for notes interactions.

#### Scenario: Scroll to notes animation

- **WHEN** a user clicks the notes anchor in the pillar header
- **THEN** the page smooth-scrolls to the notes section
- **AND** the scroll accounts for any sticky header offset
- **AND** the scroll behavior is smooth, not instant

#### Scenario: Expand/collapse animation

- **WHEN** a user toggles the notes section collapsed state
- **THEN** the section expands/collapses with a smooth height transition
- **AND** the toggle icon rotates to indicate current state
- **AND** the transition duration is approximately 300ms

#### Scenario: Drag-drop visual feedback

- **WHEN** a user drags a file over the upload zone
- **THEN** the zone border changes to primary color
- **AND** the zone background shows a subtle tint
- **AND** the zone scales up slightly (1-2%)
- **AND** visual changes revert when drag leaves the zone
