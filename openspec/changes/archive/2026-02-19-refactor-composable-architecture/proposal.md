## Why

The current frontend architecture has business logic scattered across pages (`assessment.vue`, `survey.vue`) rather than organized by domain. Composables are thin `useFetch` wrappers with no real behavior, while models are pure TypeScript interfaces. This creates several problems:

1. **Discovery**: Finding where logic lives requires searching multiple pages
2. **Duplication**: Same answer state machine duplicated in assessment.vue and survey.vue
3. **Testing**: Business logic embedded in pages is hard to test in isolation
4. **Scalability**: Future concerns (tracing, retry, sync, caching) have no natural home
5. **Domain alignment**: OpenSpec domains and backend ports/adapters won't map to frontend structure

The Vuex 2/GraphQL mental model (actions → mutations → getters → state) provided clear organization that's missing in the current Nuxt composables approach.

## What Changes

Restructure composables into domain-organized folders with fat composables that own business logic, not just data fetching. This is a refactor, not a behavior change.

### Composable Organization
- **Domain folders**: `app/assessment/`, `app/templates/`, `app/applications/`
- **Decomposed modules per domain**: Fetch, Mutate, State, Navigation, Computed
- **Cross-cutting utilities**: Move to `app/ui/`

### Naming Convention
- `use{Domain}Fetch` → GET operations (caching, revalidation)
- `use{Domain}Mutate` → POST/PUT/DELETE operations (optimistic updates, retry)
- `use{Domain}[Concept]` → Domain state + transitions (e.g., `useAssessmentAnswers`)
- `use{Domain}Navigation` → Current position, next/prev
- `use{Domain}[Calc]` → Pure computation (e.g., `useAssessmentProgress`)

### Documentation Updates
- `site/docs/development/frontend.md` → Composable architecture guide
- `site/docs/development/architecture.md` → Updated folder structure
- `site/docs/development/decisions.md` → Architecture decision entry

### Migration
- Survey mode becomes a view mode of assessment data, not separate logic
- Pages become thin orchestration layers
- Existing composables refactored into domain modules

## Capabilities

### New Capabilities
(None - this is a refactor, not new functionality)

### Modified Capabilities
- `assessment`: Survey and assessment views will share the same composable; no behavior changes, only implementation structure
- `template-studio`: Template composables will be reorganized into domain folder

## Impact

### Files Changed
- `app/composables/` → Reorganized into `app/assessment/`, `app/templates/`, `app/applications/`, `app/ui/`
- `app/pages/applications/[appId]/reviews/[reviewId]/assessment.vue` → Simplified
- `app/pages/applications/[appId]/reviews/[reviewId]/survey.vue` → Simplified

### Documentation Changed
- `site/docs/development/frontend.md` → Major rewrite for composable architecture
- `site/docs/development/architecture.md` → Updated folder structure diagram
- `site/docs/development/index.md` → Updated repository structure

### Tests Changed
- New test structure mirroring domain folders
- Isolated unit tests for pure computation modules
- Integration tests for orchestrators

### Dependencies
(None - internal refactor only)
