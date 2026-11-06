# Change: Add Composable Unit Tests

## Why

The project has 21 composables but only 1 is tested (`useCommandPalette`). Composables contain critical business logic for state management, data fetching, and UI coordination. Testing them now:
- Documents data contracts before backend refactor
- Provides refactor safety net
- Serves as living documentation for how UI expects data

## What Changes

- Add unit tests for 20 untested composables using Vitest + @nuxt/test-utils
- Tests focus on behavior: state transitions, computed values, emitted events
- No mocking of implementation details - test public API only

**Composables to test (by priority):**

High (complex state/logic):
- `useTemplateEditor` - Template editing state machine
- `useNAModal` - N/A answer modal state
- `useBulkActions` - Bulk operation handling
- `useBulkSelection` - Multi-select state
- `useQuestionAdapter` - Data transformation

Medium (data fetching/caching):
- `useApplications`, `useApplicationDetails`, `useApplicationFilters`, `useApplicationReviews`
- `useTemplates`, `useTemplateSelector`
- `useReviewData`, `useReviewQuestions`, `useReviewSessions`

Lower (simple state):
- `useBreadcrumbs`, `usePageHeader`, `usePageSections`
- `useSortState`
- `useQuestionDetail`, `useQuestionInfo`

## Impact

- Affected specs: All domains (composables underpin all features)
- Affected code: `tests/composables/` directory
- No production code changes
