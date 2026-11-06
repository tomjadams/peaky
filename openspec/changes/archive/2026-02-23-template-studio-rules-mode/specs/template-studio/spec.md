# template-studio Delta Specification

## MODIFIED Requirements

### Requirement: Template Studio Page

The application SHALL provide a dedicated full-screen editor for creating and editing Peaky templates with a focused, distraction-free experience.

#### Scenario: Studio layout structure

- **WHEN** viewing the Template Studio at `/templates/:id/edit`
- **THEN** the page displays a full-screen editor layout
- **AND** a collapsible left sidebar shows pillar navigation (in Questions mode)
- **AND** the main area displays the question editor for the active pillar (in Questions mode)
- **AND** the main area displays the rules canvas (in Rules mode)
- **AND** the main content is positioned vertically toward the center of the viewport (not at top)
- **AND** the layout provides comfortable editing position with content "in front of user"
- **AND** the sidebar can collapse to show only pillar icons for maximum editing space
- **AND** sidebar collapse state persists across page reloads
- **AND** space is allocated for pillar descriptions/subtitles in sidebar (implementation deferred)

#### Scenario: Studio sub-header with mode toggle

- **WHEN** viewing the Template Studio
- **THEN** the sub-header area displays a Questions/Rules toggle
- **AND** the toggle uses pill-style buttons
- **AND** "Questions" is active by default on page load
- **AND** clicking a mode switches the main content area

#### Scenario: Questions mode display

- **WHEN** Questions mode is active
- **THEN** pillar tabs are displayed in the sub-header
- **AND** the question editor is displayed in the main area
- **AND** the mode toggle shows "Questions" as active

#### Scenario: Rules mode display

- **WHEN** Rules mode is active
- **THEN** pillar tabs are hidden
- **AND** the rules canvas is displayed in the main area
- **AND** the mode toggle shows "Rules" as active
- **AND** a validation toolbar shows multi-rule warnings at the bottom

#### Scenario: Studio header display

- **WHEN** editing a template
- **THEN** the header displays the template name (editable inline)
- **AND** shows a status badge (draft, active, archived)
- **AND** shows an auto-save indicator ("Saving...", "Saved X mins ago", "Unsaved changes")
- **AND** includes "Save Draft" and "Publish" action buttons
- **AND** displays the template version

## ADDED Requirements

### Requirement: Template Rule Sets Storage

The Template data model SHALL include storage for scoring rule sets.

#### Scenario: Rule sets field

- **WHEN** a template is loaded or saved
- **THEN** the template SHALL have an optional `ruleSets` array field
- **AND** existing templates without rules SHALL have an empty array
- **AND** the field SHALL be included in template save/load operations

#### Scenario: Rule sets in template validation

- **WHEN** publishing a template
- **THEN** all rule sets SHALL be validated
- **AND** empty rule sets SHALL cause validation failure
- **AND** rules referencing deleted questions SHALL cause validation failure
