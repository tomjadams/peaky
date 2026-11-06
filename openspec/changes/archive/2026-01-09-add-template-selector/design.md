# Design: Template Selector Navigation

## Context

The application currently has a navigation sidebar for app-level navigation and a main content area showing questions. Users need a way to understand which template they're working with, see progress across pillars, and navigate between sections. The template selector sits between the main navigation and content, providing template-specific context and navigation.

## Goals / Non-Goals

**Goals:**
- Provide visual context about the active template and its structure
- Enable quick navigation to specific pillars within a template
- Show progress indicators per pillar
- Support collapse/expand to maximize content space
- Add question identifiers for reference and future deep linking
- Maintain current compact question layout for information density

**Non-Goals:**
- Backend integration for template/pillar data (future work)
- Actual routing implementation (prepare structure only)
- Template switching functionality (single template for now)
- Modifying the compact question layout to card-based design

## Decisions

### Layout Structure

The template selector is positioned as a floating element within the main content area, using absolute positioning:

```
[Nav Sidebar (80px - fixed)] [Template Selector (96px collapsed → 256px expanded)] [Main Content (max-width: 1280px)]
```

**Rationale:** Positioning the template selector as a floating element within the main content area (rather than at the layout level) allows the header to extend full width, creating better visual hierarchy. The template selector clearly belongs to the content, not the navigation.

**Final Implementation:**
- Template selector uses `absolute` positioning within the `<main>` element
- Header extends full width across the viewport
- NavigationSidebar remains fixed width (80px) and always visible
- Content has responsive left padding that adjusts based on template selector state

### Collapse Behavior

**Collapsed state (96px width):**
- Document icon with primary color accent
- Template name displayed horizontally
- Status badge with full text (ACTIVE/DRAFT/REVIEW)
- Horizontal divider
- Expand toggle button

**Expanded state (256px width):**
- Full template name and version
- Status badge
- List of pillars with progress percentages
- Active pillar highlighting
- Collapse/expand toggle button

**Rationale:** After testing multiple collapsed widths (48px, 64px, 112px), settled on 96px as the optimal balance between showing useful context (template name + status) and preserving screen space. Horizontal text proved more readable than vertical orientation.

**State Persistence:**
- Collapse state stored in localStorage with key `orr:template-selector-collapsed`
- Shared across components via `useTemplateSelector` composable
- Auto-collapses on screens < 1280px width for responsive behavior

### Question ID Format

Question IDs follow the format: `{PILLAR_SLUG}-{ORDER}` (e.g., SEC-1, SEC-2, PERF-1)

**Display options considered:**
1. Small badge before question text
2. Subtle prefix inline with question
3. Positioned in top-right of question container

**Decision:** Use small badge before question text for visibility without clutter.

**Rationale:** Badges are scannable, don't break question text flow, and align with the pillar slugs shown in the template selector.

**Implementation Details:**
- Badge alignment changed from `items-center` to `items-start` to align with first line of question text
- Improves visual hierarchy and readability

### State Management

Template selector collapse state is stored in localStorage with key `orr:template-selector-collapsed`.

**Alternatives considered:**
- URL query parameter (too noisy)
- Vuex/Pinia store (overkill for single boolean)
- No persistence (poor UX)

**Decision:** localStorage with composable wrapper (`useTemplateSelector`).

**Rationale:** Simple, persistent across sessions, doesn't pollute URL, easy to implement. Composable allows state sharing between TemplateSelectorSidebar and pages that need to adjust layout.

**Implementation:**
- Created `app/composables/useTemplateSelector.ts` with `useState` for reactivity
- State is shared across components automatically
- Main content padding adjusts dynamically based on collapse state

### Deep Linking Preparation

Anchor tags added to:
- Pillar sections: `#pillar-{slug}` (e.g., `#pillar-security`)
- Individual questions: `#question-{pillar-slug}-{order}` (e.g., `#question-sec-1`)

**Rationale:** Establishes URL structure for future routing implementation without requiring backend changes now.

**Additional UX Decisions:**

### Content Width Management
- Added `max-w-5xl` (1280px) container to prevent content from stretching too wide
- Content remains centered with `mx-auto`
- Maintains readability and elegant use of negative space

### Sidebar Visibility When MoreInfoPanel Opens
- Both NavigationSidebar and TemplateSelectorSidebar hide when MoreInfoPanel is open
- Maximizes available space for viewing question details
- Content margin resets to 0 instead of shifting left by 25rem

### NavigationSidebar Simplification
- Removed collapse/expand functionality from NavigationSidebar
- Always visible at fixed 80px width
- Simplifies UI with only one collapsible sidebar (template selector)

### BEM Class Names
- Added BEM-style class names to all key DOM elements in TemplateSelectorSidebar
- Block: `template-selector`
- Elements: `__collapsed-view`, `__icon`, `__name`, `__status-badge`, `__pillar-link`, etc.
- Modifiers: `--collapsed`, `--expanded`, `--active`, `--complete`
- Improves maintainability and makes elements easily targetable for styling/testing

## Risks / Trade-offs

**Risk:** Adding another sidebar may feel cluttered on smaller screens.
- **Mitigation:** Default to collapsed on screens < 1280px, provide clear expand/expand controls.

**Risk:** Mock data structure may not align with future backend schema.
- **Mitigation:** Base structure on existing database schema (`pillars` and `questions` tables), use TypeScript interfaces to document expected shape.

**Risk:** Question IDs may need to change based on backend implementation.
- **Mitigation:** Use data attributes and CSS classes that can be easily updated, avoid hardcoding ID format in multiple places.

## Migration Plan

1. Create new component without affecting existing pages
2. Add component to layout with feature flag or conditional rendering
3. Test with mock data
4. Integrate into main pages
5. Future: Connect to backend API for real template/pillar data

**Rollback:** Remove component from layout, no data migration needed (frontend-only change).

## Open Questions

- Should collapsed state show a vertical text label or just an icon?
  - **Answer:** Show template name vertically when collapsed for context.
  
- Should we show question count per pillar in addition to percentage?
  - **Answer:** Start with percentage only, add count if user feedback requests it.

- Should template selector be visible in survey mode?
  - **Answer:** No, survey mode is focused on single-question flow. Template selector only in dashboard/multi-question view.
