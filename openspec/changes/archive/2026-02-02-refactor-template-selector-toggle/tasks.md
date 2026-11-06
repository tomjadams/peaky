**GitLab Issue:** [#2](https://gitlab.is.adyen.com/heitorl/orr/-/issues/2)

## 1. Refactor Toggle Button

- [x] 1.1 Remove the two external toggle buttons (expand/collapse) from outside the `<aside>` element
- [x] 1.2 Add a header section inside the sidebar with the toggle button using `flex justify-end p-2`
- [x] 1.3 Replace chevron icons with Lucide `panel-left-close` (expanded) and `panel-left-open` (collapsed) icons
- [x] 1.4 Use single toggle button with conditional `aria-label` based on collapsed state

## 2. Styling and Transitions

- [x] 2.1 Apply hover states (`hover:bg-primary/10 hover:text-primary`) to the new toggle button
- [x] 2.2 Ensure toggle button uses `currentColor` for icon theming in light/dark modes
- [x] 2.3 Verify toggle position adjusts correctly in both collapsed (`w-24`) and expanded (`w-64`) states

## 3. Verification

- [x] 3.1 Run `pnpm run lint --fix` to ensure code quality
- [x] 3.2 Verify collapse/expand functionality works as before
- [x] 3.3 Test keyboard accessibility (toggle should be focusable and activatable)
- [x] 3.4 Add Assessment Page visual regression tests for both expanded and collapsed states
- [x] 3.5 Run visual regression tests and update baselines (`pnpm test:visual --update-snapshots --grep "Assessment Page"`)

## 4. Documentation

- [x] 4.1 Update decision log (`docs/decisions/DECISION_LOG.md`) with toggle refactor rationale
