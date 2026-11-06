## MODIFIED Requirements

### Requirement: Schema Pipeline Single Source of Truth

The system SHALL use `services/schema.sql` plus Goose/sqlc for PostgreSQL and explicit hand-written Drizzle schemas plus registered SQL migrations for SQLite, with persistence behavior tests enforcing the shared contract.
**ID:** REQ-003

#### Scenario: Schema change propagates through active artifacts

- **WHEN** a shared persistence contract changes
- **THEN** PostgreSQL desired state, Goose migrations, sqlc models, hand-written SQLite Drizzle schemas, and SQLite migrations are updated where applicable
- **AND** behavior tests exercise the accepted and rejected states through the active PostgreSQL and SQLite runtime paths
- **AND** the unused PostgreSQL-to-Drizzle converter and its generated directory remain non-authoritative pending issue #142
- **ID:** AC-007

#### Scenario: Schema and Goose migrations stay aligned

- **WHEN** persistence behavior runs against a fresh `services/schema.sql` database and a database built by all Goose migrations
- **THEN** both paths satisfy the same shared-schema contract across all persisted entities, fields, constraints, indexes, and references
- **AND** divergence in accepted or rejected persistence operations fails verification without requiring exact catalog or source-file equality
- **ID:** AC-008

#### Scenario: Client-only tables remain explicit

- **WHEN** a table exists only in browser SQLite
- **THEN** it is excluded from `services/schema.sql`
- **AND** its hand-written schema and SQLite migration remain explicit and tested
- **ID:** AC-009

#### Scenario: Cross-database type representations remain explicit

- **WHEN** a shared field is represented in PostgreSQL and SQLite
- **THEN** each active schema uses its documented native representation for text, integer, timestamp, JSON, and boolean values
- **AND** persistence behavior tests prove the representations accept and return the required domain values
- **ID:** AC-010

#### Scenario: Template Revision tables and references exist in both active schemas

- **WHEN** Template, Revision, Pillar, Question, or Review-selection state is stored
- **THEN** PostgreSQL and the hand-written SQLite Drizzle schema expose the required fields and references through their active runtime paths
- **AND** no runtime depends on `shared/db/schema/generated/`
- **ID:** AC-011

#### Scenario: Partial unique indexes preserve their predicates

- **WHEN** one-draft, one-published, or Revision-number uniqueness is enforced
- **THEN** PostgreSQL and SQLite apply conditional uniqueness only to the intended rows
- **AND** behavioral inserts prove valid retired and cross-Template rows remain accepted
- **ID:** AC-012

#### Scenario: Incomplete shared-schema changes fail behaviorally

- **WHEN** a shared table, field, constraint, or reference is missing from an active PostgreSQL or SQLite path
- **THEN** the relevant fresh/upgrade or persistence behavior test fails with the affected domain operation
- **ID:** AC-013

#### Scenario: Composite primary keys remain composite

- **WHEN** Review selections use `(review_id, template_revision_id)` identity
- **THEN** PostgreSQL and SQLite enforce one composite primary key rather than independent column primary keys
- **AND** duplicate Revision selection behavior fails consistently in both databases
- **ID:** AC-018
