## MODIFIED Requirements

### Requirement: Exact Cross-Review Rollups

The system SHALL support cross-Review rollups using exact Template Revision and Revision-specific Question identity and SHALL avoid fuzzy or cross-Revision similarity grouping.
**ID:** REQ-003

#### Scenario: Exact repeated item detection

- **WHEN** multiple Reviews use the same Template Revision and Question row
- **THEN** the rollup groups them only when `templateRevisionId` and `questionId` match exactly
- **AND** the grouped item shows each contributing Review and subject
- **AND** equivalent text from another Revision or Template remains separate
- **ID:** AC-010

#### Scenario: Source context display

- **WHEN** a rollup is displayed
- **THEN** it shows Template, Revision number, Pillar, Question ID, Review, and subject context
- **AND** the user can drill into the source assessment Question
- **AND** the UI identifies whether contributors come from Product-level, application-linked, or Team-owned Reviews
- **ID:** AC-011

#### Scenario: Many contributing Reviews

- **WHEN** a repeated item appears in more than three contributing Reviews
- **THEN** the first contributing Review links appear inline
- **AND** remaining Reviews are available through a `+N more` dropdown
- **AND** each item opens the exact Revision Question in a new tab
- **ID:** AC-012

### Requirement: Team Improvement Plan

The application SHALL provide a Team-level Improvement Plan that rolls up exact Revision-specific attention items across Reviews for one Team.
**ID:** REQ-004

#### Scenario: Team plan route

- **WHEN** a user opens `/teams/:teamId/plan`
- **THEN** the page title is `Improvement Plan`
- **AND** the Team Details page links to the Team plan
- **ID:** AC-013

#### Scenario: Team rollup contributors

- **WHEN** active Team Reviews contribute attention items
- **THEN** items group only when Template Revision and Question row identities match exactly
- **AND** each contributor link opens the source assessment Question
- **ID:** AC-014

### Requirement: Product Cross-Review Rollups

The Product plan SHALL aggregate exact repeated plan items across contributing Reviews by Revision-specific identity.
**ID:** REQ-002

#### Scenario: Exact Product rollup grouping

- **WHEN** the same Revision Question appears in multiple contributing Reviews
- **THEN** the Product plan groups it only when `templateRevisionId` and `questionId` match exactly
- **AND** the grouped item lists each source Review and contributor
- **AND** similar wording from another Revision or Template remains separate
- **ID:** AC-007

#### Scenario: Product rollup drilldown

- **WHEN** a user selects a repeated Product-plan item
- **THEN** the user can see which Product-level Reviews, applications, or Teams contributed
- **AND** each source link opens the exact Revision Question
- **ID:** AC-008

#### Scenario: Many source contributors

- **WHEN** a repeated item appears in many contributing Reviews
- **THEN** only the first source links are shown inline
- **AND** remaining source links are available from a `+N more` dropdown
- **AND** each link opens the exact Revision Question in a new tab
- **ID:** AC-009
