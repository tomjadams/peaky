# Product Features — Walkthroughs

This series covers the main product features from a maintainer's perspective: data model, composable layer, key flows, and design decisions.

Each walkthrough is a linear trace through one feature — from the data layer up to the UI. The [codebase series](../codebase/) covers the shared infrastructure those features build on.

---

## Walkthroughs in this series

<div class="grid cards" markdown>

- **Products**

---

    User-created entities at the heart of Peaky. Covers the product model, lifecycle, review wizard, and assessment flow.

    [:octicons-arrow-right-24: Products](./products.md)

- **Teams**

---

    Read-only catalog-mirrored entities. Covers how teams flow from an external source into local SQLite and how reviews are attached.

    [:octicons-arrow-right-24: Teams](./teams.md)

- **Assessments**

---

    The act of answering review questions. Covers the orchestrator pattern, local-first answer saving, pillar notes, N/A handling, and the save/checkpoint flow.

    [:octicons-arrow-right-24: Assessments](./assessments.md)

- **Reviews**

---

    Review detail architecture, including metrics, session history, HLC-backed Recent Changes, and read-side grouping with inspectable intermediate trails.

    [:octicons-arrow-right-24: Reviews](./reviews.md)

- **Template Studio**

---

    The template authoring experience. Template identity is stable, content lives in Revisions, and current draft authoring is local-only. Publication and lifecycle controls are frozen until the server-authoritative follow-up.

    [:octicons-arrow-right-24: Template Studio](./template-studio.md)

- **Events**

---

    The unified activity feed at `/events`. Covers the member vs admin split, local events layer, live tail via SSE, and GDPR redaction.

    [:octicons-arrow-right-24: Events](./events.md)

- **System Health**

---

    The `/system` page — per-browser diagnostics. Covers the four status tiles, emergency banner, recreate flow, and the session-scoped recent activity table.

    [:octicons-arrow-right-24: System Health](./system-health.md)

- **Improvement Plan**

---

    A derived read model built from answer state. Covers the classification model, pure projection service, composable layer for review / product / team contexts, and deep links back to the assessment.

    [:octicons-arrow-right-24: Improvement Plan](./improvement-plan.md)

</div>

---

## Reading paths

=== "New to the features"

    1. [Products](./products.md) — start here; it establishes the shared patterns (review wizard, assessment flow, local-first mutations)
    2. [Teams](./teams.md) — shows how catalog-mirrored entities differ from user-created ones
    3. [Assessments](./assessments.md) — deep dive into the assessment orchestrator

=== "Working on the events surface"

    1. [Events](./events.md) — page, composables, SSE live tail
    2. [System Health](./system-health.md) — the third reading surface (peaky.system events only)
    3. [codebase/Events](../codebase/events.md) — the underlying event system, taxonomy, and GDPR rules

=== "Working on review history"

    1. [Reviews](./reviews.md) — Recent Changes, HLC-backed field history, and grouped presentation
    2. [Assessments](./assessments.md) — answer writes and checkpoint flow
    3. [local-first/HLC](../local-first/hlc.md) — conflict ordering and protection layers

=== "Working on the improvement plan"

    1. [Improvement Plan](./improvement-plan.md) — projection service, composables, routes
    2. [Assessments](./assessments.md) — the assessment flow that feeds plan items

=== "Working on templates"

    1. [Template Studio](./template-studio.md) — full authoring flow
    2. [codebase/Domain](../codebase/domain.md) — template entity in the domain model

---

## Shared patterns across all features

These patterns appear in every feature walkthrough. Understanding them once means you can read any walkthrough faster.

| Pattern | Where to learn it | Short form |
|---------|-------------------|------------|
| Local-first mutation | [Products §2](./products.md#2-the-data-layer) | Enabled transports use `commit(state + event + outbox)`; frozen Template drafts use `localOnly(state)` |
| Remote + local merge | [Teams §3](./teams.md#3-composable-layer) | Remote wins on list; local wins on detail (local-first Pattern A/B) |
| Orchestrator composable | [Assessments §3](./assessments.md#3-orchestrator-pattern) | One public composable composes 4–5 focused sub-composables |
| Read-side history grouping | [Reviews §7](./reviews.md#7-read-path-grouping-without-losing-trail) | Store every accepted field change; group only adjacent rows for presentation |
| Singleton state machine | [Template Studio §4](./template-studio.md#4-composable-layer) | Module-level `ref` shared across component tree, auto-saves on dirty |
| Pure projection service | [Improvement Plan §2](./improvement-plan.md#2-projection-service) | All business logic in pure functions; composables are thin wrappers that supply data |
| 403 role fallback | [Events §2](./events.md#2-one-page-two-audiences) | Single page; if admin API returns 403, silently falls back to local data |
| peaky.system events | [System Health §3](./system-health.md#3-how-tiles-derive-state) | `source="peaky.system"` events; local-only, never synced |
