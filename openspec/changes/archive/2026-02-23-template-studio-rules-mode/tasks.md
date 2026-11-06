## Prerequisites

> Issue: #17
> MR: !42 

- [x] 0.1 Create GitLab issue using `glab` CLI describing scoring rules feature and Vue Flow canvas approach from `design.md`
- [x] 0.2 Create feature branch `feat/template-studio-rules-mode`

## 1. Install Dependencies

> isolation: Can be done first, no dependencies

- [x] 1.1 Install Vue Flow packages: `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`
- [x] 1.2 Verify packages work with Nuxt 4 / Vue 3 setup (create minimal test component)

## 2. Data Model & Types

> dependencies: 1 (packages installed)

- [x] 2.1 Add `RuleSet`, `RuleCondition`, `RuleAction` types to `app/models/`
- [x] 2.2 Extend `Template` type with optional `ruleSets: RuleSet[]` field
- [x] 2.3 Update template Zod schemas to include `ruleSets` validation

## 3. Rules State Management

> dependencies: 2 (types defined)

- [x] 3.1 Create `app/templates/useTemplateRules.ts` composable
  - Add/remove/update rule sets
  - Track Vue Flow node positions
  - Multi-rule detection for questions
- [x] 3.2 Write unit tests for `useTemplateRules` (pure state logic, no mocks)
- [x] 3.3 Integrate rules state with `useTemplateEditor` (save/load with template)

## 4. Mode Toggle UI

> dependencies: None (can parallel with 2-3)
> **Note:** Implemented as separate pages (/edit vs /edit/rules) with URL-based navigation instead of toggle component. ModeToggle.vue was deleted.

- [x] 4.1 ~~Create `app/components/template-studio/ModeToggle.vue`~~ → Split into separate pages with Header button
- [x] 4.2 Update `app/pages/templates/[id]/edit.vue` → Created `/templates/[id]/edit/rules.vue`
- [x] 4.3 Add reactive `editorMode` state → URL-based: `/edit` vs `/edit/rules`
- [x] 4.4 Conditionally show/hide pillar tabs → Separate pages, no toggle needed
- [x] 4.5 ~~Write component test~~ → ModeToggle.vue deleted

## 5. Rules Canvas Foundation

> dependencies: 1 (packages), 4 (mode toggle)

- [x] 5.1 Create `app/components/template-studio/RulesCanvas.vue`
  - Vue Flow wrapper with background and controls
  - Dot pattern background using `@vue-flow/background`
  - Zoom controls using `@vue-flow/controls`
- [x] 5.2 Add CSS for dot pattern matching design spec (20px grid, dark theme)
- [x] 5.3 Integrate canvas into edit page (shown when mode is 'rules')

## 6. Question Sidebar

> dependencies: 5 (canvas exists)

- [x] 6.1 Create `app/components/template-studio/RulesQuestionSidebar.vue`
  - List all questions from all pillars
  - Show question slug, abbreviated text, pillar badge
- [x] 6.2 Add pillar filter dropdown (`USelect` with "All" + pillar options)
- [x] 6.3 Add search input for filtering by question text
- [x] 6.4 Implement drag start handlers for questions (Vue Flow drag-and-drop)
- [x] 6.5 Add multi-rule warning badge (⚠️) with tooltip for questions in 2+ rules

## 7. Custom Vue Flow Nodes

> dependencies: 5 (canvas), 3 (rules state)

- [x] 7.1 Create `app/components/template-studio/nodes/QuestionNode.vue`
  - Display question slug and abbreviated text
  - Styling per design spec
- [x] 7.2 Create `app/components/template-studio/nodes/RuleSetNode.vue`
  - Editable name field
  - Logic selector dropdown (AND/OR)
  - Container for question nodes
  - Action selector dropdown (future-proofed)
  - Colored left border based on action type
- [x] 7.3 Register custom node types with Vue Flow
- [x] 7.4 Implement drop handling to add questions to rule sets

## 8. Rule Set CRUD Operations

> dependencies: 7 (nodes), 3 (state)

- [x] 8.1 Add "Add Rule Set" button on canvas
- [x] 8.2 Implement rule set creation (default name, logic, action, position)
- [x] 8.3 Implement question removal from rule sets (delete key)
- [x] 8.4 Implement rule set deletion
- [x] 8.5 Connect canvas interactions to `useTemplateRules` state

## 9. Rule Validation

> dependencies: 8 (CRUD working)
> **Note:** "Validate Logic" button removed. Validation implemented via multi-rule warnings in toolbar, character limits on comments, and duplicate detection. Integrated into publish flow.

- [x] 9.1 ~~Create `app/templates/useTemplateRulesValidation.ts`~~ → Created with grouped conditions support
  - Multi-rule warnings shown in toolbar with popover
  - Character limit validation on comment textarea
  - Duplicate detection within rule sets (×2 badge)
  - Empty group warnings
  - Missing question reference errors
- [-] 9.2 ~~Add "Validate Logic" button~~ → REMOVED - not needed, real-time validation is better UX
- [x] 9.3 Display validation results → Multi-rule warnings in toolbar, character count on comments
- [x] 9.4 Integrate rule validation into template publish flow → Added to useTemplateEditor.validateTemplate()
- [x] 9.5 Write unit tests for validation logic → 17 tests in useTemplateRulesValidation.test.ts

## 10. Persistence Integration

> dependencies: 9 (validation), 3 (state)

- [x] 10.1 Update template save to include `ruleSets` with positions → Integrated with useTemplateEditor
- [x] 10.2 Update template load to restore canvas nodes from `ruleSets` → Nodes created from ruleSets on mount
- [x] 10.3 Ensure auto-save triggers on rule changes → Connected via useTemplateEditor
- [x] 10.4 Test save/load round-trip with multiple rule sets → E2E tests in rules-editor.spec.ts

## 11. E2E Testing

> dependencies: 10 (full feature complete)

- [x] 11.1 Use playwright-cli to test mode toggle switching → tests/e2e/rules-editor.spec.ts
- [x] 11.2 Use playwright-cli to test drag-and-drop from sidebar to canvas → tests/e2e/rules-editor.spec.ts
- [x] 11.3 Use playwright-cli to test rule set creation and configuration → tests/e2e/rules-editor.spec.ts
- [x] 11.4 Use playwright-cli to test validation flow → tests/e2e/rules-editor.spec.ts

## Housekeeping

- [x] Update decision log `site/docs/development/decisions.md` with:
  - Vue Flow library choice rationale
  - Data model design for rule sets
  - Toggle placement decision (Option B) → Separate pages instead
- [x] Use playwright-cli to verify homepage and `/templates` are loading without errors
- [x] Run ui-review subagent on modified `.vue` files in `template-studio/` → ux-reviewer significantly improved
- [x] Manual review of areas ordered by ROI:
  - [x] Mode toggle interaction and visual state → Separate pages with Header button
  - [x] Canvas drag-and-drop UX → Vue Flow native events working
  - [x] Rule validation error messages → Multi-rule warnings in toolbar
  - [x] Save/load persistence → Integrated with useTemplateEditor
- [x] Update GitLab issue with task completions → MR !42 created
- [x] Validate code quality using `site/docs/development/vue.md` and `site/docs/development/typescript.md` before merging → Lint passed
- [x] Run ux-reviewer subagent on light-mode to be sure contrast and such is correct → Light/dark mode verified
- [x] Resolve all console.log and Nuxt warnings → Checked
- [x] Triple check tests would capture regression → 29 unit tests for state machine

## Deferred Actions

> All improvements have been completed. No deferred items remain.

### Refactor Vue Components per Conventions ✅ COMPLETED

Reference: `site/docs/development/vue.md`

All components refactored with shared utilities:

- [x] **RulesCanvas.vue** - Code reviewed, already clean with computed properties
- [x] **RulesQuestionSidebar.vue** - Extracted `stripMarkdown`/`abbreviateText` to shared utility
- [x] **QuestionNode.vue** - Refactored to use shared text utility
- [x] **Create shared text utility** - `app/utils/text.ts` with `stripMarkdown`, `abbreviateText`, `truncateText`, `extractPreview`

**Patterns applied:**
1. ✅ Use computed properties for derived state (avoid complex template expressions)
2. ✅ Use `SCREAMING_SNAKE_CASE` for template constants
3. ✅ Extract pure utility functions outside reactive context
4. ✅ Move shared utilities to `app/utils/` for reuse
5. ✅ Group script setup code in order: imports → props/emits → constants → state → computed → watchers → handlers → lifecycle

## Deleted Files

> Files removed during implementation due to architecture changes

- `app/components/template-studio/ModeToggle.vue` → Replaced with separate pages + Header button
- `tests/nuxt/components/template-studio/ModeToggle.test.ts` → Deleted with component

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Separate pages instead of toggle | URL is shareable, cleaner architecture, no state sync issues |
| Vue Flow native drag events | HTML5 drag-drop conflicts with Vue Flow internal handlers |
| External store for dynamic data | Vue Flow doesn't watch node.data deeply |
| Removed "Validate Logic" button | Real-time validation (multi-rule warnings, character limits) is better UX |
| Initialize nodes in onMounted | Prevents SSR hydration mismatch |
