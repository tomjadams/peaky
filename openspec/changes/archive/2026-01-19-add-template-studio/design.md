# Template Studio - Design Document

## Context
Template authoring requires a focused, distraction-free environment where authors can spend extended time (1+ hours) crafting questions, defining their importance, and organizing content. The UI must balance space efficiency with usability, allowing quick navigation while maximizing the editing area.

## Goals
- Provide a "Wow" experience for template authors
- Enable comfortable, long-session authoring with minimal distractions
- Support Markdown storage while limiting formatting options for consistency
- Allow flexible organization through drag-and-drop reordering
- Preview templates exactly as they'll appear in assessments
- Prepare for future analytics (template usage, adoption metrics)

## Non-Goals
- Real-time collaboration (future consideration)
- Template versioning with full diff history (MVP shows only current version)
- Advanced Markdown features (tables, code blocks) - limited to basic formatting

## Architecture Decisions

### 1. Layout Structure
**Decision**: Use a collapsible left sidebar for pillar navigation, maximizing editor space.

The sidebar will:
- Show pillar names with question counts
- Collapse to icons only (similar to TemplateSelectorSidebar)
- Highlight active pillar
- Support drag-and-drop pillar reordering

**Alternative considered**: Top tab navigation (as in the HTML sketch)
- Rejected: Takes vertical space, limits pillar count visibility, harder to reorder

### 2. Question Editor Design
**Decision**: Expandable card pattern with inline editing.

Each question card:
- **Collapsed state**: Shows question text, risk badge, practices count, drag handle
- **Expanded state**: Full editor with all metadata fields

This allows:
- Quick overview when collapsed (scan all questions)
- Deep editing when expanded (focus on one question)
- Easy reordering via drag handles

### 3. Rich Text Handling (Updated)
**Decision**: Prioritize rich text (HTML) over Markdown, with Markdown as secondary export/import option.

- Primary editing mode: Rich text with visual formatting (Bold, Italic, Lists)
- Toolbar provides direct HTML formatting controls
- Markdown available via export/import modal (for power users or external editing)
- Backend stores Markdown content (converted from HTML on save)
- Frontend converts Markdown to HTML on load for editing

**Implementation** (TipTap):
- Using TipTap (@tiptap/vue-3) with starter-kit, character-count, placeholder extensions
- RichTextEditor.vue component with configurable toolbar and character limits
- Question Text: Bold, Italic formatting (no lists)
- Why This Matters: Bold, Italic, Numbered List, Unordered List buttons
- Pillar Description: Bold, Italic only, compact mode (36px height)
- Markdown ↔ HTML conversion using marked (parse) and turndown (serialize)
- Reactivity handled by comparing Markdown values to avoid update loops
- No complex WYSIWYG features (tables, images, code blocks)

### 4. Slug ID Generation
**Decision**: Auto-generate slugs based on pillar prefix and question order.

Format: `{PILLAR_SLUG}-{ORDER}` (e.g., REL-1, SEC-2)

- IDs update automatically when questions are reordered
- Visual indicator shows "IDs will update" during drag operation
- Backend stores order, frontend computes display IDs

### 5. Preview Mode
**Decision**: Full-screen modal with exact assessment layout fidelity.

- Uses shared assessment components (AssessmentPillarSection, AssessmentQuestionRow)
- Full fidelity layout matching actual assessment:
  - Header (h-20) with "Preview Mode" badge
  - Fixed sidebar (left-0, top-20, w-64) with pillar navigation
  - Main content with same padding/margins (pl-72, max-w-5xl)
  - Sticky progress bar with live tracking
- Interactive elements work exactly like real assessment:
  - Yes/No/N/A buttons clickable with state tracking
  - Info buttons toggle side panel
  - N/A modal opens with full workflow
- Progress updates live as user answers questions
- Preview button in header toolbar (also via Cmd+K command palette)

### 6. Auto-Save
**Decision**: Auto-save with debounce (2 seconds after last change).

- Visual indicator: "Saving...", "Saved 2 mins ago", "Unsaved changes"
- Manual "Save Draft" button for explicit saves
- No data loss on accidental navigation (prompt if unsaved)

### 7. Template Status Flow
```
DRAFT → PUBLISHED
  ↓
ARCHIVED
```

- New templates start as DRAFT
- Publish validates Markdown and promotes to PUBLISHED
- PUBLISHED templates can be cloned for new versions (future)
- ARCHIVED templates are hidden from active selection

### 8. Character Limits & Visual Feedback
**Decision**: Implement sensible character limits with progressive visual warnings.

Character Limits:
- Question Text: 200-300 characters
- Why This Matters: 500-800 characters
- Leading Practices (individual): 150-200 characters

Visual Feedback:
- Display format: "120/200" next to or below input
- Warning at 80%: Counter turns orange
- Warning at 95%: Counter turns red
- Soft validation prevents extremely long content
- Consistent placement across all text areas (aligned with "Why this matters" pattern)

**Rationale**: Prevents essays and maintains readability in customer-facing assessment views.

### 9. Metadata Section Discoverability
**Decision**: Add visual cues to help users understand metadata sections appear in "More information".

Implementation:
- Info icon (ⓘ) next to section headers: "Why this matters", "Leading practices", "Resources"
- Tooltip on hover: "This content appears when customers click 'More information' on the question"
- Optional: Subtle background color or border to visually group metadata sections
- Consistent styling helps distinguish editable metadata from main question content

### 10. Layout & Positioning Refinements
**Decision**: Center content vertically and use animations for better UX.

Changes:
- Move main content toward vertical center of viewport (not anchored at top)
- Add space for pillar descriptions/subtitles in sidebar
- CSS animation when expanding question card (smooth transition, fills available space)
- Ensure comfortable editing position (content "in front of user", not high up)

**Rationale**: Reduces eye strain during long editing sessions, makes better use of available screen space.

### 11. Drag-and-Drop Completeness
**Decision**: Ensure all reorderable lists support drag-and-drop.

Lists requiring drag support:
- Questions within pillar (existing)
- Leading practices within question (existing)
- **Resources/Helpful links within question** (new requirement)
- Pillars in Structure view (existing)

Visual affordances:
- Drag handle icon visible on hover
- Visual feedback during drag (ghost element, drop zone highlight)
- Update order immediately on drop

### 12. Delete Action Clarity
**Decision**: Make delete actions more visually distinct to avoid confusion.

Leading Practices delete icon:
- Change from subtle "×" to bold red trash can icon
- Tooltip: "Delete practice"
- Hover state: Slightly larger, brighter red
- Clear visual distinction from "clear input field" action

**Rationale**: Users might think "×" clears the field rather than deletes the entire practice.

### 13. Shared Assessment Components
**Decision**: Extract assessment UI into reusable components for both assessment page and template preview.

Components created in `components/assessment/`:
- `AnswerToggle.vue` - Yes/No/N/A button group with proper state and accessibility
- `QuestionRow.vue` - Single question with ID badge, text, info button, answer toggle
- `PillarSection.vue` - Pillar card wrapper with header and progress badge

Data adapter in `composables/useQuestionAdapter.ts`:
- `templateQuestionToQuestion()` - Converts TemplateQuestion to Question format
- `questionToQuestionInfo()` - Converts Question to QuestionInfo for "More Info" panel
- `templateQuestionToQuestionInfo()` - Direct template-to-info conversion

**Benefits**:
- Single source of truth for assessment UI behavior
- Preview matches actual assessment exactly (full fidelity)
- Components tested in isolation (26 unit tests with @testing-library/vue)
- Changes propagate automatically to both contexts

### 14. Command Palette Integration
**Decision**: Register template studio-specific commands for quick access via Cmd+K.

Navigation commands:
- "Go to: [Pillar Name]" - Jump to any pillar (dynamically generated)

Action commands:
- Save template (disabled when no changes)
- Preview template
- Add new pillar (triggers inline add flow)
- Add new question (focuses add question input)
- Publish template
- Share template
- Import / Export Markdown
- Collapse all questions

Commands are registered on mount and re-registered when template or state changes.

## Data Model Extensions

### Template (Enhanced)
```typescript
interface Template {
  id: string
  name: string
  version: string
  status: 'draft' | 'active' | 'archived'
  description: string
  pillars: TemplatePillar[]
  createdAt: string
  updatedAt: string
  publishedAt?: string
  // Analytics (future)
  stats?: {
    reviewsCount: number
    applicationsCount: number
    organizationsCount: number
  }
}

interface TemplatePillar {
  slug: string
  name: string
  description?: string  // Brief description (Markdown), displayed in pillar header
  order: number
  questions: TemplateQuestion[]
}

interface TemplateQuestion {
  id: string
  order: number
  text: string  // Rich text (HTML)
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  importance: string  // Rich text (HTML) - "Why it's important"
  leadingPractices: LeadingPractice[]
  helpfulLinks: HelpfulLink[]
}

interface LeadingPractice {
  id: string
  order: number
  text: string  // Rich text (HTML)
}

interface HelpfulLink {
  title: string
  url: string
}
```

## Component Structure

```
pages/
  templates/
    index.vue           # Templates list page
    [id]/
      edit.vue          # Template Studio page
  applications/
    [appId]/
      reviews/
        [reviewId]/
          assessment.vue  # Uses shared assessment components

components/
  # Shared Assessment Components (used by both assessment and preview)
  assessment/
    QuestionRow.vue         # Single question with answer buttons, info button
    AnswerToggle.vue        # Yes/No/N/A button group with state
    QuestionInfoButton.vue  # Info button that opens side panel
    PillarSection.vue       # Pillar card with questions list
    ProgressBar.vue         # Overall/pillar progress indicator

  # Existing shared components
  MoreInfoPanel.vue         # Side panel for question details (already exists)
  NAReasonModal.vue         # N/A reason selection modal (already exists)

  # Template Studio specific
  template-studio/
    Header.vue              # Template name, status, save actions
    PillarTabs.vue          # Pillar tab navigation
    QuestionList.vue        # List of question cards (editing mode)
    QuestionCard.vue        # Expandable question editor
    RichTextEditor.vue      # TipTap-based rich text editor
    PracticesList.vue       # Draggable practices
    LinksList.vue           # Helpful links editor
    RiskLevelDropdown.vue   # Risk level selector
    PreviewPanel.vue        # Template preview (uses shared assessment components)
    ShareModal.vue          # Share template modal
    MarkdownModal.vue       # Import/export markdown

composables/
  useQuestionInfo.ts        # Shared: manages "More Info" panel state
  useNAModal.ts             # Shared: manages N/A reason modal state
  useTemplateEditor.ts      # Template Studio: editor state management
  useReviewData.ts          # Assessment: review data fetching
  useReviewQuestions.ts     # Assessment: questions data fetching
```

### 13. Shared Assessment Components Refactor

**Goal**: Extract assessment UI into reusable components that both the real assessment page and template preview can use, ensuring full fidelity and maintainability.

**Rationale**:
- Single source of truth for assessment UI behavior
- Preview automatically stays in sync with assessment changes
- Easier to test individual components in isolation
- Reduces code duplication between assessment.vue and edit.vue preview

#### 13.1 Component Extraction Plan

**QuestionRow.vue** - The core question display component
```typescript
interface Props {
  questionId: string
  questionText: string
  answer: QuestionAnswer | null
  isNADisabled?: boolean  // For N/A visual treatment
}

interface Emits {
  (e: 'answer', value: QuestionAnswer): void
  (e: 'info-click'): void
}
```

**AnswerToggle.vue** - Yes/No/N/A button group
```typescript
interface Props {
  modelValue: QuestionAnswer | null
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: QuestionAnswer): void
  (e: 'na-click'): void  // Special handling for N/A (opens modal)
}
```

**PillarSection.vue** - Pillar card wrapper
```typescript
interface Props {
  pillarName: string
  pillarSlug: string
  progress: number
  answeredCount: number
  totalCount: number
}

interface Slots {
  default: () => VNode[]  // Questions go here
}
```

#### 13.2 Data Adapter Pattern

Since `TemplateQuestion` and `Question` have different shapes, create adapters:

```typescript
// composables/useQuestionAdapter.ts
export function templateQuestionToQuestion(
  templateQuestion: TemplateQuestion,
  pillarSlug: string,
  answer?: QuestionAnswer
): Question {
  return {
    id: templateQuestion.id,
    pillar: pillarSlug,
    text: templateQuestion.text,
    type: 'yes-no',
    answer: answer || null,
    importance: templateQuestion.importance,
    leadingPractices: templateQuestion.leadingPractices.map(p => p.text),
    helpfulLinks: templateQuestion.helpfulLinks,
  }
}
```

#### 13.3 Migration Strategy

1. **Phase 1**: Create shared components alongside existing code
2. **Phase 2**: Update assessment.vue to use shared components
3. **Phase 3**: Update template preview to use shared components
4. **Phase 4**: Remove duplicated code from both pages

#### 13.4 Testing Strategy

Each shared component should have:
- Unit tests for props/emits behavior
- Visual regression tests (optional, via Storybook)
- Accessibility tests (keyboard navigation, ARIA)

Example test structure:
```
tests/
  components/
    assessment/
      QuestionRow.test.ts
      AnswerToggle.test.ts
      PillarSection.test.ts
```

## API Design

### Templates List
```
GET /api/templates
Response: { templates: Template[] }
```

### Template Detail (for editing)
```
GET /api/templates/:id
Response: Template (with full pillars and questions)
```

### Update Template
```
PUT /api/templates/:id
Body: { name, description, status, pillars }
Response: Template
```

### Publish Template
```
POST /api/templates/:id/publish
Response: { success: boolean, errors?: string[] }
- Validates all HTML fields are safe (sanitization, XSS prevention)
- Validates character limits are respected
- Changes status to 'active'
- No-op in MVP (just prints payload)
```

### Template Stats (future-ready)
```
GET /api/templates/:id/stats
Response: { reviewsCount, applicationsCount, organizationsCount }
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| HTML/XSS injection | Sanitize on render and validate on publish |
| Data loss during editing | Auto-save + unsaved changes prompt |
| Complex drag-and-drop | Use proven library or native HTML5 drag API |
| Performance with many questions | Virtual scrolling if >50 questions |
| Users writing essays | Character limits with visual warnings |
| Confusion about metadata sections | Tooltips and info icons for context |

## Open Questions
1. Should we support template cloning for new versions? (Defer to future)
2. Should previews show mock assessment data or be empty? (Show mock data)
3. ~~Maximum character limits for Markdown fields?~~ **Resolved**: Question Text: 200-300, Why This Matters: 500-800, Leading Practices: 150-200
4. Should we allow Markdown import/export for bulk editing? (Yes, via top-level button)
5. What rich text editor library should we use? (Consider: Tiptap, ProseMirror, or native contenteditable)
6. Should pillar descriptions be part of this iteration or deferred? (Include space in layout, defer implementation)
7. What specific CSS animation should be used for card expansion? (To be defined during implementation)

## Future Considerations (Deferred)

These features require deeper design work around versioning strategy and are deferred until after the History/Lineage feature is implemented.

### Template Versioning & Publishing

**Current State (MVP)**:
- `Publish` action exists in UI but backend is a no-op
- Version number not displayed in Template Studio
- Markdown export/import works but isn't fully documented

**Deferred Decisions**:

1. **Version Bump Strategy**
   - What constitutes a minor bump vs major bump?
   - Proposed heuristic (needs validation):
     - **Minor**: Metadata changes (importance, practices, links, pillar descriptions)
     - **Major**: Question text changes, question ID changes, pillar restructuring
   - Impact: Major bumps may affect in-progress reviews and historical reports

2. **Backwards Compatibility**
   - Changing question text affects historical reports unless we snapshot
   - Question ID changes break continuity tracking
   - Need to decide: Live updates vs point-in-time snapshots for reports

3. **Snapshot Strategy** (preferred direction)
   - Reports should capture template state at assessment completion time
   - Allows template evolution without breaking historical data
   - Requires: History/Lineage feature to track template versions used per review

4. **Publish Workflow**
   - Validation rules before publishing (all questions have importance, etc.)
   - Draft vs Published state transitions
   - Rollback capability for published templates

5. **Version Display in UI**
   - Show current version in Template Studio header
   - Version history panel (after History/Lineage feature)
   - Diff view between versions

### Markdown Documentation

The Markdown export/import feature needs documentation for:
- Expected format and structure
- Supported Markdown syntax
- How pillar/question ordering is preserved
- Error handling for malformed imports

### Related Feature Dependencies

These features should be implemented after **History/Lineage** feature:
- Template version history with diff view
- "Used in N reviews" with version breakdown
- Template cloning for new major versions
- Migration path for active reviews when template is updated
