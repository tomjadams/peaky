> **Note:** The `specs/layout/` domain no longer exists. Theming requirements are now the source of truth in `openspec/schemas/peaky-workflow/templates/design.md` and `site/docs/development/visual-design.md` (the `openspec/specs/branding/` spec has been archived).

## ADDED Requirements
### Requirement: Color System

The application MUST implement a consistent color system with appropriate contrast ratios for both light and dark themes.

#### Scenario: Color variables for action types
- **WHEN** implementing UI elements that represent different action types
- **THEN** the application uses defined color variables for:
  - Positive actions (e.g., Yes, confirm, save)
  - Negative actions (e.g., No, decline, cancel)
  - Dangerous actions (e.g., delete, remove)
  - Secondary text

#### Scenario: Light theme contrast
- **WHEN** using the light theme
- **THEN** all text and interactive elements meet WCAG AA contrast requirements
- **AND** primary color usage is adjusted for better contrast on light backgrounds
- **AND** link colors provide sufficient contrast against light backgrounds

### Requirement: Collapsible Navigation

The application MUST provide a collapsible navigation sidebar to optimize screen space.

#### Scenario: Sidebar collapse functionality
- **WHEN** a user clicks the collapse button in the navigation sidebar
- **THEN** the sidebar collapses to a minimal width showing only icons
- **AND** the main content area expands to use the additional space
- **AND** the collapse state is preserved between page loads

#### Scenario: Sidebar expand functionality
- **WHEN** a user clicks the expand button on a collapsed sidebar
- **THEN** the sidebar expands to show full navigation items with text
- **AND** the main content area adjusts to accommodate the expanded sidebar

### Requirement: Consistent Tooltip System

The application MUST implement a consistent tooltip system across all navigation and interactive elements.

#### Scenario: Navigation tooltips
- **WHEN** hovering over navigation items in the sidebar
- **THEN** tooltips appear with descriptive text
- **AND** tooltips use consistent styling and timing
- **AND** tooltips include keyboard shortcuts when applicable

#### Scenario: Theme toggle tooltip
- **WHEN** hovering over the theme toggle button
- **THEN** a tooltip appears indicating the action (e.g., "Switch to dark mode")
- **AND** the tooltip follows the same design pattern as navigation tooltips

### Requirement: VueUse Composables

The application MUST use VueUse composables for common functionality instead of manual JavaScript implementations.

#### Scenario: Keyboard event handling
- **WHEN** implementing keyboard shortcuts or event listeners
- **THEN** the application uses VueUse composables like `onKeyStroke` instead of manual event listeners
- **AND** event listeners are properly scoped to components rather than globally mounted
- **AND** cleanup is handled automatically by the composable

#### Scenario: Common utilities
- **WHEN** implementing common functionality like window events, mouse tracking, or storage
- **THEN** the application uses appropriate VueUse composables
- **AND** follows VueUse best practices for reactivity and lifecycle management

## MODIFIED Requirements
### Requirement: View Mode Navigation
The application MUST provide seamless navigation between different view modes.

#### Scenario: View mode switching
- **WHEN** a user clicks the mode toggle button
- **THEN** the application navigates to the appropriate view
- **AND** the toggle shows clear visual indication of the current mode
- **AND** the toggle uses intuitive labeling instead of "Power User"

#### Scenario: Survey mode navigation
- **WHEN** a user activates the Survey mode
- **THEN** the application navigates to the single-question survey view
- **AND** the toggle shows active state styling
- **AND** navigation uses NuxtLink for client-side routing
- **AND** there is a clear visual indication that Survey mode is active

### Requirement: Question Information Access

The application SHALL provide access to additional information for each question including importance context, leading practices, and helpful resources.

#### Scenario: Info icon display
- **WHEN** viewing questions in either survey or default view
- **THEN** each question displays a subtle information (i) icon
- **AND** the icon is positioned with appropriate spacing from the question text
- **AND** the icon is aligned with the first line of multi-line questions
- **AND** no redundant dropdown is shown in the default view

#### Scenario: Sidebar information display
- **WHEN** a user clicks on a question's information icon
- **THEN** the right information panel opens with question-specific information
- **AND** the panel displays "Why is this important?" section with descriptive text
- **AND** the panel displays "Leading practices" section as a list of items
- **AND** the panel displays "Helpful links" section with external link indicators

#### Scenario: Information panel control
- **WHEN** content components need to control information panel visibility
- **THEN** the layout uses shared state management instead of local control
- **AND** any component can open or close the information panel programmatically
- **AND** the panel displays content appropriate to the triggering question

## RENAMED Requirements
- FROM: `### Requirement: Page Navigation`
- TO: `### Requirement: View Mode Navigation`
