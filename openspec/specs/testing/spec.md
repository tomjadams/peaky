# testing Specification

## Purpose

This specification covers the testing strategy and test file structure for the
Peaky project. Tests are split across six maintained layers: unit, Nuxt
component, integration, functional end-to-end, accessibility, and Go. A gated
sync-stack E2E suite extends functional coverage when the full local stack is
available.

**Test layer summary:**

| Layer | Config | Path pattern | Speed |
|-------|--------|-------------|-------|
| Unit | `vitest.config.ts` | `tests/unit/**/*.test.ts` | Fast |
| Nuxt component | `vitest.config.ts` | `tests/nuxt/**/*.test.ts` | Fast |
| Integration | `vitest.integration.config.ts` | Selected `tests/integration/**/*.test.ts` | Node DB/API contracts; full-server suites are explicit |
| Functional E2E | `playwright.config.ts` | `tests/e2e/**/*.spec.ts` | Slow |
| Accessibility | `playwright.config.ts` | Playwright `a11y` project | Slow |
| Go | Go toolchain | `services/**/*_test.go` | Package-dependent |
| Gated sync-stack E2E | `playwright.config.ts` | `tests/e2e/sync-scoped-pull.spec.ts` | Slow; requires the full local stack |

## Requirements

### Requirement: Axe-core accessibility checks

The project MUST run axe‑core accessibility checks for UI refactors and resolve contrast violations before completion.

#### Scenario: Axe-core test execution

- **WHEN** running a11y checks for UI changes
- **THEN** tests use axe‑core via `@axe-core/playwright`
- **AND** color‑contrast rules are included in the scan
- **AND** any violations cause the test run to fail

#### Scenario: Contrast violations

- **WHEN** axe‑core reports a contrast violation
- **THEN** UI styling is adjusted to meet WCAG AA contrast
- **AND** the a11y checks are re‑run to confirm resolution

### Requirement: Unit Test Coverage

The project SHALL maintain unit tests for services, composables, utils, and domain logic.

#### Scenario: Unit test file structure

- **WHEN** a service, composable, or utility exists
- **THEN** a corresponding test file exists under `tests/unit/`
- **AND** tests are organised by domain (e.g., `tests/unit/assessment/`, `tests/unit/templates/`, `tests/unit/services/`)
- **AND** shared UI composables live under `tests/unit/ui/`
- **AND** tests use Vitest with `@nuxt/test-utils` environment

#### Scenario: Domain-aligned structure

- **WHEN** creating unit tests for a bounded domain
- **THEN** test files mirror the domain folder (e.g., `tests/unit/products/products/*.test.ts`)
- **AND** shared/cross-cutting utilities go under `tests/unit/utils/` or `tests/unit/composables/`

#### Scenario: State management composable testing

- **WHEN** testing a composable with reactive state
- **THEN** tests verify initial state values
- **AND** tests verify state transitions via public methods
- **AND** tests verify computed values update correctly
- **AND** tests reset state between test cases

#### Scenario: Data fetching composable testing

- **WHEN** testing a composable that fetches data
- **THEN** tests verify the expected data shape is returned
- **AND** tests document the contract between UI and data layer
- **AND** tests do not mock internal fetch implementation

### Requirement: Nuxt Component Test Coverage

The project SHALL maintain component tests for shared UI components using `@nuxt/test-utils`.

#### Scenario: Component test file structure

- **WHEN** a shared component exists
- **THEN** a corresponding test file exists under `tests/nuxt/components/`
- **AND** tests are grouped by domain (e.g., `tests/nuxt/components/assessment/`, `tests/nuxt/components/template-studio/`)
- **AND** tests use `@testing-library/vue` for rendering within a real Nuxt environment

#### Scenario: Interactive component testing

- **WHEN** testing a component with user interactions
- **THEN** tests verify click handlers emit correct events
- **AND** tests verify keyboard navigation works
- **AND** tests use `fireEvent` or `userEvent` for interactions
- **AND** tests avoid testing internal component state

#### Scenario: Accessibility testing

- **WHEN** testing interactive components
- **THEN** tests verify ARIA attributes are present and correct
- **AND** tests verify focus management for modals/dialogs
- **AND** tests verify screen reader text where applicable

#### Scenario: Component rendering testing

- **WHEN** testing component output
- **THEN** tests verify correct content is rendered for given props
- **AND** tests verify conditional rendering based on state
- **AND** tests stub child components to isolate unit under test

### Requirement: Integration Test Coverage

The project SHALL maintain integration tests for scenarios that require a full Nuxt server to be running.

#### Scenario: Integration test file structure

- **WHEN** a test requires server-side rendering or real API routes
- **THEN** the test lives under `tests/integration/`
- **AND** it uses `await setup()` from `@nuxt/test-utils` to spin up a full Nuxt server
- **AND** it uses the `vitest.integration.config.ts` config (run separately from unit tests)

#### Scenario: When to use integration vs unit

- **WHEN** a test only validates logic (services, composables, utils)
- **THEN** it is a unit test in `tests/unit/`
- **WHEN** a test validates behaviour that requires Nuxt server context (e.g., API route handlers, SSR)
- **THEN** it is an integration test in `tests/integration/`

### Requirement: E2E Test Coverage

The project SHALL maintain end-to-end tests for critical user journeys using Playwright.

#### Scenario: E2E test file structure

- **WHEN** a critical user journey exists
- **THEN** a corresponding E2E test exists at `tests/e2e/*.spec.ts`
- **AND** tests use Playwright with Nuxt integration
- **AND** tests run against a real (or mocked) server

#### Scenario: User journey testing

- **WHEN** testing a user journey
- **THEN** tests simulate real user actions (clicks, typing, navigation)
- **AND** tests verify visible outcomes (not internal state)
- **AND** tests use accessible selectors (getByRole, getByText, getByPlaceholder)
- **AND** data-testid attributes are used sparingly, only when accessible selectors are insufficient
- **AND** tests document the expected UI-server contract through their assertions

#### Scenario: Test isolation

- **WHEN** running E2E tests
- **THEN** each test starts from a known state
- **AND** tests do not depend on other tests' side effects
- **AND** test data fixtures provide consistent starting points (using mock API data)

#### Scenario: CI compatibility

- **WHEN** E2E tests run in CI
- **THEN** tests execute in headless mode
- **AND** tests complete within reasonable timeout
- **AND** test failures provide actionable error messages with screenshots
- **AND** `PLAYWRIGHT_BASE_URL` env var configures target URL (defaults to localhost:3000)
- **AND** webServer is disabled when `PLAYWRIGHT_BASE_URL` is set (for testing deployed stages)

### Requirement: Test Data Generation

The project SHALL use Zod schemas as the single source of truth for test data generation.

#### Scenario: Schema-based data generation

- **WHEN** test data is needed
- **THEN** use `TestDataFactory` from `tests/fixtures/factory.ts`
- **AND** data is generated from Zod schemas in `app/models/`
- **AND** generated data passes schema validation automatically

#### Scenario: Reproducible test data

- **WHEN** tests require reproducible data across runs
- **THEN** use `seededFactory(seed)` with a fixed seed value
- **AND** call `resetSeed()` before generating data sequences

### Requirement: Makefile provides test path targets

The Makefile SHALL provide distinct targets for the repository's maintained test layers.
**ID:** REQ-004

#### Scenario: Fast test target runs unit tests

- **WHEN** a developer runs `make test`
- **THEN** Vitest unit and Nuxt component tests execute
- **ID:** AC-008

#### Scenario: Integration target runs selected integration tests

- **WHEN** a developer runs `make test:integration`
- **THEN** the maintained Node integration tests execute
- **ID:** AC-009

#### Scenario: E2E target runs functional tests

- **WHEN** a developer runs `make test:e2e`
- **THEN** the maintained functional browser tests execute
- **AND** accessibility tests remain available through `make test:a11y`
- **ID:** AC-010

#### Scenario: Full test target runs maintained suites

- **WHEN** a developer runs `make test:all`
- **THEN** unit, Nuxt component, integration, functional E2E, accessibility, and Go tests execute
- **ID:** AC-011

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

### Requirement: Template Revision Destructive Migration Evidence

The project MUST prove the intentional Template and dependent Review reset during Preview while preserving unrelated data and installing the new constrained schema.
**ID:** REQ-007

#### Scenario: Existing SQLite data is reset completely

- **WHEN** the Template Revision migration runs against a SQLite database seeded with every table, entity type, exact/null-entity event type, and preserved class enumerated by design D13
- **THEN** every Template/Review domain, import/evidence, audit, outbox, pending-review, entitlement-snapshot, and field-history row in scope is removed
- **AND** Product, Team, catalog-directory, sync-cursor, migration-log, and unrelated event data remains byte-for-byte unchanged
- **ID:** AC-012

#### Scenario: Existing PostgreSQL data is reset completely

- **WHEN** Goose migration 008 runs against PostgreSQL seeded with every applicable table, entity type, exact/null-entity event type, and preserved class enumerated by design D13
- **THEN** all in-scope Template/Review domain, import/evidence, audit, and generic sync rows are removed without `CASCADE` masking unknown dependencies
- **AND** unrelated Product, Team, cursor, migration, and sync data remains unchanged
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
