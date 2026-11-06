## 1. Core Composable Update

- [x] 1.1 Update `useCommandPalette.ts` to use `navigateTo()` instead of `router.push()`

## 2. Component Navigation Fixes

- [x] 2.1 Update `AppHeader.vue` survey mode toggle to use explicit param-based paths with `navigateTo()`
- [x] 2.2 Update `templates/index.vue` row click and action handlers to use `navigateTo()`

## 3. Application Pages Navigation Fixes

- [x] 3.1 Update `applications/[id].vue` start review and review click handlers to use `navigateTo()`
- [x] 3.2 Update `applications/[id]/reviews/new.vue` cancel and next handlers to use `navigateTo()`
- [x] 3.3 Update `applications/[appId]/reviews/[reviewId]/index.vue` assessment and pillar navigation to use `navigateTo()`

## 4. Verification

- [x] 4.1 Run unit tests: `pnpm test`
- [x] 4.2 Run E2E tests: `pnpm test:e2e`
- [x] 4.3 Run linting: `pnpm run lint --fix`
- [x] 4.4 Verify command palette navigation works correctly
- [x] 4.5 Verify survey mode toggle works correctly

## 5. Documentation and Cleanup

- [x] 5.1 Update decision log: Remove TD-009 from tech debt section
- [x] 5.2 Commit changes with conventional commit messages
- [x] 5.3 Create MR with summary of changes
