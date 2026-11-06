## Why

When navigating between pages via the command palette, lifecycle-scoped commands from the new page were not appearing. The root cause was a race condition: the route watcher in `useCommandPalette` immediately cleared ALL lifecycle commands on route change, before the new page's `onMounted` hook could register its commands. This made the command palette unusable for multi-step navigation flows.

## What Changes

- Track which route each lifecycle command was registered on (`registeredAtRoute` field)
- When route changes, only clear lifecycle commands that were NOT registered on the new route
- Commands from the new page are preserved; commands from the old page are cleaned up
- No timing hacks (setTimeout) - deterministic behavior based on route matching

## Capabilities

### New Capabilities

None - this is a bug fix to existing behavior.

### Modified Capabilities

- `command-palette`: Clarify lifecycle command cleanup behavior during client-side navigation. The existing spec scenario "Command palette extensibility" states commands should be removed "when the view/component is unmounted or no longer active" but doesn't specify the mechanism for route-based cleanup, which led to the race condition.

## Impact

- **Code**: `app/composables/useCommandPalette.ts` - added `registeredAtRoute` tracking to `RegisteredCommand` and `RegisteredSource` interfaces, modified route watcher logic
- **Behavior**: Lifecycle commands now persist correctly during SPA navigation
- **Testing**: All 263 unit tests pass; command palette tests specifically verify lifecycle scope behavior
- **Breaking**: None - this is a bug fix that makes the existing API work as expected
