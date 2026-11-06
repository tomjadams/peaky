# Change: Add Dashboard Home View with Enhanced Navigation

## Why
Create a comprehensive dashboard home view that provides an overview of all enterprise applications and their operational readiness status. Improve navigation with breadcrumbs for better user orientation within the application.

## What Changes
- Add new dashboard home page with application overview table
- Extend layout spec with breadcrumb navigation requirements
- Update header component to support dynamic breadcrumb trails
- Implement application status monitoring with three statuses: In Progress, Action needed, Ready
- Add fuzzy search filtering for applications
- Add bulk selection and actions (delete, transfer, archive) with backend no-ops
- Add new Nitro API endpoints for applications data
- Add responsive design patterns for dashboard tables
- **Enhancement**: Create generic composables for cross-cutting concerns (sorting, bulk actions)
- **Enhancement**: Implement event-driven component architecture for loose coupling
- **Enhancement**: Add reusable sorting composable (`useSortState`) for any data table
- **Enhancement**: Add reusable bulk actions composable (`useBulkActions`) for any resource
- **Enhancement**: Refactor code organization with clear separation of concerns
- **Enhancement**: Add dashboard summary cards showing key metrics (Operationally Ready, Currently Reviewing, Blocked/Actions)
- **Enhancement**: Replace "New Review" with "New Application" CTA button
- **Enhancement**: Add real-time status counts with trend indicators

## Impact
- Affected specs: layout (breadcrumb, dashboard, API requirements)
- Affected code:
  - `app/pages/` - new dashboard home page
  - `app/components/AppHeader.vue` - breadcrumb integration
  - `app/components/` - new dashboard components (ApplicationTable, StatusIndicator, FilterBar, etc.)
  - `app/composables/` - new composables (useApplications, useBreadcrumbs, etc.)
  - `server/api/applications/` - new API endpoints
- Adds new navigation patterns and application management capabilities
