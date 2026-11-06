## ADDED Requirements

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
