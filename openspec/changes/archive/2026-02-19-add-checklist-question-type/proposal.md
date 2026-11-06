## Why

Templates with many yes/no questions create cognitive overload for reviewers. When a template has 30-40 binary questions, reviewers lose focus and the assessment becomes a checkbox exercise rather than a meaningful review.

Checklist questions solve this by allowing template authors to group related items under a single question. Instead of 5 separate "Do you have X?" questions, one checklist question can ask "Which of these practices are implemented?" with selectable items.

This reduces visual clutter, groups related concepts, and helps reviewers engage with the content meaningfully.

## What Changes

- **New question type**: `checklist` alongside existing `yes-no` type
- **Checklist items**: 3-5 items per checklist question (configurable by author)
- **Template Studio UX**: Type selector at question creation, adapted wizard flow
- **Assessment UX**: Checklist questions render with checkboxes and progress indicator
- **Data model**: `TemplateQuestion` and `Question` models gain `type` and `checklistItems` fields

## Capabilities

### New Capabilities

- `checklist-questions`: Support for checklist-type questions in templates and assessments

### Modified Capabilities

- `template-editor`: Question editing flow now supports type selection and checklist item management
- `question-answering`: Assessment flow now handles checklist question rendering and answer storage

## Impact

- **Data models**: `app/models/question.ts`, `app/models/template.ts`
- **Template Studio**: `QuestionCardGuidedView.vue`, `QuestionCardCompactView.vue`
- **Assessment**: `QuestionRow.vue`, new `ChecklistQuestionRow.vue` component
- **Server data**: `server/data/templates.ts` (Peak Season template to include example checklist)
- **Answer handling**: `useAssessment` composable, `QuestionAnswer` type

---

<!--
PROMPT GUIDANCE FOR AI:

Keep proposal concise (1-2 pages). Focus on "why" not "how" - implementation details belong in design.md.

The Capabilities section is critical - it creates the contract between proposal and specs phases.
Research existing specs before filling this in. Each capability listed needs a corresponding spec file.

Before creating a new spec, check existing specs in openspec/specs/ for a suitable domain match.
This project follows DDD - prefer extending an existing spec over creating a new one.
Only create a new spec if the change introduces a genuinely new bounded context.
-->
