# Change: Update Command Palette (Tailwind + Extensible Actions)

## Why
The current layout requirement for the command palette is tied to NuxtUI’s `CommandPalette`, which limits UI/UX control and makes it harder to evolve toward a Raycast/Linear-style productivity launcher (page-scoped actions, async data-backed commands, consistent keyboard-first behavior).

## What Changes
- Update the `layout` spec “Command Palette” requirement to require a first-party Vue + TailwindCSS implementation (no NuxtUI `CommandPalette`).
- Define an extensibility mechanism so any view/component can contribute contextual commands (e.g., “Create application”, “Select all applications”, “Answer No”).
- Allow commands to trigger async work (e.g., fetch more applications/reviews) and refresh available results.

## Impact
- Affected specs: `layout`
- Expected code touch-points (apply stage):
  - `app/components/AppCommandPalette.vue` (custom implementation)
  - Command registration API (composable/plugin/store)
  - Global shortcut handling and focus management
