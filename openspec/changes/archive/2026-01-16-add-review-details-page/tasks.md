# Tasks

## 1. Review Details Page Structure
- [x] 1.1 Create `/applications/[appId]/reviews/[reviewId]/index.vue` page
- [x] 1.2 Add page header with review name, template badge, status badge
- [x] 1.3 Add "Continue Assessment" button in header
- [x] 1.4 Set up breadcrumb (uses existing layout wrapper)

## 2. Metric Cards
- [x] 2.1 Add metric cards section with gradient borders (reuse pattern from Application Details)
- [x] 2.2 Implement Overall Progress card (percentage with progress bar)
- [x] 2.3 Implement Actions Needed card (count of remaining questions)
- [x] 2.4 Implement Questions Answered card (X / Y format)
- [x] 2.5 Implement Last Activity card (relative date with full date below)

## 3. Pillars Breakdown
- [x] 3.1 Add "Pillars" section with DataTable
- [x] 3.2 Configure columns: Name, Progress (bar), Questions (answered/total), Actions Needed
- [x] 3.3 Make rows clickable → navigate to assessment with anchor to pillar
- [x] 3.4 Handle empty state (no pillars)

## 4. Participants Display
- [x] 4.1 Add assessors and reviewers avatar groups in header area
- [x] 4.2 Show stacked initials with native title tooltip
- [x] 4.3 Handle empty state (hides section if no participants)

## 5. Future Placeholder
- [x] 5.1 Add "History" section placeholder
- [x] 5.2 Show dashed border empty state with "Assessment history coming soon"

## 6. Navigation Updates
- [x] 6.1 Update Application Details review row click → Review Details (not assessment)
- [x] 6.2 Update Application Details action button label to "View Details"
- [x] 6.3 Command palette review commands already use handleReviewClick which now goes to details

## 7. Data & API
- [x] 7.1 Reuse existing `useReviewData` composable for review data
- [x] 7.2 Pillar progress data available from review.pillars
- [x] 7.3 Reviewers/assessors data already in review model (from previous change)

## 8. Command Palette Integration
- [x] 8.1 Add "Continue Assessment" command when on Review Details page
- [x] 8.2 Add pillar jump commands (e.g., "Go to Security pillar")

## 9. Validation
- [x] 9.1 Verify navigation flow: App Details → Review Details → Assessment
- [x] 9.2 Breadcrumb shows: Dashboard / App / Review / Overview
- [x] 9.3 Empty states handled for pillars and participants
- [x] 9.4 Dark mode styling consistent with other pages
- [x] 9.5 Run `pnpm run lint --fix` - passes
- [x] 9.6 Run `pnpm run typecheck` - passes (pre-existing assessment.vue error unrelated)
