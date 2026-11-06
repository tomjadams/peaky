# Reorganize Specs by Domain

## Summary

Reorganize the current `layout` and `backend` specs into domain-oriented specs for better discoverability and maintainability. The current `layout` spec has grown to 40 requirements covering unrelated concerns, making it difficult to understand specific domains.

## Motivation

- **Discoverability**: Hard to find requirements (e.g., "what was Team vs Advisors in a review?")
- **Scalability**: New features like "Create Application" view will add more requirements
- **Cognitive load**: 1184 lines in `layout` spec is too much to parse
- **Domain clarity**: Current specs organized by layer (frontend/backend) rather than business domain

## Proposed Structure

| Spec | Description | Source |
|------|-------------|--------|
| `applications` | Application listing, details, status, navigation + API | layout + backend |
| `reviews` | Review details, sessions, history, diff view + API | layout + backend |
| `assessment` | Assessment UI, answers, N/A flow, shared components | layout (existing expanded) |
| `templates` | Template listing, selection, status indicators + API | layout + backend |
| `template-studio` | Template authoring, editor, preview, publishing + API | layout + backend |
| `branding` | Color system, application branding | layout |
| `command-palette` | Command palette functionality | layout |
| `common-ui` | Shared UI patterns, accessibility, tooltips, PWA, DataTable | layout |

## Deltas

- **REMOVED from `layout`**: All 40 requirements (spec retired)
- **REMOVED from `backend`**: All 16 requirements (spec retired)
- **ADDED to new specs**: Requirements redistributed by domain

## Out of Scope

- Rewriting or refactoring requirement content
- Adding new requirements
- Changing requirement names (except where necessary for clarity)

## Risks

| Risk | Mitigation |
|------|------------|
| OpenSpec CLI breaks with renamed specs | Test `openspec list --specs` and `openspec show` after migration |
| Archived changes reference old spec names | Old archives remain valid; only active specs change |
| Requirements split incorrectly | Review mapping before applying |
