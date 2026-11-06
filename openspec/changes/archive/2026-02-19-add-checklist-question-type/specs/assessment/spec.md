# assessment Delta Specification

## ADDED Requirements

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
- **AND** X is the number of checked items
- **AND** Y is the total number of items
- **AND** a mini progress bar fills proportionally

### Requirement: Checklist Question Answer Handling

The system SHALL handle checklist question answers in the assessment flow.

#### Scenario: Saving checklist answer

- **WHEN** a user checks or unchecks items in a checklist question
- **THEN** the answer is stored as an array of checked item IDs
- **AND** the question is marked as answered (if at least one item checked)
- **AND** the progress calculation includes this question

#### Scenario: Checklist N/A selection

- **WHEN** a user clicks N/A on a checklist question
- **THEN** the N/A reason modal opens
- **AND** confirming N/A grays out the entire question
- **AND** the question counts as answered

#### Scenario: Toggling N/A off

- **WHEN** a question is marked N/A and user checks an item
- **THEN** the N/A state is cleared
- **AND** the question becomes active again
- **AND** the checked item is recorded

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
