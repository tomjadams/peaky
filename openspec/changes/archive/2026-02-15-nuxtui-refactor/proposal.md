## Why

Now that the NuxtUI dependency conflict is resolved, we can replace bespoke Tailwind UI with NuxtUI primitives to eliminate UX micro‑interaction issues (layout shifts, flicky tabs, sidebar text jumps) while preserving current styling and improving accessibility contrast under axe‑core a11y tests.

## What Changes

- Replace custom UI components across `app/components` and `app/pages` with NuxtUI primitives (Table, Tabs, Accordion/Collapsible, Modal/Slideover, Input, Select/Dropdown, Tooltip, Badge, Button), keeping existing styling through global theming and per‑component overrides.
- Switch the Command Palette UI to NuxtUI `CommandPalette` while preserving the existing command registry logic and keyboard behavior.
- Improve contrast for low‑contrast controls (notably AnswerToggle Yes/No/N/A) to satisfy accessibility expectations.
- Apply smoother, stable transitions for accordion/tab/sidebar interactions using NuxtUI patterns to reduce layout jank.

## Capabilities

### New Capabilities
- _None_

### Modified Capabilities
- `command-palette`: allow NuxtUI `CommandPalette` as the UI surface while retaining current behavior contracts.
- `common-ui`: require NuxtUI‑first component usage with global theme defaults and per‑component `ui` overrides to preserve existing styling variants.
- `assessment`: strengthen AnswerToggle contrast requirements (Yes/No/N/A) to meet a11y expectations.
- `testing`: document axe‑core a11y checks as part of UI validation during refactors.

## Impact

- Frontend UI components across `app/components/**` and `app/pages/**` (tables, tabs, accordions, modals, tooltips, inputs, badges).
- NuxtUI theming configuration (`app.config.ts`, `nuxt.config.ts`, `app/assets/css/main.css`).
- Command palette UI in `AppCommandPalette.vue` (visual implementation swap).
- Accessibility checks/contrast adjustments validated against axe‑core a11y tests.
