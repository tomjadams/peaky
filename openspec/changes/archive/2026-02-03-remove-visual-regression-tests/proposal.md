## Why

Visual regression tests have provided zero value add - every OpenSpec proposal change requires creating new baselines, adding friction without catching meaningful regressions. The maintenance overhead outweighs any benefits.

## What Changes

- Remove all visual regression test files (`tests/e2e/visual/*.spec.ts`)
- Remove visual test baseline snapshots (`tests/e2e/__snapshots__/`)
- Remove visual-specific npm scripts and Makefile targets
- Add accessibility testing with axe-core as a replacement that provides more actionable feedback
- **Fix existing accessibility violations** detected by axe-core (demonstrates immediate value of a11y tests)
- Update testing documentation to reflect the new approach

## Capabilities

### New Capabilities

- `accessibility-testing`: Automated accessibility testing using axe-core integrated with Playwright E2E tests

### Modified Capabilities

- `testing`: Remove visual regression test requirements, add accessibility testing requirements, update test path targets

## Impact

- **Tests**: Visual regression tests removed entirely, accessibility tests added
- **CI/CD**: Visual test stage removed from pipeline, a11y test stage added
- **Dependencies**: Remove any visual-specific dependencies, add `@axe-core/playwright`
- **Documentation**: AGENTS.md, testing spec, and development docs need updates
- **Makefile**: Remove `test:visual` target, add `test:a11y` target
- **Components**: Fixed a11y violations in NavigationSidebar, TemplateSelectorSidebar, AttachmentUpload
