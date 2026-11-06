## Context

Teams come from LDAP (external organizational data) with predefined identity (name, org, members). Products need a parallel view but with user-created identity — users create products on-demand as the unit of review for things that don't map to a single LDAP team.

A Product is the central concept that ties teams, applications, and reviews together. It represents something the organization builds and operates. As products grow in complexity and scope, they naturally involve more teams and more applications.

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCT MENTAL MODEL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌──────────────────┐                         │
│                    │     Product      │                         │
│                    │  name + origin   │                         │
│                    └────────┬─────────┘                         │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │           │               │           │               │
│   ┌─────▼─────┐ ┌──▼───┐ ┌────────▼────────┐ ┌▼──────────┐   │
│   │  Contacts │ │Teams │ │  Applications   │ │  Links    │   │
│   │  PM (req) │ │who   │ │  that make up   │ │  roadmap  │   │
│   │  Eng Lead │ │own   │ │  this product   │ │  docs     │   │
│   │  (opt)    │ │(1..n)│ │  (0..n)         │ │  support  │   │
│   └───────────┘ └──────┘ └─────────────────┘ └───────────┘   │
│                                                                 │
│   All external references (people, teams, applications) are    │
│   stored as short Backstage IDs — resolved at render time.     │
│   Products grow: more teams join, more applications attach.    │
│   Reviews assess readiness across all of it.                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

CONCRETE EXAMPLE — "Checkout" (service)

┌─────────────────────────────────────────────────────────────────┐
│  Product: Checkout          origin: bespoke · External         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Contacts                        Teams                         │
│  ─────────                       ─────                         │
│  PM:       Vlad S. (vlads)       ├─ Checkout Core              │
│  Eng Lead: Heitor L. (heitorl)   └─ Payments Platform          │
│                                                                 │
│  Applications                    Links                         │
│  ────────────                    ─────                         │
│  ├─ checkout-api                 Roadmap: confluence/checkout   │
│  ├─ checkout-web                 Docs:    docs.adyen/checkout   │
│  └─ payment-gateway              Support: #checkout-support     │
│                                                                 │
│  "Applications" in the UI maps to Backstage components.        │
│  Users think "apps"; data stores componentRefs.                │
│                                                                 │
│  PRODUCT MATURITY — the fields map directly:                   │
│    a) clear ownership       → PM + Eng Lead contacts           │
│    b) origin clarity        → origin + isExternal              │
│    c) documentation         → documentationUrl                 │
│    d) roadmap               → roadmapUrl                       │
│    e) feedback loop         → supportChannel (Slack channel)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Ownership — Local vs External

```
┌─────────────────────────────────────────────────────────────────┐
│                  DATA OWNERSHIP MODEL                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   LOCAL (owned by Peaky)           BACKSTAGE (external refs)   │
│   ══════════════════════           ═════════════════════════    │
│                                                                 │
│   Products                         Users     (kind: User)      │
│   ProductReviews                   Teams     (kind: Group)     │
│   Assessments                      Components(kind: Component) │
│   Templates                                                     │
│   Scoring Rules                    Resolved at render time     │
│                                    via Backstage Catalog API   │
│                                                                 │
│   Peaky stores only short IDs:                                  │
│     productManagerRef: "vlads"                                  │
│     engineeringLeadRef: "heitorl"                               │
│     teamRefs: ["resilience-taskforce"]                          │
│     componentRefs: ["webapp-pal"]                               │
│                                                                 │
│   UI terminology:                                               │
│     "Applications" (user-facing) = componentRefs (data model)  │
│     Users search/link "applications"; stored as Backstage      │
│     component IDs under the hood.                              │
│                                                                 │
│   Backstage URLs follow:                                        │
│     /catalog/default/user/{id}                                  │
│     /catalog/default/group/{id}                                 │
│     /catalog/default/component/{id}                             │
│                                                                 │
│   The kind is inferred from the field name:                    │
│     *Ref fields on users → User                                │
│     teamRefs → Group                                           │
│     componentRefs → Component                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

This approach keeps the local database lean and positions Peaky for a local-first architecture — all Peaky-owned data can live on-device, while Backstage is the resolution layer for organizational identity.

Current architecture:
```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAMS (LDAP-sourced)                        │
│                                                                 │
│   LDAP Sync → Team → Review → Assessment                        │
│                │                                                │
│                └─ Predefined: name, org, memberCount           │
│                                                                 │
│   Routes: /teams, /teams/:id/reviews/*                          │
└─────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Products view with parallel structure to Teams
- User-created products with rich identity (name, type, contacts, teams, applications, links)
- Backstage-native references — store short IDs, resolve display info at render time
- Standalone product creation page with mental model explainer
- Product editing via dedicated edit page and `PATCH` API
- Product-to-team relationships (one product, one or more owning teams via Backstage groups)
- Product-to-application relationships (one product, zero or more applications — stored as Backstage component refs)
- Product contacts: Product Manager (required) and Engineering Lead (optional) via Backstage user lookup
- External links on products (roadmap, documentation, support)
- Product-scoped reviews separate from team reviews

**Non-Goals:**
- Product lifecycle management (archiving, ownership transfer)
- Bulk product import

## Decisions

### 1. Parallel Architecture (Not Unified Subject)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PARALLEL MODELS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   TEAMS                          PRODUCTS                       │
│   ═════                          ════════                       │
│                                                                 │
│   Team (LDAP)                    Product (User-created)         │
│   ├─ id                          ├─ id                          │
│   ├─ name                        ├─ name                        │
│   ├─ orgId                       ├─ origin (bespoke|           │
│   ├─ orgName                     │    open-source|vendor)       │
│                                  ├─ isExternal: boolean         │
│   └─ memberCount                 ├─ productManagerRef: string  │
│                                  │    (Backstage user ID)       │
│                                  ├─ engineeringLeadRef?: string│
│                                  │    (Backstage user ID)       │
│                                  ├─ teamRefs: string[]         │
│                                  │    (Backstage group IDs)     │
│                                  ├─ componentRefs: string[]    │
│                                  │    (Backstage component IDs) │
│                                  ├─ roadmapUrl?: string        │
│                                  ├─ documentationUrl?: string  │
│                                  ├─ supportChannel?: string    │
│                                  │    (Slack channel name)      │
│                                  ├─ createdAt                   │
│                                  └─ createdBy                   │
│         │                               │                       │
│         ▼                               ▼                       │
│   Review                         ProductReview                  │
│   ├─ teamId                      ├─ productId                  │
│   ├─ templateIds                 ├─ templateIds                 │
│   ├─ status                      ├─ status                     │
│   └─ ...                         └─ ...                        │
│                                                                 │
│   Shared: Assessment flow, templates, status enum               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**: Separate models keep the domains clean. Products diverge from teams with richer metadata (links, multi-team ownership, application composition). No premature abstraction.

### 2. Standalone Product Creation (Not Inline in Wizard)

```
┌─────────────────────────────────────────────────────────────────┐
│              PRODUCT CREATION vs REVIEW CREATION                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   /products/new                  /products/:id/reviews/new     │
│   ══════════════                 ══════════════════════════     │
│                                                                 │
│   Dedicated page:                Review wizard (2 steps):      │
│                                                                 │
│   ┌─ Mental Model ──────────┐   Step 1: Templates              │
│   │  Visual explainer of    │   Step 2: Scope & Confirm        │
│   │  what a product is      │          (full product OR        │
│   └─────────────────────────┘           specific applications) │
│                                          + review name         │
│   ┌─ Identity ──────────────┐                                   │
│   │  Name*    [__________]  │                                   │
│   │  Origin*  (◉ Bespoke)   │  ← 3 radio cards                 │
│   │           ( ) OSS       │                                   │
│   │           ( ) Vendor    │                                   │
│   │  [x] External (toggle)  │                                   │
│   └─────────────────────────┘                                   │
│                                                                 │
│   ┌─ Contacts ──────────────┐                                   │
│   │  PM*       [Search...]  │  ← Backstage user lookup         │
│   │  Eng Lead  [Search...]  │  ← optional, Backstage user      │
│   └─────────────────────────┘                                   │
│                                                                 │
│   ┌─ Teams ─────────────────┐                                   │
│   │  [Search teams...]      │  ← Backstage group lookup        │
│   │  + selected chips       │                                   │
│   └─────────────────────────┘                                   │
│                                                                 │
│   ┌─ Applications ──────────┐                                   │
│   │  [Search applications.] │  ← Backstage component lookup    │
│   │  + selected chips       │                                   │
│   └─────────────────────────┘                                   │
│                                                                 │
│   ┌─ Links (optional) ─────┐                                   │
│   │  Roadmap      [url]    │                                   │
│   │  Documentation [url]   │                                   │
│   │  Support      [url]    │                                   │
│   └─────────────────────────┘                                   │
│                                                                 │
│       [Cancel]  [Create Product]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**: Product creation has grown beyond what fits inline in a wizard. A dedicated page gives room for the mental model explainer and the richer form (teams, applications, links). It also separates concerns: create the product first, then start reviews on it.

### 3. Product-to-Team Relationship

- `teamRefs: string[]` — Backstage group short names (e.g., `"resilience-taskforce"`)
- Array from day one to support multiple teams without migration
- Creation form starts with a team search selector, the model allows growth
- Display names resolved from Backstage at render time
- Product detail page shows associated teams with Backstage links

### 4. Product-to-Application Relationship

- `componentRefs: string[]` — Backstage component short names (e.g., `"webapp-pal"`)
- UI calls these "Applications" — users think in terms of apps, data stores component refs
- Optional (zero or more)
- Product detail page shows application count and names (resolved from Backstage)
- Review wizard pre-populates the Applications step from `product.componentRefs`

### 5. External Links

- Two optional URL fields (`roadmapUrl`, `documentationUrl`) + one optional text field (`supportChannel`)
- `supportChannel` is a Slack channel name (e.g. `#checkout-support`) — not a URL
- Displayed on product detail page as a Resources table (Roadmap, Docs, Support Channel rows)
- URL fields validated as URLs on the API side (zod `.url().optional()`); `supportChannel` is plain string

### 6. Product Contacts (Backstage User References)

```
┌─────────────────────────────────────────────────────────────────┐
│              CONTACTS vs TEAMS (different concerns)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   CONTACTS (people)              TEAMS (organizational)        │
│   ═════════════════              ══════════════════════         │
│                                                                 │
│   "Who do I talk to?"            "Who owns/contributes?"       │
│                                                                 │
│   productManagerRef: "vlads"     teamRefs: ["res-taskforce",   │
│   engineeringLeadRef?: "heitorl"            "checkout-core"]   │
│                                                                 │
│   Stored as short Backstage      Multiple teams can contribute │
│   user IDs — display name        to one product. Contacts are  │
│   resolved at render time.       the single point of contact   │
│                                  regardless of team count.     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Product Manager is **required** — every product needs a point of contact
- Engineering Lead is **optional** — not all products have a dedicated eng lead
- Contacts stored as short Backstage user IDs (e.g., `"vlads"`, `"heitorl"`)
- Display info (name, email) resolved from Backstage Catalog API at render time
- UI uses an autocomplete/search input that queries the Backstage-backed search endpoint

### 7. Product Editing (PATCH + Edit Page)

- `PATCH /api/products/:id` accepts partial updates — any subset of product fields
- Edit page at `/products/:productId/edit` reuses the same form layout as creation
- Form is pre-populated with existing product data
- Product detail page shows an "Edit" button linking to the edit page
- On successful save, user is navigated back to the product detail page

### 8. Backstage Resolution Layer (Mocked for Now)

```
┌─────────────────────────────────────────────────────────────────┐
│              RESOLUTION LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   IMPORTANT: Resolution is CLIENT-SIDE, not server-side.       │
│   The Nitro server (Vercel) cannot reach internal Backstage.   │
│   The user's browser (corporate network) can.                  │
│                                                                 │
│   Product record         Browser composable     Backstage      │
│   (local, lean)          (client-side)           (internal)    │
│                                                                 │
│   productManagerRef  →   useBackstageEntity     launchpad.is   │
│   "vlads"                ("user", "vlads")  →   .adyen.com/    │
│                          { name, email }        catalog/       │
│                                                  default/user/ │
│                                                  vlads         │
│                                                                 │
│   teamRefs           →   useBackstageEntity                    │
│   ["res-taskforce"]      ("group", id)      →   /catalog/      │
│                          { name }               default/group/ │
│                                                                 │
│   componentRefs      →   useBackstageEntity                    │
│   ["webapp-pal"]         ("component", id)  →   /catalog/      │
│                          { name }               default/       │
│                                                  component/    │
│                                                                 │
│   MOCK PHASE: Composable returns from local mock data in        │
│               app/composables/useBackstage*.ts                 │
│               (no network call — data embedded in composable)  │
│   PRODUCTION: Composable calls Backstage Catalog API           │
│               directly from the browser.                       │
│                                                                 │
│   No server/api/backstage/ routes — resolution never goes      │
│   through the Nitro server. Mock data lives in:                │
│     app/composables/useBackstageUserSearch.ts                  │
│     app/composables/useBackstageGroupSearch.ts                 │
│     app/composables/useBackstageComponentSearch.ts             │
│     app/composables/useBackstageSearch.ts (generic)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Mock data reuses the existing `participants` records from `server/data/reviews.ts` for users
- Mock data reuses existing teams/applications data for groups/components
- In production, the browser calls Backstage Catalog API directly (internal network)
- Search endpoints return `Array<{ id, name, email? }>` (shape varies by kind)

### 9. Resilience — Graceful Degradation When Backstage Is Unreachable

```
┌─────────────────────────────────────────────────────────────────┐
│              GRACEFUL DEGRADATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   RESOLVED (Backstage reachable)   DEGRADED (unreachable)      │
│   ══════════════════════════════   ════════════════════════     │
│                                                                 │
│   PM: Vlad S. (vlads)              PM: vlads                   │
│       + email, Backstage link          raw ID, still useful    │
│                                                                 │
│   Teams:                           Teams:                      │
│   ├─ Checkout Core                 ├─ checkout-core            │
│   └─ Payments Platform             └─ payments-platform        │
│                                                                 │
│   Apps:                            Apps:                       │
│   ├─ checkout-api                  ├─ checkout-api             │
│   └─ checkout-web                  └─ checkout-web             │
│                                                                 │
│   KEY: Backstage short IDs are human-readable by design.       │
│   The app is always usable — resolution only enriches.         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rendering pattern**: render immediately with the raw ID, enhance with display info when resolution succeeds. Never block on resolution. Never show loading spinners for entity names.

**Composable contract**:
```typescript
// useBackstageEntity returns synchronously with the ID,
// then reactively updates when resolution completes
const { displayName, email, resolved } = useBackstageEntity('user', 'vlads')
// displayName starts as "vlads", becomes "Vlad S." if resolved
// resolved: false → true (or stays false on failure)
```

**Failure modes and handling**:

| Scenario | Behavior |
|----------|----------|
| Backstage reachable, entity exists | Show display name, email, Backstage profile link |
| Backstage reachable, entity not found | Show raw ID with subtle "not found" indicator |
| Backstage unreachable (off VPN, down) | Show raw ID, no indicator (IDs are readable) |
| Creation form: Backstage unreachable | Search yields no results; user can type raw ID manually as fallback |

**Why this works**: Backstage short IDs (`heitorl`, `resilience-taskforce`, `webapp-pal`) are human-readable by convention. They are the username, the team slug, the app name. Showing them unresolved is not a broken experience — it's a slightly less rich one.

### 10. Data Storage (Mock Data Phase)

Products stored in `server/data/products.ts` following existing pattern:

```typescript
export type ProductOrigin = "bespoke" | "open-source" | "vendor";

export interface Product {
  id: string;
  name: string;
  origin: ProductOrigin;           // how the product came to exist
  isExternal: boolean;             // true = customer-facing, false = internal
  productManagerRef: string;       // Backstage user ID, e.g. "vlads"
  engineeringLeadRef?: string;     // Backstage user ID, e.g. "heitorl"
  teamRefs: string[];              // Backstage group IDs, e.g. ["resilience-taskforce"]
  componentRefs: string[];         // Backstage component IDs, e.g. ["webapp-pal"] — UI shows as "Applications"
  roadmapUrl?: string;
  documentationUrl?: string;
  supportChannel?: string;         // Slack channel name, e.g. "#checkout-support"
  createdAt: string;
  createdBy: string;
  // Computed at query time (not stored):
  totalReviewCount: number;
  activeReviewCount: number;
  lastActivityDate: string;
}
```

### 11. Route Structure

```
/products                              → Products dashboard
/products/new                         → Product creation page
/products/:productId                  → Product details
/products/:productId/edit             → Product edit page
/products/:productId/reviews/new      → New product review wizard
/products/:productId/reviews/:reviewId → Product review details
```

## Testing strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEST COVERAGE (actual)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Unit Tests (composables)                                     │
│   ────────────────────────                                     │
│   tests/products/                                              │
│   ├─ useProducts.test.ts         ← interface shape             │
│   ├─ useProductFilters.test.ts   ← filter by origin, search    │
│   ├─ useProductReviews.test.ts   ← interface + sort comparator │
│   └─ resolveBackstageUser.test.ts← Backstage ID → display name │
│                                                                 │
│   API Tests (data layer)                                       │
│   ───────────────────────                                      │
│   tests/nuxt/api/                                              │
│   ├─ products.test.ts            ← GET/POST/PATCH products     │
│   └─ review-lookup.test.ts       ← findReviewById: team +      │
│                                     product reviews, unknown,  │
│                                     unified interface cast      │
│                                                                 │
│   E2E Tests                                                    │
│   ──────────                                                   │
│   tests/e2e/                                                   │
│   └─ product-flow.spec.ts        ← create product → review     │
│                                     wizard → assessment loads  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Product proliferation | Products are lightweight; accept natural growth |
| Duplicate product names | Allow duplicates (not unique constraint); users self-govern |
| Creator attribution | Store `createdBy` for future ownership features |
| Team/app association stale | Accept staleness; no sync needed for MVP. Products reflect a point-in-time snapshot, users update as needed in future iterations |

## What Was Built

All planned decisions were implemented. Key changes from original design:

| Area | Designed | Implemented |
|------|----------|-------------|
| Product identity field | `type` (dropdown) | `origin` enum (3 radio cards) + `isExternal` toggle |
| Support link | `supportUrl` (URL) | `supportChannel` (Slack channel name, plain text) |
| Product detail layout | Ownership & Support card + Architecture card | PM/EL inline in header, 2-col grid (Architecture + Resources table) |
| Review wizard steps | 2-step described | 2-step confirmed: Templates → Scope & Confirm |
| Session history | Not designed | Save-with-comment modal, in-memory session storage, History section |
| Unified review API | Separate endpoints per review type | `findReviewById()` in `server/data/review-lookup.ts` serves all sub-endpoints for both team and product reviews |
| Shared review UI | Separate markup per page | `ReviewHeader`, `ReviewParticipants`, `ReviewMetrics` extracted to `app/components/review/` |
| Pillar tab progress | Server-driven | `localPillarStats` computed from `questions.value` for immediate updates |
| ProductTable | Name + Origin + Reviews + Actions | Added Teams column (first 2 chips + overflow tooltip) + Last Activity column (relative date, sortable) |

### 12. Save-with-Comment Modal

Assessment saves are not silent — users are prompted for a session note before answers are persisted. This creates an audit trail in the History section.

```
[Save] button (header CTA)
  │
  ▼
SaveProgressModal
  ├─ shows: questions answered this session, progress delta, per-pillar bars
  ├─ optional comment textarea (Ctrl+Enter submits)
  └─ on confirm:
       ├─ POST /api/reviews/:id/answers  (each answer)
       └─ POST /api/reviews/:id/sessions (comment + snapshot + delta)
```

`useSaveModal.ts` — Promise-based singleton composable (same pattern as `useNAModal`). `open()` returns `Promise<string | null>` — `null` means cancelled.

### 13. Unified Review API

All `/api/reviews/:id/*` sub-endpoints serve both team reviews and product reviews via a single lookup function:

```typescript
// server/data/review-lookup.ts
export const findReviewById = (id: string): Review | undefined => {
  return reviews.find(r => r.id === id)
      ?? (productReviews.find(r => r.id === id)
            ? { ...productReview, teamId: "", orgId: "" } as Review
            : undefined);
};
```

Product reviews are cast to `Review` shape (shared fields only: id, name, templates, pillars, status, assessors, reviewers). The assessment flow never needs to know whether it's working with a team or product review.

### 14. In-Memory Session Storage

Sessions accumulate in a runtime array (`runtimeSessions`) alongside static seed data. `getSessionsByReviewId()` merges both. Data survives browser refresh but resets on server restart — same contract as all other in-memory stores.

### 15. Shared Review Components

`ReviewHeader`, `ReviewParticipants`, and `ReviewMetrics` in `app/components/review/` are used by both team and product review detail pages. Extracts ~460 lines of duplicate markup. Both pages remain thin wrappers: load data, pass props, handle navigation.

## Open Questions — Resolved

- **Should products be deletable?** Deferred — not needed for MVP.
- **Should products have descriptions?** Deferred — name + origin + links sufficient.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Product origin badge | UBadge | `color="neutral" variant="subtle"` | | bespoke / open-source / vendor + Internal/External |
| Product table row | tr | | `hover:bg-muted transition-colors` | Products list |
| Create/edit product form | UInput + USelect + UInputMenu | `size="lg"` | | Dedicated page, shared layout for create and edit |
| PM search | UInputMenu | single-select | | Backstage user autocomplete, required |
| Eng Lead search | UInputMenu | single-select | | Backstage user autocomplete, optional |
| Team search/select | UInputMenu | `multiple` | | Backstage group search, multi-select with chips |
| Application search/select | UInputMenu | `multiple` | | Label: "Applications", searches Backstage components, multi-select with chips |
| Link inputs | UInput | `size="lg" type="url"` | | Roadmap + Documentation are URL inputs (lucide:map, lucide:book-open); Support Channel is a text input for Slack channel name (lucide:message-square) |
| Edit button | UButton | `color="neutral" variant="outline"` | | On product detail page, navigates to edit |
| Mental model card | div | | `bg-elevated border-default rounded-xl` | Visual explainer at top of creation page |
| Empty products | div | | `bg-elevated border-default rounded-lg border` | Centered icon + text |

### Spatial Composition

- Container widths: `max-w-8xl mx-auto` (dashboard), `max-w-4xl mx-auto` (creation page)
- Gaps and spacing: `gap-4` between cards, `space-y-4` within sections, `space-y-6` between form groups
- Stretch behavior: Product cards stretch to container width
- Visual hierarchy: Type badge subtle, name prominent, links as secondary info

### Visual Assertions

- AND the products dashboard uses same stat card styling as Teams
- AND the product origin badge uses `color="neutral" variant="subtle"`
- AND the creation page shows a mental model diagram at the top
- AND the creation form groups fields into logical sections (Identity, Contacts, Teams, Applications, Links)
- AND the PM field is required and uses Backstage user autocomplete
- AND the Eng Lead field is optional and uses Backstage user autocomplete
- AND team/application selectors show chips for selected items
- AND link inputs use appropriate icons (map for roadmap, book for docs, message-square for support channel)
- AND empty products state shows centered icon with "No products yet" message
- AND the products dashboard has a "New Product" button navigating to `/products/new`
- AND the product detail page shows an "Edit" button navigating to `/products/:productId/edit`
- AND the edit page pre-populates all fields with existing product data
- AND the product detail page displays PM and Eng Lead as Backstage-linked names in the header metadata row
- AND PM and EL abbreviations have UTooltip showing full role name on hover
- AND the product detail page groups Architecture (teams + apps) and Resources (roadmap, docs, support channel) in a 2-column grid
- AND support channel appears as a row in the Resources table (not a URL link)
