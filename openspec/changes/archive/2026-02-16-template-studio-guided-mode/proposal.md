## Why

First-time template authors (95-99% of users) face cognitive overload when expanding a question in Template Studio. All editing sections (Question, Why This Matters, Leading Practices, Resources) appear simultaneously, making it unclear where to start or what's required. Since template authoring is a rare activity, optimizing for speed over learnability hurts the majority of users.

## What Changes

- Add a new **Guided Mode** (default) that displays question editor sections vertically, one at a time, with Next/Back/Skip navigation
- Keep the current 2-column layout as **Compact Mode** (opt-in for power users)
- Add a toggle at the top of the expanded question to switch between modes
- Persist the mode preference in localStorage, applied globally to all questions

## Capabilities

### New Capabilities

_None - this is a UX enhancement to existing Template Studio functionality_

### Modified Capabilities

- `template-studio`: Adding view mode toggle (Guided vs Compact) for question editing experience

## Impact

- **Components affected**: `QuestionCard.vue`, `QuestionList.vue` - need to support both layouts
- **New state**: View mode preference stored in localStorage (`templateStudio.viewMode`)
- **No API changes**: Purely frontend UX modification
- **No breaking changes**: Existing template data structure unchanged
