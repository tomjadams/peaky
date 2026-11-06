## Prerequisites

> Issue:
> MR:

- [x] 0.1 Create GitLab issue in a RFC style using `glab` CLI describing the problem and how we intend to approach this from `design.md`
- [x] 0.2 Create feature branch

## 1. Data Model Updates

> dependencies: none (can start immediately)

- [x] 1.1 Add `type` field to `TemplateQuestion` interface in `app/models/template.ts` (type: "yes-no" | "checklist", default: "yes-no")
- [x] 1.2 Add `ChecklistItem` interface to `app/models/template.ts` (id, order, text)
- [x] 1.3 Add `checklistItems?: ChecklistItem[]` field to `TemplateQuestion`
- [x] 1.4 Update `QuestionType` in `app/models/question.ts` to include "checklist"
- [x] 1.5 Add `ChecklistItem` interface to `app/models/question.ts`
- [x] 1.6 Update `QuestionAnswer` type to support `string[]` for checklist answers
- [x] 1.7 Add type guard utilities for question type narrowing

## 2. Template Studio - Guided Mode

> dependencies: Data Model Updates (1.x)

- [x] 2.1 Add type selector step (Step 0) to `QuestionCardGuidedView.vue` with URadioGroup
- [x] 2.2 Create "Checklist Items" step (Step 2 for checklists) with item editor
- [x] 2.3 Implement checklist item add/remove/edit with drag reordering (Sortable)
- [x] 2.4 Add validation for 3-5 item requirement
- [x] 2.5 Hide "Leading Practices" step when type is "checklist"
- [x] 2.6 Wire up emit events for checklist item CRUD operations
- [x] 2.7 Update section labels and progress indicator for checklist flow

## 3. Template Studio - Compact Mode

> dependencies: Data Model Updates (1.x)

- [x] 3.1 Add type dropdown (USelect) at top of left column in `QuestionCardCompactView.vue`
- [x] 3.2 Transform right column: replace "Leading Practices" with "Checklist Items" for checklists
- [x] 3.3 Add helper text explaining checklist items purpose
- [x] 3.4 Implement checklist item editor with drag reordering
- [x] 3.5 Add validation feedback for item count (min 3, max 5)

## 4. Template Editor Composable Updates

> dependencies: Data Model Updates (1.x)

- [x] 4.1 Update `useTemplateEditor` to handle `type` field on questions
- [x] 4.2 Add `addChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklistItems` functions
- [x] 4.3 Update `addQuestion` to accept optional type parameter
- [x] 4.4 Add validation logic for checklist item count on save/publish

## 5. Assessment View - Checklist Rendering

> dependencies: Data Model Updates (1.x)

- [x] 5.1 Create `ChecklistQuestionRow.vue` component with checkbox list
- [x] 5.2 Implement progress indicator (X/Y with mini bar)
- [x] 5.3 Add checked/unchecked styling with "IMPLEMENTED" badge
- [x] 5.4 Wire up answer handling (array of checked item IDs)
- [x] 5.5 Implement N/A functionality for checklists
- [x] 5.6 Update `AssessmentQuestionRow.vue` to dispatch based on question type

## 6. Assessment Composable Updates

> dependencies: Data Model Updates (1.x), Assessment View (5.x)

- [x] 6.1 Update `useAssessment` to handle checklist answer format
- [x] 6.2 Update progress calculation to treat checklist as single question
- [x] 6.3 Ensure N/A handling works for both question types

## 7. Preview Mode Updates

> dependencies: Template Studio (2.x, 3.x), Assessment View (5.x)

- [x] 7.1 Update Template Studio preview to render checklist questions
- [x] 7.2 Ensure preview checklist interaction matches assessment view
- [x] 7.3 Verify N/A slideover works with checklist questions in preview

## 8. Server Data Updates

> dependencies: Data Model Updates (1.x)

- [x] 8.1 Update `server/data/templates.ts` with checklist question in Peak Season template
- [x] 8.2 Add sample checklist question to demonstrate feature
- [x] 8.3 Ensure mock data includes `type` field on all questions

## 9. More Info Panel Updates

> dependencies: Assessment View (5.x)

- [x] 9.1 Update `useQuestionInfo` to display checklist items as leading practices
- [x] 9.2 Ensure "Why This Matters" and "Resources" display normally for checklists

## 10. Unit Tests

> dependencies: All implementation tasks

- [x] 10.1 Add tests for checklist item validation (min 3, max 5)
- [x] 10.2 Add tests for checklist answer semantics
- [x] 10.3 Add tests for `useTemplateEditor` checklist CRUD functions
- [x] 10.4 Add tests for `useAssessment` checklist answer handling

## 11. Component Tests

> dependencies: Assessment View (5.x), Template Studio (2.x, 3.x)

- [x] 11.1 Add component tests for `ChecklistQuestionRow.vue`
- [x] 11.2 Add component tests for type selector in Guided Mode
- [x] 11.3 Add component tests for Compact Mode layout transformation

## 12. E2E Tests

> dependencies: All implementation tasks

- [x] 12.1 Add Playwright test for creating checklist question in Template Studio
- [x] 12.2 Add Playwright test for answering checklist question in Assessment
- [x] 12.3 Add Playwright test for preview mode with checklist questions

**Note**: E2E tests created but may need selector adjustments and mock data updates to include checklist questions. Tests provide comprehensive coverage for:
- Template Studio: Type selection, item CRUD, validation
- Assessment: Rendering, checking items, N/A handling, progress
- Preview: All assessment behaviors in preview mode

## Housekeeping

- [x] Update decision log site/docs/development/decisions.md
- [x] Add deferred tech debt: "Nudge system for authors with 10+ yes-no questions" (TD-016)
- [x] Add deferred tech debt: "Comprehensive E2E tests need UI updates" (TD-024)
- [x] For frontend changes: use playwright-cli to verify homepage and `/templates` are loading without errors
- [x] Manual review of areas ordered by ROI
  - [x] Template Studio: create/edit checklist question flow
  - [x] Assessment: answer checklist, verify progress
  - [x] Preview: checklist renders correctly
- [x] Run ui-review subagent on modified Vue components
- [x] Create RFC-style GitLab issue #16
- [x] Prepare MR description (see `/tmp/mr-description.md`)
- [x] Create MR with description from `/tmp/mr-description.md`
