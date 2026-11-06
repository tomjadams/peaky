> **Note:** The `specs/layout/` domain no longer exists. Question info sidebar requirements now live in `openspec/specs/assessment/spec.md`.

## ADDED Requirements

### Requirement: Question Information Access

The application SHALL provide access to additional information for each question including importance context, leading practices, and helpful resources.

#### Scenario: Info icon display

- **WHEN** viewing questions in either survey or multi-question view
- **THEN** each question displays a subtle information (i) icon
- **AND** the icon is positioned with appropriate spacing from the question text
- **AND** the icon is aligned with the first line of multi-line questions

#### Scenario: Sidebar information display

- **WHEN** a user clicks on a question's information icon
- **THEN** the right sidebar opens with question-specific information
- **AND** the sidebar displays "Why is this important?" section with descriptive text
- **AND** the sidebar displays "Leading practices" section as a list of items
- **AND** the sidebar displays "Helpful links" section with external link indicators

#### Scenario: Sidebar control

- **WHEN** content components need to control sidebar visibility
- **THEN** the layout uses shared state management instead of local control
- **AND** any component can open or close the sidebar programmatically
- **AND** the sidebar displays content appropriate to the triggering question

## MODIFIED Requirements

### Requirement: Semantic HTML Structure

The application MUST use semantic HTML elements to improve accessibility and document structure.

#### Scenario: Semantic layout elements

- **WHEN** rendering page layouts
- **THEN** the application uses `<main>` for primary content areas
- **AND** uses `<section>` for distinct content sections with appropriate `aria-label` attributes
- **AND** uses `<article>` for individual content items (questions, survey content)
- **AND** uses `<nav>` for navigation areas with descriptive `aria-label` attributes
- **AND** uses `<fieldset>` and `<legend>` for grouping related form controls
- **AND** uses `<aside>` for the right sidebar with proper accessibility attributes

#### Scenario: ARIA accessibility attributes

- **WHEN** rendering interactive elements
- **THEN** buttons include appropriate `type="button"` attributes
- **AND** progress bars include `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`
- **AND** expandable elements include `aria-expanded` states
- **AND** decorative icons include `aria-hidden="true"`
- **AND** screen reader content uses `sr-only` classes where appropriate
- **AND** information icons include `aria-label="Get more information about this question"`
- **AND** the sidebar includes `role="complementary"` and `aria-label="Question information"`
