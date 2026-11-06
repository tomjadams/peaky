> **Note:** The `specs/layout/` domain no longer exists. Template selector requirements now live in `openspec/specs/templates/spec.md` and `openspec/specs/assessment/spec.md`.

## ADDED Requirements

### Requirement: Template Selector Navigation

The application SHALL provide a collapsible sidebar for template and pillar navigation in the dashboard view.

#### Scenario: Template selector display

- **WHEN** viewing the dashboard (multi-question view)
- **THEN** a template selector sidebar is displayed between the main navigation and content area
- **AND** the sidebar shows the active template name, version, and status badge
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

### Requirement: Template Status Indicators

The application SHALL display visual status indicators for templates to communicate their current state.

#### Scenario: Active template badge

- **WHEN** viewing a template with ACTIVE status
- **THEN** a green badge labeled "ACTIVE" is displayed
- **AND** the badge uses appropriate color contrast for accessibility

#### Scenario: Draft template badge

- **WHEN** viewing a template with DRAFT status
- **THEN** a gray badge labeled "DRAFT" is displayed
- **AND** the template name has reduced opacity to indicate inactive state

#### Scenario: Review template badge

- **WHEN** viewing a template with REVIEW status
- **THEN** a badge labeled "REVIEW" is displayed
- **AND** the template name has reduced opacity to indicate inactive state

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
- **AND** the calculation excludes inactive questions
