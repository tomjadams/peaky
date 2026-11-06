# Tasks

## 1. Reusable DataTable Component
- [x] 1.1 Create `DataTable.vue` with dynamic column configuration via props
- [x] 1.2 Implement column types: `text`, `status`, `progress`, `date`, `actions`
- [x] 1.3 Implement `avatar-group` column type (stacked initials with hover tooltip)
- [x] 1.4 Add sortable column headers with sort indicators
- [x] 1.5 Add `selectable` prop for checkbox column
- [x] 1.6 Add `clickable-rows` prop with row click handler
- [x] 1.7 Add scoped slots for custom cell rendering overrides
- [x] 1.8 Add empty state slot/prop
- [x] 1.9 Use cell type registry pattern for extensibility

## 2. Refactor ApplicationTable
- [x] 2.1 Refactor `ApplicationTable.vue` to use `DataTable.vue`
- [x] 2.2 Verify existing dashboard functionality unchanged

## 3. Metric Cards Enhancement
- [x] 3.1 Add gradient border wrapper to metric cards (indigo/purple glow)
- [x] 3.2 Ensure consistent styling in light and dark modes
- [x] 3.3 Verify visual hierarchy with content below

## 4. Reviews Table Implementation
- [x] 4.1 Create reviews table with columns: Name, Status, Progress, Assessors, Reviewers, Updated, Actions
- [x] 4.2 Configure status badges (draft=gray, in-progress=blue, completed=green)
- [x] 4.3 Add row click → navigate to assessment
- [x] 4.4 Add action button with "Open Assessment" tooltip (clipboard-check icon)
- [x] 4.5 Handle empty state (no reviews, filtered empty)

## 5. Search & Filtering
- [x] 5.1 Add search input above table (fuzzy match on name/template)
- [x] 5.2 Add status filter buttons with filter icon and "Status:" label
- [x] 5.3 Wire up filters with local state and computed properties
- [x] 5.4 Update FilterBar component with consistent filter label UX

## 6. Page Layout Refactor
- [x] 6.1 Replace `ReviewCard` grid with reviews DataTable
- [x] 6.2 Add section header pattern ("Reviews" title)
- [x] 6.3 Ensure responsive behavior (horizontal scroll on mobile)

## 7. Command Palette Integration
- [x] 7.1 Maintain existing review navigation commands

## 8. Domain Model Updates
- [x] 8.1 Add `ReviewParticipant` interface to review model
- [x] 8.2 Add `assessors` and `reviewers` arrays to `Review` interface
- [x] 8.3 Add mock participant data to reviews

## 9. Validation
- [x] 9.1 Verify sorting works for all sortable columns
- [x] 9.2 Verify filtering works (status + search combined)
- [x] 9.3 Test navigation to assessment from row click and action button
- [x] 9.4 Test empty state display
- [x] 9.5 Verify dark mode styling
- [x] 9.6 Verify dashboard still works after ApplicationTable refactor
- [x] 9.7 Run `pnpm run lint --fix` - passes
- [x] 9.8 Run `pnpm run typecheck` - passes (pre-existing assessment.vue error unrelated)
