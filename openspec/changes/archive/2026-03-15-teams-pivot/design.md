## Context

The application currently uses Applications as the top-level entity for the dashboard, with reviews scoped 1:1 to applications. The "Owner" field is a plain string. Reviews with multiple templates are handled via a "sibling review" hack at the UI level (same name, different templates).

This design replaces Applications with Teams as the primary entry point, introduces Organization as a first-class organizational grouping, and makes Review a true container for 1-3 templates.

## Goals / Non-Goals

**Goals:**
- Teams Dashboard as the new homepage (`/` redirects to `/teams`)
- Team Details page with reviews list and "Start New Review" action
- Multi-step review creation wizard (Templates -> Applications -> Confirm)
- Organization entity for team grouping
- Review as true template container (ReviewTemplate join)
- Sidebar navigation updated (Teams added, Applications kept visible)
- Reusable flow pattern that replicates for Products later

**Non-Goals:**
- Products entity or flow (separate change)
- Authentication/LDAP integration for Organizations
- Real database persistence (continue with mock data, extend TD-002)
- Runtime rule evaluation for the new review model
- Template version locking implementation (data model prepared, logic deferred)
- Removing or hiding Applications routes

## Decisions

### 1. Data Model: New Entities

```
BEFORE:
┌─────────────┐  1:1   ┌──────────┐  1:1  ┌──────────┐
│ Application │───────▶│  Review  │──────▶│ Template │
│  owner: str │        │ appId    │       └──────────┘
└─────────────┘        └──────────┘

AFTER:
┌─────────────┐  1:N  ┌──────┐  1:N  ┌──────────┐  1:N(max3)  ┌────────────────┐
│ Org(ization) │──────▶│ Team │──────▶│  Review  │────────────▶│ ReviewTemplate │
└─────────────┘       └──────┘       │ teamId   │             │ templateId     │
                                  │ appIds[] │(opt N:M)    │ progress       │
                                  └──────────┘             └────────────────┘
                                       │ N:M (optional)
                                       ▼
                                  ┌─────────────┐
                                  │ Application │ (existing, unchanged)
                                  └─────────────┘
```

**New TypeScript types** (in `app/models/`):

```typescript
// app/models/organization.ts
interface Organization {
  id: string
  name: string
  shortName?: string  // e.g., "FP", "PE", "CX"
  description: string
}

// app/models/team.ts
interface Team {
  id: string
  name: string
  orgId: string
  orgName: string
  memberCount: number
  activeReviewCount: number
  lastActivityDate: string
}

// app/models/review-template.ts
interface ReviewTemplate {
  templateId: string
  templateName: string
  templateVersion: string
  progress: number
  pillars: Pillar[]
}
```

**Modified Review type**:

```typescript
// app/models/review.ts (modified)
interface Review {
  id: string
  name: string
  teamId: string                    // NEW: replaces applicationId
  orgId: string                     // NEW: derived from team
  templates: ReviewTemplate[]       // NEW: 1-3 templates with per-template progress
  applicationIds?: string[]         // NEW: optional N:M (was required 1:1 applicationId)
  status: ReviewStatus
  createdAt: string
  updatedAt: string
  assessors: ReviewParticipant[]
  reviewers: ReviewParticipant[]
}
```

### 2. Route Structure

```
NEW ROUTES:
/teams                                     ← Teams Dashboard (new homepage)
/teams/:teamId                             ← Team Details
/teams/:teamId/reviews/new                 ← Review Creation Wizard
/teams/:teamId/reviews/:reviewId           ← Review Details (re-parented)
/teams/:teamId/reviews/:reviewId/assessment ← Assessment (re-parented)
/teams/:teamId/reviews/:reviewId/survey    ← Survey mode (re-parented)

KEPT (visible, secondary):
/applications/*                            ← All existing routes unchanged

MODIFIED:
/                                          ← Redirects to /teams
```

**Page file structure:**
```
app/pages/
├── index.vue                              ← redirect to /teams
├── teams/
│   ├── index.vue                          ← Teams Dashboard
│   ├── [teamId].vue                       ← Layout wrapper
│   └── [teamId]/
│       ├── index.vue                      ← Team Details (was Application Details)
│       └── reviews/
│           ├── new.vue                    ← Review Wizard (3 steps)
│           ├── [reviewId].vue             ← Layout wrapper
│           └── [reviewId]/
│               ├── index.vue              ← Review Details
│               ├── assessment.vue         ← Assessment
│               └── survey.vue             ← Survey mode
├── applications/                          ← KEPT AS-IS
│   ├── index.vue
│   └── ...
└── templates/                             ← UNCHANGED
```

### 3. Teams Dashboard Layout

Same proven pattern as the Applications Dashboard, adapted for teams:

```
TEAMS DASHBOARD (/teams):
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │  Header: Teams / Dashboard                           │
│          │──────────────────────────────────────────────────────│
│  Teams ● │                                                      │
│  Apps    │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  Tpl     │  │ Total Teams│ │Active Revs │ │Pending Acts│       │
│          │  │     12     │ │     8      │ │    15      │       │
│          │  └────────────┘ └────────────┘ └────────────┘       │
│          │                                                      │
│          │  [Search teams...]  [Org filter: All ▼]         │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Name      │ Org      │ Reviews │ Last Active │    │
│          │  ├──────────────────────────────────────────────┤    │
│          │  │ Mobile    │ Product  │ 3       │ 2d ago      │    │
│          │  │ Platform  │ Eng      │ 5       │ 1d ago      │    │
│          │  │ Data      │ Eng      │ 2       │ 5d ago      │    │
│          │  └──────────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────────┘
```

**Reusable components**: `SearchInput`, `DataTable`, `FilterBar` (same components as Applications Dashboard, different data/columns).

### 4. Team Details Page

```
TEAM DETAILS (/teams/:teamId):
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │  Teams / Mobile Team                                 │
│          │──────────────────────────────────────────────────────│
│          │                                                      │
│          │  Mobile Team                    [Start New Review]    │
│          │  Org: Product Engineering                       │
│          │  12 members                                          │
│          │                                                      │
│          │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│          │  │Active Revs │ │ Avg Prog   │ │Pending Acts│       │
│          │  │     3      │ │   67%      │ │    8       │       │
│          │  └────────────┘ └────────────┘ └────────────┘       │
│          │                                                      │
│          │  Reviews                                             │
│          │  ┌──────────────────────────────────────────────┐    │
│          │  │ Name       │ Templates │ Status │ Progress   │    │
│          │  ├──────────────────────────────────────────────┤    │
│          │  │ Q1 Review  │ OPS, SEC  │ Active │ ████░ 75%  │    │
│          │  │ Peak Prep  │ PERF      │ Draft  │ ░░░░░  0%  │    │
│          │  └──────────────────────────────────────────────┘    │
└──────────┴──────────────────────────────────────────────────────┘
```

Pattern mirrors Application Details: header with metadata, metric cards, reviews table. Uses `DataTable` component with different columns.

### 5. Review Creation Wizard

Three-step flow, single page with step state managed in a composable. Current UX uses a distinct stepper container, lightweight inline pagination controls (to avoid competing with primary frames), persistent selection summaries, and a stronger Confirm layout.

```
STEP 1 - SELECT TEMPLATES (1-3):
┌─────────────────────────────────────────────────────────────────┐
│  Teams / Mobile Team / New Review                               │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  [ STEPPER FRAME ]                                               │
│  ● Step 1: Templates    ○ Step 2: Applications    ○ Step 3:Confirm│
│                                                                  │
│  Select up to 3 templates for this review.                       │
│  Selected: [2 templates selected]                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ✓ Operations Readiness        Active    4 pillars       │    │
│  │   Comprehensive ops checklist                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   Security Compliance          Active    3 pillars       │    │
│  │   Security and compliance assessment                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Templates · Page 1 of 2      ( Previous | Next page )           │
│                                                                  │
│  [Cancel]                                          [Next →]     │
└─────────────────────────────────────────────────────────────────┘

STEP 2 - LINK APPLICATIONS (optional):
┌─────────────────────────────────────────────────────────────────┐
│  [ STEPPER FRAME ]                                               │
│  ○ Step 1    ● Step 2: Applications    ○ Step 3: Confirm        │
│                                                                  │
│  Optionally link applications to this review.                    │
│  Linking helps track readiness per application over time.        │
│  Linked: [2 applications linked]                                 │
│                                                                  │
│  [Search applications...]                                        │
│                                                                  │
│  ☐ Customer Portal                                              │
│  ☐ Payment Gateway                                              │
│  ☐ Analytics Dashboard                                          │
│  ☐ Mobile App                                                   │
│                                                                  │
│  Applications · Page 1 of 2   ( Previous | Next page )          │
│                                                                  │
│  [← Back]    [Skip]                               [Next →]     │
└─────────────────────────────────────────────────────────────────┘

STEP 3 - CONFIRM (POLISHED):
┌─────────────────────────────────────────────────────────────────┐
│  [ STEPPER FRAME ]                                               │
│  ○ Step 1    ○ Step 2    ● Step 3: Confirm                      │
│                                                                  │
│  Finalize review details before creation                         │
│  Review Name                                                     │
│  [ e.g. Topic Q1 2026 Review                   ]                │
│                                                                  │
│  ┌──────────────────────────┐ ┌──────────────────────────┐      │
│  │ Templates      2 selected│ │ Applications    2 linked │      │
│  │ • Peak Season        v1  │ │ • Customer Portal     ↔  │      │
│  │ • PCI-DSS            v2  │ │ • Analytics Dashboard ↔  │      │
│  └──────────────────────────┘ └──────────────────────────┘      │
│                                                                  │
│  [Cancel]                       [← Back] [Create Review (lg)]   │
└─────────────────────────────────────────────────────────────────┘
```

**Wizard state composable** (`app/teams/useReviewWizard.ts`):
- Manages current step (1-3)
- Tracks selected templateIds, applicationIds, review name
- Validates step transitions (Step 1 needs >= 1 template)
- Handles submission via POST to `/api/teams/:teamId/reviews`

### 6. Review Details Adaptation

The existing Review Details page (`[reviewId]/index.vue`) is largely reusable. Changes:

- Breadcrumbs: "Teams / [Team Name] / [Review Name]" (was "Dashboard / Applications / ...")
- Route params: `teamId` replaces `appId`
- Template display: Already handles multi-template via tabs (the sibling hack). With the true container model, `review.templates` is native -- simpler.
- The sibling-review fetching logic (`useApplicationReviews` to find same-name siblings) is removed. `review.templates` directly provides all template data.

### 7. Composable Structure

```
app/
├── teams/                              ← NEW domain folder
│   ├── useTeams.ts                     ← Fetch teams list
│   ├── useTeamDetails.ts              ← Fetch single team
│   ├── useTeamReviews.ts             ← Fetch reviews for a team
│   ├── useTeamFilters.ts             ← Search + Org filter
│   └── useReviewWizard.ts            ← Wizard step state + submission
├── orgs/                              ← NEW domain folder
│   └── useOrgs.ts                     ← Fetch organizations list
├── applications/                       ← KEPT, still used
│   ├── useApplications.ts
│   ├── useApplicationDetails.ts
│   ├── useApplicationFilters.ts
│   ├── useApplicationReviews.ts       ← Still used by /applications/* routes
│   └── useReviewData.ts              ← Shared, used by both teams and applications review details
│   └── useReviewSessions.ts          ← Shared, used by both
└── models/
    ├── organization.ts                ← NEW
    ├── team.ts                        ← NEW
    ├── review-template.ts             ← NEW
    ├── review.ts                      ← MODIFIED (teamId, templates[], applicationIds?)
    └── ...                            ← Rest unchanged
```

### 8. Mock Data Strategy

Extend the existing mock data pattern in `server/`:

```
server/
├── api/
│   ├── orgs/
│   │   └── index.get.ts               ← GET /api/orgs
│   ├── teams/
│   │   ├── index.get.ts               ← GET /api/teams
│   │   ├── [id].get.ts               ← GET /api/teams/:id
│   │   └── [id]/
│   │       └── reviews.get.ts         ← GET /api/teams/:id/reviews
│   │       └── reviews.post.ts        ← POST /api/teams/:id/reviews
│   ├── applications/                   ← KEPT AS-IS
│   └── reviews/                        ← MODIFIED: review.templates replaces single templateId
└── data/
    ├── organizations.ts               ← NEW: mock organizations
    ├── teams.ts                       ← NEW: mock teams
    └── reviews.ts                     ← MODIFIED: reviews have teamId + templates[]
```

**Mock Organizations** (6 actual organizational units):

| ID | Name | Short |
|----|------|-------|
| org-payments | Payments | - |
| org-fp | Financial Products | FP |
| org-pe | Platform Engineering | PE |
| org-cx | Customer Experience | CX |
| org-te | Tech Enablement | - |
| org-ipo | Identity Performance Optimization | IPO |

**Mock Teams** (2-3 per org for realistic distribution, ~15 total).

**Review name input**: Blank field with placeholder `"e.g., Topic Q1 2026 Review"`. No auto-generation.

**Metrics computation**: Dashboard metrics (Active Reviews, Pending Actions) are computed from mock review data, not hardcoded on teams. This keeps the pattern realistic and prepares for a future "dry-run" review mode that would be excluded from metric aggregation.

### 9. Navigation Sidebar Changes

Add Teams icon between logo and current Dashboard link:

```
┌──────────┐
│  Peaky   │
├──────────┤
│ Teams    │  ← NEW (lucide:users, links to /teams)
│ Apps     │  ← RENAMED label "Dashboard" → "Apps" (lucide:layout-dashboard stays)
│ Templates│  ← unchanged
│ Help     │  ← unchanged
├──────────┤
│ Settings │
│ Profile  │
└──────────┘
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────────────────┐                                 │
│   │   E2E (Playwright)        │  Teams dashboard load,          │
│   │                           │  wizard flow, navigation        │
│   └───────────────────────────┘                                 │
│                                                                  │
│   ┌───────────────────────────────┐                             │
│   │  Component Tests (Vitest)     │  TeamTable, WizardStep      │
│   │                               │  components rendering       │
│   └───────────────────────────────┘                             │
│                                                                  │
│   ┌─────────────────────────────────────┐                       │
│   │  Unit Tests (Vitest)                │  useTeams,            │
│   │                                     │  useReviewWizard,     │
│   │                                     │  useTeamFilters       │
│   └─────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Unit tests** (pure composable logic):
- `useTeamFilters` - search + org filtering
- `useReviewWizard` - step transitions, validation, state management

**Component tests**:
- TeamTable renders correct columns with team data
- Wizard step components render appropriate content per step

**E2E tests**:
- Navigate to Teams Dashboard from homepage redirect
- Click team row -> Team Details
- Start New Review -> complete wizard flow
- Review Details loads under team route

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Review model change breaks existing assessment flow | Assessment reads `review.templates[0].pillars` instead of `review.pillars` -- mechanical refactor. E2E tests catch regressions. |
| Applications routes become stale with new review model | Applications stay on old mock data for now. When application integration returns, it gets updated. |
| Wizard adds complexity vs. single-page template selection | Wizard composable isolates state. Each step is a simple component. Pattern replicates for Products. |
| Organization as first-class entity is premature | Organizations are few and stable. The entity is simple (id, name, shortName, description). Cost of adding later is higher than adding now. |

## Migration Plan

No production deployment. No data migration needed. All changes are additive (new routes, new types, new endpoints). Existing `/applications/*` routes are untouched.

1. Add new types (Organization, Team, ReviewTemplate)
2. Modify Review type
3. Add mock data + API endpoints
4. Build pages (Teams Dashboard, Team Details, Wizard)
5. Update sidebar navigation
6. Update homepage redirect
7. Adapt Review Details to new model
8. Verify existing application routes still work

Rollback: Revert branch. No database changes.

## Open Questions

None -- all resolved.

### Resolved

1. **Mock Organizations data**: Organizations are: Payments, Financial Products (FP), Platform Engineering (PE), Customer Experience (CX), Tech Enablement, Identity Performance Optimization (IPO). Use short names where available (e.g., "FP", "PE", "CX", "IPO").
2. **Review name**: Leave blank with a placeholder hint like "e.g., Topic Q1 2026 Review". No auto-generation.
3. **Team metrics**: Computed from mock review data (not hardcoded). Future consideration: allow "dry-run" or "test" reviews that don't contribute to metrics, so users can explore templates without polluting stats. This is deferred but the metrics computation should be structured to support filtering by review mode later.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
|---------|------------------|-----------|------------------|-------|
| Teams table | `DataTable` (custom) | `:columns`, `:data`, `:clickable-rows` | `bg-elevated` | Reuse existing DataTable |
| Search input | `SearchInput` (custom) | `v-model`, `placeholder` | - | Reuse existing component |
| Organization filter | `USelect` | `v-model`, `items`, `icon="i-lucide-filter"` | global `select` slots in `app.config.ts` | Uses "Organizations" label/terminology |
| Metric cards | Custom div | - | `bg-elevated rounded-xl p-6` | Same pattern as app dashboard |
| Wizard step indicator | `UStepper` | `:items`, `:model-value` | gradient outer frame + elevated inner surface | Primary progress affordance |
| Template selection cards | Custom button | - | `border rounded-lg p-6` | Reuse pattern from existing new.vue |
| Application selection list | Custom | - | `rounded-lg` | Checkbox list with search, names only (no status) |
| Step pagination controls | `UButton` | `size="sm"`, `variant="ghost"` | compact rounded capsule, low-emphasis container | Separate from stepper/action-bar visual weight |
| Review name input | `UInput` | `size="lg"` | - | Step 3 prominent input |
| Create button | `UButton` | `color="primary" size="lg"` | stronger hover (brightness + shadow) | Final wizard step |
| Cancel button | `UButton` | `color="neutral" variant="ghost"` | - | All wizard steps |
| Team sidebar icon | `Icon` | `name="lucide:users"` | - | New nav item |
| Organization text | Plain text | - | `text-muted` | Replaced previous badge usage for readability |

### Spatial Composition

- **Dashboard page padding**: `px-8 py-6` with `max-w-8xl mx-auto` (matches existing)
- **Metric cards grid**: `grid gap-4 sm:grid-cols-3` (matches existing)
- **Table container**: Full width within content area
- **Wizard container**: `max-w-4xl mx-auto` (matches existing new review page)
- **Wizard step spacing**: `space-y-6` between step indicator and content
- **Template cards**: `gap-4` between cards (matches existing)
- **Sidebar icon size**: `h-12 w-12` with `text-2xl` icon (matches existing nav items)

### Visual Assertions

- "AND the Teams Dashboard metric cards use the same gradient border styling as Review Details"
- "AND team table rows show Organization as readable text (not badge-styled status UI)"
- "AND the wizard step indicator clearly marks the current step as active"
- "AND completed wizard steps show a checkmark icon"
- "AND step pagination is visually de-emphasized relative to stepper/action bar"
- "AND the template selection cards use the same styling as the existing new review page"
- "AND the application selection in Step 2 shows only application names with checkboxes (no status badges -- readiness is a review outcome, not an input)"
- "AND the confirmation step uses two clearly framed summary cards (Templates/Applications) with strong dark-mode contrast"
- "AND the sidebar Teams icon uses `lucide:users` and highlights on `/teams/*` routes"
- "AND the existing Applications sidebar link remains visible and functional"
