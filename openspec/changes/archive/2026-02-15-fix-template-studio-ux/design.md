## Context

Template Studio is the primary interface for template authors (99% first-time users) to create Peaky templates. A frontend expert UX review identified 11 issues spanning bugs, usability friction, and missing affordances.

Current state:
- Preview mode uses `NAReasonModal` (UModal) inside a full-screen modal - causing modal-in-modal failure
- Preview mode has inline info panel implementation instead of reusing `MoreInfoPanel` (USlideover)
- `useNAModal.closeModal()` clears `currentQuestion` immediately, breaking any code accessing it during close animation
- Delete pillar button only visible on hover - discoverability issue
- No onboarding for pillar mental model - users don't understand pillar progression concept
- Input fields silently truncate text instead of showing validation errors
- Question text field has Bold/Italic formatting (unnecessary complexity)
- "Why This Matters" limited to 500 chars (too restrictive)

## Goals / Non-Goals

**Goals:**
- Fix all 4 bugs identified in review (N/A modal, info panel, close order, input truncation)
- Improve discoverability of pillar management actions
- Reduce cognitive load for first-time template authors with guided pillar creation
- Simplify question editing by removing unnecessary formatting options
- Provide better character limit UX with validation feedback

**Non-Goals:**
- Redesigning the overall Template Studio layout
- Adding new template features (versioning, collaboration, etc.)
- Changing the template data model or API contracts
- Visual regression testing infrastructure (separate initiative)

## Decisions

### Decision 1: Use USlideover for N/A in Preview Mode

**Choice**: Extract form content into `NAReasonForm.vue`, compose with `UModal` or `USlideover` depending on context.

**Rationale**: UModal stacking is problematic in NuxtUI. USlideover slides from the side and doesn't conflict with the existing full-screen Preview modal. Extracting the form avoids conditional rendering complexity inside one component.

**Alternatives considered**:
- Close Preview before opening NA modal - disrupts user flow, loses preview context
- Add `variant` prop to NAReasonModal - leads to messy conditional rendering inside component
- Inline NA form in preview - requires significant UI redesign, inconsistent with assessment page

**Implementation**: 
- Extract `NAReasonForm.vue` with reason selection and comment fields
- Use `URadioGroup` for reason selection (cleaner than custom button pills)
- `NAReasonModal.vue` = `UModal` + `NAReasonForm`
- Preview mode uses `USlideover` + `NAReasonForm` directly

### Decision 2: Reuse MoreInfoPanel in Preview Mode

**Choice**: Replace inline `previewInfoQuestion` implementation with `useQuestionInfo()` + `MoreInfoPanel`.

**Rationale**: Assessment page already uses this pattern and it works. DRY principle - no need to maintain two info panel implementations.

**Implementation**: Remove inline aside in Preview, call `openQuestionInfo()` with adapted question data using `templateQuestionToQuestionInfo()`.

### Decision 3: Fix NA Modal Close Order

**Choice**: Delay clearing `currentQuestion` until after modal close animation completes.

**Rationale**: Current implementation clears state immediately, but confirm handlers and animations may still need access to `currentQuestion`.

**Implementation**: In `closeModal()`, set `isOpen = false` first, then use `setTimeout` or `watch` on `isOpen` to clear `currentQuestion` after ~300ms (animation duration).

### Decision 4: Validation Instead of Truncation

**Choice**: Replace `limitText()` truncation with validation state that shows error message when limit exceeded.

**Rationale**: Silent truncation is surprising behavior - users don't know content was lost. Validation error is standard UX pattern.

**Implementation**: 
- Add `error` state to input components
- On input, check length against limit
- If exceeded, set error state and show message like "Maximum 120 characters"
- Don't modify the input value - let user see and fix

### Decision 5: Pillar Creation Modal with Mental Model

**Choice**: Replace inline pillar name input with modal containing:
1. Collapsible pyramid diagram showing pillar progression (using `UCollapsible`)
2. Name and description fields
3. Collapse preference saved to localStorage

**Rationale**: 99% of users are first-time template authors who don't understand the pillar mental model. The pyramid visualization (Operations → Security → Reliability → Clarity) helps them structure templates effectively.

**Diagram content**:
```
        ┌───────────┐
        │  Clarity  │  ← Customer focus, onboarding
      ┌─┴───────────┴─┐
      │  Reliability  │  ← Testing, resilience, monitoring
    ┌─┴───────────────┴─┐
    │     Security      │  ← Secure by design, data protection, compliance
  ┌─┴───────────────────┴─┐
  │      Operations       │  ← Deployment, observability, processes
  └───────────────────────┘
```

**Implementation**: 
- New `PillarCreateModal.vue` component
- Use `UCollapsible` for the "How pillars work" section
- Use `useOverlay` to open modal programmatically from `PillarTabs.vue`
- Store collapse preference with VueUse `useLocalStorage('orr:pillar-diagram-collapsed', false)`

### Decision 6: Question Field Simplification

**Choice**: 
- Remove Bold/Italic from question text RichTextEditor
- Convert to single-row input that auto-expands when text overflows
- Keep 120 char limit

**Rationale**: Frontend expert feedback - formatting adds complexity without value for question text. Auto-expand gives clean single-line default while accommodating longer questions.

**Implementation**: Replace RichTextEditor with NuxtUI `UTextarea` using `autoresize` prop and `:rows="1"` for single-row default that expands.

### Decision 7: Pre-populate Practices and Resources

**Choice**: When creating a new question, auto-add:
- One Leading Practice: "Run regular customers pain point review"
- One Resource: "Knowledge Hub" → "https://www.adyen.com/knowledge-hub"

**Rationale**: Reduces cognitive load - authors see examples of expected content format and length immediately.

**Implementation**: In `addQuestion()` handler, include default practice and link in the new question object.

## Risks / Trade-offs

**[Risk] USlideover z-index conflicts with Preview modal** → Test thoroughly; may need explicit z-index adjustment on slideover.

**[Risk] localStorage not available in SSR** → Use `useLocalStorage` from VueUse which is SSR-safe out of the box.

**[Risk] Auto-expand input may cause layout shifts** → Use NuxtUI `UTextarea` with `autoresize` prop which handles this gracefully.

**[Trade-off] Modal for pillar creation adds a click** → Acceptable because onboarding value outweighs friction, and collapse preference means power users see minimal UI after first use.

**[Trade-off] Pre-populated content may feel presumptuous** → Content is clearly example-style; users can easily edit or delete.
