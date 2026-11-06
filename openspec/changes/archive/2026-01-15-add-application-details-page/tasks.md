# Implementation Tasks

## 1. Data Model Updates
- [x] 1.1 Add `applicationId` field to Review model
- [x] 1.2 Update `server/data/reviews.ts` to include applicationId references
- [x] 1.3 Create sample Q4 Peak Season review for Customer Portal (app-001)

## 2. Backend API
- [x] 2.1 Create `server/api/applications/[id].get.ts` endpoint
- [x] 2.2 Create `server/api/applications/[id]/reviews.get.ts` endpoint
- [x] 2.3 Implement filtering logic to exclude archived reviews by default
- [x] 2.4 Add query parameter support for including archived reviews

## 3. Frontend Composables
- [x] 3.1 Create `useApplicationReviews` composable for fetching application-scoped reviews
- [x] 3.2 Create `useApplicationDetails` composable for fetching application metadata

## 4. UI Components
- [x] 4.1 Create ReviewCard component for displaying review summary
- [x] 4.2 Implement review status badges (in-progress, completed, draft)
- [x] 4.3 Add progress indicators and metrics display

## 5. Application Details Page
- [x] 5.1 Create `app/pages/applications/[id].vue`
- [x] 5.2 Implement page header with application name and metadata
- [x] 5.3 Add summary statistics cards (total reviews, active reviews, completion rate)
- [x] 5.4 Display review list with ReviewCard components
- [x] 5.5 Add "Start New Review" button
- [x] 5.6 Implement breadcrumb navigation
- [x] 5.7 Handle loading and error states
- [x] 5.8 Add empty state when no reviews exist

## 6. Template Selection Page
- [x] 6.1 Create `app/pages/applications/[id]/reviews/new.vue`
- [x] 6.2 Display available ORR templates
- [x] 6.3 Implement multi-select (up to 3 templates)
- [x] 6.4 Add "Next" button to navigate to assessment page
- [x] 6.5 Handle navigation back to application details
- [x] 6.6 Implement breadcrumb navigation

## 7. Navigation Integration
- [x] 7.1 Update homepage ApplicationTable to link to application details
- [x] 7.2 Ensure review cards link to existing assessment pages
- [x] 7.3 Test complete flow: Home → Application Details → Start Review → Template Selection → Assessment
- [x] 7.4 Improve app routing to connect an app to a review to an assessment *(e.g., /applications/app-001/reviews/review-001/assessment)*

## 8. Styling and Accessibility
- [x] 8.1 Follow existing design patterns from homepage
- [x] 8.2 Ensure semantic HTML structure
- [x] 8.3 Add proper ARIA attributes
- [x] 8.4 Test responsive layout on mobile, tablet, desktop
- [x] 8.5 Verify dark mode compatibility
