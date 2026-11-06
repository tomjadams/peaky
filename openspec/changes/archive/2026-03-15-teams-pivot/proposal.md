## Why

The current dashboard is built around **Applications** as the top-level entity, but company-wide application definitions aren't agreed upon yet. Meanwhile, teams need to start running operational readiness reviews immediately. Teams are the natural unit of ownership -- they perform assessments, own the outcomes, and drive maturity improvements.

Additionally, the current "Owner" field on applications is a plain string. In reality, teams belong to **Organizations** (LDAP-sourced grouping), which will eventually unlock org-level compliance reviews.

By pivoting from Applications to Teams now, we:
- Unblock review workflows immediately (no application definitions needed)
- Establish the correct ownership hierarchy (Organization -> Team -> Review)
- Keep Applications as an optional association, futureproofed for when definitions are ready
- Build a flow pattern (dashboard -> details -> new review wizard) that replicates cleanly for Products later

## What Changes

1. **New Teams Dashboard**: Replaces the homepage. `/` redirects to `/teams`. Teams table with Organization grouping, search, filters, and summary metrics.
2. **New Team Details page**: Shows team info, active reviews, and a "Start New Review" action. Routes: `/teams/:teamId`.
3. **New Review Wizard**: Multi-step flow for creating reviews under a team. Step 1: select templates (1-3). Step 2: optionally link applications. Step 3: confirm & name. Routes: `/teams/:teamId/reviews/new`.
4. **Review becomes a true container**: A single review holds 1-3 templates via a `ReviewTemplate` join, each tracking independent progress. Replaces the current sibling-review hack.
5. **Organization entity**: First-class entity grouping teams. Few and stable (LDAP-sourced eventually). Can own org-level reviews in the future.
6. **Terminology shift**: "Owner" -> "Organization" (short: "Org") across the codebase and UI.
7. **Applications remain visible**: Kept in navigation and routes for demonstrating the grand vision, but no longer the entry point.

## Capabilities

### New Capabilities
- `teams`: Team dashboard, team details, team-scoped review creation, Organization grouping
- `review-wizard`: Multi-step review creation flow (template selection, application linking, confirmation)

### Modified Capabilities
- `reviews`: Review becomes a container for 1-3 templates (ReviewTemplate join entity). `applicationId` replaced by `teamId` + optional N:M application links.
- `applications`: No longer the homepage entry point. Routes remain visible but are secondary. Navigation updated to show Teams as primary alongside Applications.

## Impact

- **Frontend**: New pages under `/teams/*`, new wizard components, sidebar navigation update, Review model changes ripple through review details and assessment pages
- **Backend (mock)**: New `/api/teams` and `/api/orgs` endpoints, updated `/api/reviews` to include `teamId` and `templateIds`, review creation endpoint
- **Data model**: New `Team`, `Organization`, `ReviewTemplate` types. `Review` gains `teamId`, loses required `applicationId`
- **Navigation**: Sidebar adds "Teams" icon, homepage redirects to `/teams`
- **Existing routes**: `/applications/*` kept intact but de-emphasized
