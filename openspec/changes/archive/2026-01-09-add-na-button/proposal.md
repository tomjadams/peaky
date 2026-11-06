# Change: Add Not Applicable (N/A) Button with Reason Selection

## Why
Users need the ability to mark questions as "Not Applicable" when a question doesn't apply to their specific context, infrastructure, or operational model. Currently, the only options are Yes/No, which forces users to either skip questions without context or provide inaccurate answers. Capturing N/A responses with justification provides valuable audit trail and helps understand why certain checks were deemed irrelevant.

## What Changes
- Add a third "N/A" button to the existing Yes/No answer toggle in both dashboard and survey views
- Implement a modal dialog that appears when N/A is clicked, requiring users to select a reason
- Provide predefined reason options: "Not in scope", "Handled by infrastructure", "Legacy System", "Pending Deprecation", "Other"
- Include an optional text area for additional details (up to 200 characters)
- Update the answer data model to support N/A responses with reason and optional comment
- Ensure N/A questions count as "answered" in progress calculations
- Add visual styling to distinguish N/A state from Yes/No answers

## Impact
- **Affected specs**: `layout`
- **Affected code**: 
  - `app/pages/index.vue` - Dashboard view answer buttons
  - `app/pages/survey.vue` - Survey view answer buttons
  - `app/models/question.ts` - Answer type definitions
  - `app/components/` - New N/A modal component
  - `server/data/questions.ts` - Answer data structure
  - Database schema (future migration for persistence)
