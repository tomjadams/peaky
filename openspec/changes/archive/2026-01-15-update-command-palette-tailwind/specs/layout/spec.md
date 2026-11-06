> **Note:** The `specs/layout/` domain no longer exists. Command palette and shared UI pattern requirements now live in `openspec/specs/command-palette/spec.md` and `openspec/specs/common-ui/spec.md`.

# layout Specification Delta

## MODIFIED Requirements

### Requirement: Command Palette

The application SHALL provide a reusable command palette component for quick navigation and action execution across all views, implemented as a first-party Vue component styled with TailwindCSS (without using NuxtUI’s `CommandPalette`).

#### Scenario: Command palette activation
- **WHEN** a user presses Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- **THEN** the command palette modal opens
- **AND** focus is automatically placed in the search input
- **AND** the palette displays recent commands or suggestions

#### Scenario: Command palette search
- **WHEN** the command palette is open and user types
- **THEN** results are filtered based on fuzzy matching
- **AND** results include global navigation, in-page destinations, and available actions
- **AND** each result shows an icon, title, and optional shortcut
- **AND** results are grouped by category (Navigation, Page, Actions, Data, etc.)

#### Scenario: Command palette navigation (routes)
- **WHEN** a user selects a navigation item from the palette
- **THEN** the application navigates to the selected page
- **AND** the command palette closes
- **AND** the selected page receives focus

#### Scenario: Command palette in-page navigation
- **WHEN** a user selects an in-page destination (e.g., a section heading)
- **THEN** the application scrolls to the target section
- **AND** focus is moved to the target heading (or the first focusable element in the target section)
- **AND** the command palette closes

#### Scenario: Command palette actions
- **WHEN** a user selects an action from the palette
- **THEN** the action is executed
- **AND** appropriate feedback is shown (toast, modal, etc.)
- **AND** the command palette closes after action execution

#### Scenario: Command palette extensibility
- **WHEN** a view/component registers additional commands (e.g., “Create application”, “Select all applications”, “Answer No”)
- **THEN** those commands are visible while that view/component is active
- **AND** those commands are removed when the view/component is unmounted or no longer active
- **AND** command identifiers are stable and uniquely identify a command within the registry

#### Scenario: Command palette async sources
- **WHEN** the command palette is open and a command source refreshes results asynchronously (e.g., “Fetch more applications”)
- **THEN** the palette shows a loading indicator for the refreshing source/group
- **AND** results update when the async work completes
- **AND** the current query continues to filter the updated results

#### Scenario: Command palette keyboard navigation
- **WHEN** the command palette is open
- **THEN** arrow keys navigate between results
- **AND** Enter selects the highlighted result
- **AND** Escape closes the palette without action
- **AND** Tab cycles through interactive elements within the palette

#### Scenario: Command palette styling and icons
- **WHEN** the command palette is displayed
- **THEN** it is implemented without using NuxtUI’s `CommandPalette`
- **AND** styling matches the application's current theme (light/dark)
- **AND** results may display Lucide icons (via the app's icon system)
- **AND** the component is encapsulated in `AppCommandPalette.vue` for reuse

#### Scenario: Command palette accessibility
- **WHEN** the command palette modal is open
- **THEN** it exposes dialog semantics (`role="dialog"` and `aria-modal="true"`)
- **AND** the search input has an accessible label
- **AND** focus is trapped within the modal until it is closed
- **AND** focus returns to the element that opened the palette when the modal closes
