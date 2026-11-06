## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Visual Regression Test Coverage

**Reason**: Screenshot-baseline regression infrastructure was deliberately removed and is not a maintained test layer.
**Migration**: Use functional Playwright assertions, axe-core accessibility checks, and deliberate screenshot tooling for documentation where appropriate.
**ID:** REQ-003

### Requirement: Visual tests excluded from default e2e run

**Reason**: The dedicated visual test suite and command no longer exist.
**Migration**: `make test:e2e` owns functional browser coverage and `make test:a11y` owns accessibility coverage.
**ID:** REQ-005

### Requirement: Missing baselines fail instead of auto-create

**Reason**: The repository no longer maintains visual-regression baselines.
**Migration**: No migration is required because baseline creation and comparison commands were removed with the suite.
**ID:** REQ-006
