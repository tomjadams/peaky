> **Note:** The `specs/layout/` domain no longer exists. Layout structure requirements now live in `openspec/specs/common-ui/spec.md` (shared layout patterns) and `openspec/specs/applications/spec.md` (application-specific views).

## ADDED Requirements

### Requirement: Application Layout Structure
The application MUST provide a consistent layout structure with a left sidebar, main content area, and hidden right sidebar as demonstrated in the reference implementation.

#### Scenario: Default layout structure
- **WHEN** a user accesses the application
- **THEN** they see a layout with a fixed-width left sidebar (80px) containing the logo at the top
- **AND** a main content area displaying the primary application content
- **AND** a hidden right sidebar that can be toggled

#### Scenario: Minimum device size support
- **WHEN** a user accesses the application on a 14-inch MacBook (Nov 2023) or larger display
- **THEN** the layout displays properly without horizontal scrolling
- **AND** all content is accessible and usable

### Requirement: Left Sidebar Navigation
The application MUST provide a Discord-inspired left sidebar with logo placement at the top and navigation items below, following the reference implementation.

#### Scenario: Left sidebar structure
- **WHEN** a user accesses the application on desktop
- **THEN** the left sidebar is always visible with fixed width of 80px (w-20)
- **AND** displays the application logo and name at the top in a 64px height container (h-16)
- **AND** shows navigation items as centered icons in 48px square containers (h-12 w-12 rounded-lg)

#### Scenario: Navigation item interaction
- **WHEN** a user hovers over a navigation item in the left sidebar
- **THEN** a tooltip appears showing the item name
- **AND** the tooltip is positioned to the right of the icon

#### Scenario: Active navigation item
- **WHEN** a navigation item is active
- **THEN** it is highlighted with a primary color background at 10% opacity (bg-primary/10)
- **AND** the icon is displayed in the primary color

### Requirement: Header Component
The application MUST provide a header component with title, subtitle, and user controls.

#### Scenario: Header structure
- **WHEN** a user accesses the application
- **THEN** they see a header with height of 80px (h-20)
- **AND** the header contains a title and subtitle on the left
- **AND** user controls (like Power User Mode toggle) on the right

#### Scenario: Header positioning
- **WHEN** a user scrolls the page
- **THEN** the header remains sticky at the top
- **AND** has a subtle backdrop blur effect (backdrop-blur-sm)
- **AND** has a semi-transparent background (bg-white/75 or bg-background-dark/75 in dark mode)

### Requirement: Dark Mode Toggle
The application MUST provide a dark mode toggle that allows users to switch between light and dark themes.

#### Scenario: Toggle dark mode
- **WHEN** a user clicks the dark mode toggle
- **THEN** the application theme switches between light and dark modes
- **AND** the toggle visually indicates the current mode

#### Scenario: Theme persistence
- **WHEN** a user sets their preferred theme
- **THEN** the application remembers this preference
- **AND** applies it on subsequent visits

### Requirement: Main Content Area
The application MUST provide a main content area with appropriate structure and styling that supports both default (multiple questions) and survey (single question) views.

#### Scenario: Content container
- **WHEN** a user accesses the application
- **THEN** the main content is displayed in a container with appropriate padding (px-8 py-6)
- **AND** has a maximum width for readability (max-w-4xl mx-auto)

#### Scenario: Progress indicator
- **WHEN** a user is in a multi-step process like a survey
- **THEN** a progress bar is displayed showing completion percentage
- **AND** the current section is indicated below the progress bar

#### Scenario: Default view (multiple questions)
- **WHEN** a user is in the default view mode
- **THEN** questions are organized in sections with headers
- **AND** multiple questions are displayed in a list format
- **AND** questions can be expanded/collapsed
- **AND** answer options are displayed in a horizontal layout

#### Scenario: Survey view (single question)
- **WHEN** a user is in the survey view mode
- **THEN** a single question is displayed with focus
- **AND** the question text is displayed in large, bold typography (text-2xl font-bold)
- **AND** answer options are displayed as prominent side-by-side buttons
- **AND** a subtle "not applicable" option is provided as underlined text
- **AND** navigation controls (back/next) are displayed at the bottom
- **AND** the content width is optimized for kiosk-style interaction (max-w-5xl)

### Requirement: Right Sidebar Panel
The application MUST provide a right sidebar that is hidden by default and can be toggled.

#### Scenario: Right sidebar toggle
- **WHEN** a user clicks the right sidebar toggle button
- **THEN** the right sidebar appears if it was hidden
- **OR** hides if it was visible
- **AND** the main content area adjusts accordingly

### Requirement: Color Palette Implementation
The application MUST implement the defined color palette consistently across the layout as shown in the reference implementation.

#### Scenario: Light mode colors
- **WHEN** the application is in light mode
- **THEN** it uses white for component backgrounds
- **AND** uses the background-light color (#f6f6f8) for the page background
- **AND** uses the primary color (#135bec) for active elements and highlights
- **AND** uses appropriate slate colors for text and UI elements

#### Scenario: Dark mode colors
- **WHEN** the application is in dark mode
- **THEN** it uses dark component backgrounds (gray-900)
- **AND** uses the background-dark color (#101622) for the page background
- **AND** uses the primary color (#135bec) for active elements and highlights
- **AND** uses appropriate slate colors for text and UI elements

## ADDED Requirements

### Requirement: Semantic HTML Structure
The application MUST use semantic HTML elements to improve accessibility and document structure.

#### Scenario: Semantic layout elements
- **WHEN** rendering page layouts
- **THEN** the application uses `<main>` for primary content areas
- **AND** uses `<section>` for distinct content sections with appropriate `aria-label` attributes
- **AND** uses `<article>` for individual content items (questions, survey content)
- **AND** uses `<nav>` for navigation areas with descriptive `aria-label` attributes
- **AND** uses `<fieldset>` and `<legend>` for grouping related form controls

#### Scenario: ARIA accessibility attributes
- **WHEN** rendering interactive elements
- **THEN** buttons include appropriate `type="button"` attributes
- **AND** progress bars include `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`
- **AND** expandable elements include `aria-expanded` states
- **AND** decorative icons include `aria-hidden="true"`
- **AND** screen reader content uses `sr-only` classes where appropriate

### Requirement: Page Navigation
The application MUST provide seamless navigation between different view modes.

#### Scenario: View mode switching
- **WHEN** a user clicks the Power User toggle button
- **THEN** the application navigates to the default multi-question view
- **AND** the button shows active state styling

#### Scenario: Survey mode navigation
- **WHEN** a user clicks the Survey toggle button  
- **THEN** the application navigates to the single-question survey view
- **AND** the button shows active state styling
- **AND** navigation uses NuxtLink for client-side routing
