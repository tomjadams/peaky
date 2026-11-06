> **Note:** Composable test structure has evolved to a domain-aligned layout under `tests/unit/{domain}/`. Current requirements live in `openspec/specs/testing/spec.md`.

## ADDED Requirements

### Requirement: Composable Unit Test Coverage

The project SHALL maintain unit tests for all composables to document behavior contracts and enable safe refactoring.

#### Scenario: Composable test file structure
- **WHEN** a composable exists at `app/composables/use*.ts`
- **THEN** a corresponding test file exists at `tests/composables/use*.test.ts`
- **AND** tests use `@nuxt/test-utils` for Nuxt context
- **AND** tests use behavior-focused assertions (not implementation details)

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
