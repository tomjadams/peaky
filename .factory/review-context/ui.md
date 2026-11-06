# UI review context

## Scope

Apply this context to user-visible work under `app/**`, including complete pages,
shared Vue components, overlays, and stateful workflows. `DESIGN.md` owns visual
tokens and component rules. `site/docs/development/visual-design.md` owns the
implementation patterns.

Peaky uses Nuxt 4, Vue 3, NuxtUI v4, Tailwind CSS v4, and vendored Public Sans.

## What approval means

A UI review is not only a design-system and accessibility audit. Those are
necessary checks, but they are not enough. A page can use the right tokens,
pass axe, and still be confusing, punitive, or organized around the data model
instead of the user's job.

Approve only when the rendered workflow:

- makes the page's purpose and next action obvious;
- gives different concepts different names and visual roles;
- keeps useful work ahead of history, metadata, and technical explanation;
- lets people recover from mistakes without losing evidence or context;
- tells the truth about local, shared, pending, unavailable, and completed state;
- works as one page, not as individually polished components competing for
  attention.

Review the product behavior before reviewing polish. Do not spend the review on
radius, color, or component-library details while the state model or information
hierarchy is wrong.

## Product-design invariants

### Start with the user's decision

- Every page has one dominant job. Its layout, first heading, default view, and
  primary action support that job.
- A first-time user should be able to answer within a few seconds: Where am I?
  What matters now? What can I do? What will happen if I do it?
- Use the page's existing negative space before adding another full-width card,
  summary band, or repeated section.
- Context stays close to the control or data it explains. Do not make people
  compare distant panels to understand one result.
- Progressive disclosure is for detail, not for the page's basic meaning or
  primary action.

### Name semantics, not shapes

- Every percentage, count, badge, status, and progress bar states what it
  measures. Similar-looking numbers must not hide different denominators.
- Do not collapse workflow state and evidence state into one word. Closing a
  Handoff records coordination. It does not prove that Assessment evidence is
  complete.
- Labels follow the source of truth. In Review Details, Progress means resolved
  checklist items, Answered means question coverage, and Maturity means the
  severity-weighted result.
- A selected, linked, handed-off, resolved, and completed item may occupy more
  than one state dimension. Do not force them into one mutually exclusive status
  when the domain does not.
- Static headings and labels must look static. Filter groups say "Filter by ..."
  rather than presenting a bare noun that resembles a selectable value.

### Recovery is part of the primary flow

- Before approving a close, clear, remove, replace, or bulk action, trace what
  becomes visible, hidden, eligible, and recoverable afterward.
- An action should not permanently penalize someone for a coordination mistake.
  Preserve history without using history as a permanent eligibility lock.
- Clearing an active selection returns eligible items to the available view.
  Closing with unresolved work returns that work to Follow-ups. Reopening the
  latest manual close restores the previous cycle when no newer cycle exists.
- Prefer one atomic bulk action over repeated row mutations when the UI presents
  one user intent.
- Disabled actions explain the missing prerequisite where the user tried to act.
  If a form remains useful for discovery, open it and disable only the unsafe
  confirmation.
- If an operation cannot be undone, the confirmation explains the exact scope
  and why no recovery path exists.

### History informs; it does not lead

- Default views prioritize work that can be acted on now.
- Completed or previously handed-off work is grouped, filtered, or collapsed so
  it does not bury available work.
- Historical state remains discoverable and may annotate an available item, but
  it does not automatically make that item unavailable.
- Immutable history and current ownership are separate concepts. Review both
  when a workflow closes, reopens, or starts a new cycle.

### Keep boundaries visible

- Results from different Template Revisions remain separate. Never invent a
  combined maturity score across different questions, weights, or thresholds.
- Assessment evidence is authoritative for whether a practice is met or not
  applicable. Handoff actions never fabricate or edit that evidence.
- Local-first actions state what is saved on this device and what requires a
  current shared sync view.
- Provider links are references to existing work. Peaky does not imply that it
  created, updated, read, or completed provider work.
- Technical calculation details belong in an explanation or authoring view.
  Assessment participants see enough to understand movement without incentives
  to optimize point arithmetic.

## Review sequence

### 1. Use the running page

Start from the route a user opens. Read the page without repository context.
Identify its dominant job, first meaningful content, primary action, and default
filter state. If these are unclear, report that before inspecting component
classes.

### 2. Trace the state transitions

Exercise the whole workflow. Select, reorder, clear, close, reopen, filter,
reload, and return from linked pages where applicable. For each action, record:

- what changed;
- what persisted;
- what became eligible;
- what moved to history;
- how the user gets back.

Test the uncomfortable path, not only the successful one. Examples include
closing with unresolved evidence, clearing every selected item, losing shared
sync before confirmation, and opening a page with only historical items.

### 3. Review information architecture

- Check whether the page repeats the same result in multiple components.
- Check whether a secondary explanation, preview, or history panel competes with
  the main work queue.
- Check whether filters expose only values present in the current data.
- Check whether the default view surfaces usable work before archived work.
- Check whether a side panel or stable region would work better than a popover
  whose content can grow or whose position depends on the trigger.
- Check whether moving compact context into unused horizontal space removes a
  row without harming reflow.

### 4. Review interaction details

- Pointer-only hover must not leave focus rings or overlays behind. Dismissal
  should feel immediate when the pointer leaves, while keyboard focus remains
  stable and intentional.
- Full-row selection controls expose one accessible name and one click target.
  Nested interactive controls do not compete with the row action.
- Reordering preserves visible order in copied or submitted output immediately.
- Controls remain reachable with long lists and short viewports. Keep primary
  actions fixed or visible while the list scrolls internally when appropriate.
- Loading, empty, unavailable, conflict, and degraded-sync states keep the same
  page hierarchy instead of replacing it with a different product.

### 5. Review visual design and accessibility

- Light mode is the default. Dark mode is a first-class alternative. Verify the
  same content, hierarchy, state, and controls in both.
- In light mode, the white canvas is the surface. Create hierarchy with type,
  whitespace, hairlines, and the survey tick. Do not stack grey or blue cards to
  manufacture depth.
- Use `#F4F5F7` only for inputs, search, and quiet wells. Tints carry meaning such
  as selection, warning, or completion.
- Standard controls use the documented 7 to 8px radius and explicit NuxtUI size
  and variant. Pills are for statuses, tags, and avatars.
- Text follows `text-highlighted`, `text-default`, `text-muted`, and
  `text-dimmed`. The minimum product text size is 13px.
- Actions remain visible. Do not hide a required action behind hover.
- Focus order, accessible names, target size, contrast, reflow, reduced motion,
  and screen-reader announcements are part of the product behavior.

## Browser evidence

Screenshots support a finding; they do not replace interaction. Verify at least:

- the accepted desktop width and a narrow reflow width;
- light and dark mode in the same state;
- zero, one, two, and many repeated items;
- no selection, partial selection, all selected, and Clear all;
- unresolved manual close, automatic resolved close, and reopen;
- default filters and every non-default filter that changes eligibility;
- initial render, settled local-database state, reload, and degraded sync where
  the feature depends on shared state;
- pointer exit and keyboard traversal for hover or focus overlays;
- browser console output for hydration and runtime errors.

Measure geometry or timing when the complaint is about density, clipping,
position, or delayed dismissal. Do not answer those findings from source code
alone.

## Finding quality

A useful finding names:

1. the user consequence;
2. the shortest reproducible flow;
3. the conflicting product rule or state transition;
4. evidence from the running page;
5. the smallest coherent direction for a fix.

Do not file isolated class-name preferences as product findings. Do not prescribe
component-level fixes that make the page hierarchy worse. If a proposed fix
changes domain semantics, eligibility, persistence, or a protected workflow,
stop and ask the maintainer to choose the product behavior first.

## Peaky checks worth repeating

- Multi-template Review pages keep results separate and label the selected
  Template Revision.
- Review Details does not confuse item progress, question coverage, and weighted
  maturity.
- Follow-ups leads with available gaps, groups historical work, and preserves
  exact Assessment links.
- Handoff movement uses exact values for threshold crossing. Rounded display
  values never fill the bar early.
- Closing a Handoff does not change Assessment answers. Unresolved practices
  return to Available and history remains intact.
- Existing-ticket forms ask for the URL, derive provider-owned fields, and
  explain when shared sync prevents confirmation.
- Template Studio teaches authors enough to configure scoring without exposing
  that machinery to assessment participants.

## References

- `DESIGN.md`
- `site/docs/development/visual-design.md`
- `site/docs/development/walkthroughs/codebase/ui.md`
- `site/docs/development/walkthroughs/local-first/failure-domains.md`
- `site/docs/user-guide/`
- `site/docs/assets/images/`
- `tests/e2e/`
- `app/assets/css/main.css`
- `nuxt.config.ts`
