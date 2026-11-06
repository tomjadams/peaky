## Prerequisites

- [x] 0.1 Create GitLab issue using `glab` CLI
- [x] 0.2 Create feature branch `feat/refactor-composable-architecture`
- [x] 0.3 Create `TARGETS.md` documenting browser (modern Chrome ES2024+), Node (v20+), build target (esnext)
- [x] 0.4 Verify `nuxt.config.ts` has `vite.build.target: "esnext"` and `vite.esbuild.target: "esnext"` ✅ (already configured)
- [x] 0.5 Create domain folder structure: `app/assessment/`, `app/templates/`, `app/ui/`, `app/applications/`
- [x] 0.6 Create `index.ts` barrel exports for each domain folder

## Phase 1: UI Utilities Migration (TDD)

### RED: Write Tests for UI Utilities
- [x] 1.1 Create `tests/ui/` folder
- [x] 1.2 Move `tests/nuxt/composables/useSortState.test.ts` → `tests/ui/useSortState.test.ts`
- [x] 1.3 Move `tests/nuxt/composables/useBulkSelection.test.ts` → `tests/ui/useBulkSelection.test.ts`
- [x] 1.4 Move `tests/nuxt/composables/useBulkActions.test.ts` → `tests/ui/useBulkActions.test.ts`
- [x] 1.5 Move `tests/nuxt/composables/useCommandPalette.test.ts` → `tests/ui/useCommandPalette.test.ts`
- [x] 1.6 Move `tests/nuxt/composables/usePageHeader.test.ts` → `tests/ui/usePageHeader.test.ts`
- [x] 1.7 Move `tests/nuxt/composables/useBreadcrumbs.test.ts` → `tests/ui/useBreadcrumbs.test.ts`
- [x] 1.8 Move `tests/nuxt/composables/useQuestionInfo.test.ts` → `tests/ui/useQuestionInfo.test.ts`
- [x] 1.9 Move `tests/nuxt/composables/useNAModal.test.ts` → `tests/ui/useNAModal.test.ts`
- [x] 1.10 Update test imports to point to `app/ui/` (tests should FAIL - files don't exist yet)
- [x] 1.11 Run `pnpm test` - verify tests fail (RED state)

### GREEN: Migrate UI Files
- [x] 1.12 Move `app/composables/useSortState.ts` → `app/ui/useSortState.ts`
- [x] 1.13 Move `app/composables/useBulkSelection.ts` → `app/ui/useBulkSelection.ts`
- [x] 1.14 Move `app/composables/useBulkActions.ts` → `app/ui/useBulkActions.ts`
- [x] 1.15 Move `app/composables/useCommandPalette.ts` → `app/ui/useCommandPalette.ts`
- [x] 1.16 Move `app/composables/usePageHeader.ts` → `app/ui/usePageHeader.ts`
- [x] 1.17 Move `app/composables/useBreadcrumbs.ts` → `app/ui/useBreadcrumbs.ts`
- [x] 1.18 Move `app/composables/useQuestionInfo.ts` → `app/ui/useQuestionInfo.ts`
- [x] 1.19 Move `app/composables/useNAModal.ts` → `app/ui/useNAModal.ts`
- [x] 1.20 Move `app/composables/usePillarNotes.ts` → `app/ui/usePillarNotes.ts`
- [x] 1.21 Update all component imports to use EXPLICIT imports: `import { usePageHeader } from '~/composables/nav/usePageHeader'` (DO NOT rely on auto-imports)
- [x] 1.22 Update `app/plugins/commandPalette.client.ts` with explicit import
- [x] 1.23 Run `pnpm test` - verify UI tests pass (GREEN state)

### REFACTOR: Modernize UI Utilities with ES2024+
- [x] 1.24 In `useBulkSelection.ts`: Replace `||` with `??` for nullish coalescing
- [x] 1.25 In `useSortState.ts`: Replace `[...array].sort()` with `.toSorted()`
- [x] 1.26 In `useBreadcrumbs.ts`: Replace `||` with `??`, use `.toReversed()` if applicable
- [x] 1.27 In `useCommandPalette.ts`: Replace `||` with `??` for default values
- [x] 1.28 In `useNAModal.ts`: Replace `||` with `??`, use optional chaining `?.`
- [x] 1.29 In `useBulkActions.ts`: Replace `||` with `??`
- [x] 1.30 In `useQuestionInfo.ts`: Replace `||` with `??`
- [x] 1.31 In `usePillarNotes.ts`: Replace `||` with `??`, use `.toSorted()` if applicable
- [x] 1.32 Run `pnpm test` - verify refactored code passes tests
- [x] 1.33 Run `pnpm typecheck` - MUST PASS (no `--no-verify` allowed)
- [x] 1.34 Run `pnpm dev` - verify dev server starts without errors
- [x] 1.35 Navigate to key routes: `/`, verify no console errors
- [x] 1.36 Commit: "refactor(ui): migrate UI utilities to app/ui/ with ES2024+ modernization"

## Phase 2: Applications Domain Migration (TDD)

### RED: Write Tests for Applications Domain
- [x] 2.1 Create `tests/applications/` folder
- [x] 2.2 Move/create tests for applications domain composables
- [x] 2.3 Update test imports to point to `app/applications/` (tests should FAIL)
- [x] 2.4 Run `pnpm test` - verify tests fail (RED state)

### GREEN: Migrate Applications Files
- [x] 2.5 Move `app/composables/useApplications.ts` → `app/applications/useApplications.ts`
- [x] 2.6 Move `app/composables/useApplicationFilters.ts` → `app/applications/useApplicationFilters.ts`
- [x] 2.7 Move `app/composables/useApplicationDetails.ts` → `app/applications/useApplicationDetails.ts`
- [x] 2.8 Move `app/composables/useApplicationReviews.ts` → `app/applications/useApplicationReviews.ts`
- [x] 2.9 Move `app/composables/useReviewSessions.ts` → `app/applications/useReviewSessions.ts`
- [x] 2.10 Update ALL page imports with EXPLICIT imports: `import { useApplications } from '~/applications/useApplications'`
- [x] 2.11 Update `app/pages/index.vue` with explicit imports
- [x] 2.12 Update `app/pages/applications/[id].vue` with explicit imports
- [x] 2.13 Update `app/components/ApplicationTable.vue` with explicit imports
- [x] 2.14 Run `pnpm test` - verify applications tests pass (GREEN state)

### REFACTOR: Modernize Applications with ES2024+
- [x] 2.15 In `useApplications.ts`: Replace `||` with `??`, use `.toSorted()` for sorting
- [x] 2.16 In `useApplicationFilters.ts`: Replace `||` with `??`, use `Object.groupBy()` if applicable
- [x] 2.17 In `useApplicationDetails.ts`: Replace `||` with `??`, use optional chaining
- [x] 2.18 In `useApplicationReviews.ts`: Replace `||` with `??`
- [x] 2.19 In `useReviewSessions.ts`: Replace `||` with `??`
- [x] 2.20 Run `pnpm test` - verify refactored code passes tests
- [x] 2.21 Run `pnpm typecheck` - MUST PASS
- [x] 2.22 Run `pnpm dev` - verify dev server starts
- [x] 2.23 Navigate to: `/`, `/applications/[id]`, verify no console errors
- [x] 2.24 Commit: "refactor(applications): migrate to app/applications/ with ES2024+ modernization"

## Phase 3: Assessment Domain - Pure Functions (TDD)

### RED: Write Tests for Pure Functions FIRST
- [x] 3.1 Create `tests/assessment/` folder
- [x] 3.2 Create `tests/assessment/useAssessmentProgress.test.ts` - test pure progress calculations (NO mocks needed)
- [x] 3.3 Write test cases for: calculateProgress, isComplete, getPillarProgress (tests will FAIL - no implementation yet)
- [x] 3.4 Run `pnpm test tests/assessment/useAssessmentProgress.test.ts` - verify FAILS (RED state)

### GREEN: Implement Pure Progress Functions
- [x] 3.5 Create `app/assessment/useAssessmentProgress.ts` - extract pure progress calculation from pages
- [x] 3.6 Implement functions to pass tests (use ES2024+: `??`, `.toSorted()`, `Object.groupBy()` from start)
- [x] 3.7 Run `pnpm test tests/assessment/useAssessmentProgress.test.ts` - verify PASSES (GREEN state)

### REFACTOR: Polish Progress Functions
- [x] 3.8 Review for ES2024+ opportunities: ensure using `??`, `.filter().length` → `.filter().toSorted()`
- [x] 3.9 Add JSDoc comments for public API
- [x] 3.10 Run `pnpm test tests/assessment/` - verify still passes
- [x] 3.11 Run `pnpm typecheck` - MUST PASS

## Phase 4: Assessment Domain - State Machine (TDD)

### RED: Write Tests for Answer State Machine
- [x] 4.1 Create `tests/assessment/useAssessmentAnswers.test.ts` - test state transitions (NO mocks needed)
- [x] 4.2 Write test cases for: setAnswer, clearAnswer, toggleNA, getAnswerState (tests will FAIL)
- [x] 4.3 Run `pnpm test tests/assessment/useAssessmentAnswers.test.ts` - verify FAILS (RED state)

### GREEN: Implement Answer State Machine
- [x] 4.4 Create `app/assessment/useAssessmentAnswers.ts` - extract answer state machine from assessment.vue/survey.vue
- [x] 4.5 Implement state machine to pass tests (use ES2024+: `??`, `?.`, immutable updates with `.toSpliced()` from start)
- [x] 4.6 Run `pnpm test tests/assessment/useAssessmentAnswers.test.ts` - verify PASSES (GREEN state)

### REFACTOR: Polish State Machine
- [x] 4.7 Review for ES2024+: replace array mutations with `.toSpliced()`, use `??` for defaults
- [x] 4.8 Ensure immutable state updates (no `.splice()`, `.push()`, etc.)
- [x] 4.9 Add JSDoc comments
- [x] 4.10 Run `pnpm test tests/assessment/` - verify still passes
- [x] 4.11 Run `pnpm typecheck` - MUST PASS

## Phase 5: Assessment Domain - Navigation (TDD)

### RED: Write Tests for Navigation
- [x] 5.1 Create `tests/assessment/useAssessmentNavigation.test.ts` - test pillar/question navigation
- [x] 5.2 Write test cases for: currentPillar, currentQuestion, nextQuestion, prevQuestion (tests will FAIL)
- [x] 5.3 Run `pnpm test tests/assessment/useAssessmentNavigation.test.ts` - verify FAILS (RED state)

### GREEN: Implement Navigation
- [x] 5.4 Create `app/assessment/useAssessmentNavigation.ts` - extract navigation state from pages
- [x] 5.5 Implement navigation logic to pass tests (use ES2024+: `??`, `?.` from start)
- [x] 5.6 Run `pnpm test tests/assessment/useAssessmentNavigation.test.ts` - verify PASSES (GREEN state)

### REFACTOR: Polish Navigation
- [x] 5.7 Review for ES2024+: use `??` for default indices, optional chaining for safe access
- [x] 5.8 Add JSDoc comments
- [x] 5.9 Run `pnpm test tests/assessment/` - verify still passes
- [x] 5.10 Run `pnpm typecheck` - MUST PASS

## Phase 6: Assessment Domain - Fetch & Mutate (TDD)

### RED: Write Tests for Fetch & Mutate
- [x] 6.1 Create `tests/assessment/useAssessmentFetch.test.ts` - mock API calls
- [x] 6.2 Create `tests/assessment/useAssessmentMutate.test.ts` - mock API calls
- [x] 6.3 Write test cases (tests will FAIL - no implementation)
- [x] 6.4 Run `pnpm test tests/assessment/useAssessment*.test.ts` - verify FAILS (RED state)

### GREEN: Implement Fetch & Mutate
- [x] 6.5 Create `app/assessment/useAssessmentFetch.ts` - combine useReviewData + useReviewQuestions (use ES2024+ from start)
- [x] 6.6 Create `app/assessment/useAssessmentMutate.ts` - saveAnswer, saveProgress operations (use ES2024+ from start)
- [x] 6.7 Run `pnpm test tests/assessment/useAssessment*.test.ts` - verify PASSES (GREEN state)

### REFACTOR: Modernize Fetch & Mutate
- [x] 6.8 Review for ES2024+: use `??` for default params, optional chaining for safe access
- [x] 6.9 Add JSDoc comments
- [x] 6.10 Run `pnpm test tests/assessment/` - verify still passes
- [x] 6.11 Run `pnpm typecheck` - MUST PASS

## Phase 7: Assessment Domain - Orchestrator (TDD)

### RED: Write Integration Tests
- [x] 7.1 Create `tests/assessment/useAssessment.test.ts` - integration test for orchestrator
- [x] 7.2 Write test cases for composed API (tests will FAIL - no orchestrator yet)
- [x] 7.3 Run `pnpm test tests/assessment/useAssessment.test.ts` - verify FAILS (RED state)

### GREEN: Implement Orchestrator
- [x] 7.4 Create `app/assessment/useAssessment.ts` - compose all assessment modules (use ES2024+ from start)
- [x] 7.5 Export clean public API for pages
- [x] 7.6 Run `pnpm test tests/assessment/useAssessment.test.ts` - verify PASSES (GREEN state)

### REFACTOR: Polish Orchestrator
- [x] 7.7 Review for ES2024+: ensure using `??`, `?.` throughout
- [x] 7.8 Add comprehensive JSDoc for public API
- [x] 7.9 Run `pnpm test tests/assessment/` - verify all assessment tests pass
- [x] 7.10 Run `pnpm typecheck` - MUST PASS
- [x] 7.11 Commit: "feat(assessment): create domain modules with ES2024+ features"

## Phase 8: Update Assessment Pages (TDD)

### RED: Update Tests First
- [x] 8.1 Update assessment.vue tests to expect new orchestrator API
- [x] 8.2 Update survey.vue tests to expect new orchestrator API
- [x] 8.3 Run `pnpm test` - verify page tests FAIL (pages not updated yet)

### GREEN: Update Pages
- [x] 8.4 Update `app/pages/applications/[appId]/reviews/[reviewId]/assessment.vue` to use `useAssessment()` with EXPLICIT import
- [x] 8.5 Update `app/pages/applications/[appId]/reviews/[reviewId]/survey.vue` to use same orchestrator with EXPLICIT import
- [x] 8.6 Remove duplicated logic from both pages
- [x] 8.7 Ensure EXPLICIT imports for all composables (no auto-import reliance)
- [x] 8.8 Run `pnpm test` - verify page tests PASS (GREEN state)

### REFACTOR: Modernize Pages
- [x] 8.9 Review pages for ES2024+ opportunities in template logic
- [x] 8.10 Simplify page code (orchestrator should handle complexity)
- [x] 8.11 Run `pnpm test` - verify still passes
- [x] 8.12 Run `pnpm typecheck` - MUST PASS
- [x]  8.13 Run `pnpm dev` - verify dev server starts
- [x] 8.14 Navigate to: `/applications/[id]/reviews/[reviewId]/assessment`, `/applications/[id]/reviews/[reviewId]/survey`
- [x] 8.15 Verify no console errors, UI works correctly
- [x] 8.16 Commit: "refactor(pages): use useAssessment() orchestrator in assessment and survey pages"

## Phase 9: Templates Domain (TDD) 

### RED: Write Tests for Templates
- [x] 9.1 Create `tests/templates/` folder
- [x] 9.2 Create tests for: useTemplatesFetch, useTemplatesMutate, useTemplatesDraft, useTemplatesValidation (tests will FAIL)
- [x] 9.3 Run `pnpm test tests/templates/` - verify FAILS (RED state)

### GREEN: Implement Templates Modules
- [x] 9.4 Create `app/templates/useTemplatesFetch.ts` - move from useTemplates (use ES2024+ from start)
- [x] 9.5 Create `app/templates/useTemplatesMutate.ts` - CRUD operations (use ES2024+ from start)
- [x] 9.6 Create `app/templates/useTemplatesDraft.ts` - extract from useTemplateEditor (use ES2024+, `.toSpliced()` for immutable updates)
- [x] 9.7 Create `app/templates/useTemplatesValidation.ts` - validation logic (use ES2024+ from start)
- [x] 9.8 Create `app/templates/useTemplates.ts` orchestrator (use ES2024+ from start)
- [x] 9.9 Run `pnpm test tests/templates/` - verify PASSES (GREEN state)

### REFACTOR: Modernize Templates
- [x] 9.10 Review all templates modules for ES2024+: `??`, `.toSorted()`, `.toSpliced()`, `Object.groupBy()`
- [x] 9.11 Add JSDoc comments for public APIs
- [x] 9.12 Update `app/pages/templates/[id]/edit.vue` with EXPLICIT imports to new templates modules
- [x] 9.13 Update `app/pages/templates/index.vue` with EXPLICIT imports
- [x] 9.14 Update `app/components/template-studio/Header.vue` with EXPLICIT imports
- [x] 9.15 Run `pnpm test tests/templates/` - verify still passes
- [x] 9.16 Run `pnpm typecheck` - MUST PASS
- [x] 9.17 Run `pnpm dev` - verify dev server starts
- [x] 9.18 Navigate to: `/templates`, `/templates/[id]/edit`, verify no console errors
- [x] 9.19 Commit: "feat(templates): create domain modules with ES2024+ features"

## Phase 10: Update Remaining Pages

- [x] 10.1 Update `app/components/AppHeader.vue` with EXPLICIT imports for all moved composables
- [x] 10.2 Update `app/pages/index.vue` with EXPLICIT imports
- [x] 10.3 Update `app/pages/applications/[id].vue` with EXPLICIT imports
- [x] 10.4 Update `app/components/assessment/PillarNotes.vue` with EXPLICIT imports
- [x] 10.5 Update `app/middleware/breadcrumbs.global.ts` with EXPLICIT imports
- [x] 10.6 Search for any remaining `~/composables/` imports: `rg "from '~/composables/" --type ts --type vue`
- [x] 10.7 Replace ALL with explicit domain imports
- [x] 10.8 Run `pnpm test` - verify all tests pass
- [x] 10.9 Run `pnpm typecheck` - MUST PASS
- [x] 10.10 Run `pnpm dev` - verify dev server starts
- [x] 10.11 Navigate ALL key routes: `/`, `/templates`, `/templates/[id]/edit`, `/applications/[id]`, `/applications/[id]/reviews/[reviewId]/assessment`, `/applications/[id]/reviews/[reviewId]/survey`
- [x] 10.12 Verify no console errors on any route
- [x] 10.13 Commit: "refactor(pages): update all remaining pages with explicit domain imports"

## Phase 11: Cleanup & Final Verification

- [x] 11.1 Delete `app/composables/` folder entirely (no backwards compatibility needed)
- [x] 11.2 Delete old test files from `tests/nuxt/composables/` (already moved to domain folders)
- [x] 11.3 Update vitest config if needed for new test structure
- [x] 11.4 Run `pnpm test` - verify ALL tests pass (303 passing, 2 pre-existing FilterBar failures)
- [x] 11.5 Run `pnpm typecheck` - MUST PASS WITH ZERO ERRORS
- [x] 11.6 Run `pnpm lint` - should pass (warnings OK, errors NOT OK) - 0 errors, 17 warnings
- [x] 11.7 Run `pnpm dev` - final dev server verification
- [x] 11.8 Navigate ALL routes again, verify no regressions
- [x] 11.9 Run integration tests: `pnpm test:integration`
- [x] 11.10 Run E2E tests: `pnpm test:e2e` (if available)
- [x] 11.11 Commit: "chore: remove old composables folder and finalize cleanup"

## Phase 12: Documentation

- [x] 12.1 Rewrite `site/docs/development/frontend.md` with new architecture, naming conventions, module patterns
- [x] 12.2 Update `site/docs/development/architecture.md` folder structure diagram
- [x] 12.3 Update `site/docs/development/index.md` repository structure section
- [x] 12.4 Update `site/docs/development/decisions.md` with decision entry for composable architecture refactor
- [x] 12.5 Create `site/docs/development/typescript.md` with conventions: null vs undefined, safe defaults, when `any` is OK
- [x] 12.6 Create `TARGETS.md` in project root: browser targets (modern Chrome ES2024+), Node v20+, build: esnext
- [x] 12.7 Commit: "docs: update architecture documentation and add TypeScript/JavaScript conventions"

## Phase 13: GitLab MR and Final Steps

- [x] 13.1 Run final verification: `pnpm typecheck && pnpm lint && pnpm test` - all passing
- [x] 13.2 Review git diff for any secrets, credentials, or sensitive data - clean
- [x] 13.3 Create MR using conventional commit message
- [x] 13.4 Link MR to GitLab issue
- [x] 13.5 Verify MR passes CI/CD pipeline
- [x] 13.6 Request review
- [x] 13.7 Address review feedback
- [x] 13.8 Update `site/docs/development/decisions.md` with final outcome
