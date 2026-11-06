> **Note:** The `specs/backend/` domain no longer exists. Backend and data-fetching patterns now live in `openspec/specs/common-ui/spec.md` (Nitro/data layer patterns) and `openspec/specs/local-first/spec.md` (local-first data architecture).

# Backend API Specification

## ADDED Requirements

### Requirement: Nitro Server API
The application MUST implement a backend API using Nitro server to serve data to frontend components.

#### Scenario: API directory structure
- **WHEN** implementing the backend API
- **THEN** the application follows Nuxt conventions with a `server/` directory
- **AND** API endpoints are organized under `server/api/`
- **AND** utility functions are placed in `server/utils/`
- **AND** mock data files are stored in `server/data/`

#### Scenario: Question data endpoint
- **WHEN** a client requests question data
- **THEN** the API returns structured question data in JSON format
- **AND** includes question text, type, and other relevant metadata
- **AND** returns appropriate HTTP status codes
- **AND** handles error cases gracefully

#### Scenario: Question information endpoint
- **WHEN** a client requests additional information for a specific question
- **THEN** the API returns detailed information including importance context
- **AND** includes leading practices as a structured list
- **AND** includes helpful resources with URLs
- **AND** uses proper error handling for invalid question IDs

#### Scenario: Template options endpoint
- **WHEN** a client requests available template options
- **THEN** the API returns a list of available templates
- **AND** includes template name, description, and ID
- **AND** structures the response in a consistent JSON format

#### Scenario: Pillar data endpoint
- **WHEN** a client requests data for a specific pillar
- **THEN** the API returns all questions associated with that pillar
- **AND** includes pillar metadata (name, progress, etc.)
- **AND** supports filtering and pagination
- **AND** returns appropriate HTTP status codes

### Requirement: Data Fetching Patterns
The application MUST implement consistent data fetching patterns using Nuxt composables.

#### Scenario: Question data fetching
- **WHEN** a component needs to display question data
- **THEN** it uses a dedicated composable for fetching question data
- **AND** the composable handles loading states
- **AND** the composable handles error states
- **AND** the composable leverages Nuxt's built-in caching

#### Scenario: Error handling
- **WHEN** an API request fails
- **THEN** the application displays an appropriate error message
- **AND** provides retry functionality when appropriate
- **AND** logs detailed error information for debugging
- **AND** gracefully degrades the UI to maintain usability

#### Scenario: Loading states
- **WHEN** data is being fetched from the API
- **THEN** the application displays appropriate loading indicators
- **AND** prevents premature user interaction with loading content
- **AND** maintains accessibility during loading states

### Requirement: Multi-Pillar Support
The application MUST provide comprehensive data for all pillars (Security, Infrastructure, Reliability, and Operations).

#### Scenario: Security pillar data
- **WHEN** a client requests Security pillar data
- **THEN** the API returns all Security-related questions and information
- **AND** includes appropriate metadata for the Security pillar

#### Scenario: Infrastructure pillar data
- **WHEN** a client requests Infrastructure pillar data
- **THEN** the API returns all Infrastructure-related questions and information
- **AND** includes appropriate metadata for the Infrastructure pillar

#### Scenario: Reliability pillar data
- **WHEN** a client requests Reliability pillar data
- **THEN** the API returns all Reliability-related questions and information
- **AND** includes appropriate metadata for the Reliability pillar

#### Scenario: Operations pillar data
- **WHEN** a client requests Operations pillar data
- **THEN** the API returns all Operations-related questions and information
- **AND** includes appropriate metadata for the Operations pillar

### Requirement: Review-Centric Architecture
The application MUST use a review-centric approach for data organization and routing.

#### Scenario: Review-based URL structure
- **WHEN** implementing URL routing
- **THEN** the application uses `/review/:id` as the primary route pattern
- **AND** all pillar and question data is scoped to the specific review
- **AND** handles invalid review IDs gracefully

#### Scenario: Review data endpoint
- **WHEN** a client requests data for a specific review
- **THEN** the API returns the review details including template information
- **AND** includes metadata about the review (status, progress, etc.)
- **AND** returns appropriate HTTP status codes

#### Scenario: Review pillar relationship
- **WHEN** a client requests pillar data within an review
- **THEN** the API returns pillar data specific to that review
- **AND** includes review-specific progress for each pillar
- **AND** maintains the relationship between review, template, and pillars

### Requirement: Deep Linking Support
The application MUST support deep linking to specific reviews, pillars, and questions.

#### Scenario: Review deep linking
- **WHEN** a user navigates to a URL with an review ID parameter
- **THEN** the application loads the specified review
- **AND** displays the review's data and associated pillars
- **AND** handles invalid review IDs gracefully

#### Scenario: Pillar deep linking
- **WHEN** a user navigates to a URL with review and pillar parameters
- **THEN** the application loads the specified review and activates the specified pillar
- **AND** displays the questions for that pillar within the review context
- **AND** handles invalid pillar IDs gracefully

#### Scenario: Question deep linking
- **WHEN** a user navigates to a URL with review, pillar, and question parameters
- **THEN** the application loads the specified review, pillar, and scrolls to the specified question
- **AND** may highlight or focus the specified question
- **AND** handles invalid question IDs gracefully
