## Context

The codebase has accumulated several patterns for programmatic navigation that are not idiomatic for Nuxt 4:

1. **Brittle string manipulation in `AppHeader.vue`**: Uses `route.path.replace(/\survey$/, "/assessment")` to toggle between survey and assessment views. This regex-based approach breaks if the URL structure changes (e.g., adding query params or changing the path pattern).

2. **`router.push()` in multiple pages**: Several page components use `const router = useRouter()` followed by `router.push(path)`. While functional, this is less idiomatic than `navigateTo()` which handles SSR correctly and is the recommended Nuxt 4 pattern.

3. **`router.push()` in `useCommandPalette.ts`**: The composable uses `router.push(command.to)` for command navigation.

The pattern has already been established in the survey mode command palette fix (MR for `assessment.vue` and `survey.vue`), which now use explicit `navigateTo()` calls with param-based paths like:
```typescript
navigateTo(`/applications/${appId}/reviews/${reviewId}/survey`)
```

## Goals / Non-Goals

**Goals:**
- Replace all `router.push()` calls with `navigateTo()` for consistency
- Replace all regex-based path manipulation with explicit param-based path construction
- Ensure all navigation continues to work identically from a user perspective
- Resolve tech debt item TD-009 from decisions.md

**Non-Goals:**
- No changes to URL structure or routing configuration
- No new navigation features
- No changes to the command palette API or command structure
- No changes to page behavior or UI

## Decisions

### Decision 1: Use `navigateTo()` over `router.push()`

**Rationale:** `navigateTo()` is the Nuxt 4 idiomatic way to handle programmatic navigation. It:
- Works correctly in both client and server contexts (SSR)
- Has better TypeScript support
- Is the recommended pattern in official Nuxt documentation

**Alternative considered:** Keep `router.push()` - rejected because it creates inconsistency with the patterns already established in assessment.vue and survey.vue.

### Decision 2: Use explicit param-based paths over string manipulation (Interim Solution)

**Rationale:** The current `route.path.replace()` pattern is fragile:
```typescript
// Brittle - breaks if URL pattern changes
const assessmentPath = route.path.replace(/\/survey$/, "/assessment")
```

Should become:
```typescript
// Explicit and refactor-safe (interim until named routes are added)
const appId = route.params.appId
const reviewId = route.params.reviewId
navigateTo(`/applications/${appId}/reviews/${reviewId}/assessment`)
```

This approach:
- Is type-safe (params are explicit)
- Survives URL structure refactoring
- Is easier to grep and update
- Matches the pattern already documented in `site/docs/maintainers/development/frontend.md`

**Note:** Named routes via `definePageMeta({ name: '...' })` are the **preferred** long-term solution. When names are added to pages, navigation should use:
```typescript
// Best practice - requires adding name to definePageMeta first
navigateTo({ name: 'review-survey', params: { appId, reviewId } })
```

### Decision 3: Minimal changes to `useCommandPalette.ts`

The composable currently uses `router.push(command.to)`. The minimal change is to replace this with `navigateTo(command.to)`. The `to` property in commands can remain as string paths since commands are registered with explicit paths already.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Regression in navigation behavior | Comprehensive E2E tests exist for command palette and survey mode navigation. All tests must pass before merge. |
| Type errors from `navigateTo()` | `navigateTo()` accepts the same arguments as `router.push()` - string paths work identically. |
| SSR compatibility issues | `navigateTo()` is specifically designed for SSR and is safer than `router.push()` in server contexts. |

## Migration Plan

**Phase 1: Core composable change**
1. Update `useCommandPalette.ts` - replace `router.push(command.to)` with `navigateTo(command.to)`

**Phase 2: Component updates (in dependency order)**
1. Update `AppHeader.vue` - most critical as it uses brittle regex pattern
2. Update `templates/index.vue` - straightforward row click handlers
3. Update `applications/[id].vue` - review navigation
4. Update `applications/[id]/reviews/new.vue` - cancel/next handlers  
5. Update `applications/[appId]/reviews/[reviewId]/index.vue` - assessment navigation

**Phase 3: Verification**
1. Run unit tests: `pnpm test`
2. Run E2E tests: `pnpm test:e2e`
3. Manual verification of all navigation paths

**Rollback:**
- All changes are localized to specific files
- Git revert is straightforward if issues are found
- No database or API changes involved

## Future Work

### Named Routes (Recommended Next Step)

While this MR moves the codebase from brittle regex patterns to explicit param-based paths, the **ideal** solution is to use named routes:

1. Add `name` property to `definePageMeta()` on commonly navigated pages:
   - `review-survey`, `review-assessment`, `review-details`
   - `application-details`, `application-reviews-new`
   - `template-edit`, `template-list`

2. Update navigation to use object syntax:
   ```typescript
   navigateTo({ name: 'review-survey', params: { appId, reviewId } })
   ```

3. Benefits over string paths:
   - URL structure changes don't affect navigation code
   - Centralized route naming in page meta
   - IDE support for route name autocomplete
   - Type safety via route name validation

This future work is documented as the recommended pattern in `site/docs/maintainers/development/frontend.md`.
