## MODIFIED Requirements

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
  - riskLevel: 'critical' | 'high' | 'medium'
  - importance: why it's important text (HTML string)
  - leadingPractices: array of LeadingPractice objects with id, order, text (HTML string)
  - helpfulLinks: array of HelpfulLink objects with title, url, order

## REMOVED Requirements
