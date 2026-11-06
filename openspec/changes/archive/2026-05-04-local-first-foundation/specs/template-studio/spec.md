## ADDED Requirements

### Requirement: Local-First Template Draft Authoring

The Template Studio SHALL support local-first draft authoring for editable templates.

#### Scenario: Template draft loads from local state

- **WHEN** a user opens an editable template draft that has already been replicated locally
- **THEN** the Template Studio hydrates from the local database first
- **AND** the last known draft state is available even if the remote server is temporarily unavailable

#### Scenario: Draft edits commit locally before sync

- **WHEN** a user edits template metadata, pillars, questions, or rule sets in draft mode
- **THEN** the draft mutation is committed locally first
- **AND** the change is queued for background synchronization

### Requirement: Structured Template Collaboration

The Template Studio SHALL model template drafts as structured authoring units so non-overlapping edits do not become whole-draft conflicts.

#### Scenario: Independent template units sync independently

- **WHEN** different authors edit different pillars, questions, or rule sets in the same draft
- **THEN** synchronization treats those units independently
- **AND** the draft does not require whole-template conflict review for non-overlapping changes

#### Scenario: Ordering does not depend on raw array indexes

- **WHEN** users add adjacent questions or reorder authoring units within the same pillar
- **THEN** the draft model preserves stable identity and durable ordering metadata for those units
- **AND** synchronization can reconcile nearby inserts without rewriting the entire draft as one blob

#### Scenario: Same-entity template collisions require explicit review

- **WHEN** concurrent offline or delayed-sync edits change the same question, rule, or other template authoring unit
- **THEN** the system preserves both sides for explicit conflict review instead of silently overwriting one side
- **AND** the user is shown conflict markers plus guidance on the recommended resolution path

### Requirement: Markdown Import And Export For Template Drafts

The Template Studio SHALL support markdown import and export for template-draft authoring workflows outside the app.

#### Scenario: Draft export preserves template structure

- **WHEN** a user exports a template draft to markdown
- **THEN** the export preserves template metadata, pillars, questions, and rule structure
- **AND** the result is suitable for external editing workflows such as Google Docs drafting

#### Scenario: Markdown import reuses the same conflict-review model

- **WHEN** a user imports markdown that touches template units also changed locally or remotely since the import base
- **THEN** the system marks the affected units with explicit conflict markers instead of silently merging them
- **AND** the import flow nudges the user toward the recommended resolution path before publish

#### Scenario: Publishing remains server-authoritative

- **WHEN** a user attempts to publish a template
- **THEN** the publish action requires a server-authoritative confirmation
- **AND** local-first draft editing does not imply that publish state becomes active without remote acceptance
