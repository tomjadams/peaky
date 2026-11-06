## Context

The project currently maintains visual regression tests using Playwright's screenshot comparison feature. These tests:
- Live in `tests/e2e/visual/*.spec.ts`
- Store baselines in `tests/e2e/__snapshots__/`
- Run via `pnpm test:visual` and `make test:visual`
- Require baseline updates for every UI change (intentional or not)

Experience has shown these tests add maintenance burden without catching meaningful regressions. Accessibility testing with axe-core would provide more actionable, valuable feedback.

## Goals / Non-Goals

**Goals:**
- Remove all visual regression test infrastructure
- Add accessibility testing with axe-core integrated into E2E tests
- Simplify the test matrix (unit + e2e + a11y instead of unit + e2e + visual)
- Maintain fast feedback loop for developers

**Non-Goals:**
- Replacing visual testing with another visual tool (e.g., Percy, Chromatic)
- Adding comprehensive a11y audits to every page (focus on critical paths)
- Changing the component or composable unit test approach

## Decisions

### Decision 1: Use `@axe-core/playwright` for accessibility testing

**Choice**: Integrate axe-core directly with Playwright rather than a separate tool.

**Rationale**:
- Same test runner infrastructure as existing E2E tests
- No additional CI configuration needed
- Can run a11y checks inline with functional E2E tests or separately
- Well-maintained, WCAG-aligned ruleset

**Alternatives considered**:
- `pa11y`: Less Playwright integration, older API
- Browser extensions: Not CI-compatible
- Manual audits: Not scalable

### Decision 2: Replace `make test:visual` with `make test:a11y`

**Choice**: Add a dedicated a11y test target rather than bundling with E2E.

**Rationale**:
- Keeps test paths explicit and discoverable
- Allows running a11y tests independently for focused feedback
- Maintains parallel structure with other test targets

### Decision 3: Organize a11y tests in `tests/e2e/a11y/`

**Choice**: Mirror the visual test directory structure.

**Rationale**:
- Consistent with existing test organization
- Easy to find and maintain
- Can be excluded from regular e2e runs if needed

### Decision 4: Use NuxtUI `UTooltip` for accessible tooltips

**Choice**: Replace custom CSS tooltips with NuxtUI's `UTooltip` component for accessibility.

**Rationale**:
- `UTooltip` provides built-in accessibility (ARIA attributes, keyboard support)
- Consistent with NuxtUI component library already in use
- Eliminates custom CSS tooltip code, reducing maintenance
- Requires `UApp` wrapper in `app.vue` for context providers

**Implementation notes**:
- Use `:delay-duration="0"` for instant tooltip display
- Use `:ui="{ content: 'bg-slate-800 text-white text-sm font-medium px-3 py-1.5' }"` to match original styling
- Use `:content="{ side: 'right', sideOffset: 8 }"` for positioning
- Add `sr-only` spans for screen reader accessibility

## Risks / Trade-offs

**[Risk]** Loss of visual consistency checks → Rely on PR review process and component storybook (if added later)

**[Risk]** A11y tests may be flaky with dynamic content → Use axe's `disableRules` for known false positives, document exceptions

**[Trade-off]** A11y tests catch different issues than visual tests → Acceptable trade-off given the low value of visual tests in this project
