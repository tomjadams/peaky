## ADDED Requirements

### Requirement: NuxtUI Component Foundation

The application MUST use NuxtUI components as the foundation for shared UI primitives, with global theme defaults and per‑component `ui` overrides to preserve existing visual styling.

#### Scenario: Shared UI primitives use NuxtUI

- **WHEN** implementing or refactoring shared UI primitives (tabs, accordions, modals, tooltips, inputs, dropdowns, badges, buttons)
- **THEN** the UI is built on NuxtUI components or thin wrapper components
- **AND** wrapper components preserve existing public props/events to avoid call‑site churn

#### Scenario: DataTable uses bespoke Tailwind CSS

- **WHEN** implementing the DataTable component
- **THEN** the table uses native HTML `<table>` elements with Tailwind CSS classes
- **AND** NuxtUI components (UCheckbox, UTooltip, UButton) are used for interactive elements within cells
- **AND** this deviation from UTable is intentional due to tbody row styling limitations in UTable that proved difficult to override

#### Scenario: Global theme defaults

- **WHEN** NuxtUI components are rendered
- **THEN** they inherit global theme defaults (colors, typography, radii) defined in app configuration and CSS variables
- **AND** defaults provide a consistent baseline across all views

#### Scenario: Per‑component overrides for variants

- **WHEN** a view requires a distinct variant (e.g., Template Studio tabs vs Review tabs)
- **THEN** the variant is implemented via NuxtUI `ui` overrides or wrapper props
- **AND** global defaults remain the baseline for all other components

#### Scenario: Style preservation during refactor

- **WHEN** a custom component is replaced with a NuxtUI‑based implementation
- **THEN** spacing, typography, and color intent are preserved to match current design
- **AND** any visual changes are intentional and documented
