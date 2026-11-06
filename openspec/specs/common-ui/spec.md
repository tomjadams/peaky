# common-ui Specification

## Purpose

This specification covers shared UI patterns, components, and infrastructure that are used across multiple domains in the Peaky application. Includes accessibility requirements, reusable components, and cross-cutting concerns.

## Requirements

### Requirement: NuxtUI Component Foundation

The application MUST use NuxtUI components as the foundation for shared UI primitives, with global theme defaults and per-component `ui` overrides to preserve existing visual styling.

#### Scenario: Shared UI primitives use NuxtUI

- **WHEN** implementing or refactoring shared UI primitives (tabs, accordions, modals, tooltips, inputs, dropdowns, badges, buttons)
- **THEN** the UI is built on NuxtUI components or thin wrapper components
- **AND** wrapper components preserve existing public props/events to avoid call-site churn

#### Scenario: DataTable uses bespoke Tailwind CSS

- **WHEN** implementing the DataTable component
- **THEN** the table uses native HTML `<table>` elements with Tailwind CSS classes
- **AND** NuxtUI components (UCheckbox, UTooltip, UButton) are used for interactive elements within cells
- **AND** this deviation from UTable is intentional due to tbody row styling limitations in UTable that proved difficult to override

#### Scenario: Global theme defaults

- **WHEN** NuxtUI components are rendered
- **THEN** they inherit global theme defaults (colors, typography, radii) defined in app configuration and CSS variables
- **AND** defaults provide a consistent baseline across all views

#### Scenario: Global input focus and hover state precedence

- **WHEN** a `UInput` component is both focused and hovered simultaneously
- **THEN** the focus ring style SHALL take visual precedence over the hover ring style
- **AND** the focus ring SHALL use the primary color in both light and dark modes
- **AND** this SHALL be achieved via stacked Tailwind variants (e.g., `focus:hover:ring-primary`) in the global input theme

#### Scenario: Per-component overrides for variants

- **WHEN** a view requires a distinct variant (e.g., Template Studio tabs vs Review tabs)
- **THEN** the variant is implemented via NuxtUI `ui` overrides or wrapper props
- **AND** global defaults remain the baseline for all other components

#### Scenario: Style preservation during refactor

- **WHEN** a custom component is replaced with a NuxtUI-based implementation
- **THEN** spacing, typography, and color intent are preserved to match current design
- **AND** any visual changes are intentional and documented

### Requirement: Semantic HTML Structure

The application MUST use semantic HTML elements to improve accessibility and document structure.

#### Scenario: Semantic layout elements

- **WHEN** rendering page layouts
- **THEN** the application uses `<main>` for primary content areas
- **AND** uses `<section>` for distinct content sections with appropriate `aria-label` attributes
- **AND** uses `<article>` for individual content items (questions, survey content)
- **AND** uses `<nav>` for navigation areas with descriptive `aria-label` attributes
- **AND** uses `<fieldset>` and `<legend>` for grouping related form controls
- **AND** uses `<aside>` for the right sidebar with proper accessibility attributes

#### Scenario: ARIA accessibility attributes

- **WHEN** rendering interactive elements
- **THEN** buttons include appropriate `type="button"` attributes
- **AND** progress bars include `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`
- **AND** expandable elements include `aria-expanded` states
- **AND** decorative icons include `aria-hidden="true"`
- **AND** screen reader content uses `sr-only` classes where appropriate
- **AND** information icons include `aria-label="Get more information about this question"`
- **AND** the sidebar includes `role="complementary"` and `aria-label="Question information"`

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

### Requirement: Breadcrumb Navigation

The application SHALL provide breadcrumb navigation in the header to show the user's current location within the application hierarchy.

#### Scenario: Breadcrumb display in dashboard view

- **WHEN** viewing the dashboard home page
- **THEN** breadcrumbs display "Dashboard / Applications"
- **AND** "Dashboard" is linked to the home page
- **AND** "Applications" is displayed as plain text (current page)
- **AND** breadcrumbs use subtle styling with proper separators

#### Scenario: Breadcrumb display in assessment view

- **WHEN** viewing the assessment page
- **THEN** breadcrumbs display "Dashboard / Assessment"
- **AND** "Dashboard" is linked to the home page
- **AND** "Assessment" is displayed as plain text (current page)
- **AND** breadcrumbs maintain consistent styling with other views

#### Scenario: Breadcrumb navigation interaction

- **WHEN** a user clicks on any breadcrumb link except the current page
- **THEN** the application navigates to the corresponding page
- **AND** the breadcrumb trail updates to reflect the new location
- **AND** navigation uses client-side routing for optimal performance

#### Scenario: Breadcrumb accessibility

- **WHEN** breadcrumbs are displayed
- **THEN** they use proper semantic HTML with nav element and aria-label
- **AND** each breadcrumb link has descriptive text
- **AND** the current page breadcrumb has aria-current="page"
- **AND** keyboard navigation is supported for all breadcrumb links

### Requirement: Progressive Web App Support

The application SHALL be installable as a Progressive Web App (PWA) from supported browsers, providing a standalone desktop-like experience.

#### Scenario: PWA manifest configuration

- **WHEN** the application is loaded in a browser
- **THEN** a valid web manifest is served with app metadata
- **AND** the manifest includes `name` set to "Readiness Assessment"
- **AND** the manifest includes `short_name` set to "Peaky"
- **AND** the manifest includes `display` set to "standalone"
- **AND** the manifest includes appropriate theme and background colors

#### Scenario: PWA icon assets

- **WHEN** the PWA manifest is loaded
- **THEN** icons are provided in 192x192 and 512x512 sizes
- **AND** icons display the Peaky branding (upward chart with star)
- **AND** icons use a dark slate background (#0f172a) matching the app theme
- **AND** a maskable icon variant is included for adaptive icon support

#### Scenario: PWA installation prompt

- **WHEN** a user visits the application in a supported browser (Chrome, Edge)
- **THEN** the browser displays an install prompt or icon in the address bar
- **AND** clicking the install prompt initiates the PWA installation flow
- **AND** after installation, the app opens in a standalone window

#### Scenario: Service worker registration

- **WHEN** the application loads
- **THEN** a service worker is registered for offline caching
- **AND** static assets (JS, CSS, HTML, images) are cached for offline access
- **AND** the service worker uses auto-update strategy for seamless updates

#### Scenario: PWA development mode

- **WHEN** running the application in development mode
- **THEN** the PWA service worker is enabled for testing
- **AND** the manifest and icons are accessible at their configured paths
- **AND** developers can test installation flow locally

### Requirement: Reusable DataTable Component

The application SHALL provide a reusable data table component for displaying collections of items with consistent UX patterns. The component uses a bespoke Tailwind CSS implementation with native HTML `<table>` elements for full styling control, while leveraging NuxtUI components (UCheckbox, UTooltip, UButton) for interactive elements within cells.

#### Scenario: Checkbox visibility on hovered rows in dark mode

- **WHEN** a user hovers over a table row in dark mode
- **THEN** the row checkbox SHALL remain clearly visible with sufficient contrast against the hover background
- **AND** the checkbox border SHALL use an explicit dark-mode color that contrasts with `bg-accented`
- **AND** checkbox interactivity SHALL not be affected by the row hover state
