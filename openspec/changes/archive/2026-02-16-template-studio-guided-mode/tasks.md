## 1. Setup

- [x] 1.1 Create GitLab issue for template-studio-guided-mode
- [x] 1.2 Create composable `useQuestionEditorMode` with `useLocalStorage` for view mode state

## 2. Component Extraction

- [x] 2.1 Extract current expanded content from `QuestionCard.vue` into `QuestionCardCompactView.vue`
- [x] 2.2 Create `QuestionCardGuidedView.vue` with vertical single-section layout
  - See Component Map in design.md for exact NuxtUI props and semantic classes
  - Include step indicator, progress bar, and section navigation (Next/Back/Skip/Done)
  - Sub-task: Run ui-review subagent on QuestionCardGuidedView.vue to validate design system compliance

## 3. Integration

- [x] 3.1 Update `QuestionCard.vue` to conditionally render GuidedView or CompactView based on mode
- [x] 3.2 Add view mode toggle to expanded card header using UToggle
  - See Component Map in design.md for toggle props
  - Sub-task: Run ui-review subagent on QuestionCard.vue to validate design system compliance

## 4. Testing

- [x] 4.1 Write tests for `useQuestionEditorMode` composable (localStorage persistence)
- [x] 4.2 Write component tests for mode toggle interaction
- [x] 4.3 Write component tests for Guided Mode navigation (Next/Back/Skip/Done)
- [x] 4.4 Use /playwright-cli skill to verify mode toggle persists across page reload

## 5. Finalization

- [x] 5.1 Update decision log (site/docs/development/decisions.md) with view mode pattern
- [x] 5.2 Create GitLab MR with conventional commit title
