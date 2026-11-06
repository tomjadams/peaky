## Context

Currently, `pnpm test:e2e` runs ALL Playwright tests including visual regression tests. Visual tests:
- Take 30+ seconds due to screenshot comparisons
- Auto-create baselines when missing (`updateSnapshots: 'missing'` is Playwright's default)
- Pollute working directory with untracked PNG files

The `test:visual` script exists but developers run `test:e2e` by habit, bundling slow visual tests with fast functional tests.

## Goals / Non-Goals

**Goals:**
- Fast feedback loop: functional e2e tests complete in <10 seconds
- Visual tests only run when explicitly requested
- Missing baselines FAIL tests instead of auto-creating files
- Clear developer workflow for updating baselines
- Fix pre-existing test failures for green CI (completeness)

**Non-Goals:**
- CI pipeline changes (future change)
- Refactoring existing visual test structure
- Adding new visual tests

## Decisions

### Decision 1: Exclude visual tests from default e2e run

**Choice**: Add `testIgnore` pattern to playwright.config.ts for visual directory.

**Rationale**: Keeps existing `test:e2e` command semantics while excluding slow tests. Alternative was renaming commands, but that breaks muscle memory.

### Decision 2: Configure strict baseline mode

**Choice**: Set `updateSnapshots: 'none'` in playwright.config.ts expect settings.

**Rationale**: Playwright creates missing snapshots by default. With `'none'`, missing baselines fail immediately, making accidental baseline drift impossible.

**Alternatives considered**:
- `updateSnapshots: 'missing'` - Still auto-creates, doesn't solve the problem
- CI-only enforcement - Delays feedback to pipeline, bad DX

### Decision 3: Dedicated visual test command with explicit update flag

**Choice**: Keep `test:visual` for running visual tests, `test:visual:update` for updating baselines.

**Rationale**: Existing scripts already follow this pattern. Just need to ensure `test:visual` doesn't auto-update.

### Decision 4: Update Makefile test target

**Choice**: Keep `make test` as fast path (unit tests only), add `make test:e2e` and `make test:visual`.

**Rationale**: Aligns with Makefile convention of quick feedback from default targets.

### Decision 5: Fix pre-existing test failures

**Choice**: Fix TypeScript error and flaky e2e tests discovered during verification.

**Rationale**: Ensuring all tests pass provides confidence in the new test separation and leaves the codebase in a better state. These are small, isolated fixes.

**Fixes needed**:
- TypeScript: Add type assertion in `templates/index.vue` for route params
- E2E locator fixes: Use more specific selectors to avoid strict mode violations

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Developers forget to run visual tests | Document in AGENTS.md; CI will catch regressions |
| Existing untracked baselines break builds | One-time cleanup: commit valid baselines or delete invalid ones |
| `updateSnapshots: 'none'` too strict | Can override per-run with `--update-snapshots` flag |
