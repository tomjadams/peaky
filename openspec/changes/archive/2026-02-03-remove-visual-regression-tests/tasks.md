## 1. Setup

- [x] 1.1 Create GitLab issue for tracking this change (https://gitlab.is.adyen.com/heitorl/orr/-/issues/7)

## 2. Remove Visual Regression Tests

- [x] 2.1 Delete visual test files (`tests/e2e/visual/*.spec.ts`)
- [x] 2.2 Delete baseline snapshots directory (`tests/e2e/__snapshots__/`)
- [x] 2.3 Remove `test:visual` and `test:visual:update` scripts from `package.json`
- [x] 2.4 Remove `visual` project from `playwright.config.ts`

## 3. Add Accessibility Testing

- [x] 3.1 Install `@axe-core/playwright` as devDependency
- [x] 3.2 Create `tests/e2e/a11y/` directory
- [x] 3.3 Create accessibility test for home page (`tests/e2e/a11y/pages.spec.ts`)
- [x] 3.4 Add `test:a11y` script to `package.json`
- [x] 3.5 Add `a11y` project to `playwright.config.ts` (if needed)

## 4. Update Makefile

- [x] 4.1 Remove `test:visual` target
- [x] 4.2 Add `test:a11y` target
- [x] 4.3 Update `test:all` target to include a11y instead of visual

## 5. Update Documentation

- [x] 5.1 Update `AGENTS.md` testing section (remove visual references, add a11y)
- [x] 5.2 Update decision log (`site/docs/maintainers/decisions.md`) with rationale

## 6. Fix Accessibility Violations (demonstrates a11y test value)

- [x] 6.1 Fix missing `aria-label` on navigation links in `NavigationSidebar.vue`
- [x] 6.2 Fix color contrast for progress percentages in `TemplateSelectorSidebar.vue`
- [x] 6.3 Add `aria-label` to file input in `AttachmentUpload.vue`
- [x] 6.4 Remove a11y test exclusions (all violations now fixed)

## 7. Finalize

- [x] 7.1 Run `pnpm lint --fix` and `pnpm typecheck`
- [x] 7.2 Run `make test` and `make test:e2e` to verify no regressions
- [x] 7.3 Run `make test:a11y` to verify all a11y tests pass
- [x] 7.4 Create MR with `glab` CLI (https://gitlab.is.adyen.com/heitorl/orr/-/merge_requests/30)
