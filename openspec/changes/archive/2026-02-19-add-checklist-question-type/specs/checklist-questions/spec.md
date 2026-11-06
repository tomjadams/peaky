> **Note:** The `specs/checklist-questions/` domain has been merged into `openspec/specs/assessment/spec.md` under the "Question Types" section. Question types are a sub-concern of the assessment domain.

# checklist-questions Specification

## Purpose

This specification covers checklist-type questions - a new question format that allows multiple selectable items per question, reducing cognitive load for templates with many yes/no questions.

## Requirements

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
- **THEN** the question MUST have between 3 and 5 checklist items
- **AND** validation fails with error if item count is outside this range

### Requirement: Checklist Question Answer Storage

The system SHALL store checklist answers as an array of checked item IDs.

#### Scenario: Checklist answer structure

- **WHEN** a user answers a checklist question
- **THEN** the answer is stored as an array of string IDs
- **AND** each ID corresponds to a checked checklist item
- **AND** an empty array indicates no items are checked

#### Scenario: Checklist N/A answer

- **WHEN** a user marks a checklist question as N/A
- **THEN** the answer value is "na"
- **AND** the N/A reason is stored in `naReason` field
- **AND** the question counts as answered in progress calculation

#### Scenario: Checklist answer clearing

- **WHEN** a user unchecks all items in a checklist
- **THEN** the answer becomes an empty array `[]`
- **AND** the question is NOT counted as answered in progress

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
- **AND** the item has a `text` field (string, max 200 characters)
- **AND** the structure matches `LeadingPractice` interface

#### Scenario: Checklist item ordering

- **WHEN** checklist items are displayed
- **THEN** items are sorted by `order` field ascending
- **AND** reordering updates the `order` values
- **AND** order is persisted on save
