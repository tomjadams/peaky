## Context

The `nuxtui-refactor` change (2026-02-06) introduced global NuxtUI `input` style overrides in `app.config.ts`. These overrides apply custom ring/border styles to all `UInput` components. However, the CSS specificity of hover vs focus states was not properly ordered, and the command palette's `UModal` usage has `sm:my-[12vh]` which conflicts with NuxtUI's default fixed-centered positioning.

Current state:
- `AppCommandPalette.vue` uses `UModal` with `#content` slot and `{ content: 'max-w-3xl sm:my-[12vh]' }`
- The `sm:my-[12vh]` class on a `fixed top-1/2 -translate-y-1/2` element pushes the modal off-center
- Escape key only works when the inner `.command-palette` div has focus (via `@keydown`), but clicking outside the modal and reopening may not refocus that div
- Global input styles use `hover:ring-slate-400 focus:ring-2 focus:ring-primary` but in dark mode `dark:hover:ring-slate-600` can visually compete with `focus:ring-primary` since both modify the ring
- DataTable rows use `hover:bg-accented` which in dark mode reduces contrast with `UCheckbox`

## Goals / Non-Goals

**Goals:**
- Restore command palette centering by removing `sm:my-[12vh]` from the UModal content override
- Fix escape key behavior by ensuring the command palette's keyboard handler fires reliably (use `onKeyStroke` from VueUse on the document level while modal is open, instead of relying on `@keydown` on a div)
- Fix input focus vs hover specificity: ensure `focus:ring-*` always takes visual precedence over `hover:ring-*` in the global input style by adding `focus:hover:ring-primary` (so focus wins even during hover)
- Fix checkbox contrast on hovered table rows in dark mode

**Non-Goals:**
- Redesigning the command palette UI or adding new features
- Changing the overall NuxtUI theming approach
- Fixing unrelated dark mode issues outside of the identified regressions

## Decisions

### Decision 1: Command palette centering

**Choice:** Remove `sm:my-[12vh]` from the UModal `ui.content` override. NuxtUI's default compound variant for non-scrollable, non-fullscreen modals already provides `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`, which centers the modal properly. The `max-w-3xl` can remain.

**Alternative considered:** Adding `scrollable` prop -- rejected because it changes the overflow behavior and is not needed for a command palette.

### Decision 2: Escape key after outside click

**Choice:** Replace the `@keydown` handler on the inner `.command-palette` div with a `watchEffect` + `onKeyStroke('Escape', ...)` from VueUse that fires globally while `isOpen` is true. This decouples the escape handler from DOM focus state.

**Alternative considered:** Auto-focusing the inner div when modal opens -- insufficient because clicking outside the modal and then pressing escape would still not reach the div's keydown handler (the modal is closed by UModal's own dismiss logic, so the keydown on the inner div never fires).

**Note:** Arrow key and Enter handling should remain on the `@keydown` of the inner div since they only make sense when the palette is visually present and focused.

### Decision 3: Input focus vs hover ring conflict

**Choice:** Add `focus:hover:ring-primary dark:focus:hover:ring-primary` to the global input base styles. In Tailwind v4, stacked variants work as `focus:hover:` meaning "when focused AND hovered", which ensures the primary ring color wins over the hover slate ring.

**Alternative considered:** Removing hover ring styles entirely -- rejected because the hover feedback is useful for discoverability.

### Decision 4: Checkbox contrast on hovered rows

**Choice:** Override `UCheckbox` styling within DataTable to ensure the checkbox border/background has sufficient contrast against the `bg-accented` hover background. Add explicit dark mode border color to checkboxes: `dark:border-slate-400` instead of relying on the default which blends with `bg-accented`.

**Alternative considered:** Changing the row hover color -- rejected because `bg-accented` is the correct semantic class per the design system.

### Decision 5: Pillar delete button hide-on-idle, reveal-on-hover

**Choice:** Hide the delete button by default using `w-0 opacity-0 overflow-hidden` and reveal it on pillar tab hover with `group-hover:w-6 group-hover:opacity-100` plus a width/opacity transition. The button is vertically centered using `self-center` or by ensuring the flex container uses `items-center`. This keeps the UI clean until the user signals intent to interact with the pillar tab.

**Alternative considered:** Using a context menu (right-click) -- rejected because it's less discoverable and doesn't match the existing pattern of inline action buttons elsewhere in the app.

## Risks / Trade-offs

- **[Risk]** Global input style changes could affect other components not yet identified → **Mitigation**: Use playwright-cli to audit all pages with input fields after the fix; run ui-review subagent on affected components
- **[Risk]** Removing `sm:my-[12vh]` may change vertical position in edge cases → **Mitigation**: NuxtUI's default centering is well-tested; the command palette's `max-h-[28rem]` inner content keeps it within viewport
- **[Risk]** VueUse `onKeyStroke` on Escape may conflict with other escape handlers → **Mitigation**: Only active while `isOpen` is true, and calls `close()` which is idempotent
