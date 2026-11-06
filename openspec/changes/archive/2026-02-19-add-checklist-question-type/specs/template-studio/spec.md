# template-studio Delta Specification

## ADDED Requirements

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
- **AND** the step shows 3-5 item input fields
- **AND** each item has a drag handle for reordering
- **AND** an "Add item" button is available (up to 5 items)
- **AND** a validation message shows "Required: 3-5 items"

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
- **THEN** a text input accepts up to 200 characters
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
- **AND** an error message displays "Checklist requires 3-5 items"

### Requirement: Checklist Question Validation

The Template Studio SHALL validate checklist questions before save and publish.

#### Scenario: Item count validation

- **WHEN** saving or publishing a checklist question
- **THEN** the system validates 3-5 items exist
- **AND** validation fails with specific error if count is wrong

#### Scenario: Empty item text validation

- **WHEN** a checklist item has empty text
- **THEN** the item shows validation error
- **AND** the question cannot be marked complete
