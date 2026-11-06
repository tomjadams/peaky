## Prerequisites

> Issue: <https://gitlab.is.adyen.com/heitorl/orr/-/issues/20>
> MR: <https://gitlab.is.adyen.com/heitorl/orr/-/merge_requests/48>

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in a RFC style using `glab` CLI describing the problem and approach from `design.md`
- [x] 0.3 Create feature branch named `add-review-improvement-plan`
- [x] 0.4 Create MR using conventional commit + template `.gitlab/merge_request_templates/default.md`

## 1. Plan data contract, fixtures, and projections

> Can be done before UI work.
> Dependencies: proposal, specs, design.

- [x] 1.1 Inventory current review, template, question, checklist, answer, and N/A shapes used by review details and assessment hydration
- [x] 1.2 Define `PlanItem`, `PlanSummary`, `PlanItemIdentity`, contributor, and rollup TypeScript contracts before implementing UI
- [x] 1.3 Add fixture builders for team reviews, product reviews, application reviews, multi-template reviews, checklist answers, item-level N/A, and product contributors
- [x] 1.4 Add failing unit tests for attention-item classification: yes/no No, unanswered, N/A, partial checklist, fully accounted checklist, and empty review
- [x] 1.5 Add failing unit tests for summary counts: follow-up, checklist gaps, not assessed, documented exceptions, primary total, and critical/high totals
- [x] 1.6 Add failing unit tests for recommended sorting by severity and state without exposing a numeric score in UI contracts
- [x] 1.7 Add failing unit tests for exact rollup grouping: same template/question groups; similar text from different templates does not group
- [x] 1.8 Extend review/template question projection types to carry `riskLevel` where the plan needs severity
- [x] 1.9 Implement pure attention-item classification with no Vue dependencies
- [x] 1.10 Implement pure summary, filter, sorting, grouping, and exact-rollup helpers
- [x] 1.11 Implement assessment deep-link helpers for context routes and question/pillar anchors
- [x] 1.12 Run targeted unit tests for the projection/read-model
- [x] 1.13 Run `ts-reviewer` on new/modified TypeScript projection/model files
- [x] 1.14 Run `test-reviewer` on new/modified projection tests
- [x] 1.15 Address review findings

## 3. Review-level plan data plumbing and navigation

> User-facing flow; load `nuxt-ui` skill before implementation.
> Dependencies: plan projection.

- [x] 3.1 Load `nuxt-ui` skill before implementing NuxtUI components
- [x] 3.2 Add review plan routes for team, product, and application contexts ending in `/plan`
- [x] 3.3 Wire route names, breadcrumbs, page headers, and Continue Assessment destinations for all three contexts
- [x] 3.4 Add a shared composable/service to hydrate review data, question metadata, answer state, and plan projection for a single review
- [x] 3.5 Handle loading, remote/local fallback, local DB unavailable, missing review, missing template, and empty review states
- [x] 3.6 Update Review Details metric computation to use the new attention summary, not only unanswered count
- [x] 3.7 Update Review Details metric card to show Items Needing Attention with follow-up/not-assessed sub-labels and link to `/plan`
- [x] 3.8 Add command palette entries for "View Improvement Plan" where review commands exist
- [x] 3.9 Add unit/component tests for route helpers, metric-card labels, and metric-card navigation
- [x] 3.10 Run `ts-reviewer` on navigation/composable/read-path TypeScript files
- [x] 3.11 Run `vue-reviewer` on modified Review Details/route wrapper Vue files
- [x] 3.12 Run `ui-review` on metric card label, clickable state, and hover treatment
- [x] 3.13 Run `test-reviewer` on new/modified navigation and metric tests
- [x] 3.14 Run `security-reviewer` on route/read-path authorization assumptions
- [x] 3.15 Address review findings

## 4. Review-level plan UI and interactions

> User-facing flow; depends on review-level data plumbing.

- [x] 4.1 Implement plan page shell with title, calm subtitle, summary cards, and Continue Assessment CTA
- [x] 4.2 Implement filters for state, severity, pillar, template, and search text, including empty-result behavior
- [x] 4.3 Implement single severity-grouped issue list; do not add competing view modes
- [x] 4.4 Implement layered section cards with dense row content and non-judgemental item explanations
- [x] 4.5 Implement non-modal dropdown filters that avoid body scroll locking and page shift
- [x] 4.6 Reuse/extend MoreInfoPanel integration for "Learn why" actions while preserving filters and scroll position
- [x] 4.7 Implement "Open in assessment" deep links for pillar/question targets and graceful fallback when an anchor is missing
- [x] 4.8 Implement designed empty states for no active items, only unanswered items, only documented exceptions, and no results after filtering
- [x] 4.9 Add component/unit tests for filters, sorting, empty states, and MoreInfoPanel opening
- [x] 4.10 Add/update happy-path E2E coverage from Review Details metric card to plan to assessment question
- [x] 4.11 Add responsive coverage for filter wrapping and issue-list stacking
- [x] 4.12 Run `vue-reviewer` on new/modified Vue components
- [x] 4.13 Run `ui-review` on styled plan UI, progressive disclosure, semantic colors, dark-first design, and filters
- [x] 4.14 Run `test-reviewer` on new/modified UI and E2E tests
- [x] 4.15 Run `security-reviewer` on read-path and route behavior
- [x] 4.16 Run `ux-reviewer` on the completed review plan flow
- [x] 4.17 Address review findings

## 5. Product-level contributor plan and cross-review rollups

> User-facing flow; depends on projection and product/review aggregation rules.

- [x] 5.1 Add failing tests for product contributors: product-level reviews without applications, application contributors, team contributors, duplicate review de-duplication, and product with no contributors
- [x] 5.2 Map current product relationships to review discovery paths: product-owned reviews, product application-linked reviews, and product team-owned reviews
- [x] 5.3 Implement product contributor aggregation with explicit contributor types: Product review, Application, Team
- [x] 5.4 Implement review de-duplication by `reviewId` across overlapping discovery paths
- [x] 5.5 Implement exact repeated-item rollups for product contributors without fuzzy text matching
- [x] 5.6 Add performance guardrails for product aggregation so imported Peak Season ORR reviews across all teams remain usable
- [x] 5.7 Add `/products/:productId/plan` route with contributor summary cards, contributor table, repeated items section, and drilldowns to source review plans/assessment questions
- [x] 5.8 Add filters for contributor type, state, severity, top area, and search text
- [x] 5.9 Add loading, error, empty contributor, no repeated items, and filtered-empty states
- [x] 5.10 Add entry point from Product Details to the product plan
- [x] 5.10a Add team-level rollup plan route and Team Details entry point
- [x] 5.10b Collapse repeated-item source links after the first few contributors behind a "+N more" dropdown
- [x] 5.11 Add/update happy-path E2E coverage for product-level review contributor and application/team contributor drilldown
- [x] 5.12 Add E2E/fixture coverage proving a product-level launch/roadmap/communications review appears without selected applications
- [x] 5.13 Run `ts-reviewer` on aggregation/read-model TypeScript files
- [x] 5.14 Run `vue-reviewer` on product plan Vue components
- [x] 5.15 Run `ui-review` on product plan styling, contributor table, repeated-item section, and tone
- [x] 5.16 Run `test-reviewer` on product plan tests
- [x] 5.17 Run `security-reviewer` on product aggregation/read-path authorization assumptions
- [x] 5.18 Run `ux-reviewer` on the completed product plan flow
- [x] 5.19 Address review findings

## 6. Release documentation and roadmap communication

> Complete near the end of implementation, after the UI and scope are stable.

- [x] 6.1 Update `site/docs/changelog.md` with an Improvement Plans entry, user-facing screenshots, and bullets for review plans, product contributors, exact rollups, and progressive disclosure
- [x] 6.2 Update `site/docs/roadmap.md` to reflect Improvement Plans moving from roadmap intent to shipped/landing status and keep post-GA Analytics/Jira/Gemini items clearly separate
- [x] 6.3 Update `site/docs/development/decisions.md` with the decisions to use exact-only rollups and single issue-list plans
- [x] 6.4 Run `docs-reviewer` on changelog, roadmap, and decision-log updates
- [x] 6.5 Run `make lint-docs`
- [x] 6.6 Address documentation review and lint findings

## 7. Final validation and polish

- [x] 7.1 Verify empty states: no active items, only unanswered items, only documented N/A exceptions, no filter results, and product with no contributors
- [x] 7.2 Verify light and dark mode for review plan, product plan, metric card, issue rows, filters, badges, empty states, and detail panel
- [x] 7.3 Verify command palette entries and all plan navigation paths
- [x] 7.4 Verify responsive behavior for desktop, narrow laptop, and mobile-width layouts
- [x] 7.5 Verify local-first behavior after refresh and local DB recovery paths
- [x] 7.6 Verify imported Peak Season ORR fixture scale does not make product plan sluggish
- [x] 7.7 Run targeted unit/component/E2E tests added by this change
- [x] 7.8 Run `make mr`
- [x] 7.9 Address validation failures

## Housekeeping

- [x] Run `make mr` — all quality gates must pass before submitting MR
- [x] Update Gitlab issue with task completions

## Manual tasks

- [x] Manual review of areas ordered by ROI
  - [x] Review Details metric card language and click target
  - [x] Review-level plan table default and progressive disclosure
  - [x] Review-level issue-list view for teams that prefer context-first scanning
  - [x] Product plan contributor model, especially product-level launch/roadmap/communications reviews
  - [x] Product exact repeated-item rollups and anti-fuzzy grouping behavior
  - [x] Changelog and roadmap language after implementation
