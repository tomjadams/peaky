## Context

Template Studio currently provides a question editing interface organized by pillars. Template authors can create questions, set risk levels, and add metadata. However, there's no way to define cross-question logic that triggers actions when certain answer patterns emerge.

This design adds a **Rules mode** alongside the existing Questions mode, using Vue Flow to provide a visual canvas for creating rule sets.

## Goals / Non-Goals

**Goals:**
- Add Questions/Rules navigation via separate pages (URL shareable)
- Implement Vue Flow canvas for visual rule building
- Support drag-and-drop from question sidebar to rule set nodes
- Store rule sets as part of template data model
- Real-time validation with multi-rule warnings

**Non-Goals:**
- Runtime rule evaluation (separate concern for assessment engine)
- Rule versioning or history

## Decisions

### 1. Separate Pages (Not Toggle)

Questions and Rules are separate pages with URL-based navigation, not a toggle in the sub-header.

**Rationale:**
- URL is shareable (`/templates/123/edit` vs `/templates/123/edit/rules`)
- Cleaner architecture (no state sync between modes)
- No toggle state to persist

```
QUESTIONS MODE (/templates/:id/edit):
┌─────────────────────────────────────────────────────────────────┐
│  ← Templates  Template Name │ Questions →        [Save] [Pub]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┬──────────┬──────────┬───────┐                     │
│  │ Security│Operations│Reliability│+ Add │                     │
│  └─────────┴──────────┴──────────┴───────┘                     │
├─────────────────────────────────────────────────────────────────┤
│                    Question Editor                              │
└─────────────────────────────────────────────────────────────────┘

RULES MODE (/templates/:id/edit/rules):
┌─────────────────────────────────────────────────────────────────┐
│  ← Templates  Template Name │ ← Questions       [Save] [Pub]    │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────────────────────────────────┐   │
│  │ Questions  │  │          Vue Flow Canvas                 │   │
│  │ Sidebar    │  │   (dot background, zoom controls)        │   │
│  └────────────┘  └──────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ 2 questions in multiple rules     [view details]        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

Header shows a button to switch modes with an arrow indicating direction.

### 2. Vue Flow Integration

Using `@vue-flow/core` with extensions:
- `@vue-flow/background` - dot pattern for canvas
- `@vue-flow/controls` - zoom in/out/fit controls

Custom node types:
- **QuestionNode**: Dragged from sidebar, displays question ID + abbreviated text
- **RuleSetNode**: Container holding multiple questions, logic selector, action output
- **ActionNode**: Output node showing the triggered action

### 3. Data Model

```typescript
// Rule set with multiple trigger types
interface RuleSet {
  id: string
  name: string
  triggerType: 'all' | 'any' | 'multiple'  // How conditions are evaluated
  conditions: RuleCondition[]              // For 'all'/'any' triggers
  conditionGroups: ConditionGroup[]        // For 'multiple' trigger
  action: RuleAction
  position: { x: number; y: number }       // Vue Flow positioning
}

interface RuleCondition {
  questionId: string
  triggerOn: 'no'  // Extensible: could add 'yes', 'na' later
}

// Grouped conditions for complex logic
interface ConditionGroup {
  id: string
  logic: 'and' | 'or'
  conditions: RuleCondition[]
}

interface RuleAction {
  type: 'escalate_review' | 'notify_advisor'  // Extensible for future actions
  comment?: string  // Optional context for the action
}

// Template extension
interface Template {
  // ...existing fields
  ruleSets?: RuleSet[]
}
```

**Trigger Types:**
- `'all'` - ALL conditions must be NO (AND logic)
- `'any'` - ANY condition is NO (OR logic)  
- `'multiple'` - ALL groups must evaluate to TRUE, each group has its own logic

### 4. Component Structure

```
app/
├── pages/templates/[id]/
│   └── edit/
│       ├── index.vue              # Questions mode page
│       └── rules.vue              # Rules mode page
│
├── components/template-studio/
│   ├── Header.vue                 # Mode navigation button
│   ├── RulesCanvas.vue            # Main canvas wrapper
│   ├── RulesQuestionSidebar.vue   # Draggable question list
│   └── nodes/
│       └── RuleSetNode.vue        # Rule container node (includes conditions)
│
├── templates/
│   ├── useTemplateRules.ts        # Rules state management
│   └── useTemplateRulesValidation.ts  # Validation logic
│
└── models/
    └── rule.ts                    # RuleSet, ConditionGroup types
```

### 5. Question Multi-Rule Detection

When a question appears in 2+ rule sets, show a warning badge in the sidebar:

```
┌──────────────┐
│ SEC-2 ⚠️     │  ← Badge indicates "appears in multiple rules"
│ Crypto keys  │
│ in HSM       │
└──────────────┘
```

Tooltip: "This question triggers 2 rules. Consider increasing its criticality level."

### 6. Real-Time Validation

Validation happens continuously in the UI, not via a button:

- **Multi-rule warnings** - Toolbar shows ⚠️ badge when questions appear in 2+ rules
- **Character limits** - Comment textarea shows count and red border when over limit
- **Empty group warnings** - Groups with no conditions show warning state
- **Missing references** - Validation errors shown when questions are deleted but still in rules
- **Publish integration** - `useTemplateEditor.validateTemplate()` includes rule validation

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────┐                                       │
│   │  E2E (Playwright)   │  Canvas interactions, drag-drop       │
│   └─────────────────────┘                                       │
│                                                                  │
│   ┌───────────────────────────┐                                 │
│   │  Component Tests (Vitest) │  Node rendering, toggle state   │
│   └───────────────────────────┘                                 │
│                                                                  │
│   ┌─────────────────────────────────────┐                       │
│   │  Unit Tests (Vitest, no mocks)      │  useTemplateRules,    │
│   │                                     │  validation logic,    │
│   │                                     │  multi-rule detection │
│   └─────────────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Unit tests** (pure functions):
- `useTemplateRules` - add/remove/update rule sets
- Rule validation logic
- Multi-rule detection for questions

**Component tests**:
- Toggle switches between Questions/Rules modes
- Question sidebar filtering by pillar
- Node rendering with correct data

**E2E tests**:
- Drag question from sidebar to canvas
- Create rule set, add conditions, set action
- Validate and save template with rules

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Vue Flow bundle size | Tree-shake unused features, lazy-load canvas |
| Canvas performance with many rules | Pagination/virtualization if needed (unlikely for MVP) |
| Data migration | Rules field is optional, existing templates unaffected |

## Migration Plan

1. Install Vue Flow packages
2. Add `ruleSets` optional field to Template model
3. Deploy backend changes (template save handles new field)
4. Deploy frontend with toggle + canvas
5. No migration needed - existing templates have empty `ruleSets`

Rollback: Feature flag on toggle visibility, rules data is inert without UI.

## Open Questions

None - design is ready for implementation.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
|---------|------------------|-----------|------------------|-------|
| Mode Toggle | `UButtonGroup` | `size="sm"` | - | Questions/Rules pills |
| Validate Button | `UButton` | `color="neutral" variant="soft"` | - | Top-right toolbar |
| Question Sidebar | Custom | - | `bg-elevated rounded-xl` | Fixed left panel |
| Pillar Filter | `USelect` | `size="sm"` | - | "All" / pillar names |
| Search Input | `UInput` | `size="sm"` | - | Filter questions |
| Question Card | Custom | - | `bg-muted rounded-lg` | Draggable item |
| Multi-rule Badge | `UBadge` | `color="warning" variant="subtle"` | - | ⚠️ indicator |
| Canvas | Vue Flow | - | `bg-dot-pattern` | Custom CSS for dots |
| Zoom Controls | `@vue-flow/controls` | - | `bg-elevated rounded-lg` | Bottom-right |

### Spatial Composition

- **Sidebar width**: `w-72` (288px) fixed
- **Sidebar padding**: `p-4`
- **Gap between sidebar and canvas**: `gap-0` (sidebar overlays canvas edge)
- **Canvas**: Fills remaining space with `flex-1`
- **Dot pattern**: 20px grid, `#283039` dots on `#111418` background
- **Controls position**: Bottom-right, `right-4 bottom-4`

### Visual Assertions

- "AND the mode toggle shows 'Questions' as active by default"
- "AND the pillar tabs are hidden when Rules mode is active"
- "AND questions in the sidebar show their pillar badge (e.g., 'SEC', 'OPS')"
- "AND dragging a question shows a ghost preview following cursor"
- "AND the canvas background uses a dot pattern matching the sample design"
- "AND zoom controls appear in bottom-right corner of canvas"
- "AND rule set nodes have colored left border matching action severity"
- "AND questions appearing in 2+ rules show warning badge in sidebar"
