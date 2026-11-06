> **Note:** Current E2E test requirements live in `openspec/specs/testing/spec.md`. The structure grew to include `tests/e2e/a11y/`, `tests/e2e/fixtures/`, and `tests/e2e/helpers/` sub-directories.

## ADDED Requirements

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

### Requirement: Command Palette In-Page Actions

Each page SHALL register relevant command palette actions scoped to that page's context.

#### Scenario: In-page action registration
- **WHEN** a page has in-page actions (navigation, toggles, etc.)
- **THEN** commands are registered with `lifecycle` scope
- **AND** commands are cleaned up when navigating away (route watcher)
- **AND** commands update when reactive data changes (watch pattern)

#### Scenario: Command deduplication
- **WHEN** multiple items share the same display name (e.g., reviews with same name but different templates)
- **THEN** only one command is shown to avoid confusion
- **AND** the first item is used for navigation

#### Scenario: Navigation vs in-page actions
- **WHEN** an action would navigate away from the current page
- **THEN** it SHALL NOT be presented as an in-page action
- **AND** users should use explicit navigation commands instead

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
