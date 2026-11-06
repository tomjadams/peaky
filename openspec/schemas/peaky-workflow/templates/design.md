## Context

<!-- Background and current state -->

## Goals / Non-Goals

**Goals:**
<!-- What this design aims to achieve -->

**Non-Goals:**
<!-- What is explicitly out of scope -->

## Decisions

<!-- Key design decisions and rationale -->

<!-- Use ASCII diagrams to reduce cognitive load to understand before/after -->

## Testing strategy

<!-- Use ASCII diagrams to explain how this change will approach testing these decisions -->

## Security Considerations

<!-- If this change touches API endpoints, sync push, authorization, or stores data in the browser, answer these questions. Delete this section if none apply.

Reference: site/docs/development/walkthroughs/local-first/security.md

1. Does this add a new API endpoint or sync event type? If so, is the request body validated with Zod?
2. Does this store new data in the browser (OPFS, localStorage)? What happens if an attacker reads or modifies it?
3. Does this change who can access or modify data? Is the check on the server, not just the UI?
4. Does this render user-supplied content? Is it sanitized before reaching the DOM?
5. Are there new window.* globals? Are they guarded by import.meta.dev?
-->

## Risks / Trade-offs

<!-- Known risks and trade-offs -->

## Migration Plan

<!-- Steps to deploy, rollback strategy -->

## Open Questions

<!-- Outstanding decisions or unknowns -->

---

<!-- PEAKY UI CHANGES: If this design involves UI changes, include these additional sections -->

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
|         |                  |           |                  |       |

<!-- Reference site/docs/development/visual-design.md for exact styling -->

### Spatial Composition

- Container widths:
- Gaps and spacing:
- Stretch behavior:
- Visual hierarchy:

### Visual Assertions

- "AND the ..."
- "AND the ..."

---

<!--
PROMPT GUIDANCE FOR AI:

Reference specs/ for requirements.

For UI changes:
- Include Component Map + Spatial Composition + Visual Assertions sections
- Reference site/docs/development/visual-design.md for exact styling

Use ASCII diagrams to reduce cognitive load when explaining before/after states.
-->
