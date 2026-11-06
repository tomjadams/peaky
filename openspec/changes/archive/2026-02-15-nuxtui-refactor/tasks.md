## 1. Tracking & Decisions

- [x] 1.1 Create a GitLab issue for the NuxtUI refactor using `glab issue create`
- [x] 1.2 Update decision log at `site/docs/development/decisions.md` with NuxtUI adoption + command palette UI swap + color palette unification + a11y contrast focus

## 2. Color Palette Unification (Single Source of Truth)

> **Problem:** Colors are scattered across three conflicting locations:
> - `app/app.config.ts` declares `primary: 'green'` (NuxtUI runtime alias)
> - `app/assets/css/main.css` overrides `--color-primary` to `#135bec` (deep blue), defines custom `--color-green-*` scale, and adds bespoke `--color-action-*` / `--color-text-*` / `--color-background-*` tokens
> - Components use a mix of `indigo-*`, `blue-*`, `primary`, and raw `--color-*` vars with no consistency
>
> **Solution:** NuxtUI provides a clean layered system -- use it properly:
> 1. **`app.config.ts`** → semantic color aliases only (`primary`, `secondary`, `neutral`, etc.) pointing to named Tailwind colors
> 2. **`main.css` `@theme static`** → custom color scales (only if Tailwind defaults don't fit) and font overrides
> 3. **`main.css` `:root` / `.dark`** → fine‑tune `--ui-*` CSS variable shades for light/dark contrast
> 4. **Components** → use only semantic classes (`text-primary`, `bg-success`, `text-muted`, `bg-elevated`, `border-default`) and NuxtUI `color` props; never raw `indigo-500` or hex values
>
> **Proposed palette (aligned with logo gradient `#0ea5e9` → `#22c55e`):**
> | Semantic | Tailwind color | Purpose |
> |---|---|---|
> | `primary` | `sky` | Main CTAs, active navigation, brand accent (logo start) |
> | `secondary` | `green` | Completion states, readiness star, logo endpoint |
> | `success` | `green` | Positive answers (Yes), completed assessments |
> | `info` | `sky` | Informational badges, help text |
> | `warning` | `amber` | Caution states, No answers, pending items |
> | `error` | `red` | Destructive actions, critical risk, validation errors |
> | `neutral` | `slate` | Text, borders, backgrounds (unchanged) |

- [x] 2.1 Update `app/app.config.ts` to set `primary: 'sky'`, `secondary: 'green'`, `neutral: 'slate'`
- [x] 2.2 Register `secondary` in `nuxt.config.ts` under `ui.theme.colors` (NuxtUI only ships `primary` by default; `secondary` requires explicit registration)
- [x] 2.3 Rewrite `app/assets/css/main.css`:
  - Remove the custom `--color-green-*` scale (use Tailwind's built‑in green via `secondary`)
  - Remove `--color-primary` / `--color-primary-light` / `--color-primary-dark` overrides (let NuxtUI handle via `--ui-primary`)
  - Remove bespoke `--color-action-*` / `--color-text-secondary*` tokens; replace consumers with NuxtUI semantic classes (`text-success`, `text-error`, `text-muted`, `text-dimmed`)
  - Keep `--color-background-light` / `--color-background-dark` only if NuxtUI's `--ui-bg` doesn't cover the need; otherwise migrate to `bg-default` / `bg-muted`
  - Fine‑tune `--ui-primary` shade for light/dark if the default `sky-500`/`sky-400` contrast isn't sufficient
  - Keep `--font-sans` definition
- [x] 2.4 Audit and replace ad‑hoc color classes across all components and pages:
  - **Brand/accent colors** — `indigo-*` → `primary`; `blue-*` → `primary` or `info` depending on intent; `emerald-*` used for completion → `secondary` or `success`
  - **Neutral palette** — replace raw `text-slate-900`, `text-slate-700`, `text-slate-600`, `text-slate-500`, `text-slate-400` with NuxtUI text semantics (`text-highlighted`, `text-default`, `text-toned`, `text-muted`, `text-dimmed`); replace `bg-white`/`bg-slate-50`/`bg-slate-100`/`bg-slate-200` with `bg-default`/`bg-muted`/`bg-elevated`/`bg-accented`; replace `border-slate-200`/`border-slate-700` with `border-default`/`border-muted`/`border-accented`; apply the matching `dark:` variant removals since NuxtUI semantic classes handle dark mode automatically
  - **Semantic status colors** — `green-*` for success → `text-success` / `bg-success`; `amber-*`/`yellow-*` for warning → `text-warning`; `red-*` for error/danger → `text-error`
  - **Legacy CSS var consumers** — replace `--color-action-positive`/`--color-action-negative`/`--color-action-dangerous` usages with `text-success`/`text-warning`/`text-error`; replace `text-text-muted`/`text-text-success`/`text-text-warning` (bespoke tokens) with NuxtUI equivalents
  - **Scope note:** this is the largest task in the refactor (~40+ files, hundreds of class replacements). Consider doing it per‑component as each component is migrated to NuxtUI, rather than as a single sweeping pass
- [x] 2.5 Update `openspec/specs/branding/spec.md` to document the final palette decision and the single‑source‑of‑truth layering convention

## 3. NuxtUI Theme Foundations

- [x] 3.1 Configure global NuxtUI theme defaults in `nuxt.config.ts` (radii, transitions) aligned with the new palette
- [x] 3.2 Define shared `ui` override presets for component variants (e.g., review tabs vs template studio tabs)

## 4. Assessment Contrast & Toggles

- [x] 4.1 Refactor `app/components/assessment/AnswerToggle.vue` to NuxtUI controls with WCAG‑AA contrast for Yes/No/N/A
- [x] 4.2 Update `app/components/assessment/QuestionRow.vue` to ensure contrast and N/A dimming remain correct

## 5. Accordions, Tabs, and Navigation

- [x] 5.1 Replace template‑studio question expand/collapse with NuxtUI Accordion/Disclosure patterns while preserving animations
- [x] 5.2 Migrate review/assessment tabs to NuxtUI Tabs using per‑view `ui` overrides
- [x] 5.3 Update TemplateSelectorSidebar collapse/toggle to use NuxtUI patterns and eliminate text shift
- [x] 5.4 Refactor `SessionCard.vue` expand/collapse to NuxtUI Accordion/Disclosure (currently uses manual `<Transition>` + CSS)
- [x] 5.5 Keep Template Studio pillar drag‑and‑drop while aligning tab styling with NuxtUI primitives

## 6. Tables, Inputs, Dropdowns, Tooltips, and Modals

- [x] 6.1 ~~Wrap `app/components/DataTable.vue` around NuxtUI Table without changing column API or slots~~ **REVISED:** Kept DataTable as a bespoke Tailwind CSS table using native HTML `<table>` elements. UTable's tbody row styling (hover, dividers, contrast) proved difficult to override despite multiple approaches (`:ui` prop, global config, CSS selectors). The bespoke implementation uses NuxtUI components for interactive elements (UCheckbox, UTooltip, UButton) within cells while maintaining full control over table styling via Tailwind classes
- [x] 6.2 Replace `SearchInput.vue` / `FilterBar.vue` with NuxtUI `UInput` / `URadioGroup` equivalents
- [x] 6.3 Replace raw `<input>`, `<select>`, `<textarea>` across Template Studio (`QuestionCard`, `PillarTabs` rename input, `Header` name input, `ShareModal` email+select, `MarkdownModal` textareas) and `DataTable` checkbox inputs with NuxtUI form primitives (`UInput`, `USelect`, `UTextarea`, `UCheckbox`)
- [x] 6.4 Refactor `RiskLevelDropdown.vue` to use NuxtUI `UDropdownMenu` or `USelectMenu` (currently hand‑rolls Teleport + positioning + click‑outside)
- [x] 6.5 Replace custom tooltips with `UTooltip` in header/toolbars/table actions/RiskLevelDropdown
- [x] 6.6 Replace Share/Markdown/NAReason modals and the two inline Teleport modals in `templates/[id]/edit.vue` (Preview overlay + Publish confirmation) with `UModal`
- [x] 6.7 Convert `MoreInfoPanel.vue` to `USlideover` (clarify: currently a fixed‑position persistent panel; confirm whether it should remain always‑open or become on‑demand)
- [x] 6.8 Replace `window.confirm()` / `alert()` calls in `PillarNotes.vue`, `templates/[id]/edit.vue`, and `assessment.vue` with `UModal` confirmation dialogs

## 7. Buttons, Badges, and Cards

- [x] 7.1 Replace raw `<button>` elements in `BulkActionBar.vue` (Transfer/Archive/Delete/Clear) with `UButton`
- [x] 7.2 Replace hand‑crafted status badges in `ReviewCard.vue` and `StatusIndicator.vue` with `UBadge`
- [x] 7.3 Replace raw `<button>` in `ThemeToggle.vue` with `UButton` icon‑only variant
- [x] 7.4 Replace raw `<button>` elements in `AppHeader.vue` (command palette trigger, survey mode toggle) with `UButton`
- [x] 7.5 Evaluate `ReviewCard.vue` and `SessionCard.vue` for `UCard` adoption (keep if wrapper adds value, skip if it constrains layout)

## 8. Toasts / Notifications

- [x] 8.1 Introduce `useToast()` for success/error feedback where `console.log`/`console.error` are used as placeholders (e.g., `PillarNotes.vue` upload error, `ShareModal.vue` collaborator add/remove)

## 9. Command Palette UI Swap

- [x] 9.1 Refactor `app/components/AppCommandPalette.vue` to use NuxtUI `CommandPalette` while preserving `useCommandPalette` behavior

## 10. Reference: Already‑Migrated Components

> `AttachmentUpload.vue` already uses `UForm`, `UFormField`, `UFileUpload`, `UIcon`. Use it as a pattern reference for NuxtUI form integration.

## 11. Validation & A11y

> **Important — validation strategy for a large refactor:**
>
> This refactor touches ~40+ files across color classes, component swaps, and template changes. Running the full lint/typecheck/test/a11y suite after every small commit is wasteful — intermediate states **will** have failures (missing imports from not-yet-migrated components, stale snapshot tests, color class mismatches, etc.).
>
> **Approach:**
> 1. **During migration (sections 2–9):** only run **typecheck** (`pnpm typecheck`) as a lightweight smoke test after each logical group of changes (e.g., after finishing all modals, or all buttons). Typecheck catches real breakage (wrong props, missing imports) without the noise of visual/a11y tests failing on half-migrated UI.
> 2. **After all component migrations are done (after section 9):** run the **full** validation suite once:
>    - `pnpm lint` + `pnpm typecheck` — fix all lint/type errors
>    - `pnpm test:run` — fix unit test failures (snapshot updates, assertion changes)
>    - `pnpm test:a11y` — resolve contrast violations
> 3. **Do NOT** commit visual baseline updates until the full refactor is stable.

- [x] 11.1 Run `pnpm typecheck` — fix type errors introduced across all migration sections
- [x] 11.2 Run `pnpm lint` — fix lint issues
- [x] 11.3 Run `pnpm test:run` — fix unit test failures and update snapshots
- [x] 11.4 Run `pnpm test:a11y` — resolve any remaining contrast violations

## 12. Update Development Documentation

> The dev docs at `site/docs/development/` need to reflect the new conventions introduced by this refactor.

- [x] 12.1 Update `site/docs/development/frontend.md`:
  - Add a **Color & Theming** section documenting the NuxtUI layered color system (`app.config.ts` → `main.css @theme` → `--ui-*` vars → semantic classes in components)
  - Document the semantic color palette (primary=sky, secondary=green, success, info, warning, error, neutral) and when to use each
  - Document the NuxtUI semantic text classes (`text-default`, `text-muted`, `text-dimmed`, `text-highlighted`) and background classes (`bg-default`, `bg-muted`, `bg-elevated`) to replace raw `slate-*` usage
  - Add a **Components** section documenting that NuxtUI primitives are the default (UButton, UInput, UModal, UTabs, UTable, UBadge, etc.) and bespoke Tailwind primitives should not be introduced
  - Document the `useToast()` pattern for user feedback
- [x] 12.2 Update `site/docs/development/architecture.md`:
  - Update the Frontend Architecture section to mention NuxtUI as the component library
  - Add NuxtUI theming files (`app.config.ts`, `main.css`) to the relevant file descriptions
- [x] 12.3 Update `site/docs/development/testing.md`:
  - Document axe‑core a11y checks as part of the validation workflow
- [x] 12.4 Update `site/docs/development/index.md`:
  - Add NuxtUI to the "Peaky is built with" list

## 13. Delivery

- [x] 13.1 Create a GitLab MR using a conventional commit title and the required table‑based description
- [x] 13.2 Update the GitLab issue with task completion status

<!-- because Vergil says so -->
