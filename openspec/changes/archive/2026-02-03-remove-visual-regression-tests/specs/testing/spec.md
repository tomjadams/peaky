## ADDED Requirements

### Requirement: Accessibility Test Coverage

The project SHALL maintain accessibility tests using axe-core to verify WCAG compliance.

#### Scenario: Accessibility test file structure
- **WHEN** an accessibility test is needed
- **THEN** a test file exists at `tests/e2e/a11y/*.spec.ts`
- **AND** tests use `@axe-core/playwright` for a11y checks
- **AND** tests run against real rendered pages

#### Scenario: Page accessibility testing
- **WHEN** testing a page for accessibility
- **THEN** tests verify the page has no critical or serious axe violations
- **AND** tests document any intentional rule exclusions with rationale
- **AND** tests wait for page to be fully loaded before scanning

#### Scenario: Component accessibility testing
- **WHEN** testing interactive components for accessibility
- **THEN** tests verify keyboard navigation works
- **AND** tests verify ARIA attributes are correct
- **AND** tests verify focus management for modals/dialogs

### Requirement: Use NuxtUI UTooltip for accessible tooltips

Interactive tooltips SHALL use NuxtUI's `UTooltip` component for consistent accessibility.

#### Scenario: Tooltip accessibility
- **WHEN** a component needs a tooltip
- **THEN** it uses `UTooltip` from NuxtUI
- **AND** the tooltip has appropriate ARIA attributes
- **AND** the tooltip is keyboard accessible

#### Scenario: UApp context provider
- **WHEN** using NuxtUI components that require context (e.g., UTooltip)
- **THEN** `app.vue` wraps the app with `UApp` component
- **AND** all NuxtUI context providers are available

### Requirement: Accessibility tests available via dedicated command

The test runner SHALL provide a dedicated command for accessibility tests.

#### Scenario: Running accessibility tests
- **WHEN** developer runs `pnpm test:a11y`
- **THEN** only accessibility tests execute (tests/e2e/a11y/*.spec.ts)

#### Scenario: Accessibility tests in CI
- **WHEN** CI pipeline runs
- **THEN** accessibility tests execute as part of the test matrix
- **AND** violations fail the build with actionable error messages

## REMOVED Requirements

### Requirement: Visual Regression Test Coverage

**Reason**: Visual regression tests have provided zero value - every UI change requires baseline updates without catching meaningful regressions. The maintenance overhead outweighs benefits.

**Migration**: Use accessibility tests (`make test:a11y`) for automated UI quality checks. Rely on PR review process for visual consistency.

### Requirement: Visual tests excluded from default e2e run

**Reason**: Visual tests are being removed entirely.

**Migration**: N/A - no visual tests to exclude.

### Requirement: Missing baselines fail instead of auto-create

**Reason**: Visual tests are being removed entirely.

**Migration**: N/A - no baselines to manage.

## MODIFIED Requirements

### Requirement: Makefile provides test path targets

The Makefile SHALL provide distinct targets for fast and slow test paths.

#### Scenario: Fast test target runs unit tests
- **WHEN** developer runs `make test`
- **THEN** only vitest unit tests execute

#### Scenario: E2E test target runs functional tests
- **WHEN** developer runs `make test:e2e`
- **THEN** only functional e2e tests execute (excluding a11y)

#### Scenario: Accessibility test target runs a11y tests
- **WHEN** developer runs `make test:a11y`
- **THEN** only accessibility tests execute

#### Scenario: Full test target runs all tests
- **WHEN** developer runs `make test:all`
- **THEN** unit tests, functional e2e tests, AND accessibility tests all execute
