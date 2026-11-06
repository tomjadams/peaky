> **Note:** The `specs/layout/` domain no longer exists. Review details page requirements now live in `openspec/specs/reviews/spec.md`.

# layout Specification Delta

## ADDED Requirements

### Requirement: Review Details Page

The application SHALL provide a dedicated page for viewing review status, progress, and metadata before entering the assessment flow.

#### Scenario: Review details header
- **WHEN** viewing the review details page
- **THEN** the page displays the review name as the main heading
- **AND** displays a badge showing the template name used
- **AND** displays a status badge (draft, in-progress, completed)
- **AND** provides a prominent "Continue Assessment" button
- **AND** includes breadcrumb navigation: "Dashboard / Applications / [App Name] / [Review Name]"

#### Scenario: Review metric cards
- **WHEN** viewing the review details page
- **THEN** metric cards are displayed with gradient borders for visual distinction
- **AND** cards show: Overall Progress (%), Actions Needed (count), Questions Answered (X of Y), Last Activity (relative date)
- **AND** Last Activity card shows who performed the last action if available
- **AND** cards match the styling of Application Details metric cards

#### Scenario: Pillars breakdown table
- **WHEN** viewing the review details page with pillars
- **THEN** a "Pillars" section displays a data table
- **AND** the table shows columns: Pillar Name, Progress, Questions (answered/total), Actions Needed
- **AND** the Progress column shows a visual progress bar with percentage
- **AND** rows are clickable for future pillar navigation
- **AND** the table uses the reusable DataTable component

#### Scenario: Pillars empty state
- **WHEN** the review has no pillars loaded
- **THEN** an appropriate empty or loading state is displayed
- **AND** the empty state uses consistent styling with other empty states

#### Scenario: Reviewers display
- **WHEN** viewing the review details page
- **THEN** assigned reviewers are displayed as an avatar group
- **AND** avatars show stacked circles with initials
- **AND** hovering reveals a tooltip or popover with full names
- **AND** if no reviewers are assigned, an appropriate empty state is shown

#### Scenario: History section placeholder
- **WHEN** viewing the review details page
- **THEN** a "History" section is displayed
- **AND** the section shows a placeholder indicating lineage features are coming
- **AND** the placeholder uses appropriate styling and iconography

#### Scenario: Continue Assessment action
- **WHEN** a user clicks "Continue Assessment"
- **THEN** the application navigates to the assessment page
- **AND** the assessment page loads with the review's current state
- **AND** the route is `/applications/:appId/reviews/:reviewId/assessment`

#### Scenario: Review details navigation
- **WHEN** clicking a review from the Application Details page
- **THEN** the application navigates to the Review Details page (not directly to assessment)
- **AND** the route is `/applications/:appId/reviews/:reviewId`

#### Scenario: Command palette integration
- **WHEN** the command palette is open on the Review Details page
- **THEN** a "Continue Assessment" command is available
- **AND** pillar jump commands are available (e.g., "Go to Security pillar")
- **AND** commands navigate appropriately

## MODIFIED Requirements

### Requirement: Application Details Page

The application SHALL navigate to Review Details when clicking a review row, instead of directly to the assessment page.

#### Scenario: Review row navigation
- **WHEN** a user clicks on a review row in the Application Details page
- **THEN** the application navigates to the Review Details page
- **AND** the route is `/applications/:appId/reviews/:reviewId`
- **AND** the user can proceed to assessment from the Review Details page
