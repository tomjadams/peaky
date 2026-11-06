## 1. Setup

- [x] 1.1 Create GitLab issue for "fix: template studio UX improvements"
- [x] 1.2 Create feature branch `fix/template-studio-ux-review`

## 2. Bug Fix: NA Modal Close Order (TDD)

- [x] 2.1 RED: Write unit test for `useNAModal` - `currentQuestion` should remain accessible until modal fully closed
- [x] 2.2 GREEN: Fix `closeModal()` to delay clearing `currentQuestion` until after animation (~300ms)
- [x] 2.3 REFACTOR: Clean up timing logic if needed

## 3. Bug Fix: NA Modal in Preview Mode (TDD)

- [x] 3.1 RED: Write E2E test - Preview mode N/A flow works end-to-end (open preview, click N/A, select reason, confirm)
- [x] 3.2 GREEN: Extract `NAReasonForm.vue` from `NAReasonModal.vue` (form content only)
- [x] 3.3 GREEN: Refactor `NAReasonForm.vue` to use `URadioGroup` for reason selection
- [x] 3.4 GREEN: Update `NAReasonModal.vue` to use `UModal` + `NAReasonForm`
- [x] 3.5 GREEN: Update Preview mode in `edit.vue` to use `USlideover` + `NAReasonForm`
- [x] 3.6 REFACTOR: Clean up any shared state/props between modal and slideover usage

## 4. Bug Fix: Info Panel in Preview Mode (TDD)

- [x] 4.1 RED: Write E2E test - Preview mode info panel opens correctly (click info icon, panel shows question details)
- [x] 4.2 GREEN: Replace inline info panel in Preview with `useQuestionInfo()` + `MoreInfoPanel`
- [x] 4.3 REFACTOR: Remove dead code from inline implementation

## 5. Bug Fix: Input Validation (TDD)

- [x] 5.1 RED: Write component test - validation error shows when character limit exceeded (not truncated)
- [x] 5.2 GREEN: Update `QuestionCard.vue` to use `UFormField` error prop instead of `limitText()` truncation
- [x] 5.3 GREEN: Update `RichTextEditor.vue` to expose error state and use NuxtUI validation pattern
- [x] 5.4 GREEN: Increase "Why This Matters" limit from 500 to 1000 chars
- [x] 5.5 GREEN: Ensure "Why This Matters" field auto-expands with content
- [x] 5.6 REFACTOR: Remove `limitText()` helper if no longer used

## 6. Question Field Simplification

- [x] 6.1 Remove Bold/Italic toolbar from question text `RichTextEditor`
- [x] 6.2 Convert question text field to `UTextarea` with `autoresize` and `:rows="1"`

## 7. Pillar Management UX (TDD)

- [x] 7.1 RED: Write component test - pillar delete button is always visible (not hover-only)
- [x] 7.2 GREEN: Make delete pillar button always visible in `PillarTabs.vue`
- [x] 7.3 RED: Write component test - pillar modal opens, creates pillar, saves collapse preference
- [x] 7.4 GREEN: Create `PillarCreateModal.vue` with:
  - `UCollapsible` for "How pillars work" section
  - Pyramid diagram (Operations → Security → Reliability → Clarity)
  - `UFormField` + `UInput` for name and description fields
- [x] 7.5 GREEN: Use VueUse `useLocalStorage` for diagram collapse preference (`orr:pillar-diagram-collapsed`)
- [x] 7.6 GREEN: Update `PillarTabs.vue` to use `useOverlay` to open modal programmatically
- [x] 7.7 REFACTOR: Remove old inline pillar input code

## 8. Question Pre-population (TDD)

- [x] 8.1 RED: Write unit test - new questions have pre-populated Leading Practice and Resource
- [x] 8.2 GREEN: Update `addQuestion()` in `useTemplateEditor.ts` to include:
  - Default practice: "Run regular customers pain point review"
  - Default resource: "Knowledge Hub" → "https://www.adyen.com/knowledge-hub"
- [x] 8.3 REFACTOR: Extract default values to constants if reused

## 9. Add Question UX

- [x] 9.1 Enlarge cursor hit area in `QuestionList.vue` add question input
- [x] 9.2 Ensure entire bordered container is clickable and focuses input

## 10. Documentation & Cleanup

- [x] 10.1 Update decision log (`site/docs/development/decisions.md`) with:
  - USlideover for nested modal contexts
  - Validation over truncation pattern
  - Pillar onboarding modal approach
- [x] 10.2 Run full test suite - all tests must pass
- [x] 10.3 Create GitLab MR with conventional commit title `fix(template-studio): UX improvements from frontend review`
