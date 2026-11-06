## Context
The application details page currently displays reviews as cards in a grid. While visually appealing for small datasets, this approach doesn't scale well when:
- The number of reviews grows beyond 6-10
- Additional metadata is added (reviewers, audit trail)
- Users need to quickly find specific reviews
- Bulk actions are required

## Goals / Non-Goals

### Goals
- Replace review cards with a sortable, filterable data table
- Enhance metric cards with gradient borders for visual hierarchy
- Create a repeatable "section" pattern for future content (e.g., Reports)
- Maintain command palette integration for quick navigation
- Support assessors and reviewers columns with avatar groups

### Non-Goals
- Implementing the Reports section (future work, pattern only)
- Changing the top-level page structure (header, metrics placement)

## Decisions

### Table vs Cards
- Decision: Use a data table for reviews instead of cards
- Rationale: Tables provide built-in patterns for sorting, filtering, searching, and row actions. They scale better with data growth and are more scannable for power users.
- Trade-off: Less visually rich than cards, but more functional at scale.

### Reusable DataTable Component
- Decision: Create a generic `DataTable.vue` component that can be reused across pages (Dashboard, Application Details, future pages)
- Rationale: The existing `ApplicationTable.vue` is tightly coupled to application data. A reusable component reduces duplication and ensures consistent UX.
- Implementation approach:
  - **Column configuration via props**: Define columns as an array of objects with `key`, `label`, `sortable`, `type` (text, status, progress, avatar-group, date, actions)
  - **Slot-based cell rendering**: Use scoped slots for custom cell content when built-in types don't suffice
  - **Cell type registry pattern**: Use a registry (`CELL_TYPE_COMPONENTS`) mapping cell types to components, resolved at setup time via `resolveComponent()`. Easy to extend by adding to the `CellType` union and registry.
  - **Built-in column types**:
    - `text`: Simple text display
    - `status`: Color-coded status badge (configurable colors per status)
    - `progress`: Progress bar with percentage
    - `avatar-group`: Stacked circles with initials, tooltip appears on hover showing all names
    - `date`: Relative time formatting (e.g., "2 days ago")
    - `actions`: Row action buttons with styled tooltips (consistent with nav sidebar)
  - **Props for behavior**: `selectable` (checkboxes), `clickable-rows`, `empty-state` slot
- Migration: Refactored `ApplicationTable.vue` to use `DataTable.vue` (reduced from ~190 to ~85 lines)

### Metric Cards Enhancement
- Decision: Add subtle gradient border to metric cards
- Rationale: Creates visual hierarchy separating summary metrics from actionable data below. Matches the command palette glow aesthetic.
- Implementation: Use same gradient approach as command palette (`from-indigo-500/X via-purple-500/X`) with lower opacity for subtlety.

### Section Pattern
- Decision: Establish a repeatable section component/pattern with:
  - Section header (title + optional action button)
  - Optional toolbar (search, filters, bulk actions)
  - Content area (table, cards, or other)
- Rationale: Allows the page to grow with new sections (Reports, Snapshots) using consistent UX patterns.

### Reviews Table Columns
- Decision: Include these columns:
  - Name (sortable, with template name as subtitle)
  - Status (filterable, color-coded badge)
  - Progress (sortable, visual bar)
  - Assessors (avatar-group - team members doing self-assessment)
  - Reviewers (avatar-group - experienced engineers providing guidance)
  - Updated (sortable, relative time)
  - Actions (Open Assessment button with tooltip)
- Rationale: Supports the dual-role model where assessors do the self-assessment and reviewers provide educational guidance and historical context.

### Domain Model: Assessors vs Reviewers
- Decision: Extend `Review` model with two participant lists:
  - `assessors: ReviewParticipant[]` - Team members who own the application and perform the self-assessment
  - `reviewers: ReviewParticipant[]` - Experienced engineers/SREs who provide guidance, historical context, and incident knowledge
- Rationale: ORR is more than a checklist - the reviewer role ensures teams learn *why* operational readiness matters before an incident teaches them. This educational aspect distinguishes ORR from simple self-assessments.

### Filtering & Search
- Decision: Provide:
  - Text search (fuzzy match on name, template)
  - Status filter toggle buttons with "Status:" label and filter icon
  - Sort by clicking column headers (toggles direction)
- Rationale: Matches existing dashboard patterns. Filter label provides clear UX context.

## Risks / Trade-offs
- Table may feel less visually engaging than cards
  - Mitigation: Good typography, status badges, progress bars add visual interest
- More complex component structure
  - Mitigation: Reuse existing table patterns from dashboard
- Breaking change to existing Review Card component
  - Mitigation: Keep ReviewCard for potential use elsewhere, or deprecate cleanly
