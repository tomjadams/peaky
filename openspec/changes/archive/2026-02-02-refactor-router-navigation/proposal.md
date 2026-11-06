## Why

The codebase currently uses `useRouter().push()` with brittle string path manipulation for programmatic navigation. This pattern breaks silently when URL structures change and is not idiomatic for Nuxt 4. We need to migrate all navigation to use `navigateTo()` with explicit parameter-based paths for better maintainability, type safety, and SSR compatibility.

## What Changes

- Replace all `useRouter()` + `router.push()` patterns with `navigateTo()` calls
- Replace brittle `route.path.replace()` string manipulation with explicit path construction using `route.params`
- Update `AppHeader.vue` survey mode toggle to use explicit param-based paths instead of regex replacement
- Update `useCommandPalette.ts` to use `navigateTo()` instead of `router.push()` for command navigation
- Update page components to use `navigateTo()` for all programmatic navigation:
  - `applications/[id].vue` - review navigation
  - `applications/[id]/reviews/new.vue` - cancel/next navigation
  - `applications/[appId]/reviews/[reviewId]/index.vue` - assessment navigation
  - `templates/index.vue` - template edit navigation

## Capabilities

### New Capabilities
<!-- None - this is a pure refactoring change with no new capabilities -->

### Modified Capabilities
<!-- None - this is an implementation detail change, not a behavior change -->

## Impact

**Affected Code:**
- `app/components/AppHeader.vue` - survey mode toggle navigation
- `app/composables/useCommandPalette.ts` - command execution navigation
- `app/pages/applications/[id].vue` - start review and review click handlers
- `app/pages/applications/[id]/reviews/new.vue` - cancel and next handlers
- `app/pages/applications/[appId]/reviews/[reviewId]/index.vue` - assessment and pillar navigation
- `app/pages/templates/index.vue` - row click and action handlers

**Dependencies:**
- No new dependencies
- Relies on Nuxt 4's built-in `navigateTo()` utility

**Testing:**
- All existing navigation flows must continue to work
- E2E tests for command palette navigation
- E2E tests for survey mode toggle
- Unit tests for composable changes

**Documentation:**
- Resolves TD-009 from decisions.md (Brittle string-based router navigation)
- Pattern already documented in `site/docs/maintainers/development/frontend.md`
