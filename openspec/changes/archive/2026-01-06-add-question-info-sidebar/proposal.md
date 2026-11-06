# Change: Add question info icons and right sidebar functionality

## Why

Users need additional context and guidance for each question to understand why it's important, learn leading practices, and access helpful resources. This enhances the educational value and effectiveness of the Operational Readiness Review process.

## What Changes

- Add subtle information (i) icons next to each question in both survey and multi-question views
- Implement right sidebar functionality to display question-specific information including:
  - "Why is this important?" text paragraph
  - Leading practices (list items)
  - Helpful links with external link indicators
- Update layout architecture to allow content components to control right sidebar visibility
- Position info icons with appropriate spacing (aligned with first line of question, left padding for visual separation)

## Impact

- Affected specs: layout
- Affected code: app/layouts/default.vue, app/components/RightSidebar.vue, app/pages/index.vue, app/pages/survey.vue
- New question info data structure and state management for sidebar control
