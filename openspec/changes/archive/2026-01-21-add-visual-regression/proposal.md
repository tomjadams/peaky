# Change: Add Visual Regression Testing

## Why

UI changes can introduce unintended visual regressions. Visual regression testing with Playwright:
- Catches CSS/layout breaks automatically
- Documents expected visual states
- Provides confidence for theme/styling changes
- Complements E2E behavioral tests

## What Changes

- Configure Playwright for screenshot comparison
- Create visual regression tests for key UI states
- Set up baseline screenshot management
- Configure snapshot update workflow

**Key visual states to capture:**

1. **Pages**
   - Home/Dashboard (light + dark)
   - Application list with data
   - Template Studio editor
   - Assessment survey view

2. **Components**
   - DataTable (empty, with data, loading)
   - NAReasonModal (open state)
   - Command palette (open, with results)
   - Answer toggle states (none, yes, no, na)

3. **Viewport**
   - Desktop only (1280px+) - this app is not designed for mobile/tablet

## Impact

- Affected specs: All visual components
- New files: `tests/e2e/visual/*.spec.ts`, `.playwright/snapshots/`
- Depends on: `add-e2e-tests` (Playwright setup)
- No production code changes
