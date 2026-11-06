## Why

Frontend expert UX review identified 11 issues in Template Studio - bugs preventing core functionality, usability friction, and missing affordances that impact template author experience. These issues affect both new users (99% creating templates for first time) and power users.

## What Changes

- **BUG FIX**: N/A button in Preview mode fails due to modal-within-modal conflict - switch NAReasonModal to USlideover
- **BUG FIX**: Info panel `(i)` icon positioning broken in Preview - reuse MoreInfoPanel instead of inline implementation
- **BUG FIX**: NA modal close clears `currentQuestion` before animation completes - fix close order
- **BUG FIX**: Input truncates silently on character limit exceed - show validation error instead
- Make delete pillar button always visible (currently hover-only)
- Add create pillar modal with collapsible mental model diagram (pyramid showing pillar progression)
- Save diagram collapse preference for returning users
- Enlarge add-question input cursor hit area
- Pre-populate new questions with one Leading Practice and one Resource example
- Remove Bold/Italic formatting from question text field
- Convert question text to single-row auto-expanding input
- Increase "Why This Matters" character limit from 500 to 1000
- Ensure "Why This Matters" field auto-expands with content

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

- `template-studio`: UX behavior changes for pillar creation flow, question editing, preview mode, and input validation

## Impact

- `app/pages/templates/[id]/edit.vue` - Preview mode N/A and info panel fixes, pillar creation modal
- `app/components/template-studio/PillarTabs.vue` - Always-visible delete button
- `app/components/template-studio/QuestionCard.vue` - Input validation, character limits, field formatting
- `app/components/template-studio/QuestionList.vue` - Enlarged cursor area for add question
- `app/components/template-studio/RichTextEditor.vue` - Remove Bold/Italic, auto-expand behavior
- `app/composables/useNAModal.ts` - Fix close order bug
- `app/components/NAReasonModal.vue` - Convert to USlideover variant for preview context
- User preferences storage (localStorage/cookie) for pillar diagram collapse state
