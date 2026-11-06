> **Note:** Test path decoupling requirements (separate Makefile targets, visual exclusion) are now part of `openspec/specs/testing/spec.md`. The architecture further evolved to include a separate `vitest.integration.config.ts` for slow integration tests.

## ADDED Requirements

### Requirement: Visual tests excluded from default e2e run

The test runner SHALL exclude visual regression tests when running `pnpm test:e2e` or `make test:e2e`.

#### Scenario: Running e2e tests excludes visual tests
- **WHEN** developer runs `pnpm test:e2e`
- **THEN** only functional e2e tests execute (tests/e2e/*.spec.ts excluding visual/)

#### Scenario: Visual tests still accessible via dedicated command
- **WHEN** developer runs `pnpm test:visual`
- **THEN** only visual regression tests execute (tests/e2e/visual/*.spec.ts)

### Requirement: Missing baselines fail instead of auto-create

The visual test runner SHALL fail with an error when a baseline snapshot is missing, rather than automatically creating one.

#### Scenario: Missing baseline causes test failure
- **WHEN** visual test runs and baseline PNG does not exist
- **THEN** test fails with descriptive error indicating missing baseline

#### Scenario: Explicit update creates missing baselines
- **WHEN** developer runs `pnpm test:visual:update`
- **THEN** missing baselines are created and existing ones are updated

### Requirement: Makefile provides test path targets

The Makefile SHALL provide distinct targets for fast and slow test paths.

#### Scenario: Fast test target runs unit tests
- **WHEN** developer runs `make test`
- **THEN** only vitest unit tests execute

#### Scenario: E2E test target runs functional tests
- **WHEN** developer runs `make test:e2e`
- **THEN** only functional e2e tests execute (excluding visual)

#### Scenario: Visual test target runs visual regression tests
- **WHEN** developer runs `make test:visual`
- **THEN** only visual regression tests execute

#### Scenario: Full test target runs all tests
- **WHEN** developer runs `make test:all`
- **THEN** unit tests, functional e2e tests, AND visual tests all execute
