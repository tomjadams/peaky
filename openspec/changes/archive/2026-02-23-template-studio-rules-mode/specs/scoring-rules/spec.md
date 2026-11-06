> **Note:** The `specs/scoring-rules/` domain has been renamed to `openspec/specs/maturity-score/spec.md`. The domain name better reflects the full bounded context: weighted scoring, thresholds, and rule-based actions.

# scoring-rules Specification

## Purpose

This specification covers Scoring Rules - the system for defining conditional logic that triggers actions based on question answer patterns in templates. Template authors use a visual canvas to create rule sets that combine multiple questions with AND/OR logic.

## Requirements

### Requirement: Rule Set Data Model

The system SHALL store rule sets as part of the template data structure with support for multiple trigger types and grouped conditions.

#### Scenario: Rule set structure

- **WHEN** a rule set is created
- **THEN** it SHALL have a unique identifier
- **AND** it SHALL have a name (user-defined)
- **AND** it SHALL have a trigger type ('all', 'any', or 'multiple')
- **AND** it SHALL have conditions (for 'all'/'any' triggers)
- **AND** it SHALL have condition groups (for 'multiple' trigger)
- **AND** it SHALL have an action to trigger when conditions are met
- **AND** it SHALL have canvas position coordinates for visual layout

#### Scenario: Rule condition structure

- **WHEN** a condition is added to a rule set or group
- **THEN** it SHALL reference a question by ID
- **AND** it SHALL specify the trigger answer ('no' for MVP)

#### Scenario: Condition group structure (for 'multiple' trigger)

- **WHEN** a condition group is created
- **THEN** it SHALL have a unique identifier
- **AND** it SHALL have a logic type ('and' or 'or')
- **AND** it SHALL have one or more conditions

#### Scenario: Rule action structure

- **WHEN** an action is defined for a rule set
- **THEN** it SHALL have a type identifier ('escalate_review' or 'notify_advisor')
- **AND** it MAY have an optional comment for context
- **AND** the UI SHALL display an action dropdown (future-proofed for more types)

### Requirement: Rules Mode Navigation

The Template Studio SHALL provide navigation between Questions mode and Rules mode via separate pages.

#### Scenario: Questions mode page

- **WHEN** viewing Template Studio at `/templates/:id/edit`
- **THEN** the Questions mode SHALL be active
- **AND** pillar tabs SHALL be visible
- **AND** the question editor SHALL be displayed

#### Scenario: Rules mode page

- **WHEN** viewing Template Studio at `/templates/:id/edit/rules`
- **THEN** the Rules mode SHALL be active
- **AND** pillar tabs SHALL be hidden (rules are cross-pillar)
- **AND** the rules canvas SHALL be displayed
- **AND** a navigation button in the header SHALL link back to Questions mode

#### Scenario: Mode navigation

- **WHEN** user clicks the mode navigation button
- **THEN** the browser SHALL navigate to the other mode's URL
- **AND** unsaved changes SHALL be preserved (auto-save)
- **AND** the URL SHALL be shareable for direct access

### Requirement: Rules Canvas

The Template Studio SHALL provide a visual canvas for creating and editing rule sets using Vue Flow.

#### Scenario: Canvas layout

- **WHEN** Rules mode is active
- **THEN** the canvas SHALL fill the main content area
- **AND** a question sidebar SHALL appear on the left (fixed width 288px)
- **AND** the canvas SHALL display a dot pattern background
- **AND** zoom controls SHALL appear in the bottom-right corner

#### Scenario: Canvas interactions

- **WHEN** interacting with the canvas
- **THEN** the user SHALL be able to pan by dragging empty space
- **AND** the user SHALL be able to zoom using mouse wheel or controls
- **AND** the user SHALL be able to select nodes by clicking
- **AND** the user SHALL be able to delete selected nodes with Delete/Backspace key

### Requirement: Question Sidebar

The Rules canvas SHALL display a sidebar listing all template questions for drag-and-drop.

#### Scenario: Sidebar content

- **WHEN** viewing the question sidebar
- **THEN** all questions from all pillars SHALL be listed
- **AND** each question SHALL show its slug ID (e.g., "SEC-1")
- **AND** each question SHALL show abbreviated text
- **AND** each question SHALL show its pillar badge

#### Scenario: Sidebar filtering

- **WHEN** using sidebar filters
- **THEN** a pillar dropdown SHALL filter questions by pillar
- **AND** "All" option SHALL show questions from all pillars
- **AND** a search input SHALL filter questions by text content

#### Scenario: Question drag operation

- **WHEN** dragging a question from the sidebar
- **THEN** a ghost preview SHALL follow the cursor
- **AND** dropping on the canvas SHALL create a question node
- **AND** dropping on a rule set node SHALL add the question to that rule

### Requirement: Rule Set Node

The canvas SHALL display rule sets as container nodes that hold question conditions.

#### Scenario: Rule set node display

- **WHEN** a rule set node is rendered
- **THEN** it SHALL display the rule name (editable)
- **AND** it SHALL display a logic selector dropdown (AND/OR)
- **AND** it SHALL display contained question nodes
- **AND** it SHALL display an action selector dropdown
- **AND** it SHALL have a colored left border indicating action type

#### Scenario: Adding questions to rule set

- **WHEN** a question is dropped onto a rule set
- **THEN** the question SHALL be added as a condition
- **AND** the condition trigger SHALL default to 'no'
- **AND** the question node SHALL appear inside the rule set container

#### Scenario: Removing questions from rule set

- **WHEN** a question node is deleted from a rule set
- **THEN** the condition SHALL be removed
- **AND** the rule set SHALL remain (even if empty, until validated)

#### Scenario: Creating new rule set

- **WHEN** user clicks "Add Rule Set" button on canvas
- **THEN** a new rule set node SHALL be created at viewport center
- **AND** the node SHALL have default name "New Rule"
- **AND** the node SHALL have default logic "and"
- **AND** the node SHALL have default action "advisor_needed"

### Requirement: Multi-Rule Question Detection

The system SHALL warn when a question appears in multiple rule sets.

#### Scenario: Warning badge display

- **WHEN** a question appears in 2 or more rule sets
- **THEN** the question SHALL display a warning badge (⚠️) in the sidebar
- **AND** hovering the badge SHALL show tooltip text
- **AND** the tooltip SHALL say "This question triggers N rules. Consider increasing its criticality level."

#### Scenario: Warning clears when reduced

- **WHEN** a question is removed from rules until it appears in only 1 or 0 rules
- **THEN** the warning badge SHALL be removed

### Requirement: Rule Validation

The Template Studio SHALL validate rules with real-time feedback.

#### Scenario: Multi-rule warnings

- **WHEN** a question appears in 2 or more rule sets
- **THEN** the sidebar SHALL show a warning badge (⚠️) on the question
- **AND** the Rules page toolbar SHALL show a warning count
- **AND** clicking the warning SHALL show affected questions

#### Scenario: Comment validation

- **WHEN** a rule action comment exceeds the character limit
- **THEN** the textarea SHALL show a red border
- **AND** the character count SHALL be displayed

#### Scenario: Empty group validation

- **WHEN** a condition group has no conditions
- **THEN** the group SHALL show a warning state

#### Scenario: Missing question validation

- **WHEN** a rule references a deleted question
- **THEN** validation SHALL fail with an error message

#### Scenario: Publish validation integration

- **WHEN** publishing a template with invalid rules
- **THEN** publish SHALL be blocked
- **AND** rule validation errors SHALL be shown in publish dialog

### Requirement: Rule Persistence

Rule sets SHALL be saved and loaded with the template.

#### Scenario: Auto-save behavior

- **WHEN** rule sets are modified
- **THEN** changes SHALL trigger template auto-save
- **AND** save status indicator SHALL update accordingly

#### Scenario: Template load with rules

- **WHEN** loading a template that has rule sets
- **THEN** the canvas SHALL restore all rule set nodes
- **AND** nodes SHALL be positioned according to saved coordinates
- **AND** all conditions and actions SHALL be restored
