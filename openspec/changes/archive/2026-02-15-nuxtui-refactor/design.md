## Context

The frontend currently relies on a large set of bespoke Tailwind components across `app/components/**` and `app/pages/**`. This creates inconsistent micro‑interactions (layout shifts in accordions, flicky tab switches, sidebar text shifts) and increases maintenance surface area. NuxtUI is installed and global styles are already loaded (`@nuxt/ui` in `main.css`), but most components are not yet leveraged. The command palette is a first‑party UI with stable command registry logic that must be preserved while its visual layer is swapped to NuxtUI. Accessibility testing includes axe‑core (via Playwright), so contrast improvements (notably AnswerToggle Yes/No/N/A) are required.

Additionally, the color system is fragmented across three conflicting locations (`app.config.ts` says `primary: 'green'`, `main.css` overrides `--color-primary` to `#135bec` deep blue, and components scatter `indigo-*`/`blue-*` classes freely), creating a maintenance nightmare. The Peaky logo uses a sky‑blue→green gradient (`#0ea5e9`→`#22c55e`) that none of the current "primary" values match.

## Goals / Non-Goals

**Goals:**
- Unify the color system into a single source of truth using NuxtUI's layered theming (`app.config.ts` → `main.css @theme` → `--ui-*` CSS vars), eliminating scattered hex values and conflicting overrides.
- Replace custom UI primitives with NuxtUI components while preserving existing visual styling through global theme defaults and per‑component `ui` overrides.
- Eliminate interaction jank in accordions/tabs/sidebar toggles by using NuxtUI‑native transitions and stable layouts.
- Swap the command palette UI to NuxtUI `CommandPalette` without changing the command registry API or keyboard behavior.
- Improve contrast for AnswerToggle (especially N/A) and other low‑contrast controls to satisfy axe‑core a11y checks.

**Non-Goals:**
- Redesigning product UX or changing domain behavior.
- Removing drag‑and‑drop behavior in Template Studio pillar tabs or question ordering.
- Rewriting data/composable logic or backend APIs.
- Replacing custom charting (e.g., SessionTimeline) or other bespoke visualizations.

## Decisions

1. **NuxtUI‑first primitives with wrappers where needed**
   - Use NuxtUI components (Tabs, Accordion, Modal/Slideover, Tooltip, Input, Select/Dropdown, Badge, Button) as the base UI.
   - Keep existing higher‑level component APIs (e.g., `DataTable.vue`, `AnswerToggle.vue`) but implement them as wrappers around NuxtUI primitives to avoid churn in page code.
   - **Exception — DataTable:** After extensive attempts (~2 hours) to style UTable's tbody rows (hover states, dividers, contrast), the `:ui` prop and global config overrides failed to apply consistently. DataTable remains a bespoke Tailwind CSS implementation using native HTML `<table>` elements with NuxtUI components (UCheckbox, UTooltip, UButton) for interactive cell elements. This provides full styling control while maintaining the established column/slot API.
   - **Alternative considered:** Full replacement of custom components without wrappers. **Rejected** to avoid large call‑site diffs and preserve behavior contracts.

2. **Color palette: single source of truth with NuxtUI's layered system**
   - **Layer 1 — `app.config.ts`**: semantic aliases only — `primary: 'sky'`, `secondary: 'green'`, `neutral: 'slate'`. These map NuxtUI component `color` props to Tailwind color scales. Changeable at runtime.
   - **Layer 2 — `main.css` `@theme static`**: custom color scales (only when Tailwind defaults don't suffice) and font overrides. Currently has a custom green scale identical to Nuxt's default — remove it. No `--color-primary` overrides here; that's NuxtUI's job via `--ui-primary`.
   - **Layer 3 — `main.css` `:root` / `.dark`**: fine‑tune `--ui-primary`, `--ui-bg`, `--ui-text-*` shade mappings for light/dark contrast if NuxtUI defaults aren't ideal.
   - **Layer 4 — Components**: use only semantic classes (`text-primary`, `bg-success`, `text-muted`, `bg-elevated`, `border-default`) and NuxtUI `color` props. Never raw `indigo-500`, `blue-600`, or hex values for brand/UI colors.
   - Palette aligned with logo gradient (`#0ea5e9`→`#22c55e`): `sky` for primary brand, `green` for secondary/completion/success.
   - Remove bespoke `--color-action-*` / `--color-text-secondary*` tokens; replace with NuxtUI semantic classes (`text-success`, `text-error`, `text-muted`, `text-dimmed`).
   - **Alternative considered:** Keep the current `#135bec` blue as primary. **Rejected** because it conflicts with the logo identity and creates yet another "source of truth."

3. **Global theme defaults + per‑component overrides**
   - Define radii, transitions, and shared NuxtUI component defaults in `app.config.ts`/`nuxt.config.ts`.
   - Use `ui` prop overrides on components for view‑specific variants (e.g., Template Studio tabs vs Review tabs) while keeping shared defaults global.
   - **Alternative considered:** Only per‑component styling. **Rejected** to prevent drift and duplication.

4. **Command palette UI swap only**
   - Preserve `useCommandPalette` composable logic and command registration APIs.
   - Replace `AppCommandPalette.vue` template with NuxtUI `CommandPalette` while mapping existing groups, shortcuts, loading states, and actions.
   - **Alternative considered:** Full replacement of registry logic. **Rejected** due to proven stability and existing feature set (route‑scoped commands, async sources).

5. **Accessibility and contrast hardening**
   - Update AnswerToggle (Yes/No/N/A) to meet contrast expectations in both light/dark themes; avoid low‑contrast gray on gray for N/A.
   - Validate with axe‑core checks during refactor; adjust other low‑contrast controls opportunistically.
   - **Alternative considered:** Defer contrast changes. **Rejected** due to explicit requirement and test coverage.

## Risks / Trade-offs

- **Risk:** Visual regressions from NuxtUI defaults. → **Mitigation:** Apply global theme + per‑component `ui` overrides and spot‑check affected views.
- **Risk:** Color palette change affects every view at once. → **Mitigation:** Do the palette unification step first (before component swaps) so all subsequent work uses the correct tokens. The shift from blue→sky is subtle; green stays as success/secondary.
- **Risk:** Behavior mismatch in command palette interactions. → **Mitigation:** Preserve `useCommandPalette` logic, map existing keyboard controls, and keep grouping behavior.
- **Risk:** Incremental refactor causes mixed UI styles temporarily. → **Mitigation:** Migrate in slices and keep wrappers to avoid partial re‑styling.
- **Risk:** Accessibility regressions due to component swaps. → **Mitigation:** Run axe‑core a11y checks and explicitly improve contrast on AnswerToggle and similar controls.
- **Risk:** Token/time waste running full test suites on intermediate broken states. → **Mitigation:** Use typecheck-only during migration; defer full lint/test/a11y/visual suite to a single pass after all component work is done.

## Migration Plan

1. Update specs for command‑palette/common‑ui/assessment/testing/branding to codify NuxtUI adoption, color palette, and contrast requirements.
2. **Unify color palette first** — update `app.config.ts` (semantic aliases), rewrite `main.css` (remove conflicting overrides, keep only `@theme` font + shade fine‑tuning), and audit/replace ad‑hoc color classes across all components.
3. Build/adjust global NuxtUI theme defaults (radii, transitions) and establish per‑component override presets.
4. Refactor assessment AnswerToggle + QuestionRow (contrast fix) and template‑studio question expand/collapse to NuxtUI Accordion/Disclosure patterns.
5. Migrate tabs (assessment/review/template pages) to NuxtUI Tabs, preserving variants via `ui` overrides.
6. Wrap DataTable with NuxtUI Table while preserving column API and slots. Replace raw form elements with NuxtUI primitives.
7. Replace all bespoke modals (Share, Markdown, NAReason, Preview, Publish Confirm, `window.confirm`/`alert`) with `UModal`. Convert MoreInfoPanel to `USlideover`. Replace custom tooltips with `UTooltip`.
8. Replace raw `<button>` elements with `UButton`. Replace hand‑crafted badges with `UBadge`. Introduce `useToast()` for feedback.
9. Swap command palette UI to NuxtUI CommandPalette.
10. **Full validation pass** — lint, typecheck, unit tests, a11y checks, visual baseline regen (see below).
11. Update dev docs at `site/docs/development/` to reflect new conventions.

### Validation Strategy

This refactor is too large for per-commit full test runs. Intermediate states **will** break tests (stale snapshots, missing imports from not-yet-migrated components, color class mismatches in a11y checks, etc.). Wasting tokens re-running and re-fixing half-broken suites slows everything down.

- **During migration (steps 2–9):** only run `pnpm typecheck` as a lightweight smoke test after each logical group of changes. Typecheck catches real breakage (wrong props, missing imports) without a11y/visual noise.
- **After all migrations are complete (step 10):** run the full suite once — `pnpm lint` → `pnpm typecheck` → `pnpm test:run` → `pnpm test:a11y` → `pnpm test:visual:update`. Fix issues in a single pass.
- **Do NOT** update visual baselines until the full refactor is stable.

## Open Questions

- Which NuxtUI component variants should be standardized globally vs. overridden per view?
Default everything to standardized globally. NuxtUI `:ui` should still allow overrides.

- Should DataTable remain as a wrapper component name or be renamed to NuxtUI‑native naming later?
Rename it.
