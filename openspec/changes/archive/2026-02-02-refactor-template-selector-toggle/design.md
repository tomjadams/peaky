## Context

The `TemplateSelectorSidebar.vue` component currently has two separate toggle buttons rendered outside the `<aside>` element:
- One for expanding (when collapsed) at `left: 11rem`
- One for collapsing (when expanded) at `left: 21rem`

These buttons use chevron icons and float beside the sidebar, creating a disconnected visual appearance. The user has provided a sidebar panel SVG icon (`sample.svg`) that better represents the toggle action.

## Goals / Non-Goals

**Goals:**
- Move toggle button inside the sidebar component at a fixed top-right position
- Replace chevron icons with the provided sidebar panel SVG icon
- Maintain smooth transitions when toggling between collapsed/expanded states
- Preserve existing accessibility (aria-label, keyboard support)

**Non-Goals:**
- Changing the collapse/expand animation timing or behavior
- Modifying the sidebar content layout
- Adding new functionality beyond the toggle repositioning

## Decisions

### 1. Single toggle button inside the sidebar header

**Decision:** Replace the two external toggle buttons with a single button positioned inside the `<aside>` at the top-right corner.

**Rationale:** 
- Reduces code duplication (one button vs two)
- Creates visual cohesion - toggle is part of the sidebar, not floating outside
- Simpler positioning logic - no need to calculate `left` based on sidebar width

**Alternative considered:** Keep two buttons but move them inside. Rejected because a single button with conditional aria-label achieves the same UX with less code.

### 2. Lucide icons for panel toggle

**Decision:** Use `lucide:panel-left-close` and `lucide:panel-left-open` icons from the Lucide icon set.

**Rationale:**
- Icons semantically represent the toggle action (close panel when expanded, open panel when collapsed)
- Lucide icons are already available in the project
- No custom assets needed, keeping the change minimal
- `currentColor` theming works automatically via the Icon component

**Alternative considered:** Use a single static icon or custom SVG. Rejected because conditional icons provide clearer UX for the two distinct states.

### 3. Flexbox positioning within sidebar header

**Decision:** Add a header section to the sidebar with the toggle button positioned using `flex justify-end p-2`.

**Rationale:**
- Flexbox avoids overlap issues with content below (absolute positioning caused conflicts with template collapse chevron)
- Header takes its own row, cleanly separating toggle from sidebar content
- Top-right alignment is achieved via `justify-end`
- Works correctly in both collapsed and expanded states

### 4. Main content padding adjustment

**Decision:** Increase main content left padding to account for sidebar width plus its left offset (`left-20`).

**Rationale:**
- Sidebar is positioned at `left-20` (5rem) with width `w-24` (6rem collapsed) or `w-64` (16rem expanded)
- Main content needs `pl-52` (13rem) when collapsed, `pl-96` (24rem) when expanded
- Prevents sidebar from overlapping main content

## Risks / Trade-offs

**[Risk] Toggle may be less discoverable inside sidebar** → Mitigation: Use hover states and ensure adequate contrast. The icon clearly represents a sidebar panel.

**[Risk] Inline SVG adds template verbosity** → Mitigation: The SVG is small (2 paths) and self-contained. Acceptable trade-off for avoiding icon registration complexity.

**[Trade-off] Button size changes between states** → In collapsed state, the sidebar is narrower so the button positioning will naturally adjust. This is acceptable as the toggle remains in the top-right corner relative to the sidebar bounds.
