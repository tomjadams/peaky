## ADDED Requirements

### Requirement: Template Detail API

The backend SHALL provide an API endpoint for retrieving full template details including all pillars and questions.

#### Scenario: Get template by ID
- **WHEN** a GET request is made to `/api/templates/:id`
- **THEN** the response includes the complete template object
- **AND** includes all pillars with their questions
- **AND** each question includes text, riskLevel, importance, leadingPractices, and helpfulLinks
- **AND** returns 404 status code if template ID does not exist

#### Scenario: Template data structure
- **WHEN** template data is returned
- **THEN** each template includes:
  - id: unique identifier
  - name: template display name
  - version: version string
  - status: 'draft' | 'active' | 'archived'
  - description: template description
  - pillars: array of TemplatePillar objects
  - createdAt: ISO 8601 timestamp
  - updatedAt: ISO 8601 timestamp
  - publishedAt: ISO 8601 timestamp (optional)

#### Scenario: Pillar data structure
- **WHEN** pillar data is returned within a template
- **THEN** each pillar includes:
  - slug: pillar identifier (e.g., 'reliability', 'security')
  - name: pillar display name
  - order: numeric ordering within template
  - questions: array of TemplateQuestion objects

#### Scenario: Question data structure
- **WHEN** question data is returned within a pillar
- **THEN** each question includes:
  - id: unique identifier
  - order: numeric ordering within pillar
  - text: question text (HTML string)
  - riskLevel: 'critical' | 'high' | 'medium' | 'low'
  - importance: why it's important text (HTML string)
  - leadingPractices: array of LeadingPractice objects with id, order, text (HTML string)
  - helpfulLinks: array of HelpfulLink objects with title, url, order

### Requirement: Template Update API

The backend SHALL provide an API endpoint for updating template content.

#### Scenario: Update template
- **WHEN** a PUT request is made to `/api/templates/:id`
- **THEN** the endpoint accepts the full template structure
- **AND** updates name, description, status, and pillars
- **AND** returns the updated template object
- **AND** updates the updatedAt timestamp
- **AND** returns 404 if template ID does not exist
- **AND** is a no-op in MVP (returns input as output)

#### Scenario: Update template questions
- **WHEN** a PUT request is made to `/api/templates/:id/questions`
- **THEN** the endpoint accepts an array of pillars with questions
- **AND** replaces all pillar/question data for the template
- **AND** preserves question order as specified
- **AND** returns the updated template
- **AND** is a no-op in MVP (returns input as output)

### Requirement: Template Creation API

The backend SHALL provide an API endpoint for creating new templates.

#### Scenario: Create new template
- **WHEN** a POST request is made to `/api/templates`
- **THEN** the endpoint creates a new template in draft status
- **AND** accepts name, description, and optional initial pillars
- **AND** generates a unique template ID
- **AND** sets createdAt and updatedAt timestamps
- **AND** returns the created template object
- **AND** is a no-op in MVP (returns generated template)

### Requirement: Template Publish API

The backend SHALL provide an API endpoint for publishing draft templates.

#### Scenario: Publish template
- **WHEN** a POST request is made to `/api/templates/:id/publish`
- **THEN** the endpoint validates all HTML content for safety (XSS prevention)
- **AND** validates character limits are respected (question text, importance, practices)
- **AND** validates required fields (name, at least one pillar, at least one question per pillar)
- **AND** changes template status from 'draft' to 'active'
- **AND** sets the publishedAt timestamp
- **AND** returns success response with published template
- **AND** is a no-op in MVP (prints payload, returns success)

#### Scenario: Publish validation errors
- **WHEN** a template fails validation during publish
- **THEN** the response includes an errors array
- **AND** each error identifies the field and issue
- **AND** the template status remains 'draft'
- **AND** returns 400 status code

#### Scenario: HTML safety validation
- **WHEN** validating HTML content
- **THEN** script tags are rejected
- **AND** XSS injection attempts are rejected
- **AND** safe HTML formatting is allowed (b, i, strong, em, ul, ol, li)
- **AND** validation errors identify unsafe content location

#### Scenario: Character limit validation
- **WHEN** validating content during publish
- **THEN** question text must not exceed 300 characters
- **AND** importance text must not exceed 800 characters
- **AND** individual leading practices must not exceed 200 characters
- **AND** validation errors indicate which field exceeds limit

### Requirement: Template Statistics API

The backend SHALL provide an API endpoint for retrieving template usage statistics.

#### Scenario: Get template stats
- **WHEN** a GET request is made to `/api/templates/:id/stats`
- **THEN** the response includes usage statistics
- **AND** includes reviewsCount: number of reviews using this template
- **AND** includes applicationsCount: number of applications with reviews using this template
- **AND** includes organizationsCount: number of organizations using this template
- **AND** returns zeros for new templates with no usage
- **AND** returns mock data in MVP

### Requirement: Templates List Enhancement

The backend SHALL enhance the templates list endpoint to include usage counts.

#### Scenario: Templates list with usage
- **WHEN** a GET request is made to `/api/templates`
- **THEN** each template includes a reviewsCount field
- **AND** the count reflects the number of active reviews using each template
- **AND** templates can be sorted by reviewsCount

### Requirement: Templates List Filtering

The templates list endpoint SHALL support filtering and usage statistics.

#### Scenario: Filter by status
- **WHEN** a GET request is made to `/api/templates?status=draft`
- **THEN** only templates with the specified status are returned
- **AND** valid status values are: draft, active, archived
- **AND** omitting status returns all templates

#### Scenario: Include usage counts
- **WHEN** templates are returned from the list endpoint
- **THEN** each template includes reviewsCount indicating usage
- **AND** counts are calculated from associated reviews
