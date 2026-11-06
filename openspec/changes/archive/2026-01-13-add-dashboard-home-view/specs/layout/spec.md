> **Note:** The `specs/layout/` domain no longer exists. Dashboard/home view requirements now live in `openspec/specs/applications/spec.md`.

## ADDED Requirements
### Requirement: Breadcrumb Navigation

The application SHALL provide breadcrumb navigation in the header to show the user's current location within the application hierarchy.

#### Scenario: Breadcrumb display in dashboard view
- **WHEN** viewing the dashboard home page
- **THEN** breadcrumbs display "Dashboard / Applications" 
- **AND** "Dashboard" is linked to the home page
- **AND** "Applications" is displayed as plain text (current page)
- **AND** breadcrumbs use subtle styling with proper separators

#### Scenario: Breadcrumb display in assessment view
- **WHEN** viewing the assessment page
- **THEN** breadcrumbs display "Dashboard / Assessment"
- **AND** "Dashboard" is linked to the home page
- **AND** "Assessment" is displayed as plain text (current page)
- **AND** breadcrumbs maintain consistent styling with other views

#### Scenario: Breadcrumb navigation interaction
- **WHEN** a user clicks on any breadcrumb link except the current page
- **THEN** the application navigates to the corresponding page
- **AND** the breadcrumb trail updates to reflect the new location
- **AND** navigation uses client-side routing for optimal performance

#### Scenario: Breadcrumb accessibility
- **WHEN** breadcrumbs are displayed
- **THEN** they use proper semantic HTML with nav element and aria-label
- **AND** each breadcrumb link has descriptive text
- **AND** the current page breadcrumb has aria-current="page"
- **AND** keyboard navigation is supported for all breadcrumb links

### Requirement: Dashboard Home View

The application SHALL provide a comprehensive dashboard home view that displays an overview of all enterprise applications and their operational readiness status.

#### Scenario: Application overview table
- **WHEN** viewing the dashboard home page
- **THEN** a responsive table displays all enterprise applications
- **AND** each row shows application name, status, owner, and last updated
- **AND** status indicators use color coding based on application status
- **AND** the table supports sorting by name, status, and last updated

#### Scenario: Application fuzzy search
- **WHEN** viewing the dashboard home page
- **THEN** a search bar allows fuzzy filtering of applications by name
- **AND** search results update as the user types
- **AND** matching text is highlighted in results
- **AND** empty search shows all applications

#### Scenario: Application status filtering
- **WHEN** viewing the dashboard home page
- **THEN** status filter buttons show applications by readiness status
- **AND** filters include "In Progress", "Action needed", and "Ready"
- **AND** filters can be combined with search for refined results
- **AND** filter state is maintained during the session

#### Scenario: Application actions
- **WHEN** hovering over application rows
- **THEN** action buttons appear for viewing details and editing
- **AND** clicking "View" navigates to the application's assessment page
- **AND** clicking "Edit" opens the application configuration modal
- **AND** actions are accessible via keyboard navigation

#### Scenario: Responsive dashboard layout
- **WHEN** viewing the dashboard on different screen sizes
- **THEN** the layout adapts appropriately for mobile, tablet, and desktop
- **AND** the application table becomes scrollable on smaller screens
- **AND** filtering controls stack vertically on mobile devices
- **AND** all functionality remains accessible across screen sizes

#### Scenario: Dashboard header integration
- **WHEN** viewing the dashboard home page
- **THEN** the header displays breadcrumb navigation
- **AND** the page title shows "Application Dashboard"
- **AND** a subtitle provides context about operational readiness
- **AND** notification icons display system alerts if present

### Requirement: Application Status Management

The dashboard SHALL provide visual indicators and management tools for application operational readiness status.

#### Scenario: Status color coding
- **WHEN** displaying application status
- **THEN** "Ready" applications show green status indicators
- **AND** "In Progress" applications show yellow/amber status indicators
- **AND** "Action needed" applications show red status indicators

#### Scenario: Status progress details
- **WHEN** viewing an application's status
- **THEN** a progress bar shows completion percentage
- **AND** hover tooltips display specific completion metrics
- **AND** the status includes the number of completed checks
- **AND** last updated timestamp shows recent activity

#### Scenario: Bulk selection
- **WHEN** viewing the application table
- **THEN** each row has a checkbox for selection
- **AND** a header checkbox selects/deselects all visible applications
- **AND** selected count is displayed in the bulk action bar

#### Scenario: Bulk actions
- **WHEN** multiple applications are selected
- **THEN** a bulk action bar appears with available operations
- **AND** users can batch delete selected applications
- **AND** users can batch transfer ownership of selected applications
- **AND** users can batch archive selected applications
- **AND** backend operations are no-ops until data model is finalized

### Requirement: Command Palette

The application SHALL provide a reusable command palette component for quick navigation and action execution across all views.

#### Scenario: Command palette activation
- **WHEN** a user presses Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- **THEN** the command palette modal opens
- **AND** focus is automatically placed in the search input
- **AND** the palette displays recent commands or suggestions

#### Scenario: Command palette search
- **WHEN** the command palette is open and user types
- **THEN** results are filtered based on fuzzy matching
- **AND** results include pages, headings, and available actions
- **AND** each result shows an icon, title, and optional shortcut
- **AND** results are grouped by category (Navigation, Actions, etc.)

#### Scenario: Command palette navigation
- **WHEN** a user selects a navigation item from the palette
- **THEN** the application navigates to the selected page
- **AND** the command palette closes
- **AND** the selected page receives focus

#### Scenario: Command palette actions
- **WHEN** a user selects an action from the palette
- **THEN** the action is executed
- **AND** appropriate feedback is shown (toast, modal, etc.)
- **AND** the command palette closes after action execution

#### Scenario: Command palette keyboard navigation
- **WHEN** the command palette is open
- **THEN** arrow keys navigate between results
- **AND** Enter selects the highlighted result
- **AND** Escape closes the palette without action
- **AND** Tab cycles through interactive elements

#### Scenario: Command palette styling
- **WHEN** the command palette is displayed
- **THEN** it uses NuxtUI CommandPalette as the base component
- **AND** styling matches the application's current theme (light/dark)
- **AND** the component is encapsulated in AppCommandPalette.vue for reuse

### Requirement: Applications API

The backend SHALL provide an API endpoint for retrieving application data.

#### Scenario: List applications endpoint
- **WHEN** a GET request is made to /api/applications
- **THEN** the response includes an array of application objects
- **AND** each application has id, name, status, owner, and lastUpdated fields
- **AND** status values are one of: "in_progress", "action_needed", "ready"

#### Scenario: Application data structure
- **WHEN** application data is returned
- **THEN** each application includes:
  - id: unique identifier
  - name: application display name
  - status: current readiness status
  - owner: responsible team or individual
  - lastUpdated: ISO 8601 timestamp
  - progress: completion percentage (0-100)

#### Scenario: Bulk action endpoints
- **WHEN** POST requests are made to /api/applications/bulk/{action}
- **THEN** the endpoint accepts an array of application IDs
- **AND** valid actions are: delete, transfer, archive
- **AND** the endpoint returns success without side effects (no-op)
- **AND** response includes confirmation message for UI feedback
