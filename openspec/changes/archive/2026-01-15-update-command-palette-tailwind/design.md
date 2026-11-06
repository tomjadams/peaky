## Context
The app already specifies a global command palette in `openspec/specs/layout/spec.md`, but it currently mandates NuxtUI’s `CommandPalette` as the base implementation. We want a first-party component (Tailwind + Vue) that is keyboard-first and extensible by any view/component, including commands that can fetch/update data.

## Goals / Non-Goals

### Goals
- Provide a reusable, Raycast/Linear-inspired command palette UI implemented with TailwindCSS and standard Vue patterns.
- Support global navigation commands (e.g., “Go to Dashboard”) and in-page navigation (e.g., jump to headings/sections).
- Support page/component-scoped commands that can be registered/unregistered by components.
- Support commands and command sources that can run async work and refresh results (e.g., “Fetch more applications”).
- Meet accessibility expectations (dialog semantics, focus management, keyboard navigation).

### Non-Goals
- Replacing other NuxtUI components across the app.
- Implementing RBAC/permissions for command visibility (future).
- Persisting command history across sessions (future; keep in-memory initially).

## Decisions

### UI Implementation
- Decision: Implement the palette as a first-party Vue component styled with TailwindCSS (no NuxtUI `CommandPalette`).
- Decision: Use a modal/dialog pattern with a backdrop, `Teleport` to `body`, scroll lock, and focus trap.
- Decision: Use Lucide icons for command icons where applicable.

### Command Model
Use a simple command representation that supports both navigation and actions:
- `id` (stable key)
- `title`
- `group` (e.g., Navigation, Page Actions, Data)
- `keywords` (optional)
- `icon` (optional; lucide)
- `shortcut` (optional)
- `run()` (optional action handler)
- `to`/`href` (optional navigation target)
- `disabled` / `hidden` (optional)

### Extensibility Model
- Decision: Provide a global command registry that supports:
  - registering static commands
  - registering scoped commands (route/page/component lifecycle)
  - registering “sources” that can return commands dynamically (sync or async) based on the current query
- Decision: Scope commands by:
  - `global` (always available)
  - `route` (only when the active route matches)
  - `lifecycle` (registered on mount, removed on unmount)

### Registration Architecture
- Decision: Use a **Nuxt client-side plugin** (`plugins/commandPalette.client.ts`) for global commands and keyboard shortcut registration.
  - Rationale: Plugins run once on app initialization, before any page renders, ensuring global commands (navigation, settings) and the `Cmd/Ctrl+K` shortcut are available immediately.
  - The `.client.ts` suffix ensures browser-only execution (keyboard events and color mode don't apply server-side).
  - Alternative considered: Composable with `onMounted` in a layout—rejected because it risks multiple registrations and is less conventional.
- Decision: Use **component lifecycle hooks** (`onMounted`/`onUnmounted`) for page-specific commands.
  - Rationale: Commands should register/unregister with the page lifecycle to avoid stale actions.
  - Use `watch` to re-register commands when relevant state changes (e.g., survey mode, reviews list).

### Async Data-backed Commands
- Decision: Allow command sources to refresh asynchronously on open and/or on query change, with:
  - debouncing
  - cancellation/last-write-wins behavior
  - loading UI state per group/source

## Risks / Trade-offs
- Accessibility/focus management is easy to get wrong.
  - Mitigation: Explicit focus trap + Escape handling + return focus to the invoker.
- Async sources can introduce jitter or stale results.
  - Mitigation: Debounce queries, cancel/ignore older requests, and show loading indicators.
- Over-scoping can make commands “disappear” unexpectedly.
  - Mitigation: Keep global navigation commands always available; scope page actions only.

## Open Questions
- Should in-page navigation be derived from headings automatically, or opt-in via `data-command-palette`/IDs?
- Should async sources run only when the palette is open, or also in the background to keep results warm?
