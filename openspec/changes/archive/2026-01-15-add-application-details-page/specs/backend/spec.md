> **Note:** The `specs/backend/` domain no longer exists. Backend requirements from this change now live in `openspec/specs/applications/spec.md`.

# backend Specification Delta

## ADDED Requirements

### Requirement: Application Details API
The backend MUST provide an API endpoint for retrieving detailed information about a specific application.

#### Scenario: Get application by ID
- **WHEN** a GET request is made to `/api/applications/:id`
- **THEN** the response includes the application object with all metadata
- **AND** includes id, name, status, owner, lastUpdated, and progress fields
- **AND** returns 404 status code if application ID does not exist
- **AND** returns appropriate error messages for invalid requests

### Requirement: Application-Scoped Reviews API
The backend MUST provide an API endpoint for retrieving all reviews associated with a specific application.

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

### Requirement: Review-Application Relationship
The application MUST enforce a one-to-one relationship between reviews and applications.

#### Scenario: Review data model
- **WHEN** storing or retrieving review data
- **THEN** each review includes an applicationId field
- **AND** the applicationId references a valid application
- **AND** reviews are scoped to a single application

#### Scenario: Review creation
- **WHEN** creating a new review
- **THEN** the review MUST be associated with exactly one application
- **AND** the applicationId is required and validated
- **AND** multiple reviews can be associated with the same application

### Requirement: Actions Needed Calculation
The backend MUST calculate the number of actions needed based on assessment answers.

#### Scenario: Actions from unanswered questions
- **WHEN** calculating actions needed for a review
- **THEN** each unanswered question counts as one action needed
- **AND** questions marked as "Not Applicable" do not count as actions needed

#### Scenario: Actions from negative answers
- **WHEN** calculating actions needed for a review
- **THEN** each question answered "No" counts as one action needed
- **AND** the total actions needed is the sum of unanswered + "No" answers
- **AND** the calculation excludes inactive questions
