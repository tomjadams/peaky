## ADDED Requirements

### Requirement: Template Revision Destructive Migration Evidence

The project MUST prove the intentional Template and dependent Review reset during Preview while preserving unrelated data and installing the new constrained schema.
**ID:** REQ-007

#### Scenario: Existing SQLite data is reset completely

- **WHEN** the Template Revision migration runs against a SQLite database seeded with every table, entity type, exact/null-entity event type, an unrelated-type event correlated through a non-null `review_id`, and every preserved class enumerated by design D13
- **THEN** every Template/Review domain, import/evidence, audit, outbox, pending-review, entitlement-snapshot, and field-history row in scope plus every event with a non-null `review_id` is removed
- **AND** Product, Team, catalog-directory, sync-cursor, migration-log, and unrelated event data with a null `review_id` remains byte-for-byte unchanged
- **ID:** AC-012

#### Scenario: Existing PostgreSQL data is reset completely

- **WHEN** Goose migration 008 runs against PostgreSQL seeded with every applicable table, entity type, exact/null-entity event type, an unrelated-type event correlated through a non-null `review_id`, and every preserved class enumerated by design D13
- **THEN** all in-scope Template/Review domain, import/evidence, audit, and generic sync rows plus every event with a non-null `review_id` are removed without `CASCADE` masking unknown dependencies
- **AND** unrelated Product, Team, cursor, migration, sync, and event data with a null `review_id` remains unchanged
- **ID:** AC-013

#### Scenario: Fresh schema enforces Template Revision invariants

- **WHEN** all SQLite or PostgreSQL migrations are applied to an empty database
- **THEN** the final schema contains Template, Revision, Pillar, Question, ownership/provenance, and exact Review-selection fields
- **AND** client-only `template_revision_imports` retains `sourceType`, `sourceFile`, `importedAt`, `conflicts`, and `resolved` while replacing only `draftId` with `templateRevisionId`
- **AND** CHECK, foreign-key, partial-unique, positive-number, and summary-length constraints reject every invalid state defined by the delta specs
- **ID:** AC-014

#### Scenario: Deterministic fixtures use the new model

- **WHEN** demo fixtures are rebuilt after reset
- **THEN** stable Template, Revision, Pillar, and Question IDs are deterministic
- **AND** published fixtures have Revision 1 plus separate draft copies where specified
- **AND** demo Reviews reference exact published Revision IDs without fabricated version identities
- **ID:** AC-015

### Requirement: Template Revision Behavior Regression Coverage

Automated tests SHALL cover publication freeze, local-only draft authoring, exact local/process-fixture Review selection, ownership, immutability, and presentation boundaries without adding sync transport.
**ID:** REQ-008

#### Scenario: Disabled publication performs zero writes

- **WHEN** publication is disabled and UI, client service, or Nitro endpoint paths are exercised
- **THEN** controls remain absent or an explicit unavailable response is returned
- **AND** Template, Revision, event, outbox, fixture, and timestamp state remains unchanged
- **ID:** AC-016

#### Scenario: Draft authoring is local-only

- **WHEN** Template metadata, Pillars, or Questions are edited during the interim freeze
- **THEN** local state commits atomically
- **AND** no legacy or new Template outbox row is created
- **ID:** AC-017

#### Scenario: Exact Review selection is validated locally

- **WHEN** local or fixture compatibility Review creation selects Revisions
- **THEN** tests accept one to three current published Revisions from distinct active Templates
- **AND** tests reject draft, retired, archived-Template, duplicate-Revision, duplicate-Template, non-contiguous, or out-of-range selections without partial rows
- **AND** the test makes no cross-client synchronization claim
- **ID:** AC-024

#### Scenario: Ownership and actor-provenance boundaries are enforced

- **WHEN** fixture and newly created Templates are tested
- **THEN** each has one valid owner Team, separate Template/Revision creator and updater fields, and status-coupled Revision publisher provenance
- **AND** each initial updater equals its corresponding creator while immutable fixture Revisions use the system publisher and drafts use null publisher
- **AND** creator, updater, publisher, or draft-edit status alone never grants lifecycle actions
- **ID:** AC-019

#### Scenario: Immutable Revisions reject writes

- **WHEN** any mutation path attempts to modify a published or retired Revision or its content
- **THEN** the operation fails before partial state, event, or outbox writes
- **ID:** AC-020

#### Scenario: State-only mutation contract is formally aligned

- **WHEN** `LocalMutation.localOnly()` is added for Template draft authoring
- **THEN** unit tests and the focused `local_mutation_atomicity` model prove one atomic state write with no event, outbox, or push trigger
- **AND** code/model linkage and drift guards identify future contract changes
- **ID:** AC-023

## MODIFIED Requirements

### Requirement: Removed Rules Surface Regression Coverage

Automated tests SHALL prove that current Template authoring contains no Rules feature while supported Template Revision behavior remains functional.
**ID:** REQ-002

#### Scenario: Legacy Rules Markdown is rejected

- **WHEN** a user imports Markdown containing `## Rules`
- **THEN** parsing throws `UnsupportedTemplateRulesMarkdownError`
- **AND** no partial imported Template state is returned or applied
- **AND** current Template and draft Revision state remains unchanged
- **ID:** AC-005

#### Scenario: Rules route and navigation are absent

- **WHEN** a user opens Template Studio
- **THEN** no Rules mode, Rules command, or Rules navigation action is rendered
- **AND** the retired Rules URL follows the normal not-found path
- **ID:** AC-006

#### Scenario: Supported Template behavior remains covered

- **WHEN** the Template model migrates after Rules removal
- **THEN** focused tests continue to verify Question/checklist validation, draft save/load, Markdown round-trip, and fail-closed publication behavior without Rule validation
- **ID:** AC-007
