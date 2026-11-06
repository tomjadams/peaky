<!-- PEAKY TASK GUIDELINES -->

<!-- For UI:
  - Reference Component Map from design.md for exact NuxtUI props
  - Load `nuxt-ui` skill for any task implementing NuxtUI components
  - Load `vue-flow` skill for any task implementing or improving a canvas functionality
-->

<!-- Merge check is temporarily disabled until a new version is introduced and explicitly re-enabled.

  Do not add `/merge-check` execution or attestation tasks to generated task plans while it is disabled.
  Keep ordinary requirement/acceptance traceability so a future replacement can reuse the same audit
  anchors without retrofitting task IDs.
-->

<!-- For all tasks:
  - Ensure we follow red/green/refactor approach where tests guide implementation
  - Cite each requirement/acceptance ID as `<capability>:<ID>`, e.g.
    `(products:REQ-add-product-search-001, products:AC-add-product-search-001)`.
    This preserves spec → task → implementation/review/formal-model traceability, so an unreferenced
    AC remains a visible coverage gap rather than a silent one.
-->

<!-- MUST have task group -->
## Prerequisites

<!-- Gitlab issue URL once created -->
> Issue:
<!-- Gitlab MR URL once created -->
> MR:

- [ ] 0.1 Load `glab` skill before tackling any task with GitLab
- [ ] 0.2 Create GitLab issue in a RFC style using `glab` CLI describing the problem and how we intend to approach this from `design.md`
- [ ] 0.3 Create feature branch named after the proposed change
- [ ] 0.4 Create MR using conventional commit + template .gitlab/merge_request_templates/default.md

<!-- Example format for task groups. -->
## 1. <!-- Task Group Name -->

> optional: Whether it can be done in parallel (isolation)
> dependencies: brief note on task group names

- [ ] 1.1 <!-- Task description -->
- [ ] 1.2 <!-- Task description -->

## 2. <!-- Task Group Name -->

- [ ] 2.1 <!-- Task description -->
- [ ] 2.2 <!-- Task description -->

<!-- `/merge-check` is temporarily disabled. Do not generate a Merge Check task group until its replacement is introduced and this template is explicitly updated. -->

<!-- MUST have task group at the bottom -->
## Housekeeping

- [ ] Run `make mr` — all quality gates must pass before submitting MR
- [ ] Update decision log site/docs/development/decisions.md
- [ ] Update Gitlab issue with task completions

## Manual tasks

- [ ] Manual review of areas ordered by ROI
  - [ ] X, Y Z
