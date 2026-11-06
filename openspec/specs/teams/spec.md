# teams Specification

## Purpose

This specification covers organizations, team subjects, team details, and team-scoped review navigation. Teams are one canonical review-owning subject type alongside products and future organization subjects.

## Requirements

### Requirement: Organization Entity

The system SHALL provide a first-class Organization entity representing an organizational unit.

#### Scenario: Organization data structure

- **WHEN** retrieving Organization data
- **THEN** each Organization includes id, name, shortName (optional), and description fields
- **AND** Organizations are few and stable (sourced from LDAP eventually)
- **AND** Organizations can be listed, viewed, and have preferences set

#### Scenario: List organizations endpoint

- **WHEN** a GET request is made to `/api/orgs`
- **THEN** the response includes an array of all Organization objects
- **AND** each Organization includes id, name, shortName (if available), and description
- **AND** Organizations are sorted alphabetically by name

#### Scenario: Get organization by ID endpoint

- **WHEN** a GET request is made to `/api/orgs/:id`
- **THEN** the response includes the matching Organization object
- **AND** returns 404 if the Organization ID does not exist

#### Scenario: Organization preferences endpoints

- **WHEN** a GET request is made to `/api/orgs/:id/preferences`
- **THEN** the response includes Organization preferences for that ID
- **AND** returns 404 if the Organization ID does not exist
- **WHEN** a PATCH request is made to `/api/orgs/:id/preferences`
- **THEN** provided preference fields are validated and persisted
- **AND** returns 400 for invalid preference payloads

### Requirement: Team Entity

The system SHALL provide a Team subject that belongs to an Organization and can own reviews.

#### Scenario: Team data structure

- **WHEN** retrieving Team data
- **THEN** each Team includes id, name, orgId, orgName, and metadata fields
- **AND** metadata includes memberCount, activeReviewCount, lastActivityDate
- **AND** each Team belongs to exactly one Organization

#### Scenario: List teams endpoint

- **WHEN** a GET request is made to `/api/teams`
- **THEN** the response includes an array of all Team objects
- **AND** each Team includes its Organization name for display
- **AND** Teams are sorted alphabetically by name within their Organization

#### Scenario: Get team by ID endpoint

- **WHEN** a GET request is made to `/api/teams/:id`
- **THEN** the response includes the Team object with full metadata
- **AND** returns 404 if the Team ID does not exist

### Requirement: Teams Dashboard

The system SHALL provide a Teams Dashboard as the primary homepage view.

#### Scenario: Homepage redirect

- **WHEN** a user navigates to `/`
- **THEN** the application redirects to `/teams`

#### Scenario: Teams dashboard reads replicated local state

- **WHEN** an authenticated member opens `/teams`
- **THEN** the page reads team subjects from the local database
- **AND** background synchronization refreshes the local projection without a page-specific domain fetch

#### Scenario: Teams overview table

- **WHEN** viewing the Teams Dashboard
- **THEN** a responsive table displays all teams
- **AND** each row shows team name, Organization, active reviews count, and last activity
- **AND** the table supports sorting by name, Organization, and last activity
- **AND** each row provides explicit navigation affordances (team link and "View Team" action) to `/teams/:teamId`

#### Scenario: Teams search

- **WHEN** viewing the Teams Dashboard
- **THEN** a search bar allows fuzzy filtering of teams by name and Organization
- **AND** search results update as the user types
- **AND** empty search shows all teams

#### Scenario: Organization filter

- **WHEN** viewing the Teams Dashboard
- **THEN** an Organization selector allows filtering teams by Organization
- **AND** filters can be combined with search
- **AND** filter state is maintained during the session while navigating the app

#### Scenario: Dashboard metrics

- **WHEN** viewing the Teams Dashboard
- **THEN** metric cards display aggregate stats: Total Teams, Active Reviews, Pending Actions
- **AND** metrics update based on applied filters

#### Scenario: Dashboard empty state

- **WHEN** no teams match the current filters
- **THEN** an appropriate empty state is displayed with a message and icon

### Requirement: Team Details Page

The system SHALL provide a dedicated Team Details page showing team info and reviews.

#### Scenario: Team details header

- **WHEN** viewing the Team Details page at `/teams/:teamId`
- **THEN** the page displays the team name as heading
- **AND** displays the Organization name as a subtitle or badge
- **AND** provides a "Start New Review" button

#### Scenario: Team reviews table

- **WHEN** viewing the Team Details page
- **THEN** a table lists all reviews belonging to this team
- **AND** each review row shows name, template names, status, progress, and last updated
- **AND** clicking a review row navigates to the Review Details page
- **AND** the route for review details is `/teams/:teamId/reviews/:reviewId`

#### Scenario: Team details empty state

- **WHEN** a team has no reviews
- **THEN** an empty state displays with guidance to start a new review
- **AND** a prominent "Start New Review" CTA is shown

#### Scenario: Team details breadcrumbs

- **WHEN** viewing the Team Details page
- **THEN** breadcrumbs show: Teams / [Team Name]
- **AND** "Teams" links back to the Teams Dashboard

### Requirement: Navigation Integration

The system SHALL update the sidebar navigation to include Teams.

#### Scenario: Sidebar Teams link

- **WHEN** viewing the navigation sidebar
- **THEN** a "Teams" icon link is displayed above the existing links
- **AND** clicking it navigates to `/teams`
- **AND** it shows active state when on any `/teams/*` route

#### Scenario: Applications link preserved

- **WHEN** viewing the navigation sidebar
- **THEN** the "Applications" (Dashboard) link remains visible
- **AND** it navigates to `/applications` (the existing dashboard)

### Requirement: Team-Scoped Reviews API

The backend SHALL provide an API endpoint for retrieving reviews belonging to a team.

#### Scenario: List reviews for team

- **WHEN** a GET request is made to `/api/teams/:id/reviews`
- **THEN** the response includes an array of review objects for that team
- **AND** each review includes id, name, templateNames, status, progress, createdAt, updatedAt
- **AND** reviews are sorted by updatedAt descending

#### Scenario: Empty review list

- **WHEN** a team has no reviews
- **THEN** the API returns an empty array with 200 status
