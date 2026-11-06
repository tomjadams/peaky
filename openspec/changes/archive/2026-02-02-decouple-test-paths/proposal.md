## Why

Running all tests on every change slows development. Visual regression tests are slow (~30+ seconds) and should only run when intentionally updating UI. Additionally, visual tests are creating/updating baseline snapshots on every run instead of failing when baselines are missing, polluting the working directory with untracked files.

## What Changes

- Separate test commands into fast path (unit + functional e2e) and slow path (visual regression)
- Configure Playwright to **fail** when baseline snapshots are missing instead of auto-creating them
- Add explicit `--update-snapshots` workflow for intentional baseline updates
- Update Makefile with distinct test targets: `test` (fast), `test:visual` (slow), `test:all`
- Fix pre-existing test failures discovered during verification (for completeness)

## Capabilities

### New Capabilities
- `test-path-separation`: Decoupled test execution paths allowing fast iteration during development while preserving comprehensive visual regression coverage for intentional UI changes

### Modified Capabilities
<!-- No spec-level behavior changes - this is infrastructure/tooling only -->

## Impact

- **Config**: `playwright.config.ts` - add `updateSnapshots: 'none'` to prevent auto-creation
- **Scripts**: `package.json` - reorganize test scripts for clear fast/slow separation
- **Makefile**: Add `test:visual`, `test:all` targets; keep `test` as fast path
- **Docs**: `AGENTS.md` - update testing guidance to reflect new workflow
- **CI**: May need pipeline updates to run visual tests separately (out of scope for this change)

## Pre-existing Test Failures (to fix for completeness)

### TypeScript Error
- `app/pages/templates/index.vue` (lines 197, 202): Type 'unknown' not assignable to RouteParamValueRaw

### E2E Test Failures (9 tests)

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `home.spec.ts:12` | displays navigation sidebar | Strict mode: 2 navigation elements found (sidebar + breadcrumb) |
| `home.spec.ts:28` | can filter by status | aria-selected not updating to "true" on Ready tab click |
| `data-table.spec.ts:28` | can select rows with checkboxes | Bulk action bar not becoming visible after selection |
| `data-table.spec.ts:42` | bulk action bar shows selection count | "1 selected" text not appearing |
| `data-table.spec.ts:54` | can clear selection | "selected" text not visible |
| `navigation.spec.ts:9` | navigates to templates page | Timeout finding templates link in sidebar |
| `navigation.spec.ts:17` | sidebar shows active state | Templates link not found |
| `templates.spec.ts:8` | displays templates list | Strict mode: 5 elements match regex |
| `templates.spec.ts:15` | can view template details | Strict mode: 2 elements match "Peak Season" |
