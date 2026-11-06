## Why

The Review Details page currently surfaces an "Actions Needed" metric, but the experience stops at the number. Team members must return to the assessment, manually hunt for questions answered "No", distinguish those from unanswered checks, inspect checklist gaps, and reopen question information one item at a time to understand what to do next.

This creates the same failure mode we want to avoid from AWS Well-Architected Tool reports: the plan can feel like judgement, gives limited context, and does not help managers or product leaders understand where to focus. Peaky needs a learning-oriented, operational-health view that turns assessment state into a calm, filterable plan.

This is needed before GA because imported Peak Season ORR reviews will create many team and product reviews at once. Product managers and engineering leaders will need to see which reviews, teams, applications, or product-level readiness areas are contributing to overall readiness without relying on PDFs or manual comparison.

## What Changes

- Add contextual `/plan` pages for review-level and product-level improvement planning.
- Make the Review Details metric card clickable and change its language from a flat "Actions Needed" count into a more accurate "Items needing attention" breakdown.
- Derive plan items from answered "No" questions, checklist gaps, unanswered questions, and documented N/A exceptions.
- Provide a single dense, severity-grouped issue list with explicit filter controls and layered section-card depth.
- Use progressive disclosure: rows stay dense by default and open question learning details only when requested.
- Add exact cross-review rollups for product and team readiness views without fuzzy deduplication.
- Treat product readiness contributors as product-level reviews, application-linked reviews, and team-linked reviews.

## Capabilities

### New Capabilities

- `improvement-plans`: Review-, product-, and team-scoped plan pages that derive non-judgemental attention items from assessment state, support filtering/sorting, expose question learning context, and aggregate exact cross-review contributors.

### Modified Capabilities

- `reviews`: Review metric cards link to the contextual plan and actions-needed semantics distinguish follow-up, checklist gaps, not assessed, and documented exceptions.
- `products`: Product readiness views include product-level reviews as first-class contributors alongside applications and teams.
- `templates`: Template question severity supports `critical`, `high`, and `medium` only — `low` was removed in a prerequisite change (MR !50).

## Impact

- Review detail routes/components for teams, products, and applications.
- New plan routes under existing review/product contexts, using `/plan` for URL brevity and "Improvement Plan" as the UI title.
- Derived read-model/composables for attention-item classification across review templates, pillars, yes/no answers, checklist answers, and N/A reasons.
- Product plan aggregation across product-owned reviews, reviews linked to product applications, and reviews owned by product teams.

- Non-modal filter dropdowns that avoid body scroll locking and preserve page position.
- Tests for classification, route behavior, filtering/sorting, product contributor aggregation, and severity migration.
