# assessment Specification

## Purpose

This specification covers the assessment domain - the core experience of answering assessment questions, viewing question information, managing N/A answers, and tracking progress through pillars. Includes shared UI components used across assessment and template preview.

## Requirements

### Requirement: Shared Answer Toggle Component

The system SHALL provide a reusable `AnswerToggle` component for Yes/No/N/A answer selection.

#### Scenario: User selects Yes answer

- **WHEN** user clicks the "Yes" button
- **THEN** the button shows green highlight
- **AND** the selected state meets WCAG AA contrast in light and dark themes
- **AND** the component emits the answer value

#### Scenario: User selects No answer

- **WHEN** user clicks the "No" button
- **THEN** the button shows amber highlight
- **AND** the selected state meets WCAG AA contrast in light and dark themes
- **AND** the component emits the answer value

#### Scenario: User selects N/A answer

- **WHEN** user clicks the "N/A" button
- **THEN** the component emits an 'na-click' event
- **AND** the N/A control uses neutral styling with WCAG AA contrast in light and dark themes
- **AND** the parent component opens the NA reason modal

#### Scenario: User deselects current answer

- **WHEN** user clicks the currently selected answer button
- **THEN** the answer is cleared (set to null)
- **AND** no button is highlighted

### Requirement: Shared Question Row Component

The system SHALL provide a reusable `QuestionRow` component displaying a single assessment question.

#### Scenario: Question row displays all elements

- **WHEN** a question row is rendered
- **THEN** it shows the question ID badge
- **AND** it shows the question text
- **AND** it shows an info button
- **AND** it shows the answer toggle buttons

#### Scenario: N/A visual treatment

- **WHEN** a question has answer "na"
- **THEN** the entire row appears dimmed (reduced opacity, grayscale)

#### Scenario: Info button opens panel

- **WHEN** user clicks the info button
- **THEN** the component emits 'info-click' event
- **AND** the parent component opens the More Info panel

### Requirement: Shared Pillar Section Component

The system SHALL provide a reusable `PillarSection` component wrapping questions in a pillar.

#### Scenario: Pillar section displays header

- **WHEN** a pillar section is rendered
- **THEN** it shows the pillar name
- **AND** it shows the answered/total question count
- **AND** it shows the completion percentage badge

#### Scenario: Progress badge colors

- **WHEN** progress is 100%
- **THEN** the badge shows green styling
- **WHEN** progress is between 1-99%
- **THEN** the badge shows blue styling
- **WHEN** progress is 0%
- **THEN** the badge shows gray styling

### Requirement: Question Data Adapter

The system SHALL provide adapter functions to convert between different question data formats.

#### Scenario: Convert TemplateQuestion to Question

- **WHEN** `templateQuestionToQuestion()` is called with a TemplateQuestion
- **THEN** it returns a Question object with mapped fields
- **AND** the text, importance, leadingPractices, and helpfulLinks are preserved

#### Scenario: Convert Question to QuestionInfo

- **WHEN** `questionToQuestionInfo()` is called with a Question
- **THEN** it returns a QuestionInfo object suitable for the More Info panel

### Requirement: Question Information Access

The application SHALL provide access to additional information for each question including importance context, leading practices, and helpful resources.

#### Scenario: Info icon display

- **WHEN** viewing questions in either survey or default view
- **THEN** each question displays a subtle information (i) icon
- **AND** the icon is positioned with appropriate spacing from the question text
- **AND** the icon is aligned with the first line of multi-line questions
- **AND** no redundant dropdown is shown in the default view

#### Scenario: Sidebar information display

- **WHEN** a user clicks on a question's information icon
- **THEN** the right information panel opens with question-specific information
- **AND** the panel displays "Why is this important?" section with descriptive text
- **AND** the panel displays "Leading practices" section as a list of items
- **AND** the panel displays "Helpful links" section with external link indicators

#### Scenario: Information panel control

- **WHEN** content components need to control information panel visibility
- **THEN** the layout uses shared state management instead of local control
- **AND** any component can open or close the information panel programmatically
- **AND** the panel displays content appropriate to the triggering question

### Requirement: View Mode Navigation

The application MUST provide seamless navigation between different view modes.

#### Scenario: View mode switching

- **WHEN** a user clicks the mode toggle button
- **THEN** the application navigates to the appropriate view
- **AND** the toggle shows clear visual indication of the current mode
- **AND** the toggle uses intuitive labeling instead of "Power User"

#### Scenario: Survey mode navigation

- **WHEN** a user activates the Survey mode
- **THEN** the application navigates to the single-question survey view
- **AND** the toggle shows active state styling
- **AND** navigation uses NuxtLink for client-side routing
- **AND** there is a clear visual indication that Survey mode is active

### Requirement: Template Selector Navigation

The application SHALL provide a collapsible sidebar for template and pillar navigation in the dashboard view.

#### Scenario: Template selector display

- **WHEN** viewing the dashboard (multi-question view)
- **THEN** a template selector sidebar is displayed between the main navigation and content area
- **AND** the sidebar shows the exact selected Template Revision snapshot name, derived `v{revisionNumber}` label, and Revision status badge
- **AND** the sidebar displays a list of pillars with completion percentages
- **AND** the active pillar is visually highlighted
- **AND** the sidebar does not appear in survey mode

#### Scenario: Sidebar collapse functionality

- **WHEN** a user clicks the collapse button
- **THEN** the sidebar collapses to a minimal width
- **AND** only the template name and status badge remain visible
- **AND** the collapse state persists across page reloads
- **AND** the main content area expands to use the available space

#### Scenario: Sidebar expand functionality

- **WHEN** the sidebar is collapsed and the user clicks the expand button
- **THEN** the sidebar expands to full width
- **AND** the pillar list and progress indicators become visible
- **AND** the expand state persists across page reloads

#### Scenario: Pillar navigation

- **WHEN** a user clicks on a pillar in the template selector
- **THEN** the page scrolls to the corresponding pillar section
- **AND** the clicked pillar becomes the active pillar
- **AND** the pillar link includes an anchor tag for future deep linking support

#### Scenario: Responsive behavior

- **WHEN** viewing on screens smaller than 1280px width
- **THEN** the template selector defaults to collapsed state
- **AND** users can still expand it manually if needed

### Requirement: Question Identification

The application SHALL display unique identifiers for each question to support reference and navigation.

#### Scenario: Question ID display

- **WHEN** viewing questions in the dashboard view
- **THEN** each question displays an ID badge in the format `{PILLAR_SLUG}-{ORDER}`
- **AND** the ID badge is positioned before the question text
- **AND** the ID uses the pillar slug from the database (e.g., SEC, PERF, OPS)
- **AND** the order number corresponds to the `pillar_order` field

#### Scenario: Question anchor tags

- **WHEN** rendering questions
- **THEN** each question includes an anchor tag with ID `question-{pillar-slug}-{order}`
- **AND** the anchor tag enables future deep linking to specific questions
- **AND** the anchor tag does not interfere with existing question functionality

#### Scenario: Question ID styling

- **WHEN** displaying question IDs
- **THEN** the ID badge uses subtle styling that doesn't overpower the question text
- **AND** the badge is visually distinct from other UI elements
- **AND** the badge maintains readability in both light and dark modes

### Requirement: Pillar Progress Indicators

The application SHALL display completion progress for each pillar in the template selector.

#### Scenario: Progress percentage display

- **WHEN** viewing the pillar list in the template selector
- **THEN** each pillar shows a completion percentage
- **AND** the percentage is calculated based on answered questions
- **AND** the percentage is displayed in a small, subtle font
- **AND** completed pillars (100%) are visually distinct from incomplete pillars

#### Scenario: Progress calculation

- **WHEN** calculating pillar completion percentage
- **THEN** the percentage reflects the ratio of answered questions to total questions
- **AND** questions marked as "Not Applicable" count as answered
- **AND** questions with Yes or No answers count as answered
- **AND** the calculation excludes inactive questions

### Requirement: Not Applicable Answer Option

The application SHALL provide a "Not Applicable" (N/A) answer option for questions that do not apply to the user's specific context, infrastructure, or operational model.

#### Scenario: N/A button display in dashboard view

- **WHEN** viewing questions in dashboard view
- **THEN** a third "N/A" button is displayed alongside Yes and No buttons
- **AND** the N/A button uses neutral styling with WCAG AA contrast to distinguish it from Yes/No options
- **AND** the button is positioned as the rightmost option in the answer toggle group
- **AND** the button includes proper ARIA attributes for accessibility

#### Scenario: N/A option display in survey view

- **WHEN** viewing questions in survey view
- **THEN** a "not applicable" link is displayed below the Yes and No buttons
- **AND** the link uses subtle underlined text styling
- **AND** the link meets contrast requirements in both light and dark themes
- **AND** the link includes proper ARIA label for accessibility
- **AND** clicking the link opens the N/A reason modal

#### Scenario: N/A button interaction

- **WHEN** a user clicks the N/A button or link
- **THEN** a modal dialog appears requiring reason selection
- **AND** the modal title reads "Why is this question not applicable?"
- **AND** the modal includes explanatory text "Please choose a reason and share more if necessary."
- **AND** the modal displays the full question text in a bordered container with question mark icon
- **AND** the modal prevents interaction with background content (backdrop with blur effect)

#### Scenario: N/A button selected state in dashboard view

- **WHEN** a question is marked as N/A in dashboard view
- **THEN** the N/A button shows active state with ring styling
- **AND** the active state remains high‑contrast in light and dark themes
- **AND** the question row applies subtle opacity and grayscale effect
- **AND** the Yes and No buttons return to unselected state
- **AND** the N/A state persists until changed by the user

### Requirement: N/A Reason Selection Modal

The application MUST display a modal dialog for capturing the reason when a question is marked as Not Applicable.

#### Scenario: Modal structure and layout

- **WHEN** the N/A modal is displayed
- **THEN** the modal appears centered on screen with backdrop blur
- **AND** the modal uses a maximum width of 512px (max-w-lg)
- **AND** the modal includes a fade-in scale animation on appearance
- **AND** the modal header displays the question text in a bordered container with icon
- **AND** the modal is divided into header, content, and footer sections

#### Scenario: Predefined reason selection

- **WHEN** the modal content area is displayed
- **THEN** a "Reasoning" section shows five predefined reason buttons
- **AND** the reasons are: "Not in scope", "Handled by infrastructure", "Legacy System", "Pending Deprecation", "Other"
- **AND** the reason buttons use square design with borders
- **AND** only one reason can be selected at a time
- **AND** the selected reason shows active state with blue background, border, and checkmark icon
- **AND** unselected reasons show hover effects on interaction

#### Scenario: Additional details input

- **WHEN** the modal content area is displayed
- **THEN** an "Additional Details (optional)" textarea is provided below the reason buttons
- **AND** the textarea is optional for the user
- **AND** the textarea has a 200 character limit
- **AND** a character counter displays in the bottom-right corner (e.g., "0/200")
- **AND** the textarea includes placeholder text "Details will be saved with your answer for your team's reference."

#### Scenario: Modal confirmation

- **WHEN** the modal footer is displayed
- **THEN** a "Cancel" button is shown on the left
- **AND** a "Confirm" button is shown on the right
- **AND** the Confirm button is enabled only when a reason is selected
- **AND** clicking Cancel closes the modal without saving changes
- **AND** clicking Confirm saves the N/A answer with reason and closes the modal

#### Scenario: Modal keyboard accessibility

- **WHEN** the N/A modal is open
- **THEN** pressing Escape key closes the modal without saving
- **AND** focus is trapped within the modal
- **AND** Tab key cycles through interactive elements in logical order
- **AND** focus returns to the N/A button when modal closes

### Requirement: N/A Answer Data Model

The application SHALL store N/A answers with associated reason and optional comment.

#### Scenario: N/A answer structure

- **WHEN** a question is marked as N/A
- **THEN** the answer value is set to `'na'`
- **AND** a `naReason` object is stored with the answer
- **AND** the `naReason` contains a required `reason` field with one of the predefined values
- **AND** the `naReason` contains an optional `comment` field with user-provided text
- **AND** the comment is limited to 200 characters

#### Scenario: N/A answer persistence

- **WHEN** the user saves progress
- **THEN** N/A answers are included in the save payload
- **AND** each N/A answer includes the question ID, answer value, reason, and comment (if provided)
- **AND** the payload structure supports future API integration

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

### Requirement: Local-First Assessment Editing

The application SHALL commit assessment edits locally first and synchronize them in the background.

#### Scenario: Answer selection updates immediately

- **WHEN** a user answers a question in the assessment
- **THEN** the answer is committed to local state immediately
- **AND** the visible question state and related progress indicators update without waiting for remote confirmation

#### Scenario: Notes and progress survive refresh before sync

- **WHEN** a user updates notes, answer state, or progress and then refreshes the browser before background sync completes
- **THEN** the latest local assessment state is restored from the local database
- **AND** the unsynced changes remain pending for later synchronization

#### Scenario: Offline assessment work remains editable

- **WHEN** a user loses connectivity while working on an assessment they are permitted to edit
- **THEN** they can continue editing locally during the entitlement snapshot window
- **AND** the assessment clearly indicates that synchronization is pending

### Requirement: Local-First Save Milestones

The application SHALL preserve explicit save/checkpoint intent while using local-first persistence.

#### Scenario: Save action creates a local milestone immediately

- **WHEN** a user invokes the save or checkpoint action from the assessment
- **THEN** the action is recorded locally immediately
- **AND** the resulting milestone participates in event-derived history once synchronization completes

#### Scenario: Save action during outage does not block the user

- **WHEN** a user invokes save while the remote server is unavailable
- **THEN** the application records the save intent locally
- **AND** the user is not blocked from continuing the assessment while remote synchronization is pending

### Requirement: Checklist Question Rendering

The assessment view SHALL render checklist questions with selectable checkbox items.

#### Scenario: Checklist question display

- **WHEN** a checklist question is rendered
- **THEN** the question text is displayed with question ID badge
- **AND** a progress indicator shows "X/Y" checked count
- **AND** a mini progress bar shows visual completion
- **AND** each checklist item displays as a checkbox row
- **AND** an info button and N/A button are available

#### Scenario: Checklist item checkbox interaction

- **WHEN** a user clicks an unchecked checklist item
- **THEN** the item becomes checked
- **AND** the checkbox shows primary color styling
- **AND** a badge displays "IMPLEMENTED"
- **AND** the progress indicator updates

#### Scenario: Checklist item unchecked state

- **WHEN** a checklist item is unchecked
- **THEN** the checkbox shows neutral styling
- **AND** no badge is displayed
- **AND** hover state shows interaction affordance

#### Scenario: Checklist progress indicator

- **WHEN** viewing a checklist question
- **THEN** a progress indicator shows "X/Y" format
- **AND** X is `checkedCount + naCount`
- **AND** Y is the total number of items
- **AND** a mini progress bar fills proportionally

### Requirement: Checklist Question Answer Handling

The system SHALL store a checklist answer as either question-level `'na'` with
an N/A reason or structured per-item state with `checked` and `na` item-ID
arrays.

#### Scenario: Saving checklist answer

- **WHEN** a user checks or unchecks items in a checklist question
- **THEN** the answer is stored as an object with `checked` and `na` item-ID arrays
- **AND** an item cannot appear in both arrays
- **AND** `checkedCount` is the number of IDs in `checked`
- **AND** `naCount` is the number of IDs in `na`
- **AND** checklist progress is `(checkedCount + naCount) / totalItemCount`
- **AND** the structured checklist counts as answered when `checkedCount + naCount` is greater than zero

#### Scenario: Checklist N/A selection

- **WHEN** a user clicks N/A on a checklist question
- **THEN** the N/A reason modal opens
- **AND** confirming N/A replaces the structured checklist answer with the question-level value `'na'` and its reason
- **AND** confirming N/A grays out the entire question
- **AND** the question counts as answered

#### Scenario: Toggling N/A off

- **WHEN** a question is marked N/A and user checks an item
- **THEN** the N/A state is cleared
- **AND** the question becomes active again
- **AND** the answer becomes structured checklist state with the checked item in `checked` and an empty `na` array

### Requirement: Checklist Question Info Panel

The info panel SHALL display checklist items as leading practices for checklist questions.

#### Scenario: Info panel for checklist question

- **WHEN** a user clicks the info button on a checklist question
- **THEN** the More Info panel opens
- **AND** the "Leading Practices" section shows checklist items
- **AND** each item displays with checkmark indicator
- **AND** the "Why This Matters" and "Resources" sections display normally

### Requirement: Checklist Question in Survey Mode

Survey mode SHALL render checklist questions with the same checkbox UI.

#### Scenario: Survey mode checklist display

- **WHEN** a checklist question appears in survey mode
- **THEN** the question displays with checkbox items
- **AND** the progress indicator and N/A option are available
- **AND** interaction matches the dashboard view

### Requirement: Checklist Question Type

The system SHALL support a `checklist` question type alongside the existing `yes-no` type.

#### Scenario: Question type field

- **WHEN** a question is created
- **THEN** the question has a `type` field with value "yes-no" or "checklist"
- **AND** the default type is "yes-no" for backward compatibility

#### Scenario: Checklist items field

- **WHEN** a question has type "checklist"
- **THEN** the question has a `checklistItems` array
- **AND** each item has `id`, `order`, and `text` fields
- **AND** the items are ordered by the `order` field

#### Scenario: Checklist item count validation

- **WHEN** a checklist question is saved or published
- **THEN** the question MUST have at least 3 non-empty checklist items
- **AND** validation fails when fewer than 3 non-empty items remain

### Requirement: Checklist Progress Calculation

The system SHALL count each checklist question as a single question for progress tracking.

#### Scenario: Progress calculation for checklists

- **WHEN** calculating pillar or overall progress
- **THEN** each checklist question counts as 1 question
- **AND** the question is "answered" when N/A is selected
- **AND** the question is "answered" when at least one item is checked
- **AND** checking additional items does NOT change progress percentage

### Requirement: Checklist Item Structure

The system SHALL store checklist items with consistent structure matching Leading Practices.

#### Scenario: Checklist item fields

- **WHEN** a checklist item is created
- **THEN** the item has an `id` field (unique string)
- **AND** the item has an `order` field (number for positioning)
- **AND** the item has a `text` field (string, max 250 characters)
- **AND** the structure matches `LeadingPractice` interface

#### Scenario: Checklist item ordering

- **WHEN** checklist items are displayed
- **THEN** items are sorted by `order` field ascending
- **AND** reordering updates the `order` values
- **AND** order is persisted on save
