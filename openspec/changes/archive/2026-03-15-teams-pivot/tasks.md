## Prerequisites

> Issue: #18
> MR: #44
> Terminology: Use **Organizations** as canonical term (avoid "Solutions")

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in RFC style describing Teams pivot from `design.md`
- [x] 0.3 Create feature branch `feat/teams-pivot`
- [x] 0.4 Create MR using conventional commit + template `.gitlab/merge_request_templates/default.md`

## 1. Data Model & Types

> isolation: No dependencies, can start immediately

- [x] 1.1 Create `app/models/organization.ts` with `Organization` interface
- [x] 1.2 Create `app/models/team.ts` with `Team` interface
- [x] 1.3 Create `app/models/review-template.ts` with `ReviewTemplate` interface
- [x] 1.4 Modify `app/models/review.ts`: replace `applicationId` + single `templateId/templateName` with `teamId`, `orgId`, `templates: ReviewTemplate[]`, `applicationIds?: string[]`
- [x] 1.5 Update `app/models/index.ts` barrel exports to include new types
- [x] 1.6 Run `ts-reviewer` on new/modified model files
- [x] 1.7 Address review findings (if any)

## 2. Mock Data & API Endpoints

> dependencies: 1 (types defined)

- [x] 2.1 Create `server/data/organizations.ts` with mock Organizations
- [x] 2.2 Create `server/data/teams.ts` with mock Teams (referencing orgs)
- [x] 2.3 Update `server/data/reviews.ts` mock data to use new Review shape (teamId, templates[], applicationIds)
- [x] 2.4 Create `server/api/orgs/index.get.ts` - GET /api/orgs
- [x] 2.5 Create `server/api/teams/index.get.ts` - GET /api/teams
- [x] 2.6 Create `server/api/teams/[id].get.ts` - GET /api/teams/:id
- [x] 2.7 Create `server/api/teams/[id]/reviews.get.ts` - GET /api/teams/:id/reviews
- [x] 2.8 Create `server/api/teams/[id]/reviews.post.ts` - POST /api/teams/:id/reviews (mock, returns created review)
- [x] 2.9 Run `ts-reviewer` on new API endpoint files
- [x] 2.10 Address review findings (if any)

## 3. Composables

> dependencies: 1 (types), 2 (API endpoints)

- [x] 3.1 Create `app/orgs/useOrgs.ts` composable
- [x] 3.2 Create `app/teams/useTeams.ts` composable (fetch teams list)
- [x] 3.3 Create `app/teams/useTeamDetails.ts` composable (fetch single team)
- [x] 3.4 Create `app/teams/useTeamReviews.ts` composable (fetch team reviews)
- [x] 3.5 Create `app/teams/useTeamFilters.ts` composable (search + org filter)
- [x] 3.6 Create `app/teams/useReviewWizard.ts` composable (wizard step state, validation, submission)
- [x] 3.7 Write unit tests for `useTeamFilters` (search, org filtering)
- [x] 3.8 Write unit tests for `useReviewWizard` (step transitions, validation, state management)
- [x] 3.9 Run `ts-reviewer` on new composable files
- [x] 3.10 Run `test-reviewer` on new test files
- [x] 3.11 Address review findings (if any)

## 4. Teams Dashboard Page

> dependencies: 3 (composables ready)

- [x] 4.1 Create `app/pages/teams/index.vue` - Teams Dashboard with metric cards, search, org filter, teams table
- [x] 4.2 Create `app/components/TeamTable.vue` - DataTable wrapper with team-specific columns (Name, Org, Reviews, Last Active)
- [x] 4.3 Update `app/pages/index.vue` to redirect to `/teams` instead of rendering application dashboard
- [x] 4.4 Run `vue-reviewer` on new Vue components
- [x] 4.5 Run `ui-review` on Teams Dashboard (visual design check)
- [x] 4.6 Address review findings (if any)

## 5. Team Details Page

> dependencies: 4 (dashboard exists for navigation context)

- [x] 5.1 Create `app/pages/teams/[teamId].vue` - Layout wrapper with breadcrumb
- [x] 5.2 Create `app/pages/teams/[teamId]/index.vue` - Team Details with header, metrics, reviews table
- [x] 5.3 Run `vue-reviewer` on Team Details components
- [x] 5.4 Run `ui-review` on Team Details page
- [x] 5.5 Address review findings (if any)

## 6. Review Creation Wizard

> dependencies: 3 (useReviewWizard), 5 (team details for navigation)

- [x] 6.1 Create `app/pages/teams/[teamId]/reviews/new.vue` - Multi-step wizard page
- [x] 6.2 Implement Step 1: Template selection (reuse pattern from existing `applications/[id]/reviews/new.vue`)
- [x] 6.3 Implement Step 2: Application linking (optional, with search and checkbox selection)
- [x] 6.4 Implement Step 3: Confirmation (summary + review name input + create button)
- [x] 6.5 Implement step indicator (progress dots/bar showing steps 1-3)
- [x] 6.6 Wire wizard submission to POST `/api/teams/:teamId/reviews`
- [x] 6.7 Run `vue-reviewer` on wizard components
- [x] 6.8 Run `ui-review` on wizard pages
- [x] 6.9 Address review findings (if any)

## 7. Review Details & Assessment Adaptation

> dependencies: 1 (Review model changed), 5 (team routes exist)

- [x] 7.1 Create `app/pages/teams/[teamId]/reviews/[reviewId].vue` - Layout wrapper
- [x] 7.2 Create `app/pages/teams/[teamId]/reviews/[reviewId]/index.vue` - Review Details adapted from existing, using `review.templates` instead of sibling hack
- [x] 7.3 Create `app/pages/teams/[teamId]/reviews/[reviewId]/assessment.vue` - Assessment page adapted for new route structure
- [x] 7.4 Create `app/pages/teams/[teamId]/reviews/[reviewId]/survey.vue` - Survey mode adapted
- [x] 7.5 Update `app/applications/useReviewData.ts` to work with the new Review shape (templates[] instead of single templateId)
- [x] 7.6 Remove sibling-review logic from review details (no longer needed with native templates[])
- [x] 7.7 Run `vue-reviewer` on adapted review pages
- [x] 7.8 Run `ui-review` on Review Details page
- [x] 7.9 Address review findings (if any)

## 8. Navigation Updates

> dependencies: 4 (teams pages exist)

- [x] 8.1 Update `app/components/NavigationSidebar.vue` - Add "Teams" link with `lucide:users` icon, rename "Dashboard" to "Apps"
- [x] 8.2 Update command palette plugin to include teams in quick navigation
- [x] 8.3 Run `vue-reviewer` on NavigationSidebar
- [x] 8.4 Run `ui-review` on sidebar changes
- [x] 8.5 Address review findings (if any)

## 9. E2E Testing

> dependencies: 4-8 (all pages built)

- [x] 9.1 E2E test: Homepage redirects to `/teams`
- [x] 9.2 E2E test: Teams Dashboard loads with teams table, search works
- [x] 9.3 E2E test: Click team row navigates to Team Details
- [x] 9.4 E2E test: Start New Review -> complete wizard flow (all 3 steps)
- [x] 9.5 E2E test: Review Details loads under `/teams/:teamId/reviews/:reviewId`
- [x] 9.6 E2E test: Existing `/applications` routes still load without errors
- [x] 9.7 Run `test-reviewer` on new E2E test files
- [x] 9.8 Run `ux-reviewer` on complete Teams flow (dashboard -> details -> wizard -> review)

## Housekeeping

- [x] Update decision log `site/docs/development/decisions.md` with:
  - Teams-first pivot rationale
  - Organization as first-class entity
  - Review as template container (ReviewTemplate join)
  - Wizard pattern for replication to Products
- [x] Update domain model doc `site/docs/development/domain.md` with new entity relationships
- [x] Update GitLab issue with task completions

## 10. UX Polish & Terminology Follow-ups

> dependencies: 4-9 (core flow implemented)

- [x] 10.1 Align terminology to **Organizations** in UI and change artifacts
- [x] 10.2 Add Organization filter icon on Teams dashboard selector
- [x] 10.3 Improve global `USelect` styling for light/dark consistency
- [x] 10.4 Ensure duplicate review names are disambiguated in list/read APIs
- [x] 10.5 Add Teams dashboard "Start New Review" CTA and per-row quick action
- [x] 10.6 Preserve team assessors/reviewers when creating new team reviews
- [x] 10.7 Replace manual wizard steps with `UStepper` and improve action bar contrast
- [x] 10.8 Add pagination to Templates and Applications steps with persistent selection summaries
- [x] 10.9 Polish Confirm step with improved review name hierarchy and split summary cards
- [x] 10.10 Balance Templates/Applications summary alignment and strengthen dark-mode visibility

## Manual Tasks

- [x] Manual review of areas ordered by ROI
  - [x] Teams Dashboard responsiveness and empty states
  - [x] Wizard step transitions and back navigation
  - [x] Review Details tab behavior with native templates[]
  - [x] Sidebar navigation active states on all team routes
  - [x] Applications routes still functional and visually intact
