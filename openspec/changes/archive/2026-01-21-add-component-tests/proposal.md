# Change: Add Component Unit Tests

## Why

Shared UI components are tested inconsistently - only 4 component tests exist (3 in assessment/, 1 for AppCommandPalette). Components like DataTable, NAReasonModal, and template-studio components have complex user interactions that should be tested to:
- Ensure accessibility (ARIA attributes, keyboard navigation)
- Document expected user interactions
- Catch regressions when refactoring UI

## What Changes

- Add unit tests for shared UI components using @testing-library/vue
- Tests focus on: user interactions, emitted events, accessibility, rendered output
- Follow existing patterns from `AnswerToggle.test.ts` (exemplary behavior testing)

**Components to test (by domain):**

Assessment (partially done):
- `QuestionRow` - info click, answer interactions *(exists)*
- `PillarSection` - progress display, header *(exists)*
- `AnswerToggle` - answer selection *(exists)*

Common UI:
- `DataTable` - row rendering, sorting, selection
- `DataTableCell*` - cell type rendering (6 components)
- `NAReasonModal` - reason selection, confirmation, keyboard
- `FilterBar` - filter interactions
- `SearchInput` - search input, debounce
- `BulkActionBar` - action buttons, selection count

Template Studio:
- `QuestionCard` - expand/collapse, editing
- `QuestionList` - drag-drop ordering, add question
- `PillarTabs` - tab switching
- `RiskLevelDropdown` - selection
- `RichTextEditor` - toolbar actions
- `Header` - save status, actions

## Impact

- Affected specs: assessment, template-studio, common-ui
- Affected code: `tests/components/` directory
- No production code changes
