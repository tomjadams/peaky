## ADDED Requirements

### Requirement: Template Rules Removal Migration Evidence

The project MUST verify that Rules data and tables are removed from existing and fresh databases without changing non-Rule Template data.
**ID:** REQ-001

#### Scenario: Existing SQLite database removes only Rules data

- **WHEN** a database through migration `0014` contains published and draft Templates, pillars, questions, and Rules
- **AND** migration `0015_remove_template_rules` is applied
- **THEN** `template_rules` and `template_draft_rules` no longer exist
- **AND** every seeded non-Rule Template, version, draft, pillar, and question row remains unchanged
- **ID:** AC-001

#### Scenario: Fresh SQLite schema contains no Rules tables

- **WHEN** all registered SQLite migrations are applied to an empty database
- **THEN** the final schema does not contain `template_rules` or `template_draft_rules`
- **AND** the migration registration and embedded SQL content remain equivalent
- **ID:** AC-002

#### Scenario: Existing PostgreSQL database removes only Rules data

- **WHEN** a PostgreSQL database through Goose migration `006` contains Templates, versions, pillars, questions, and Rules
- **AND** migration `007_remove_template_rules` is applied
- **THEN** `template_rules` no longer exists
- **AND** every seeded Template, version, pillar, and question row remains unchanged
- **ID:** AC-003

#### Scenario: PostgreSQL rollback restores schema only

- **WHEN** migration `007_remove_template_rules` is rolled back
- **THEN** the `template_rules` table and index are recreated with the historical shape
- **AND** deleted Rules rows are not claimed to be recoverable
- **ID:** AC-004

### Requirement: Removed Rules Surface Regression Coverage

Automated tests SHALL prove that current Template authoring contains no Rules feature while supported Template behavior remains functional.
**ID:** REQ-002

#### Scenario: Legacy Rules Markdown is rejected

- **WHEN** a user imports Markdown containing `## Rules`
- **THEN** parsing throws `UnsupportedTemplateRulesMarkdownError`
- **AND** no partial imported Template is returned or applied
- **AND** current Template state remains unchanged
- **ID:** AC-005

#### Scenario: Rules route and navigation are absent

- **WHEN** a user opens Template Studio
- **THEN** no Rules mode, Rules command, or Rules navigation action is rendered
- **AND** the retired Rules URL follows the normal not-found path
- **ID:** AC-006

#### Scenario: Supported Template behavior remains covered

- **WHEN** the Rules feature is removed
- **THEN** focused tests continue to verify question/checklist validation, Template save/load, Markdown round-trip, and publication without Rule validation
- **ID:** AC-007
