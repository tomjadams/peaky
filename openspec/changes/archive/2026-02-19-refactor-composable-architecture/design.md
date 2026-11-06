## Context

The current frontend has composables as thin `useFetch` wrappers with business logic scattered across page components. This design establishes a domain-organized architecture with fat composables that own business logic, following the Vuex 2/GraphQL mental model of actions (Fetch/Mutate), mutations (State), and getters (Computed).

## Goals / Non-Goals

**Goals:**
- Organize composables by domain (match OpenSpec structure)
- Centralize business logic in composables, not pages
- Enable isolated testing of state machines and pure computation
- Provide clear naming convention for discoverability
- Document architecture for humans and LLM agents

**Non-Goals:**
- Changing any user-facing behavior
- Adding Pinia or state management library
- Backend API changes
- Creating new bounded contexts

## Decisions

### 1. Domain Folders Replace Flat Composables

Composables move from flat `app/composables/` to domain-organized folders under `app/`:

```
app/assessment/     app/templates/     app/applications/
app/ui/             app/models/        app/components/
app/pages/
```

### 2. Decomposed Modules (Option B)

Each domain has focused modules rather than one monolithic file:

| Module Type | Purpose | Example |
|-------------|---------|---------|
| Fetch | GET operations, caching | `useAssessmentFetch.ts` |
| Mutate | POST/PUT/DELETE, optimistic updates | `useAssessmentMutate.ts` |
| State | Domain state + transitions | `useAssessmentAnswers.ts` |
| Navigation | Current position, next/prev | `useAssessmentNavigation.ts` |
| Computed | Pure calculation | `useAssessmentProgress.ts` |
| Orchestrator | Composes modules, public API | `useAssessment.ts` |

### 3. Naming Convention

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NAMING CONVENTION                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Suffix/Word       │ What it contains        │ Example                      │
│  ──────────────────┼─────────────────────────┼──────────────────────────────│
│  Fetch             │ GET operations, caching │ useAssessmentFetch.ts        │
│  Mutate            │ POST/PUT/DELETE         │ useAssessmentMutate.ts        │
│  Navigation        │ Current, next, prev     │ useAssessmentNavigation.ts    │
│  Validation        │ Rules, checks           │ useTemplatesValidation.ts     │
│  [Concept]         │ State + transitions     │ useAssessmentAnswers.ts       │
│  [Calc]            │ Pure computation        │ useAssessmentProgress.ts      │
│                                                                             │
│  Verb-based = I/O or action                                                 │
│  Noun-based = Domain concept                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Vuex 2 Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VUEX 2 / GRAPHQL → NUXT COMPOSABLES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Vuex 2                          Nuxt Composables                          │
│  ───────────────────────         ──────────────────────────────────        │
│  actions      → Fetch + Mutate   useAssessmentFetch.ts                     │
│                                 useAssessmentMutate.ts                     │
│  mutations    → State changes    useAssessmentAnswers.ts                   │
│  getters      → Computed         useAssessmentProgress.ts                  │
│  state        → State            useAssessmentAnswers.ts (co-located)      │
│  modules      → Domain folders   app/assessment/, app/templates/           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Survey Mode = View, Not Separate Domain

Survey mode (`survey.vue`) uses the same `useAssessment` composable with different UI rendering (single question, distraction-free). No separate composable needed.

## Folder Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FINAL ARCHITECTURE                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  app/                                                                       │
│  ├── assessment/                    ← Domain folder                         │
│  │   ├── useAssessment.ts           ← Orchestrator                          │
│  │   ├── useAssessmentFetch.ts      ← GET: review, questions               │
│  │   ├── useAssessmentMutate.ts     ← POST/PUT: saveAnswer, saveProgress   │
│  │   ├── useAssessmentAnswers.ts    ← Answer state + transitions            │
│  │   ├── useAssessmentProgress.ts   ← Pure computation                      │
│  │   ├── useAssessmentNavigation.ts ← Current pillar/question               │
│  │   └── index.ts                                                           │
│  │                                                                          │
│  ├── templates/                                                             │
│  │   ├── useTemplates.ts                                                    │
│  │   ├── useTemplatesFetch.ts                                               │
│  │   ├── useTemplatesMutate.ts                                              │
│  │   ├── useTemplatesDraft.ts                                               │
│  │   ├── useTemplatesValidation.ts                                          │
│  │   └── index.ts                                                           │
│  │                                                                          │
│  ├── applications/                  ← Option A (single file for now)       │
│  │   └── useApplications.ts                                                 │
│  │                                                                          │
│  ├── ui/                            ← Cross-cutting UI utilities            │
│  │   ├── useSortState.ts                                                    │
│  │   ├── useBulkSelection.ts                                                │
│  │   ├── useCommandPalette.ts                                               │
│  │   ├── usePageHeader.ts                                                   │
│  │   └── useBreadcrumbs.ts                                                  │
│  │                                                                          │
│  ├── models/                        ← Shared type contracts                 │
│  │   ├── question.ts                                                        │
│  │   ├── review.ts                                                          │
│  │   └── ...                                                                │
│  │                                                                          │
│  ├── components/                    ← UI components                         │
│  │   ├── assessment/                                                        │
│  │   ├── template-studio/                                                   │
│  │   └── ...                                                                │
│  │                                                                          │
│  └── pages/                         ← View orchestration (thin)             │
│      ├── applications/                                                      │
│      │   └── [appId]/reviews/[reviewId]/                                    │
│      │       ├── assessment.vue    ← Uses useAssessment()                  │
│      │       └── survey.vue        ← Uses useAssessment() (same data)      │
│      └── templates/                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Testing Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TEST ORGANIZATION                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  tests/                                                                     │
│  ├── assessment/                                                            │
│  │   ├── useAssessmentFetch.test.ts      ← Mock API                        │
│  │   ├── useAssessmentMutate.test.ts     ← Mock API                        │
│  │   ├── useAssessmentAnswers.test.ts    ← No mocks, pure state            │
│  │   ├── useAssessmentProgress.test.ts   ← No mocks, pure functions        │
│  │   ├── useAssessmentNavigation.test.ts ← No mocks, simple state          │
│  │   └── useAssessment.test.ts           ← Integration                     │
│  │                                                                          │
│  ├── templates/                                                             │
│  │   └── ...                                                                │
│  │                                                                          │
│  └── ui/                                                                    │
│      └── ...                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

### Risk: Over-engineering for current scale
**Mitigation**: Use Option A (single file) for simpler domains like `applications`. Only decompose when domain grows.

### Risk: Circular dependencies between domains
**Mitigation**: Enforce dependency direction. Domains can import from other domains, but not circularly. `ui/` never imports from domains.

### Risk: Migration breaks existing pages
**Mitigation**: Keep `app/composables/` as re-exports during transition. Remove after all pages migrated.

## Migration Plan

### Phase 1: Create Structure
1. Create domain folders (`assessment/`, `templates/`, `ui/`)
2. Create orchestrator files (`useAssessment.ts`)
3. Create stub modules with pass-through to existing composables

### Phase 2: Extract Logic
1. Move answer state machine from `assessment.vue` → `useAssessmentAnswers.ts`
2. Move progress calculation → `useAssessmentProgress.ts`
3. Move navigation state → `useAssessmentNavigation.ts`
4. Combine fetch wrappers → `useAssessmentFetch.ts`

### Phase 3: Update Pages
1. Simplify `assessment.vue` to use orchestrator
2. Simplify `survey.vue` to use same orchestrator
3. Remove duplicated logic

### Phase 4: Update Documentation
1. Rewrite `site/docs/development/frontend.md`
2. Update `site/docs/development/architecture.md`
3. Update `site/docs/development/index.md`

### Phase 5: Cleanup
1. Remove old `app/composables/` folder
2. Update all imports

## Documentation Changes

### site/docs/development/frontend.md
Replace "Composables Guide" with:
- Architecture overview with ASCII diagram
- Naming convention table
- Module patterns (Fetch, Mutate, State, etc.)
- Testing guidance

### site/docs/development/architecture.md
Update folder structure diagram to match new organization.

### site/docs/development/index.md
Update repository structure section.

## Open Questions

(None - design is complete from exploration session)
