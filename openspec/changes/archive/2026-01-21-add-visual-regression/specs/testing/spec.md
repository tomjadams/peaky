> **Note:** Visual regression test structure has evolved. Current requirements live in `openspec/specs/testing/spec.md`.

## ADDED Requirements

### Requirement: Visual Regression Test Coverage

The project SHALL maintain visual regression tests to catch unintended UI changes.

#### Scenario: Visual test file structure
- **WHEN** a visual regression test is needed
- **THEN** a test file exists at `tests/e2e/visual/*.spec.ts`
- **AND** baseline screenshots are stored in version control
- **AND** tests use Playwright's screenshot comparison

#### Scenario: Screenshot capture
- **WHEN** capturing visual snapshots
- **THEN** screenshots are taken at consistent viewport sizes
- **AND** screenshots wait for animations to complete
- **AND** screenshots mask dynamic content (timestamps, etc.)

#### Scenario: Theme testing
- **WHEN** testing visual appearance
- **THEN** both light and dark themes are captured
- **AND** theme differences are tested separately

#### Scenario: Baseline management
- **WHEN** visual changes are intentional
- **THEN** baselines can be updated via script
- **AND** baseline updates are reviewed in PR diffs
- **AND** outdated baselines fail CI until updated
