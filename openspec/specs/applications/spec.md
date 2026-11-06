# applications Specification

## Purpose

This specification covers enterprise applications as catalog components and compatibility projections used for navigation, review scope, and readiness context. Applications can contribute to a team or product review but are not canonical review-owning subjects.

## Requirements

### Requirement: Applications Dashboard View

The application SHALL provide a comprehensive dashboard home view that displays an overview of all enterprise applications and their operational readiness status.

#### Scenario: Application overview table

- **WHEN** viewing the Applications page at `/applications`
- **THEN** a responsive table displays all enterprise applications
- **AND** each row shows application name, status, owner, and last updated
- **AND** status indicators use color coding based on application status
- **AND** the table supports sorting by name, status, and last updated

#### Scenario: Application fuzzy search

- **WHEN** viewing the Applications page at `/applications`
- **THEN** a search bar allows fuzzy filtering of applications by name
- **AND** search results update as the user types
- **AND** matching text is highlighted in results
- **AND** empty search shows all applications

#### Scenario: Application status filtering

- **WHEN** viewing the Applications page at `/applications`
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

- **WHEN** viewing the Applications page at `/applications`
- **THEN** the header displays breadcrumb navigation
- **AND** the page title shows "Applications"
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

### Requirement: Applications Compatibility API

The backend SHALL retain a read-only compatibility API for retrieving
application catalog data while canonical subject state reaches member-facing
pages through synchronization.

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

### Requirement: Application Details Page

The application SHALL navigate to Review Details when clicking a review row, instead of directly to the assessment page.

#### Scenario: Review row navigation

- **WHEN** a user clicks on a review row in the Application Details page
- **THEN** the application navigates to the Review Details page
- **AND** the route is `/applications/:appId/reviews/:reviewId`
- **AND** the user can proceed to assessment from the Review Details page

### Requirement: Application Details Navigation

The application SHALL provide seamless navigation between application details and related pages.

#### Scenario: Navigate from homepage

- **WHEN** a user clicks "View" on an application in the homepage table
- **THEN** the application navigates to `/applications/:id`
- **AND** the application ID is passed as a route parameter
- **AND** the page loads with application-specific data

#### Scenario: Navigate to review details

- **WHEN** a user clicks on a review card
- **THEN** the application navigates to `/applications/:appId/reviews/:reviewId`
- **AND** the application and review IDs preserve the route context
- **AND** the user can proceed to assessment from Review Details

#### Scenario: Navigate to template selection

- **WHEN** a user clicks "Start New Review"
- **THEN** the application navigates to `/applications/:id/reviews/new`
- **AND** the application context is preserved
- **AND** the template selection page loads with available templates

#### Scenario: Breadcrumb navigation

- **WHEN** viewing application details or template selection pages
- **THEN** breadcrumbs show the full navigation path
- **AND** each breadcrumb segment is clickable (except current page)
- **AND** clicking a breadcrumb navigates to that page
- **AND** breadcrumbs use semantic HTML with proper ARIA attributes

### Requirement: Application Details Compatibility API

The backend MUST retain a read-only compatibility endpoint for retrieving
detailed information about a specific application.

#### Scenario: Get application by ID

- **WHEN** a GET request is made to `/api/applications/:id`
- **THEN** the response includes the application object with all metadata
- **AND** includes id, name, status, owner, lastUpdated, and progress fields
- **AND** returns 404 status code if application ID does not exist
- **AND** returns appropriate error messages for invalid requests

### Requirement: Application-Scoped Reviews Compatibility API

The backend MUST retain a read-only compatibility endpoint for retrieving
reviews associated with a specific application context.

#### Scenario: List reviews for application

- **WHEN** a GET request is made to `/api/applications/:id/reviews`
- **THEN** the response includes an array of review objects for that application
- **AND** each review includes id, name, templateId, templateName, status, createdAt, updatedAt, and pillars
- **AND** reviews are filtered to exclude archived status by default
- **AND** reviews are sorted by updatedAt in descending order (most recent first)

#### Scenario: Include archived reviews

- **WHEN** a GET request is made to `/api/applications/:id/reviews?includeArchived=true`
- **THEN** the response includes all reviews including those with archived status
- **AND** archived reviews are clearly marked in the response

#### Scenario: Review progress metrics

- **WHEN** review data is returned
- **THEN** each review includes calculated progress metrics
- **AND** metrics include overall completion percentage
- **AND** metrics include number of pillars completed
- **AND** metrics include number of actions needed (derived from unanswered + "No" answers)
- **AND** metrics include days since last update

#### Scenario: Empty review list

- **WHEN** an application has no reviews
- **THEN** the API returns an empty array
- **AND** returns 200 status code with empty array (not 404)
