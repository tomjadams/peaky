## Why

Template authors can create questions within pillars, but there's no way to define **what happens when certain combinations of questions are answered negatively**. When multiple related questions are answered "No" (e.g., security questions about MFA, encryption, and key management), this pattern often signals deeper systemic issues that require expert review.

Currently, there's no mechanism to:
- Flag reviews that need advisor intervention before proceeding
- Define cross-pillar rules that trigger escalations
- Visually map question combinations to outcomes

This change adds a **Rules mode** to Template Studio, allowing template authors to create rule sets that trigger actions (starting with "Advisor Needed") when specific question combinations are answered negatively.

## What Changes

1. **New toggle in Template Studio**: Switch between "Questions" (existing editor) and "Rules" (new canvas view)
2. **Vue Flow canvas**: Visual rule builder with drag-and-drop question nodes, rule set containers, and action outcomes
3. **Rule set data model**: Template-level storage of rules with AND/OR logic and extensible actions
4. **Cross-pillar rules**: Rules can reference questions from any pillar in the template
5. **Multi-rule detection**: Visual warning when a question appears in multiple rules (suggesting criticality increase)

## Capabilities

### New Capabilities
- `scoring-rules`: Rule sets that define actions triggered by question answer combinations (AND/OR logic, "Advisor Needed" action)

### Modified Capabilities
- `template-studio`: Add Questions/Rules toggle, integrate canvas view, store rule sets with template

## Impact

- **Frontend**: New Vue Flow canvas components, toggle UI in Template Studio header area
- **Data model**: `Template` gains `ruleSets` field
- **Dependencies**: `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`
- **API**: Template save/load endpoints need to handle `ruleSets` data
