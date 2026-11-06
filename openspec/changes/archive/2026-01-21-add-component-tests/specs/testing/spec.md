> **Note:** Component test paths have since evolved. Tests moved from `tests/components/` to `tests/nuxt/components/` (organised by domain) as part of the architecture improvement. Current requirements live in `openspec/specs/testing/spec.md`.

## ADDED Requirements

### Requirement: Component Unit Test Coverage

The project SHALL maintain unit tests for shared UI components to verify user interactions and accessibility.

#### Scenario: Component test file structure
- **WHEN** a shared component exists at `app/components/*.vue`
- **THEN** a corresponding test file exists at `tests/components/*.test.ts`
- **AND** tests use `@testing-library/vue` for rendering
- **AND** tests query elements by role, label, or text (not implementation details)

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
