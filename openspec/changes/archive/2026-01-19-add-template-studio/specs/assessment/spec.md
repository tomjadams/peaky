# Assessment Components - Spec Delta

## ADDED Requirements

### Requirement: Shared Answer Toggle Component
The system SHALL provide a reusable `AnswerToggle` component for Yes/No/N/A answer selection.

#### Scenario: User selects Yes answer
- **WHEN** user clicks the "Yes" button
- **THEN** the button shows green highlight
- **AND** the component emits the answer value

#### Scenario: User selects No answer
- **WHEN** user clicks the "No" button
- **THEN** the button shows amber highlight
- **AND** the component emits the answer value

#### Scenario: User selects N/A answer
- **WHEN** user clicks the "N/A" button
- **THEN** the component emits an 'na-click' event
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

## ADDED Requirements (Continued)

### Requirement: Assessment Page Uses Shared Components
The assessment page (`assessment.vue`) SHALL use the shared assessment components instead of inline implementations.

#### Scenario: Assessment renders with shared components
- **WHEN** the assessment page loads
- **THEN** each question is rendered using `QuestionRow` component
- **AND** answer buttons use `AnswerToggle` component
- **AND** pillar cards use `PillarSection` component

#### Scenario: All existing functionality preserved
- **WHEN** user interacts with the assessment
- **THEN** answers work correctly (Yes/No/N/A)
- **AND** the N/A modal opens when clicking N/A
- **AND** the More Info panel opens when clicking info
- **AND** progress tracking updates correctly

### Requirement: Template Preview Uses Shared Components
The template preview in Template Studio SHALL use the same shared assessment components.

#### Scenario: Preview renders with shared components
- **WHEN** user opens template preview
- **THEN** questions render using `QuestionRow` component
- **AND** answer buttons use `AnswerToggle` component
- **AND** the preview matches the real assessment appearance

#### Scenario: Preview has full interactivity
- **WHEN** user interacts with preview
- **THEN** answer buttons respond to clicks
- **AND** N/A opens the reason modal
- **AND** info button opens the More Info panel
