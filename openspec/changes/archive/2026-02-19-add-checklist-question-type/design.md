## Context

Currently, all questions in Peaky are yes/no binary questions. This creates cognitive overload when templates have 30-40 questions. Checklist questions allow grouping related items under a single question, reducing visual clutter while maintaining assessment depth.

## Goals / Non-Goals

**Goals:**
- Add `checklist` question type alongside `yes-no`
- Support 3-5 checklist items per checklist question
- Provide intuitive authoring UX in Template Studio (Guided + Compact modes)
- Render checklist questions in Assessment view with checkbox selection
- Track checklist answers as array of checked item IDs

**Non-Goals:**
- "Best practices" nudge system when authors exceed 10 yes-no questions (deferred)
- Multiple-choice or text question types
- Per-item scoring/statistics
- Migration of existing templates (explicit opt-in, no auto-migration)

## Decisions

### Data Model

```
BEFORE:
┌─────────────────────────────────┐
│ TemplateQuestion                │
│ ├─ id: string                   │
│ ├─ order: number                │
│ ├─ text: string                 │
│ ├─ riskLevel: RiskLevel         │
│ ├─ importance: string            │
│ ├─ leadingPractices: [...]      │
│ └─ helpfulLinks: [...]          │
│                                 │
│ ❌ No type field                │
│ ❌ Assumes yes/no               │
└─────────────────────────────────┘

AFTER:
┌─────────────────────────────────┐
│ TemplateQuestion                │
│ ├─ id: string                   │
│ ├─ order: number                │
│ ├─ type: "yes-no" | "checklist" │ ◄── NEW (default: "yes-no")
│ ├─ text: string                 │
│ ├─ riskLevel: RiskLevel         │
│ ├─ importance: string            │
│ ├─ checklistItems?: [...]       │ ◄── NEW (required if type=checklist)
│ ├─ leadingPractices: [...]      │ (hidden for checklists)
│ └─ helpfulLinks: [...]          │
└─────────────────────────────────┘

ChecklistItem:
├─ id: string
├─ order: number
└─ text: string

QuestionAnswer (updated):
├─ "yes" | "no" | "na" | null     │ (yes-no questions)
└─ string[] | null                │ (checklist: array of checked item IDs)
```

### Answer Semantics

```
┌─────────────────────────────────────────────────────────────┐
│ Question "Answered" State                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Yes/No question:                                            │
│    └─ Answered when: answer ∈ {"yes", "no", "na"}           │
│                                                              │
│  Checklist question:                                         │
│    └─ Answered when:                                         │
│        ├─ answer === "na" (explicitly marked N/A)           │
│        └─ OR answer is string[] (at least one item checked)  │
│                                                              │
│  Progress calculation:                                       │
│    └─ Each question counts as 1 (not per-item)              │
│    └─ Checklist with 3/5 items checked = 1 question answered│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Template Studio UX - Guided Mode

Type-first approach with adapted wizard:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GUIDED MODE FLOW                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 0: Choose Type (NEW)                                                   │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  What kind of question is this?                                    │      │
│  │                                                                    │      │
│  │   ┌─────────────────────┐    ┌─────────────────────┐             │      │
│  │   │  ● Yes / No         │    │  ○ Checklist        │             │      │
│  │   │                     │    │                     │             │      │
│  │   │  Simple binary      │    │  Break into items   │             │      │
│  │   │  answer             │    │  (3-5 items)        │             │      │
│  │   └─────────────────────┘    └─────────────────────┘             │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  IF "Yes/No": Steps 1-4 unchanged (Question → Importance → Practices → Links)│
│                                                                              │
│  IF "Checklist":                                                             │
│    Step 1: Question text                                                     │
│    Step 2: Checklist Items (3-5 required)                                    │
│    Step 3: Why This Matters                                                  │
│    Step 4: Resources                                                         │
│    (No "Leading Practices" section - items ARE the leading practices)        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Template Studio UX - Compact Mode

Layout transformation based on type:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPACT MODE - YES/NO                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ LEFT COLUMN                  │  │ RIGHT COLUMN                          │ │
│  │                              │  │                                       │ │
│  │ ┌──────────────────────────┐ │  │ ┌─ Leading Practices (3) ─────────┐ │ │
│  │ │ Type: [Yes/No ▼]         │ │  │ │  Practices to look for when       │ │ │
│  │ └──────────────────────────┘ │  │ │  answering this question.         │ │ │
│  │                              │  │ │  ...                              │ │ │
│  │ ┌─ Question ────────────────┐│  │ └───────────────────────────────────┘ │ │
│  │ │ ...                       ││  │                                       │ │
│  │ └───────────────────────────┘│  │ ┌─ Resources ─────────────────────┐ │ │
│  │                              │  │ │  ...                              │ │ │
│  │ ┌─ Why This Matters ────────┐│  │ └───────────────────────────────────┘ │ │
│  │ │ ...                       ││  │                                       │ │
│  │ └───────────────────────────┘│  │                                       │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPACT MODE - CHECKLIST                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ LEFT COLUMN                  │  │ RIGHT COLUMN (transformed)            │ │
│  │                              │  │                                       │ │
│  │ ┌──────────────────────────┐ │  │ ┌─ Checklist Items (4/5) ──────────┐ │ │
│  │ │ Type: [Checklist ▼]      │ │  │ │  These are the items reviewers     │ │ │
│  │ └──────────────────────────┘ │  │ │  will check off. Each checked      │ │ │
│  │                              │  │ │  item indicates an implemented    │ │ │
│  │ ┌─ Question ────────────────┐│  │ │  leading practice.                 │ │ │
│  │ │ ...                       ││  │ │                                    │ │ │
│  │ └───────────────────────────┘│  │ │  ≡ ☑ Automated failover scripts   │ │ │
│  │                              │  │ │  ≡ ☑ Replication monitoring       │ │ │
│  │ ┌─ Why This Matters ────────┐│  │ │  ≡ ☐ Multi-region failover test..│ │ │
│  │ │ ...                       ││  │ │  ≡ ☑ Point-in-time recovery val..│ │ │
│  │ └───────────────────────────┘│  │ │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│ │ │
│  │                              │  │ │  [+ Add item] (1 slot remaining) │ │ │
│  │                              │  │ │  ⚠ Required: 3-5 items            │ │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                              │
│  (Leading Practices section is HIDDEN for checklists)                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Assessment View UX

New `ChecklistQuestionRow` component:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHECKLIST QUESTION RENDERING                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ REL-1  Which operational practices are implemented?         ⓘ  N/A  │    │
│  │                                                                       │    │
│  │  Progress ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3/5                         │    │
│  │                                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ ☑ Automated failover scripts              IMPLEMENTED       │    │    │
│  │  ├─────────────────────────────────────────────────────────────┤    │    │
│  │  │ ☑ Replication monitoring                  IMPLEMENTED       │    │    │
│  │  ├─────────────────────────────────────────────────────────────┤    │    │
│  │  │ ☐ Multi-region failover testing                             │    │    │
│  │  ├─────────────────────────────────────────────────────────────┤    │    │
│  │  │ ☑ Point-in-time recovery validation      IMPLEMENTED       │    │    │
│  │  ├─────────────────────────────────────────────────────────────┤    │    │
│  │  │ ☐ Chaos engineering drills                                  │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  │                                                                       │    │
│  │  [Add Note]                                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  N/A state: Entire question grays out (same as yes/no questions)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Testing strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TEST COVERAGE                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Unit Tests (Vitest):                                                        │
│  ├─ ChecklistItemValidation: min 3, max 5 items                              │
│  ├─ ChecklistAnswerSemantics: answered when items checked or N/A            │
│  ├─ useAssessment: handles checklist answer updates                         │
│  └─ QuestionTypeGuards: type narrowing for yes-no vs checklist              │
│                                                                              │
│  Component Tests (@testing-library/vue):                                    │
│  ├─ ChecklistQuestionRow: renders items, tracks selection                   │
│  ├─ QuestionCardGuidedView: type selector, checklist items step             │
│  └─ QuestionCardCompactView: layout transformation by type                  │
│                                                                              │
│  E2E Tests (Playwright):                                                    │
│  ├─ Template Studio: create checklist question, add/remove items            │
│  ├─ Assessment: answer checklist question, verify progress                  │
│  └─ Preview: checklist question renders correctly                            │
│                                                                              │
│  Accessibility:                                                              │
│  └─ Checklist checkboxes: proper ARIA, keyboard navigation                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Authors create checklists with too few items (1-2) | Validation: min 3 items before collapse/done |
| Progress calculation confusion (is 3/5 "answered"?) | Clear visual indicator: checklist = 1 question |
| Leading Practices redundancy for checklists | Hide section entirely, items serve that purpose |
| Compact mode layout shift disorients users | Smooth transition animation, helper text explains purpose |

## Migration Plan

No automatic migration. Existing questions default to `type: "yes-no"`. Authors can opt-in to convert questions to checklists manually.

Peak Season template (`template-001`) will be updated manually to include one checklist question for demonstration/testing.

## Open Questions

None - design decisions resolved through exploration.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Type selector (Guided) | URadioGroup | size="md" color="primary" | space-y-3 | Two options: Yes/No, Checklist |
| Type selector (Compact) | USelect | size="sm" | -- | Dropdown at top of left column |
| Checklist item row | UCheckbox | size="md" color="primary" | -- | Reorderable via Sortable |
| Checklist progress | -- | -- | text-xs font-medium | Custom: "3/5" with mini bar |
| Item badge | UBadge | color="primary" variant="subtle" size="xs" | -- | "IMPLEMENTED" for checked items |
| Add item button | UButton | variant="outline" size="xs" color="neutral" | -- | "+ Add item" |

### Spatial Composition

- Checklist items container: `space-y-2` between items
- Item row: `p-3 rounded-lg border border-default` with hover states
- Progress indicator: `gap-2` between label and bar, `w-24 h-1.5` for bar
- Section helper text: `text-sm text-muted mt-1`

### Visual Assertions

- AND the type selector shows Yes/No selected by default
- AND the checklist items section appears only when type=checklist
- AND the Leading Practices section is hidden when type=checklist
- AND each checklist item shows checkbox on left, text in middle, badge on right when checked
- AND the progress indicator shows "X/Y" format with filled percentage bar
- AND checked items show primary color border and "IMPLEMENTED" badge
- AND unchecked items show neutral styling with hover state
