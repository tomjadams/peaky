## Context
The current navigation flow is: Dashboard → Application Details → Assessment. Users click a review and immediately land in the assessment questionnaire. This works for active assessments but doesn't provide a way to:
- Get a quick overview of review status without entering the assessment
- See who's involved (reviewers) and recent activity
- Understand pillar-level progress at a glance
- (Future) Compare changes between assessment sessions

## Navigation Hierarchy

```
Dashboard
└── Applications list (cards with progress)
    │
    ▼ Click application card
Application Details (/applications/:appId)
├── Metrics: Total Reviews, Active Reviews, Avg Completion
├── Reviews Table (one row per review/template)
│   ├── Q4 2025 Peak Season (Peak Season)      ████░░ 54%  → [View Details]
│   ├── Q4 2025 Peak Season (Security)         ████████ 80%  → [View Details]
│   ├── Q4 2025 Peak Season (Capacity)         ██████████ 100% → [View Details]
│   └── SOC 2 Preparation                      ██░░░░ 20%  → [View Details]
│
▼ Click "View Details" on a review
Review Details (/applications/:appId/reviews/:reviewId)
├── Header: Review name, Template badge, Status badge
├── Participants: Team (blue) | Advisors (purple)
├── Metrics: Overall Progress, Actions Needed, Questions Answered, Last Activity
├── Pillars Table (clickable rows)
│   ├── Infrastructure    ██████████ 100%  (3/3)
│   ├── Reliability       ██████░░░░ 67%   (2/3)
│   └── Security          █████░░░░░ 50%   (1/2)
│
▼ Click "Continue Assessment" or pillar row
Assessment (/applications/:appId/reviews/:reviewId/assessment#pillar-slug)
└── Full questionnaire interface
```

**Key UX Principles:**
- **Progressive disclosure**: Dashboard → App overview → Review overview → Assessment detail
- **One review = one template**: Each row in Application Details is a specific template evaluation
- **Drill-down clarity**: Users always know where they are and can navigate back
- **Quick access**: "Continue Assessment" is always one click away from Review Details

## Goals / Non-Goals

### Goals
- Provide a review overview page with key metrics and status
- Show pillar-by-pillar progress breakdown
- Display reviewers and activity information
- Enable quick navigation to continue assessment
- Establish structure for future lineage features

### Non-Goals
- Implementing lineage/diff view (future work, placeholder only)
- Editing review metadata (name, template, reviewers)
- Starting a new assessment session from this page

## Decisions

### Page Structure
- Decision: Mirror Application Details page structure for consistency
- Layout:
  - **Header**: Review name, template badge, status, "Continue Assessment" button
  - **Metric cards**: Overall progress, actions needed, questions answered, last activity date
  - **Pillars section**: Table showing each pillar with progress, question count, actions
  - **Activity section** (future): Placeholder for lineage/history

### Route Structure
- Decision: Use `/applications/:appId/reviews/:reviewId` as the review details page
- Current `/applications/:appId/reviews/:reviewId/assessment` remains the assessment page
- Rationale: Follows REST-like hierarchy, details at resource root, actions as sub-paths

### Navigation Changes
- Decision: Review clicks from Application Details now go to Review Details (not directly to assessment)
- Decision: Command palette "Go to [Review Name]" navigates to Review Details
- Rationale: Provides intermediate stop for review overview; "Continue Assessment" is one click away

### Pillars Breakdown
- Decision: Display pillars in a table using the reusable DataTable component
- Columns: Pillar name, progress (bar), questions (answered/total), actions needed
- Row click: Scrolls to that pillar in the assessment page (future enhancement)

### Metric Cards
- Decision: Show 4 metric cards with gradient borders (matching Application Details):
  - Overall Progress (percentage)
  - Actions Needed (count of "No" answers + unanswered required)
  - Questions Answered (X of Y)
  - Last Activity (relative date, with "by [Name]" if available)

### Reviewers Display
- Decision: Show reviewers as avatar group in the header or a dedicated section
- Uses the `avatar-group` pattern from DataTable (stacked initials, hover to expand)
- Rationale: Consistent with future DataTable column type

### Future: Lineage Section
- Decision: Reserve space for a "History" or "Changes" section
- Initial implementation: Empty state or "Coming soon" placeholder
- Future: Timeline of assessment sessions, diff between sessions

## Risks / Trade-offs
- Adding an intermediate page increases clicks to reach assessment
  - Mitigation: "Continue Assessment" is prominent; power users can bookmark assessment URL
- Pillar click-to-scroll requires coordination with assessment page
  - Mitigation: Defer as future enhancement; initial version just shows data
