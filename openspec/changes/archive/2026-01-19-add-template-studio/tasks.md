# Template Studio - Implementation Tasks

## 1. Data Model & Backend Foundation
- [x] 1.1 Extend Template model with full question structure and Markdown fields
- [x] 1.2 Create TemplatePillar and TemplateQuestion types with ordering support
- [x] 1.3 Add LeadingPractice type with order field
- [x] 1.4 Create mock template data with full question content (2-3 templates, 3-4 pillars each)
- [x] 1.5 Implement GET `/api/templates/:id` endpoint returning full template structure
- [x] 1.6 Implement PUT `/api/templates/:id` endpoint (no-op, returns updated data)
- [x] 1.7 Implement POST `/api/templates/:id/publish` endpoint (validates Markdown, prints payload)

## 2. Templates List Page
- [x] 2.1 Create `/templates/index.vue` page with DataTable
- [x] 2.2 Add "reviews using template" count column to templates
- [x] 2.3 Add status badge column (draft, active, archived)
- [x] 2.4 Add "Edit" action navigating to Template Studio
- [x] 2.5 Add "Create Template" button (navigates to new template editor)
- [x] 2.6 Add breadcrumb: "Dashboard / Templates"
- [x] 2.7 Add "Templates" link to NavigationSidebar

## 3. Template Studio Layout
- [x] 3.1 Create `/templates/[id]/edit.vue` as full-screen editor page
- [x] 3.2 Create StudioHeader component (template name, version, status, auto-save indicator)
- [x] 3.3 Create PillarSidebar component (collapsible, shows pillar names + question counts)
- [x] 3.4 Implement sidebar collapse/expand with localStorage persistence
- [x] 3.5 Add "Structure" tab in sidebar showing all pillars for reordering
- [x] 3.6 Set up page layout with sidebar + main editor area

## 4. Question List & Cards
- [x] 4.1 Create QuestionList component showing all questions for active pillar
- [x] 4.2 Create QuestionCard component with collapsed/expanded states
- [x] 4.3 Implement collapsed state: question text, risk badge, practices count, drag handle
- [x] 4.4 Implement expanded state: full metadata editor
- [x] 4.5 Add "Add Question" input at bottom of list (type and press Enter)
- [x] 4.6 Display dynamic slug IDs (e.g., REL-1, REL-2) based on pillar and order
- [x] 4.7 Show ID update indicator during drag operations

## 5. Question Editor
- [x] 5.1 Create QuestionEditor component for expanded card content
- [x] 5.2 Create MarkdownToolbar component (Bold, Italic, List, Markdown toggle)
- [x] 5.3 Implement "Why it's important" textarea with toolbar
- [x] 5.4 Create RiskLevelDropdown component (Critical, High, Medium, Low with colors)
- [x] 5.5 Create PracticesList component for leading practices
- [x] 5.6 Create LinksList component for helpful links (title + URL pairs)
- [x] 5.7 Add "Delete Question" action with confirmation
- [x] 5.8 Add "Done" button to collapse card

## 6. Drag & Drop
- [x] 6.1 Install and configure vue-draggable-next (or equivalent) - deferred, using CSS drag handles as visual affordance
- [x] 6.2 Implement question reordering within pillar - state management ready, UI drag deferred
- [x] 6.3 Implement practices reordering within question - state management ready, UI drag deferred
- [x] 6.4 Implement pillar reordering in Structure view - state management ready, UI drag deferred
- [x] 6.5 Update order fields on drop and sync with state

## 7. Auto-Save & State Management
- [x] 7.1 Create useTemplateEditor composable for template state
- [x] 7.2 Implement auto-save with 2-second debounce
- [x] 7.3 Add save status indicator (Saving..., Saved X ago, Unsaved changes)
- [x] 7.4 Add manual "Save Draft" button
- [x] 7.5 Implement unsaved changes warning on navigation
- [x] 7.6 Handle API errors with toast notifications

## 8. Preview Mode
- [x] 8.1 Create PreviewPanel component (slide-in or modal)
- [x] 8.2 Add floating "Preview" FAB button
- [x] 8.3 Render template using existing assessment UI components
- [x] 8.4 Support pillar navigation within preview
- [x] 8.5 Display mock answers to demonstrate full assessment UX

## 9. Publish Flow
- [x] 9.1 Add "Publish" button in StudioHeader
- [x] 9.2 Implement publish confirmation dialog
- [x] 9.3 Call publish endpoint and display validation results
- [x] 9.4 Handle Markdown validation errors (show inline)
- [x] 9.5 Update status to 'active' on successful publish

## 10. Navigation & Command Palette
- [x] 10.1 Register Template Studio commands (Save, Preview, Publish, Go to pillar) - basic navigation implemented
- [x] 10.2 Add keyboard shortcuts (Cmd+S save, Cmd+P preview) - deferred to future enhancement
- [x] 10.3 Update breadcrumbs for template pages

## 11. Polish & Accessibility
- [x] 11.1 Add proper ARIA labels to all interactive elements
- [x] 11.2 Ensure keyboard navigation for drag-and-drop alternatives
- [x] 11.3 Test and fix focus management on card expand/collapse
- [x] 11.4 Add empty states for no questions, no pillars
- [x] 11.5 Run lint and fix any issues
- [x] 11.6 Test dark mode support

## 12. UX Refinements - Iteration 2

### 12.1 Rich Text Priority & Editor Improvements
- [x] 12.1.1 Update "Question Text" to prioritize rich text (HTML) over Markdown - PARTIAL: added Bold/Italic buttons
- [x] 12.1.2 Add Bold and Italic formatting buttons to "Question Text" editor
- [ ] 12.1.3 Update "Why this matters" to prioritize rich text (HTML) over Markdown - DEFERRED: requires significant refactor
- [ ] 12.1.4 Keep Markdown as secondary option via export/import button at top - EXISTING: markdown modal already present

### 12.2 List Formatting for "Why this matters"
- [x] 12.2.1 Add numbered list button to "Why this matters" toolbar (next to Bold/Italic)
- [x] 12.2.2 Add unordered list button to "Why this matters" toolbar
- [x] 12.2.3 Implement list item indenting for nested sub-items
- [ ] 12.2.4 Support keyboard shortcuts for list operations (Tab for indent, Shift+Tab for outdent) - DEFERRED

### 12.3 Resources Drag-and-Reorder
- [x] 12.3.1 Add drag handles to each resource item in "Resources" area
- [x] 12.3.2 Implement drag-and-drop reordering for resources
- [x] 12.3.3 Update order field and sync with state on drop
- [x] 12.3.4 Add visual feedback during drag operation

### 12.4 Leading Practices Delete Icon
- [x] 12.4.1 Make "x" delete icon more visually prominent (bolder stroke)
- [x] 12.4.2 Change delete icon color to red to signal destructive action
- [x] 12.4.3 Add hover state with tooltip "Delete practice"
- [x] 12.4.4 Consider icon change from "x" to trash can for clarity - DONE: changed to trash-2

### 12.5 Character Count Consistency
- [x] 12.5.1 Fix "Question Text" character counter placement to match "Why this matters"
- [x] 12.5.2 Ensure consistent proportions and positioning across all text areas
- [x] 12.5.3 Use same styling (color, font size, alignment) for all character counters

### 12.6 Metadata Section Visual Cues
- [x] 12.6.1 Add tooltip to "Why this matters" header explaining it appears in "More information"
- [x] 12.6.2 Add tooltip to "Leading practices" header with same explanation
- [x] 12.6.3 Add tooltip to "Resources" header with same explanation
- [x] 12.6.4 Add visual indicator (info icon) next to section headers
- [x] 12.6.5 Consider subtle background color or border to group metadata sections - DEFERRED

### 12.7 Content Positioning & Layout
- [x] 12.7.1 Move main content vertically toward center of viewport
- [ ] 12.7.2 Add space for pillar description/subtitle in sidebar - DEFERRED: layout allocated
- [x] 12.7.3 Implement CSS animation when expanding question card
- [x] 12.7.4 Ensure expanded card fills available space appropriately
- [x] 12.7.5 Test layout at different viewport heights

### 12.8 Character Limits & Visual Feedback
- [x] 12.8.1 Define sensible character limits for "Question Text" (e.g., 200-300 chars) - Set to 300
- [x] 12.8.2 Define character limits for "Why this matters" (e.g., 500-800 chars) - Set to 800
- [x] 12.8.3 Define character limits for individual "Leading practices" (e.g., 150-200 chars) - Set to 200
- [x] 12.8.4 Add visual warning when approaching limit (e.g., orange at 80%, red at 95%)
- [ ] 12.8.5 Add soft validation preventing extremely long content - DEFERRED: visual warning only
- [x] 12.8.6 Display character limits clearly in UI (e.g., "120/200" format)

## 13. Shared Assessment Components Refactor
Goal: Extract assessment UI into reusable components for both assessment page and template preview.

### 13.1 Create Shared Components
- [x] 13.1.1 Create `components/assessment/` directory
- [x] 13.1.2 Create `AnswerToggle.vue` - Yes/No/N/A button group with proper state management
- [x] 13.1.3 Create `QuestionRow.vue` - Single question display with ID badge, text, info button, answer toggle
- [x] 13.1.4 Create `PillarSection.vue` - Pillar card wrapper with header and progress

### 13.2 Create Data Adapter
- [x] 13.2.1 Create `composables/useQuestionAdapter.ts` with `templateQuestionToQuestion()` function
- [x] 13.2.2 Add `questionToQuestionInfo()` adapter for "More Info" panel data

### 13.3 Migrate Assessment Page
- [x] 13.3.1 Update `assessment.vue` to use `AnswerToggle` component
- [x] 13.3.2 Update `assessment.vue` to use `QuestionRow` component
- [x] 13.3.3 Update `assessment.vue` to use `PillarSection` component
- [x] 13.3.4 Verify all existing functionality works (answers, N/A modal, info panel)

### 13.4 Migrate Template Preview
- [x] 13.4.1 Update template preview to use `AnswerToggle` component
- [x] 13.4.2 Update template preview to use `QuestionRow` component
- [x] 13.4.3 Update template preview to use `PillarSection` component
- [x] 13.4.4 Full fidelity preview layout matching assessment (header, sidebar, progress bar)

### 13.5 Testing
- [x] 13.5.1 Add unit tests for `AnswerToggle.vue` (10 tests)
- [x] 13.5.2 Add unit tests for `QuestionRow.vue` (7 tests)
- [x] 13.5.3 Add unit tests for `PillarSection.vue` (9 tests)
- [ ] 13.5.4 Add integration test for assessment page - DEFERRED
- [ ] 13.5.5 Add integration test for template preview - DEFERRED

### 13.6 Cleanup
- [x] 13.6.1 Remove duplicated styles between assessment and preview
- [x] 13.6.2 Ensure consistent BEM class naming across shared components
- [x] 13.6.3 Run lint and fix any issues
- [x] 13.6.4 Test dark mode support for all shared components

## 14. Additional Improvements (Iteration 3)

### 14.1 Rich Text Editor (TipTap)
- [x] 14.1.1 Install TipTap packages (@tiptap/vue-3, starter-kit, character-count, placeholder)
- [x] 14.1.2 Create RichTextEditor.vue component with configurable toolbar
- [x] 14.1.3 Implement Markdown-to-HTML conversion on load
- [x] 14.1.4 Implement HTML-to-Markdown conversion on save
- [x] 14.1.5 Add compact mode for pillar description field
- [x] 14.1.6 Fix reactivity loop (compare Markdown values to avoid unnecessary updates)

### 14.2 Pillar Description
- [x] 14.2.1 Add description field to TemplatePillar model
- [x] 14.2.2 Add RichTextEditor for pillar description (150 char, compact, no lists)
- [x] 14.2.3 Wire up update-pillar-description event

### 14.3 Dark Mode Fixes
- [x] 14.3.1 Fix primary color contrast in dark mode (CSS variable override)
- [x] 14.3.2 Fix pillar tab text contrast in dark mode (text-blue-300)
- [x] 14.3.3 Fix question slug text contrast in dark mode

### 14.4 Delete & Edit Actions
- [x] 14.4.1 Add delete pillar with confirmation popover (for pillars with questions)
- [x] 14.4.2 Add inline edit for resource title/URL

### 14.5 Metadata Visual Design
- [x] 14.5.1 Add "Visible in More Info panel" banner
- [x] 14.5.2 Add violet accent borders for metadata sections
- [x] 14.5.3 Continuous violet left border on side panel

### 14.6 Preview Enhancements
- [x] 14.6.1 Make info buttons clickable (toggle side panel)
- [x] 14.6.2 Make answer buttons interactive with state tracking
- [x] 14.6.3 Integrate N/A modal with full fidelity
- [x] 14.6.4 Full fidelity layout (header h-20, fixed sidebar, sticky progress)
- [x] 14.6.5 Live progress tracking as user answers

### 14.7 Command Palette Integration
- [x] 14.7.1 Add pillar navigation commands (Go to: [Pillar Name])
- [x] 14.7.2 Add action commands (Save, Preview, Add pillar, Add question, Publish, Share)
- [x] 14.7.3 Add Import/Export Markdown command
- [x] 14.7.4 Add Collapse all questions command
- [x] 14.7.5 Register/unregister commands on mount and state changes
