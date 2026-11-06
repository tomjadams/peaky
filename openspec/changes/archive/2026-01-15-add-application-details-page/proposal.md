# Change: Add Application Details Page

## Why
Users need a dedicated page to view all reviews associated with an application and manage their operational readiness assessments. Currently, the homepage lists applications but provides no drill-down capability to see review history, progress tracking, or initiate new reviews for a specific application.

## What Changes
- Add new application details page at `/applications/:id` route
- Display application metadata (name, owner, status, last updated)
- List all reviews (active, in-progress, completed) with progress metrics
- Show key metrics per review: overall progress, pillar completion, actions needed, days since last update
- Provide "Start New Review" action that navigates to template selection page
- Create template selection page at `/applications/:id/reviews/new` for choosing up to 3 ORR templates
- Add backend API endpoints for application details and application-scoped reviews
- Create sample "Q4 Peak Season" review linked to "Customer Portal" (app-001)
- Implement review status filtering (hide archived reviews by default)

## Impact
- Affected specs: `backend`, `layout`
- Affected code:
  - New page: `app/pages/applications/[id].vue`
  - New page: `app/pages/applications/[id]/reviews/new.vue`
  - New API: `server/api/applications/[id].get.ts`
  - New API: `server/api/applications/[id]/reviews.get.ts`
  - Updated data: `server/data/reviews.ts` (add applicationId field)
  - New component: `app/components/ReviewCard.vue` (or similar)
  - New composable: `app/composables/useApplicationReviews.ts`
