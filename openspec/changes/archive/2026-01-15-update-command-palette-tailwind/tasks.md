# Implementation Tasks

## 1. Command Palette UI (Tailwind + Vue)
- [x] 1.1 Implement `AppCommandPalette.vue` without NuxtUI components
- [x] 1.2 Implement modal behavior: open/close, backdrop, scroll lock, return focus to invoker
- [x] 1.3 Implement keyboard interactions: Cmd/Ctrl+K (open), Escape (close), arrows (move), Enter (select)
- [x] 1.4 Implement grouped result rendering with icons and optional shortcuts
- [x] 1.5 Implement fuzzy search filtering

## 2. Command Registration & Scoping
- [x] 2.1 Define a command model/type for navigation + actions
- [x] 2.2 Implement a command registry API usable from any component
- [x] 2.3 Support global commands and page/component-scoped commands (register on mount, remove on unmount)

## 3. Async Data-backed Commands
- [x] 3.1 Support command "sources" that can refresh results asynchronously while palette is open
- [x] 3.2 Add loading/empty states per group/source and debounce query updates

## 4. Built-in Commands
- [x] 4.1 Add global navigation commands (e.g., "Go to Dashboard")
- [x] 4.2 Add in-page navigation commands for the current view (e.g., jump to headings/sections)

## 5. Example Integrations
- [x] 5.1 Dashboard: add contextual actions (e.g., "Create application", "Select all applications", "Fetch more applications")
- [x] 5.2 Reviews/Assessment views: add contextual actions (e.g., "Answer No", bulk answer helpers)

## 6. Accessibility & Theming
- [x] 6.1 Ensure dialog semantics and ARIA labeling are correct
- [x] 6.2 Ensure focus is managed correctly (trap while open, restore on close)
- [x] 6.3 Ensure light/dark theme styling parity

## 7. Tests & Validation
- [x] 7.1 Add unit tests for the command registry (scoping, registration lifecycle)
- [x] 7.2 Add component tests for keyboard navigation and selection behavior
- [x] 7.3 Run: `pnpm run lint --fix`
- [x] 7.4 Run: `pnpm run typecheck`
- [x] 7.5 Run: `pnpm run test:run`
