# Design: N/A Button with Reason Modal

## Context
The ORR application currently supports binary Yes/No answers for assessment questions. However, many questions may not apply to specific infrastructure setups, operational models, or organizational contexts. Without a way to mark questions as "Not Applicable" with justification, users either skip questions (losing progress tracking) or provide inaccurate answers.

A prototype has been created (`na.html`) demonstrating the desired UX pattern with a modal-based reason selection flow.

## Goals / Non-Goals

### Goals
- Allow users to mark questions as N/A with required justification
- Provide quick-select predefined reasons for common scenarios
- Support optional additional context via text input
- Maintain audit trail of why questions were marked N/A
- Count N/A answers as "completed" in progress tracking
- Ensure consistent UX across dashboard and survey views

### Non-Goals
- Backend persistence (will be handled separately)
- Database schema migration (future work)
- Reporting/analytics on N/A patterns (future enhancement)
- Bulk N/A operations (one question at a time for now)

## Decisions

### Decision 1: Modal vs Dropdown
**Choice**: Modal dialog
**Rationale**: 
- Provides dedicated space for reason selection and comment input
- Prevents accidental N/A marking (requires explicit confirmation)
- Better accessibility for screen readers
- Matches prototype design provided by user
- Allows for future expansion (e.g., more reasons, longer comments)

**Alternatives considered**:
- Inline dropdown: Too cramped for multiple reasons + comment field
- Popover: Would require complex positioning logic and may be cut off

### Decision 2: Required Reason Selection
**Choice**: Reason selection is mandatory, comment is optional
**Rationale**:
- Ensures audit trail exists for all N/A decisions
- Quick-select buttons make it easy to provide reason
- Optional comment allows flexibility for edge cases
- Aligns with compliance/auditing needs

### Decision 3: Predefined Reason Options
**Choice**: Five predefined reasons: "Not in scope", "Handled by infrastructure", "Legacy System", "Pending Deprecation", "Other"
**Rationale**:
- Based on common ORR scenarios from domain knowledge
- "Other" provides escape hatch for edge cases
- Small enough set to avoid decision paralysis
- Can be expanded in future based on usage patterns

### Decision 4: Answer State Model
**Choice**: N/A is a distinct answer value (`'na'`) with associated metadata
**Rationale**:
- Clear separation from Yes/No answers
- Allows storing reason/comment alongside answer
- Simplifies progress calculation logic
- Enables future filtering/reporting by N/A reason

**Data structure**:
```typescript
type QuestionAnswer = 'yes' | 'no' | 'na' | null

interface NotApplicableReason {
  reason: 'not-in-scope' | 'handled-by-infrastructure' | 'legacy-system' | 'pending-deprecation' | 'other'
  comment?: string // Optional, max 200 chars
}

interface Question {
  // ... existing fields
  answer?: QuestionAnswer
  naReason?: NotApplicableReason // Only present when answer === 'na'
}
```

### Decision 5: Visual Treatment of N/A Questions
**Choice**: Apply subtle opacity and grayscale to N/A questions (as shown in prototype)
**Rationale**:
- Provides visual feedback that question is "resolved" but differently than Yes/No
- Reduces visual clutter for completed sections
- Maintains readability while indicating different state
- Consistent with prototype design

### Decision 6: Progress Calculation
**Choice**: N/A answers count as "answered" in progress metrics
**Rationale**:
- User has made a deliberate decision about the question
- Encourages complete reviews rather than skipping questions
- Aligns with existing spec requirement (line 240 in layout/spec.md)
- Provides accurate completion percentage

## Risks / Trade-offs

### Risk 1: Users may overuse N/A
**Mitigation**: 
- Require explicit reason selection (no default)
- Modal friction prevents casual N/A marking
- Future: Add reporting to identify N/A patterns

### Risk 2: Character limit on comments may be insufficient
**Mitigation**:
- Start with 200 characters (reasonable for most cases)
- Can be increased in future if needed
- Predefined reasons handle most scenarios

### Risk 3: Modal may disrupt flow in survey mode
**Mitigation**:
- Modal is lightweight and quick to complete
- Keyboard shortcuts for common reasons (future enhancement)
- Cancel button allows easy exit

## Migration Plan

### Phase 1: Frontend Implementation (This Change)
1. Update data models
2. Create modal component
3. Add N/A button to existing views
4. Update progress calculation
5. Test across both dashboard and survey views

### Phase 2: Backend Persistence (Future)
1. Create database migration for N/A answers table
2. Implement API endpoints for saving N/A with reasons
3. Update save/load logic
4. Add validation for reason/comment fields

### Phase 3: Enhancements (Future)
1. Analytics dashboard for N/A patterns
2. Bulk N/A operations for similar questions
3. Keyboard shortcuts for reason selection
4. Export N/A justifications for audit reports

## Open Questions
None - design is based on approved prototype.
