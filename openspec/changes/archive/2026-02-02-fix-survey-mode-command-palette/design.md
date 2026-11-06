## Context

The assessment page (`assessment.vue`) registers command palette commands for toggling Survey Mode. However, these commands use an outdated approach:

**Current (broken) implementation:**
```typescript
// Enter survey mode
router.push({ path: route.path, query: { ...route.query, mode: "survey" } })

// Exit survey mode  
router.push({ path: route.path, query: restQuery }) // removes mode param
```

**Working implementation (in AppHeader.vue):**
```typescript
// Navigate to survey page
const surveyPath = route.path.replace(/\/assessment$/, "/survey");
router.push(surveyPath);

// Navigate to assessment page
const assessmentPath = route.path.replace(/\/survey$/, "/assessment");
router.push(assessmentPath);
```

The survey mode was moved to a separate page (`survey.vue`) but the command palette commands were never updated to match.

## Goals / Non-Goals

**Goals:**
- Fix command palette "Enter survey mode" command to navigate to `/survey` page
- Fix command palette "Exit survey mode" command to navigate to `/assessment` page
- Add E2E test coverage for command palette survey mode toggle

**Non-Goals:**
- No changes to the survey page or AppHeader behavior
- No changes to how survey mode works (just fixing the navigation)
- No spec changes (this is an implementation fix)

## Decisions

1. **Reuse the same navigation logic as AppHeader**
   - Rationale: Keeps behavior consistent between button click and command palette
   - Alternative: Could use a shared composable, but that's overkill for this bugfix

2. **Update commands in assessment.vue only**
   - Rationale: The survey page doesn't register command palette commands for survey mode toggle (it relies on the header button)
   - The survey page has `showSurveyMode: true` in header, which shows the toggle button

3. **Add E2E test in command-palette-in-page.spec.ts**
   - Rationale: There's already a test file for in-page command palette functionality
   - Alternative: Could add to survey-mode.spec.ts, but command palette tests belong together

## Risks / Trade-offs

- **[Risk] Command palette commands may not update when route changes** → Already handled by existing `watch` and re-registration logic in assessment.vue
- **[Risk] Hardcoded path replacement may break if URL structure changes** → This matches the existing AppHeader implementation, so risk is already present and accepted

## Implementation Notes

The fix is in `assessment.vue` lines ~280-310. Replace the query-param-based commands with page navigation:

```typescript
// BEFORE (broken):
run: () => {
  const router = useRouter();
  router.push({
    path: route.path,
    query: { ...route.query, mode: "survey" },
  });
}

// AFTER (fixed):
run: () => {
  const router = useRouter();
  const surveyPath = route.path.replace(/\/assessment$/, "/survey");
  router.push(surveyPath);
}
```

Similarly for exit survey mode command.
