> **Note:** The `specs/layout/` domain no longer exists. Application details page requirements now live in `openspec/specs/applications/spec.md`.

# layout Specification Delta

## ADDED Requirements

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
- **AND** statistics use the same visual style as homepage dashboard cards
- **AND** cards include trend indicators where applicable

#### Scenario: Review list display
- **WHEN** viewing the application details page
- **THEN** all reviews for the application are displayed as cards
- **AND** reviews are sorted by most recently updated first
- **AND** each review card shows: name, template, status, progress, actions needed, last updated
- **AND** review cards are clickable and navigate to the assessment page
- **AND** archived reviews are hidden by default

#### Scenario: Review status filtering
- **WHEN** viewing the application details page
- **THEN** only active, in-progress, and completed reviews are shown by default
- **AND** a filter toggle allows showing archived reviews
- **AND** filter state is maintained during the session
- **AND** archived reviews are visually distinct when displayed

#### Scenario: Empty state
- **WHEN** an application has no reviews
- **THEN** an empty state message is displayed
- **AND** the message encourages starting a new review
- **AND** the "Start New Review" button is prominently displayed
- **AND** the empty state uses appropriate iconography

#### Scenario: Review card metrics
- **WHEN** displaying a review card
- **THEN** the card shows overall progress percentage
- **AND** shows number of pillars completed vs total pillars
- **AND** shows number of actions needed (unanswered + "No" answers)
- **AND** shows days since last update
- **AND** all metrics are clearly labeled and easy to scan

#### Scenario: Review card interaction
- **WHEN** a user clicks on a review card
- **THEN** the application navigates to the assessment page for that review
- **AND** the review ID is passed as a route parameter
- **AND** navigation uses client-side routing for optimal performance

#### Scenario: Start new review action
- **WHEN** a user clicks "Start New Review"
- **THEN** the application navigates to the template selection page
- **AND** the route is `/applications/:id/reviews/new`
- **AND** the application ID is preserved in the route

### Requirement: Template Selection Page
The application SHALL provide a page for selecting ORR templates when creating a new review.

#### Scenario: Template selection display
- **WHEN** viewing the template selection page
- **THEN** the page displays all available ORR templates
- **AND** each template shows name, description, and pillar count
- **AND** templates are displayed as selectable cards
- **AND** breadcrumb navigation shows: "Dashboard / Applications / [App Name] / New Review"

#### Scenario: Multi-template selection
- **WHEN** selecting templates
- **THEN** users can select up to 3 templates
- **AND** selected templates are visually highlighted
- **AND** attempting to select more than 3 shows a validation message
- **AND** at least one template must be selected to proceed

#### Scenario: Template selection confirmation
- **WHEN** templates are selected and user clicks "Next"
- **THEN** the application navigates to the assessment page
- **AND** the selected templates are passed as parameters
- **AND** a new review is created with the selected templates
- **AND** the review is associated with the current application

#### Scenario: Template selection cancellation
- **WHEN** a user clicks "Cancel" or back button
- **THEN** the application navigates back to the application details page
- **AND** no review is created
- **AND** no data is persisted

#### Scenario: Template card display
- **WHEN** displaying template cards
- **THEN** each card shows template name prominently
- **AND** shows a brief description of the template purpose
- **AND** shows the number of pillars included
- **AND** shows the number of questions in the template
- **AND** uses consistent styling with other card components

### Requirement: Application Details Navigation
The application SHALL provide seamless navigation between application details and related pages.

#### Scenario: Navigate from homepage
- **WHEN** a user clicks "View" on an application in the homepage table
- **THEN** the application navigates to `/applications/:id`
- **AND** the application ID is passed as a route parameter
- **AND** the page loads with application-specific data

#### Scenario: Navigate to review assessment
- **WHEN** a user clicks on a review card
- **THEN** the application navigates to the existing assessment page
- **AND** the review ID is passed to maintain context
- **AND** the assessment page displays the review's questions and progress

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

### Requirement: Review Card Component
The application SHALL provide a reusable review card component for displaying review summaries.

#### Scenario: Review card structure
- **WHEN** rendering a review card
- **THEN** the card uses semantic HTML with article element
- **AND** includes proper ARIA attributes for accessibility
- **AND** displays review name as the card heading
- **AND** shows template name as secondary information

#### Scenario: Review card status badge
- **WHEN** displaying review status
- **THEN** the card shows a status badge (draft, in-progress, completed)
- **AND** status badges use color coding consistent with application status
- **AND** draft reviews use gray styling
- **AND** in-progress reviews use blue/amber styling
- **AND** completed reviews use green styling

#### Scenario: Review card progress display
- **WHEN** displaying review progress
- **THEN** the card shows a progress bar with percentage
- **AND** shows pillar completion (e.g., "3/4 pillars complete")
- **AND** shows actions needed count with appropriate icon
- **AND** shows relative time since last update (e.g., "Updated 2 days ago")

#### Scenario: Review card hover state
- **WHEN** a user hovers over a review card
- **THEN** the card shows hover effects (shadow, border, etc.)
- **AND** the cursor changes to pointer
- **AND** the card remains accessible via keyboard navigation
- **AND** hover effects are consistent with other interactive cards

#### Scenario: Review card responsive layout
- **WHEN** viewing review cards on different screen sizes
- **THEN** cards stack vertically on mobile devices
- **AND** cards display in a grid on tablet and desktop
- **AND** card content remains readable at all breakpoints
- **AND** metrics are appropriately sized for the viewport
