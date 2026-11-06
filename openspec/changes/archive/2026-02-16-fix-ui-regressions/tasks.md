## 1. Setup

- [x] 1.1 Create GitLab issue for the fix-ui-regressions change (`glab`)
- [x] 1.2 Create feature branch `fix/ui-regressions` from `main`

## 2. Command Palette Fixes

- [x] 2.1 Remove `sm:my-[12vh]` from UModal `ui.content` override in `AppCommandPalette.vue`, keeping only `max-w-3xl`
- [x] 2.2 Replace `@keydown` Escape handler on inner div with VueUse `onKeyStroke('Escape', ...)` scoped to `isOpen === true`; keep ArrowUp/ArrowDown/Enter on the inner div `@keydown`
- [x] 2.3 Write E2E test: command palette opens centered, escape closes it after clicking outside and reopening

## 3. Global Input Focus/Hover Fix

- [x] 3.1 Add `focus:hover:ring-primary dark:focus:hover:ring-primary` to the global input `base` style in `app.config.ts`
- [x] 3.2 Add same fix to global textarea `base` style in `app.config.ts`
- [x] 3.3 Verify SearchInput on homepage: focus ring visible during hover in both light and dark modes (playwright-cli)

## 4. DataTable Checkbox Contrast Fix

- [x] 4.1 Add explicit dark-mode border styling to `UCheckbox` instances in `DataTable.vue` so checkboxes remain visible against `hover:bg-accented` row background
- [x] 4.2 Verify checkbox visibility on hovered rows in dark mode (playwright-cli)

## 5. Pillar Delete Button UX

- [x] 5.1 In `PillarTabs.vue`, hide the delete button by default (`w-0 opacity-0 overflow-hidden`) and reveal on pillar tab hover via `group-hover` with width/opacity transition
- [x] 5.2 Ensure the delete button is vertically centered within the pillar tab (fix existing misalignment)
- [x] 5.3 Keep the delete button visible while its confirmation popover is open (even if mouse leaves the tab)
- [x] 5.4 Verify the hover-reveal animation is smooth in both light and dark modes (playwright-cli)

## 6. Audit & Verification

- [x] 6.1 Run `ui-review` subagent on `AppCommandPalette.vue`, `SearchInput.vue`, `DataTable.vue`, `PillarTabs.vue`, and `app.config.ts`
- [x] 6.2 Run playwright-cli to visually verify all pages with input fields (homepage, template studio, assessment) in both light and dark modes
- [x] 6.3 Run existing E2E test suite (`pnpm test:e2e`) and fix any failures - **Result: 57/65 passed**. New test passes. 6 pre-existing failures unrelated to UI regression fixes.
- [x] 6.4 Run `pnpm lint` and `pnpm typecheck`

## 7. Finalize

- [x] 7.1 Update decision log in `site/docs/development/decisions.md`
- [x] 7.2 Create GitLab MR with conventional commit title `fix(ui): resolve input focus, command palette, and dark mode regressions`
