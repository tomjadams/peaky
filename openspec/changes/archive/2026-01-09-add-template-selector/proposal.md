# Change: Add Template Selector Navigation

## Why

Users need a way to navigate between different assessment templates and their pillars (sections) within the dashboard view. Currently, there's no visual representation of the template structure or quick navigation to specific pillars. The template selector provides context about which template is active, shows progress per pillar, and enables deep linking to specific sections.

## What Changes

- Add a collapsible template selector sidebar as a floating element within the main content area
- Display active template with status badge (ACTIVE, DRAFT, REVIEW) in both expanded and collapsed states
- Show pillar list with completion percentages for the active template when expanded
- Support expand/collapse functionality (96px collapsed → 256px expanded) with localStorage persistence
- Add question IDs (e.g., SEC-1, SEC-2) as badges to questions in the main content area
- Add anchor tags for deep linking to specific pillars (`#pillar-{slug}`) and questions (`#question-{slug}-{order}`)
- Maintain current compact question layout (not adopting the card-based design from the reference)
- Hide both NavigationSidebar and TemplateSelectorSidebar when MoreInfoPanel is open to maximize content space
- Implement responsive content width with max-width constraint (1280px) for readability
- Add BEM-style class names to all key DOM elements for maintainability

## Impact

- Affected specs: `layout`
- Affected code:
  - `app/pages/index.vue` - Added question IDs, anchor tags, responsive padding, and max-width container
  - `app/components/TemplateSelectorSidebar.vue` - New component with collapse/expand functionality and BEM classes
  - `app/composables/useTemplateSelector.ts` - New composable for shared collapse state
  - `app/layouts/default.vue` - Integrated template selector as floating element, conditional sidebar visibility
  - `app/components/NavigationSidebar.vue` - Removed collapse functionality (always visible)
  - Future: Backend integration for template/pillar data (not in this change)
