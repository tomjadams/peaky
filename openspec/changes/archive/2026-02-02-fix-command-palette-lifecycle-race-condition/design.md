## Context

The command palette composable (`useCommandPalette.ts`) supports three command scopes: `global`, `route`, and `lifecycle`. Lifecycle-scoped commands are registered by page components in `onMounted` and should be cleaned up when navigating away.

The original implementation used a route watcher that immediately cleared ALL lifecycle commands when the route changed. This created a race condition during SPA navigation where:
1. Route changes
2. Watcher fires and clears all lifecycle commands
3. New page's `onMounted` registers its commands
4. Commands appear briefly then get cleared by delayed cleanup attempts

## Goals / Non-Goals

**Goals:**
- Fix the race condition so lifecycle commands from the new page persist after navigation
- Maintain automatic cleanup of commands from pages we navigate away from
- Deterministic behavior without timing hacks (no setTimeout delays)
- Backward compatible - existing page components don't need changes

**Non-Goals:**
- Changing the command registration API
- Adding new command scopes
- Modifying how global or route-scoped commands work

## Decisions

### Decision 1: Track registration route on lifecycle commands

**Choice:** Add `registeredAtRoute` field to `RegisteredCommand` and `RegisteredSource` interfaces, populated at registration time for lifecycle-scoped items.

**Rationale:** This gives us the information needed to distinguish "commands from the old page" from "commands from the new page" without relying on component lifecycle timing.

**Alternatives considered:**
- *setTimeout delay*: Unreliable, race condition still possible with slow mounts
- *Remove automatic cleanup entirely*: Would leak commands if components forget `onUnmounted`
- *Use component instance tracking*: More complex, requires Vue internals

### Decision 2: Filter by route match during cleanup

**Choice:** When route changes from A to B, keep lifecycle commands where `registeredAtRoute === B` (new route), remove others.

**Rationale:** Commands registered on route B were registered by the new page's `onMounted` which fires before or during the route watcher. Commands from route A should be cleaned up.

## Risks / Trade-offs

**[Risk] Commands registered during navigation transition may have ambiguous route**
→ Mitigation: `route.path` is read at registration time, which happens inside `onMounted` after the route has updated. The new route is always available.

**[Trade-off] Slightly increased memory per command (one extra string field)**
→ Acceptable: Field is only set for lifecycle scope, and lifecycle commands are short-lived by design.

**[Risk] Components that don't call `onUnmounted` cleanup may accumulate stale commands**
→ Mitigation: The route-based cleanup handles this automatically. This is actually an improvement over the original design which relied on component cleanup being called.
