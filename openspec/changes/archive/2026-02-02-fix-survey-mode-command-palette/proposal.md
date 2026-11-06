## Why

The Survey Mode toggle via command palette is broken. While clicking the "Survey Mode" button in the header correctly navigates to the survey page, using the command palette to "Enter survey mode" or "Exit survey mode" no longer works. The command palette commands use an outdated approach (query parameter manipulation) that was abandoned when survey mode was moved to a separate page.

## What Changes

- Fix the "Enter survey mode" command in assessment page to navigate to `/survey` page instead of adding query parameter
- Fix the "Exit survey mode" command in assessment page to navigate to `/assessment` page instead of removing query parameter
- Ensure the command palette commands are properly re-registered when route changes (already working, but verify)
- Add E2E test to verify command palette survey mode toggle works correctly

## Capabilities

### New Capabilities
*None - this is a bugfix*

### Modified Capabilities
*None - this is implementation fix only, no spec changes required*

## Impact

- **Files affected**:
  - `app/pages/applications/[appId]/reviews/[reviewId]/assessment.vue` - Fix command palette commands
  - `tests/e2e/command-palette-in-page.spec.ts` or new test file - Add E2E coverage

- **User-facing**: Command palette survey mode toggle will work correctly
- **No breaking changes**: This fixes broken behavior to match user expectations
