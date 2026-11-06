> **Note:** The `specs/layout/` domain no longer exists. App details page requirements now live in `openspec/specs/applications/spec.md`.

# layout Specification Delta

## MODIFIED Requirements

### Requirement: Application Details Page
The application SHALL provide a dedicated page for viewing and managing all reviews associated with a specific application.

#### Scenario: Application details header
- **WHEN** viewing the application details page
- **THEN** the page displays the application name as the main heading
- **AND** displays application metadata (owner, status, last updated)
- **AND** includes breadcrumb navigation: "Dashboard / Applications / [Application Name]"
- **AND** provides a "Start New Review" button in the header

#### Scenario: Application summary statistics
- **WHEN** viewing the application details page
- **THEN** summary statistics cards are displayed at the top
- **AND** cards show: total reviews, active reviews, and average completion rate
- **AND** cards have a subtle gradient border (indigo/purple) for visual distinction
- **AND** gradient border is more subtle in light mode, slightly more visible in dark mode
- **AND** cards include trend indicators where applicable

#### Scenario: Reviews table display
- **WHEN** viewing the application details page with reviews
- **THEN** reviews are displayed in a data table instead of cards
- **AND** the table includes columns: Name, Template, Status, Progress, Actions Needed, Last Updated
- **AND** each row is clickable and navigates to the assessment page
- **AND** the table supports sorting by clicking column headers
- **AND** archived reviews are hidden by default

#### Scenario: Reviews table search and filtering
- **WHEN** viewing the reviews table
- **THEN** a search input allows filtering reviews by name or template
- **AND** a status filter allows showing reviews by status (All, Draft, In Progress, Completed)
- **AND** search and status filters can be combined
- **AND** filter state is maintained during the session

#### Scenario: Reviews table columns
- **WHEN** displaying the reviews table
- **THEN** the Name column shows review name and is the primary identifier
- **AND** the Template column shows the template name used
- **AND** the Status column shows a color-coded badge (draft=gray, in-progress=blue, completed=green)
- **AND** the Progress column shows a visual progress bar with percentage
- **AND** the Actions column shows count of items needing attention
- **AND** the Last Updated column shows relative time (e.g., "2 days ago")

#### Scenario: Reviews table sorting
- **WHEN** a user clicks on a sortable column header
- **THEN** the table sorts by that column
- **AND** clicking again reverses the sort direction
- **AND** a visual indicator shows the current sort column and direction
- **AND** default sort is by Last Updated descending

#### Scenario: Reviews table row actions
- **WHEN** viewing a row in the reviews table
- **THEN** clicking the row navigates to the assessment page
- **AND** hover state provides visual feedback
- **AND** keyboard navigation is supported (Enter to select)

#### Scenario: Empty state
- **WHEN** an application has no reviews
- **THEN** an empty state message is displayed within the table area
- **AND** the message encourages starting a new review
- **AND** the "Start New Review" button is prominently displayed
- **AND** the empty state uses appropriate iconography

#### Scenario: Section pattern
- **WHEN** displaying content sections on the page (Reviews, future Reports)
- **THEN** each section has a consistent header with title
- **AND** sections may include an optional action button in the header
- **AND** sections may include a toolbar with search/filter controls
- **AND** the pattern is reusable for future sections (e.g., Reports)

## ADDED Requirements

### Requirement: Reusable DataTable Component

The application SHALL provide a reusable data table component for displaying collections of items with consistent UX patterns.

#### Scenario: Column configuration
- **WHEN** using the DataTable component
- **THEN** columns are configured via a props array with `key`, `label`, `sortable`, and `type`
- **AND** supported column types include: text, status, progress, avatar-group, date, actions
- **AND** custom cell rendering is supported via scoped slots

#### Scenario: Status column type
- **WHEN** a column is configured with type `status`
- **THEN** the cell displays a color-coded badge
- **AND** badge colors are configurable per status value
- **AND** common statuses use consistent colors (draft=gray, in-progress=blue, completed=green)

#### Scenario: Progress column type
- **WHEN** a column is configured with type `progress`
- **THEN** the cell displays a progress bar with percentage text
- **AND** the progress bar uses the primary color
- **AND** accessibility attributes are included (role, aria-valuenow)

#### Scenario: Avatar group column type
- **WHEN** a column is configured with type `avatar-group`
- **THEN** the cell displays stacked circular avatars with initials
- **AND** avatars beyond the display limit are shown as "+N" indicator
- **AND** hovering reveals a tooltip or popover with all names
- **AND** each avatar uses a consistent color based on the name

#### Scenario: Date column type
- **WHEN** a column is configured with type `date`
- **THEN** the cell displays relative time (e.g., "2 days ago")
- **AND** hovering shows the full date/time

#### Scenario: Sortable columns
- **WHEN** a column is configured as sortable
- **THEN** clicking the column header sorts the table
- **AND** clicking again reverses the sort direction
- **AND** a visual indicator shows current sort column and direction

#### Scenario: Selectable rows
- **WHEN** the DataTable is configured with `selectable` prop
- **THEN** a checkbox column is displayed as the first column
- **AND** a header checkbox toggles all visible rows
- **AND** selected row IDs are emitted via events

#### Scenario: Clickable rows
- **WHEN** the DataTable is configured with `clickable-rows` prop
- **THEN** clicking a row emits a row-click event with the row data
- **AND** rows show hover state indicating interactivity
- **AND** keyboard navigation is supported (Enter to select)

## REMOVED Requirements

### Requirement: Review Card Component
*This requirement is removed as reviews are now displayed in a table format. The ReviewCard component may be deprecated or repurposed for other contexts.*
