# Reviews Specification

## MODIFIED Requirements

### Requirement: Review Workspace Projection

The backend and client-local repository SHALL hydrate a Review from its exact selected Revision snapshots.
**ID:** REQ-006

#### Scenario: Workspace returns assessment-ready Review state

- **WHEN** a Review workspace is requested
- **THEN** it includes Review/subject metadata, ordered selected Revision snapshots, answers, notes, attachment metadata, capabilities, and readiness/maturity details
- **AND** it uses no fabricated Revision IDs or mutable Template metadata
- **AND** the initial workspace does not require separate reads for Pillars, Questions, answers, or permissions
- **ID:** AC-018

#### Scenario: Workspace projection remains valid for local-first reads

- **WHEN** a Review and exact selection rows exist locally
- **THEN** the assessment rehydrates from SQLite using exact Revision IDs
- **AND** later transported Review updates incrementally update their existing projection fields rather than forcing a full workspace refetch
- **AND** #140 does not claim immutable selection rows themselves replay through sync
- **ID:** AC-019

#### Scenario: Every selected TemplateRevision is projected

- **WHEN** a Review workspace is requested for a Review holding two or three `templateRevisionId` selections
- **THEN** the workspace SHALL return Pillars and Questions for every selected TemplateRevision
- **AND** each Question SHALL retain the `templateRevisionId` it belongs to
- **AND** the workspace SHALL NOT collapse Questions from multiple selections onto a first TemplateRevision
- **ID:** AC-029

#### Scenario: Maturity is exposed per TemplateRevision

- **WHEN** maturity can be calculated for a selected TemplateRevision
- **THEN** the workspace SHALL return, for that `templateRevisionId`, its calculation trace, calculation result, Pillar breakdowns, answer coverage, and effective override state
- **ID:** AC-030

#### Scenario: Over-limit TemplateRevision returns a scoped configuration error

- **WHEN** a pinned TemplateRevision contains more than ten Questions
- **THEN** the workspace SHALL return a configuration error for that `templateRevisionId`
- **AND** it SHALL expose no maturity result and no calculation trace for that TemplateRevision
- **AND** maturity results for the Review's other valid pinned TemplateRevisions SHALL remain available
- **ID:** AC-031
