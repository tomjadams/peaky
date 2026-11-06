## Context

Review Details already shows a metric labeled "Actions Needed", but the current experience does not make that number actionable. The implementation currently derives the visible count from unanswered questions, while the desired product behavior needs a richer attention model:

```text
Items needing attention
├─ Follow-up
│  ├─ Yes/no answered No
│  └─ Checklist question with missing non-N/A practices
├─ Not assessed
│  └─ Unanswered question
└─ Documented exception
   └─ N/A with reason, excluded from the primary count by default
```

The intended experience turns the metric from a dead-end number into a guided workflow:

```text
Current

Assessment
   │
   ├─ Yes / No / N/A / unanswered / partial checklist
   │
   ▼
Save progress
   │
   ▼
Review Details
   │
   └─ "Actions Needed: 7"
        │
        └─ User manually returns to assessment and hunts for context


Proposed

Assessment
   │
   ├─ Yes / No / N/A / unanswered / partial checklist
   │
   ▼
Save progress
   │
   ▼
Review Details
   │
   └─ "Items needing attention: 7"
        ├─ 4 follow-up
        └─ 3 not assessed
        │
        ▼
Improvement Plan
   │
   ├─ Scan table
   ├─ Filter by state / severity / pillar / template
   ├─ Expand row for concise reason
   ├─ Learn why in side panel
   └─ Open exact assessment question
```

Existing assets to reuse:

- Review details pages for team, product, and application contexts.
- Assessment question metadata (`importance`, `leadingPractices`, `helpfulLinks`).
- `MoreInfoPanel` for learning-oriented question context.
- `DataTable` styling patterns and table aesthetics from `site/docs/development/visual-design.md`.
- Brand and semantic color guidance from `DESIGN.md`.

## Goals / Non-Goals

**Goals:**

- Add contextual review plan pages at `/teams/:teamId/reviews/:reviewId/plan`, `/products/:productId/reviews/:reviewId/plan`, and `/applications/:appId/reviews/:reviewId/plan`.
- Add product and team rollup plans at `/products/:productId/plan` and `/teams/:teamId/plan` that explain readiness contributors.
- Make Review Details metric cards link to the plan and show follow-up/not-assessed sub-labels.
- Derive plan items from review answers, checklist gaps, unanswered questions, and N/A exceptions.
- Keep the first impression dense and calm: one severity-grouped issue list, progressive disclosure for detail, and no competing view modes.
- Aggregate exact repeated items across reviews without fuzzy "similar question" grouping.

**Non-Goals:**

- No PDF export.
- No owner, due-date, remediation status, or workflow assignment system.
- No fuzzy deduplication of similar questions.
- No Looker dashboards in this change.
- No new organization-wide analytics surface.
- No change to assessment answer-saving behavior beyond the read model needed for the plan.

## Decisions

### 1. Use a derived attention-item read model

Create a pure TypeScript projection that accepts review metadata, selected template details, and answer state, then returns normalized plan items. Keep classification testable outside Vue.

```text
Review + templates + answers
          │
          ▼
buildImprovementPlan()
          │
          ├─ summary counts
          │  ├─ followUp
          │  ├─ checklistGaps
          │  ├─ notAssessed
          │  └─ documentedExceptions
          │
          └─ items[]
             ├─ source identity
             ├─ severity
             ├─ state
             ├─ question context
             ├─ missing checklist items
             └─ assessment deep link
```

Suggested types:

```typescript
type PlanItemState =
  | "follow-up"
  | "checklist-gap"
  | "not-assessed"
  | "documented-exception";

interface PlanItemIdentity {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  templateId: string;
  templateVersionId?: string;
  pillarSlug: string;
  questionId: string;
  checklistItemIds?: string[];
}
```

This should live near review projections/services rather than inside a Vue page so product rollups can reuse it.

### 2. Treat route path and UI name separately

Use short contextual URLs, but keep the product concept clear in the UI.

```text
URL:       /plan
UI title: Improvement Plan
```

Review-level routes:

```text
/teams/:teamId/reviews/:reviewId/plan
/products/:productId/reviews/:reviewId/plan
/applications/:appId/reviews/:reviewId/plan
```

Product-level route:

```text
/products/:productId/plan
```

Review Details becomes the primary entry point:

```text
Before

┌──────────────────────────────┐
│ Actions Needed               │
│ 7                            │
│ Questions remaining          │
└──────────────────────────────┘


After

┌──────────────────────────────┐
│ Items needing attention       │
│ 7                            │
│ 4 follow-up · 3 not assessed │
│                              │
│ View plan →                  │
└──────────────────────────────┘
        │
        ▼
   /reviews/:reviewId/plan
```

### 3. Default to a single severity-grouped issue list

The review plan should support manager scanning without asking users to choose a presentation mode. The final interaction is a single issue-list view grouped by severity. It uses layered section cards rather than a classic grid table, but keeps table-like density and source metadata.

```text
Review-level issue-list page

┌──────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Teams / Checkout Platform / Peak Season Review / Plan           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Improvement Plan                                      [Continue Assessment]   │
│ Follow-up and not-yet-assessed checks for this review.                       │
│                                                                              │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐ │
│ │ Total items   │ │ High priority │ │ Follow-up     │ │ Not assessed      │ │
│ │ 11            │ │ 9             │ │ 0             │ │ 11                │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────────┘ │
│                                                                              │
│ [Search...]  Filter [State ▾] [Severity ▾] [Pillar ▾] [Template ▾]           │
│                                                                              │
│ Items Needing Attention                                                       │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ● Critical                                                   3 items     │ │
│ │ Start here for the highest operational risk.                              │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ [Not assessed] [Why it matters]  REL-1 failover test       [Open question]│ │
│ │ Source: Peak Season · Reliability                                         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Design rules:

- Severity sections use neutral layered depth: section shell, elevated header, nested body, and row cards.
- Severity color is compact: dot + label only. Avoid full colored borders, gradient washes, or red/yellow section backgrounds.
- Filters use non-modal `UDropdownMenu` controls with a filter icon/label so opening menus does not lock body scroll or shift the page.
- `Open question` opens the exact assessment question in a new tab so the plan can remain as a working checklist.
- Question text uses the same inline Markdown treatment as Template Studio question rendering.
- **Row implementation**: use divider rows (`border-b border-gray-200 dark:border-gray-700` on each row, no body background) instead of `<article>` cards. `divide-default` tokens collapse in dark mode; explicit gray borders are necessary for visible row separators across both modes.
- **Progressive disclosure**: only the first severity section is expanded by default. Collapse the rest with a chevron toggle on the section header.

### 4. Progressive disclosure protects first-use clarity

The page should not show all learning text by default. The main table/card row shows what and why briefly; the existing information panel carries the deeper "why / leading practices / helpful links" layer.

```text
Depth model

┌───────────────────────────────────────────────────────────────────┐
│ 1. Collapsed row                                                  │
│    Severity · State · Question · Source                           │
└───────────────────────────────────────────────────────────────────┘
        │ inline context
        ▼
┌───────────────────────────────────────────────────────────────────┐
│ 2. Row metadata                                                   │
│    State, concise checklist gap summary, source, and exact link    │
└───────────────────────────────────────────────────────────────────┘
        │ Why it matters
        ▼
┌────────────────────────────────────┐ ┌───────────────────────────┐
│ 3. Same plan page                  │ │ MoreInfoPanel             │
│    Filters and scroll preserved    │ │ Why it matters            │
│                                    │ │ Leading practices         │
│                                    │ │ Helpful links             │
└────────────────────────────────────┘ └───────────────────────────┘
```

This keeps the page useful for both team members and leaders without becoming a long report.

Rows should remain concise:

```text
┌──────────┬──────────────┬─────────────────────────────┬────────────────┐
│ Critical │ Follow-up    │ REL-1 Failover test         │ Peak / Reliab. │
├──────────┴──────────────┴─────────────────────────────┴────────────────┤
│ Why it matters                                                   │
│ This was answered No. It may need a plan, exception, or follow-up       │
│ conversation.                                                           │
│                                                                         │
│ [Learn why] [Open in assessment]                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. Product plan contributors are mixed, not app-only

Product readiness is not only application readiness. Product-level reviews must appear as contributors because launch readiness may include roadmap, communications, branding, support, and go-to-market topics.

```text
Product readiness contributors
├─ Product-level reviews
│  ├─ Launch readiness
│  ├─ Roadmap readiness
│  └─ Communications / brand readiness
├─ Application contributors
│  ├─ Checkout API
│  └─ Admin Portal
└─ Team contributors
   ├─ Payments Team
   └─ Platform Team
```

Contributor aggregation should deduplicate by `reviewId` so a review discovered through multiple associations is counted once.

Product/team rollup plan layout:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Products / Checkout Experience / Plan                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Improvement Plan                                                              │
│ What is contributing to readiness for Checkout Experience.                    │
│                                                                              │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐ │
│ │ Contributors  │ │ Follow-up     │ │ Not assessed  │ │ Repeated items    │ │
│ │ 8             │ │ 14            │ │ 9             │ │ 3                 │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────────┘ │
│                                                                              │
│ Filter [Contributor type ▾]          │
│                                                                              │
│ ┌────────────────────────────┬───────────────┬───────────┬──────────────┐   │
│ │ Contributor                 │ Type          │ Follow-up │ Not assessed │   │
│ ├────────────────────────────┼───────────────┼───────────┼──────────────┤   │
│ │ Launch Readiness Review     │ Product review│ 5         │ 2            │   │
│ │ Checkout API                │ Application   │ 4         │ 1            │   │
│ │ Payments Team               │ Team          │ 3         │ 0            │   │
│ │ Brand Launch Checklist      │ Product review│ 2         │ 6            │   │
│ └────────────────────────────┴───────────────┴───────────┴──────────────┘   │
│                                                                              │
│ Repeated attention items                                                     │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ REL-1 Failover test appears in 3 contributing reviews                   │ │
│ │ Sources: Checkout API, Payments Team, Peak Season product review         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Contributor discovery:

```text
Product: Checkout Experience
        │
        ├─ Product-owned reviews
        │  ├─ Launch Readiness Review
        │  ├─ Roadmap Readiness Review
        │  └─ Brand Launch Checklist
        │
        ├─ Product applications
        │  ├─ Checkout API
        │  │  └─ App review(s)
        │  └─ Admin Portal
        │     └─ App review(s)
        │
        └─ Product teams
           ├─ Payments Team
           │  └─ Team review(s)
           └─ Platform Team
              └─ Team review(s)

All discovered reviews
        │
        ├─ de-duplicate by reviewId
        ▼
Contributor rows + exact repeated-item rollups
```

### 6. Exact rollups only

Repeated-item grouping should be conservative:

```text
Rollup key =
  templateId or templateVersionId
  + questionId
  + optional checklist item identity
```

Do not merge based on similar text. If two templates ask similar things, show them separately with full source context.

Exact repeated-item grouping:

```text
Input items across contributing reviews

┌────────────────────┬─────────────┬────────────┬───────────────────────────┐
│ Contributor         │ Template    │ Question   │ State                     │
├────────────────────┼─────────────┼────────────┼───────────────────────────┤
│ Checkout API        │ peak-v1     │ REL-1      │ Follow-up                 │
│ Payments Team       │ peak-v1     │ REL-1      │ Follow-up                 │
│ Launch Readiness    │ peak-v1     │ REL-1      │ Not assessed              │
│ Admin Portal        │ security-v1 │ SEC-2      │ Follow-up                 │
└────────────────────┴─────────────┴────────────┴───────────────────────────┘
          │
          │ group by templateVersionId + questionId
          ▼

Rollup output

┌──────────────────────────────────────────────────────────────────────────┐
│ REL-1 Failover test                                      Peak Season ORR │
│ Appears in 3 contributing reviews                                        │
│                                                                          │
│ Sources                                                                  │
│ ├─ Checkout API · Follow-up                                              │
│ ├─ Payments Team · Follow-up                                             │
│ └─ Launch Readiness Review · Not assessed                                │
│                                                                          │
│ [Source review] [Source review] [+N more]                            │
└──────────────────────────────────────────────────────────────────────────┘
```

Anti-grouping example:

```text
These remain separate even if the wording looks similar:

┌─────────────┬────────────┬──────────────────────────────────────────────┐
│ Template    │ Question   │ Text                                         │
├─────────────┼────────────┼──────────────────────────────────────────────┤
│ peak-v1     │ REL-1      │ Have you performed a full failover test...?  │
│ bespoke-v1  │ REL-1      │ Have you validated business continuity...?   │
└─────────────┴────────────┴──────────────────────────────────────────────┘

Reason: template identity differs. No fuzzy dedupe in this change.
```

Rollup drilldown should preserve source context:

```text
Repeated item
└─ Peak Season ORR / Reliability / REL-1
   ├─ Product review: Launch Readiness Review
   │  └─ /products/prod-123/reviews/rev-a/assessment#question-rel-1
   ├─ Application: Checkout API
   │  └─ /applications/app-456/reviews/rev-b/assessment#question-rel-1
   └─ Team: Payments Team
      └─ /teams/team-789/reviews/rev-c/plan
```

## Testing strategy

```text
Pure projection tests
├─ yes/no No -> follow-up
├─ unanswered -> not-assessed
├─ N/A -> documented exception
├─ partial checklist -> checklist-gap
└─ complete checklist -> resolved

Component/page tests
├─ review metric links to /plan
├─ severity-grouped issue list
├─ filters narrow state/severity/pillar/template without page shift
├─ inline context preserves progressive disclosure
└─ Learn why opens MoreInfoPanel

Product rollup tests
├─ product-level review contributor appears without applications
├─ application contributors aggregate linked reviews
├─ team contributors aggregate team reviews
└─ exact duplicate questions group, similar text does not

```

Run fast scoped tests during implementation, then `make mr` before MR.

## Security Considerations

1. This change should not require new write endpoints or sync event types. If implementation adds any read API for product plan aggregation, request parameters must be validated with Zod and authorization must be enforced server-side.
2. Product, team, and cross-review aggregation must only include reviews the current user can already view. Do not infer hidden review existence through counts.
3. Question text, importance, practices, and helpful links are rendered from template content. Preserve existing markdown/rendering safeguards and do not introduce unsanitized `v-html`.
4. No new `window.*` globals are planned.

Run `security-reviewer` after implementation because the change touches client-side storage and may touch read paths/authorization for product aggregation.

## Risks / Trade-offs

- Classification semantics may surprise users if the old metric counted only unanswered questions. Mitigate with sub-labels and explanatory copy.
- Product contributor aggregation can double-count reviews if source paths overlap. Deduplicate by review identity.
- Exact-only rollups avoid false grouping but may miss conceptually similar issues. This is intentional until taxonomy/canonical practice IDs exist.

## Migration Plan

1. Add projection tests and implement the plan read model without changing UI.
2. Add `riskLevel` propagation to question projections and models where missing.
3. Implement the review-level plan page and metric-card navigation.
4. Implement product and team contributor aggregation and rollup plan pages.
5. Run unit tests, integration tests, and `make mr`.

Rollback strategy: the UI pages are additive and can be hidden by route/link removal if needed.

## Open Questions

- Should documented N/A exceptions appear as a separate default summary card, or only behind a filter?
- Should product contributor rows represent each product-level review individually, or should later versions group them by readiness area?
- Should product plan filters include review status in MVP?

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Page shell | native `<main>` / `<section>` | `aria-label` per section | `ml-20 lg:mx-32 px-8 py-6` | Match Review Details/Product Details layout |
| Summary cards | custom card or `UCard` | none | `bg-elevated rounded-xl border border-default shadow-sm p-6` | Follow `DESIGN.md` stat-card pattern |
| Search | `UInput` | `size="md"`, leading search icon | `w-full` | Use `text-dimmed` leading icon |
| Filters | `UDropdownMenu` + `UButton` | state/severity/pillar/template options, `modal=false` | semantic NuxtUI defaults | Include filter icon/label; avoid body scroll lock |
| Issue list | custom section-card list | severity-grouped rows | layered `bg-elevated` / `bg-default` surfaces | Single default presentation |
| Rollup contributor links | `UButton` + `UDropdownMenu` | first 3 inline, rest in `+N more` | primary soft links, neutral overflow | Open exact assessment question in new tab |
| Severity indicator | dot + label | compact visual | error/warning/neutral semantic colors | No Low label; medium is advisory, not positive |
| State indicator | `UBadge` | `variant="subtle"` | primary/neutral semantic colors | Avoid wall of red |
| Question ID | custom chip | none | `bg-primary/10 text-primary font-mono text-xs rounded-md` | Follow Question ID badge pattern |
| Learning details | `MoreInfoPanel` / `USlideover` | existing state API | existing panel classes | Reuse progressive learning pattern |
| Empty state | custom section | icon + CTA | `bg-elevated rounded-xl border border-default` | Calm, non-judgemental copy |

### Spatial Composition

- Container widths: use existing review/product layout (`ml-20 flex flex-1`, `lg:mx-32`, inner `max-w-8xl mx-auto`).
- Gaps and spacing: page `px-8 py-6`, summary grid `gap-4`, section spacing `space-y-6`, cards `p-4` or `p-6`.
- Stretch behavior: filters wrap on smaller widths; table scrolls horizontally only when needed; cards stack vertically.
- Visual hierarchy:
  - page canvas `bg-muted`
  - summary and section-card header surfaces `bg-elevated`
  - section bodies use nested elevated/default surface contrast
  - severity is a small indicator, not a full red card treatment

### Visual Assertions

- "AND the default view is dense enough for manager scanning without requiring users to read long explanatory text."
- "AND the page uses `text-default`, `text-muted`, `text-dimmed`, `bg-muted`, and `bg-elevated` instead of raw slate/gray classes."
- "AND follow-up items do not render as a wall of red; severity is shown as compact risk context."
- "AND filter controls use a filter icon/label and non-modal dropdowns so they are discoverable without causing page shift."
- "AND row metadata and detail panels use progressive disclosure rather than showing all learning content at once."
- "AND the UI works in dark mode first and remains correct in light mode."
