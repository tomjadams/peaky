## Context

Template Studio's QuestionCard component currently displays an expanded view with all editing sections visible simultaneously (Question, Why This Matters, Leading Practices, Resources) in a 2-column layout. First-time template authors face cognitive overload as they don't know where to start or what's required vs optional.

The current implementation lives in:
- `app/components/template-studio/QuestionCard.vue` - handles expand/collapse and all editing sections
- `app/components/template-studio/QuestionList.vue` - manages the list and passes expand state

## Goals / Non-Goals

**Goals:**
- Reduce cognitive load for first-time template authors by showing one section at a time
- Provide a toggle for power users who prefer the current all-at-once view
- Persist user preference across sessions
- Maintain all existing functionality in both modes

**Non-Goals:**
- Changing the collapsed question card appearance
- Adding onboarding tours or tooltips
- Auto-detecting user expertise level
- Per-question mode selection (global only)

## Decisions

### Decision 1: Two View Modes with Toggle

**Choice:** Implement Guided Mode (default) and Compact Mode (opt-in) with a toggle in the expanded card header.

**Alternatives considered:**
- Progressive disclosure (auto-reveal sections) - rejected: harder to navigate back, power users hate it
- Collapsible accordion sections within current layout - rejected: two levels of expand/collapse is confusing
- Smart auto-detection based on usage - rejected: edge cases, unpredictable behavior

**Rationale:** Explicit toggle is simplest, most predictable, and respects user agency.

### Decision 2: Guided Mode Layout

**Choice:** Vertical stack with step indicator, showing one section at a time with Next/Back/Skip buttons.

Sections in order:
1. Question (Required)
2. Why This Matters (Recommended)
3. Leading Practices (Optional)
4. Resources (Optional)

**Rationale:** Mirrors natural authoring flow - write the question first, then add context.

### Decision 3: State Management

**Choice:** Use VueUse's `useLocalStorage` composable with key `templateStudio.viewMode`.

```typescript
const viewMode = useLocalStorage<'guided' | 'compact'>('templateStudio.viewMode', 'guided')
```

**Rationale:** VueUse is already a project dependency, provides reactive localStorage with TypeScript support.

### Decision 4: Component Structure

**Choice:** Extract view mode logic into a composable, keep QuestionCard as orchestrator.

```
QuestionCard.vue
├── QuestionCardGuidedView.vue (new)
│   └── Shows one section at a time with navigation
└── QuestionCardCompactView.vue (new - extracts current expanded content)
    └── Current 2-column layout
```

**Rationale:** Separation of concerns - each layout can evolve independently without conditional spaghetti.

## Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
|---------|------------------|-----------|------------------|-------|
| Mode toggle | UToggle | `model-value` `on-icon` `off-icon` | -- | In expanded card header |
| Toggle label | -- | -- | text-xs text-muted | "Guided" / "Compact" |
| Step indicator | -- | -- | text-sm text-muted | "Step 1 of 4" |
| Progress bar | UProgress | `value` `max="4"` | -- | Visual progress |
| Section header | -- | -- | text-xs font-semibold uppercase tracking-wider | Match existing metadata headers |
| Skip button | UButton | `variant="ghost"` `size="sm"` | -- | Secondary action |
| Next button | UButton | `color="primary"` `size="sm"` | -- | Primary navigation |
| Back button | UButton | `variant="ghost"` `size="sm"` | -- | Secondary navigation |
| Done button | UButton | `color="primary"` `size="sm"` | -- | Final step only |

## Spatial Composition

**Guided Mode:**
- Container: Same as current expanded card (no width change)
- Content area: Single column, max-w-2xl mx-auto for comfortable reading
- Spacing: space-y-6 between section header and editor
- Navigation: Flex row justify-between at bottom, gap-3 between buttons
- Progress bar: Full width below step indicator

**Compact Mode:**
- No changes from current 2-column layout
- Toggle appears in same header row as risk dropdown

## Risks / Trade-offs

**[Risk] Guided mode feels slow for quick edits** → Users can toggle to Compact mode; preference persists

**[Risk] Two code paths to maintain** → Mitigated by extracting to separate components with shared props interface

**[Risk] Users don't discover Compact mode** → Acceptable; 95% of users benefit from Guided default

**[Trade-off] Slightly larger bundle** → Minimal impact; both views share most logic, just different layouts
