# UX Review Context

## Scope

Apply this context to user-visible changes under `app/**`. UX verification uses
the running Peaky application and feature-specific scenarios from
`.factory/skills/ux-review/SKILL.md`.

The supported automated review baseline is Chromium at a 1920×1080 desktop
viewport. Mobile and cross-browser coverage are not currently part of this
workflow.

## Project invariants

- Dark mode is Peaky's default and light mode is user-selectable. A flow is not
  verified until the same critical content and controls work in both.
- Local-first actions save to browser SQLite immediately and sync in the
  background. UX must represent local, pending, synced, conflict, and
  access-revoked outcomes honestly.
- Content remains stable across Vue hydration and delayed local-database/sync
  initialization. Elements must not disappear or change meaning after the first
  render.
- Reordering or adding content must not change how existing Markdown, labels,
  colors, or states render.
- Repeated structures are verified with zero, one, two, and at least three
  items. The first item must not receive unique spacing that breaks later rows.
- Affordances tell the truth: clickable-looking controls act, static metadata
  does not masquerade as a button, and destructive local-data recovery explains
  its bounded impact and unsynced work.

## Project conventions

- Verify complete user flows by clicking, dragging, typing, submitting, and
  recovering from validation or sync errors rather than inspecting screenshots
  alone.
- In both modes, inspect page/canvas backgrounds, text, borders, status badges,
  focus rings, zoom/action controls, and disabled/loading states.
- Check contrast on the rendered foreground/background pair. Warning and error
  badges need mode-appropriate backgrounds and text, not one mid-tone color in
  both modes.
- Capture a baseline before drag/add operations and compare both visible text
  and formatting afterward.
- Capture the initial render, then the same state after approximately 3 seconds
  and 8 seconds; inspect browser console output for hydration mismatches.
- Empty states explain what to do next. Advanced flows retain labels, tooltips,
  shortcuts, and feedback sufficient for first-time discovery.
- All browser evidence goes under `.ux-artifacts/` using scenario-oriented names
  such as `light-mode.png`, `dark-mode.png`, `align-third.png`, and
  `hydration-8s.png`. This directory is generated at review time and may not
  exist in a clean checkout.

## Deterministic coverage

- **Mode:** explicit light and dark captures of the same state.
- **Scale and alignment:** empty, first, second, and third item states.
- **Hydration:** initial, 3-second, and 8-second captures plus console check.
- **Visual consistency:** baseline versus after drag, add, reorder, or mode
  switch, as applicable.
- **Interactions:** primary flow, keyboard or pointer affordances, validation,
  loading, errors, and retry/recovery.
- **Local-first state:** immediate local persistence, pending/synced feedback,
  offline behavior where supported, and conflict/access-revoked handling when
  the feature mutates synced entities.
- **Feature scenarios:** use the scenario library for Template Studio rules
  canvas, assessment controls, lists/tables, and other supported feature shapes;
  omit an operation only when the feature genuinely has no such interaction.

## Temporary maturity-review boundary

Until the maintainer explicitly declares the Review Details and Follow-ups work complete:

- Do not invoke, delegate to, quote, or use findings from `rtf-ui-reviewer` for this work.
- Treat `rtf-ux-reviewer` as a read-only diagnostic. It may identify demonstrated user problems, but it must not prescribe or automatically trigger a design change.
- Do not change Recent Changes behavior, information architecture, controls, or layout as part of maturity work.
- Test as a tired first-time reviewer before returning `APPROVE`. Without repository knowledge, answer from the rendered page:
  1. What is this maturity result?
  2. Is it final? Why or why not?
  3. What evidence moved it?
  4. What should I do next?
  5. Can I prepare, order, copy, or link a handoff without losing context?
- Record where the answer came from and how many controls or disclosures it required. If any answer requires decoding implementation terms, comparing contradictory numbers, or inferring hidden rules, report the comprehension failure.
- Preserve explicit maintainer feedback and protected areas as hard constraints. A reviewer finding cannot override them.
- Require maintainer approval of the coherent page-level direction before proposing fixes to individual findings.

## References

- `.factory/skills/ux-review/SKILL.md`
- `site/docs/development/visual-design.md`
- `site/docs/development/walkthroughs/local-first/failure-domains.md`
- `site/docs/user-guide/`
- `tests/e2e/`
- `.ux-artifacts/` (generated review output; forward-created as needed)
