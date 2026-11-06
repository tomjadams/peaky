> **Note:** The `specs/layout/` domain no longer exists. N/A button requirements now live in `openspec/specs/assessment/spec.md`.

## ADDED Requirements

### Requirement: Not Applicable Answer Option

The application SHALL provide a "Not Applicable" (N/A) answer option for questions that do not apply to the user's specific context, infrastructure, or operational model.

#### Scenario: N/A button display in dashboard view

- **WHEN** viewing questions in dashboard view
- **THEN** a third "N/A" button is displayed alongside Yes and No buttons
- **AND** the N/A button uses gray styling to distinguish it from Yes/No options
- **AND** the button is positioned as the rightmost option in the answer toggle group
- **AND** the button includes proper ARIA attributes for accessibility

#### Scenario: N/A option display in survey view

- **WHEN** viewing questions in survey view
- **THEN** a "not applicable" link is displayed below the Yes and No buttons
- **AND** the link uses subtle underlined text styling
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

## MODIFIED Requirements

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
