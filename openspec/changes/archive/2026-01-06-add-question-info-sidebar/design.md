## Context

The current layout has a basic right sidebar component but lacks functionality to display question-specific information. 

Users need contextual help for each question to understand the importance, learn leading practices, and access external resources. 

The sidebar control is currently hardcoded in the layout, preventing content components from managing its visibility.

## Goals / Non-Goals

- Goals: 
  - Provide question-specific context and guidance
  - Enable content-controlled sidebar visibility
  - Maintain clean separation of concerns between layout and content
  - Ensure accessibility and responsive design
- Non-Goals:
  - Complete redesign of the layout system
  - Real-time collaboration features
  - Advanced analytics or tracking

## Decisions

- Decision: Use Vue composables for state management to allow components to control sidebar visibility
  Rationale: Keeps layout clean while enabling content-driven interactions
- Decision: Position info icons inline with questions, aligned to first line
  Rationale: Maintains visual hierarchy and provides clear association
- Decision: Use external link icons for helpful resources
  Rationale: Clear visual indication that links navigate away from the application
- Alternatives considered: 
  - Global state management (overkill for this feature)
  - Modal overlay (would block content, sidebar is less intrusive)
  - Tooltip approach (insufficient space for detailed information)

## Risks / Trade-offs

- Risk: Info icons may add visual clutter to question interface
  Mitigation: Use subtle styling and appropriate spacing
- Risk: Sidebar content may be difficult to maintain
  Mitigation: Create structured data format for question information
- Trade-off: Additional component complexity vs improved user experience
  Resolution: Accept complexity for significant UX improvement

## Migration Plan

1. Create composable for sidebar state management
2. Update layout to use composable instead of local state
3. Enhance RightSidebar component with question information display
4. Add info icons to question components
5. Implement sample data structure for question information
6. Test and refine interactions

## Open Questions

- Should question information be loaded from API or hardcoded initially?
- How should the sidebar behave on mobile devices?
- Should we persist sidebar state across navigation?
