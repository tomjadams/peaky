# Add Review Details Page

## Why
Currently users navigate directly from Application Details to the Assessment page. There's no intermediate view to understand the review's status, see who's involved, or get a high-level overview before diving into the assessment. This makes it hard to quickly understand "what's up with this review" without entering the full assessment flow.

## What
- Add a Review Details page at `/applications/:appId/reviews/:reviewId`
- Display review metadata, progress metrics, and pillar breakdown
- Show reviewers, last activity, and assessment history
- Provide "Continue Assessment" action to proceed to the assessment page
- Prepare structure for future lineage/diff features

## Impact
- **layout spec**: Adds Review Details Page requirement
- **app/pages/applications/[appId]/reviews/[reviewId]/index.vue**: New page
- **Navigation**: Update review clicks to go to details instead of directly to assessment
- **Command palette**: Review navigation commands now lead to details page
