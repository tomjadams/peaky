# Implementation Tasks

## 1. Layout Structure

- [x] 1.1 Create default layout component with three-column structure (80px sidebar, flexible main content, hidden right sidebar)
- [x] 1.2 Optimize layout for minimum device size of 14-inch MacBook (Nov 2023) and larger external monitors
- [x] 1.3 Apply color palette from design requirements (primary: #135bec, background-light: #f6f6f8, background-dark: #101622)

## 2. Left Sidebar

- [x] 2.1 Create SidebarMenu component with fixed width (w-20, 80px)
- [x] 2.2 Add logo and app name at the top (h-16 container with centered content)
- [x] 2.3 Implement navigation menu items with Material Icons (h-12 w-12 rounded-lg)
- [x] 2.4 Add hover tooltips for navigation items using absolute positioning
- [x] 2.5 Implement active state highlighting (bg-primary/10 text-primary)
- [x] 2.6 Add user profile icon at the bottom of sidebar

## 3. Header Component

- [x] 3.1 Create header with title and subtitle (h-20 with border-b)
- [x] 3.2 Add sticky positioning with backdrop blur (bg-white/75 backdrop-blur-sm)
- [x] 3.3 Implement user controls section (Power User Mode toggle)
- [x] 3.4 Add dark mode toggle using Nuxt's built-in color mode module

## 4. Main Content Area

- [x] 4.1 Create main content container with appropriate padding (px-8 py-6)
- [x] 4.2 Implement max-width container for content (max-w-4xl mx-auto)
- [x] 4.3 Add progress indicator component (h-2 rounded-full bg-primary)
- [x] 4.4 Create layout structure that supports both default and survey views
- [x] 4.5 Implement default view (multiple questions) with sections, expandable questions, and horizontal answer options
- [x] 4.6 Implement survey view (single question) with focused question display and prominent answer buttons
- [x] 4.7 Add navigation footer with back/next buttons for survey view

## 5. Right Sidebar (Placeholder)

- [x] 5.1 Create RightSidebar component structure
- [x] 5.2 Implement toggle mechanism to show/hide
- [x] 5.3 Add placeholder content structure

## 6. Integration

- [x] 6.1 Update app.vue to use new layout structure
- [x] 6.2 Ensure proper routing with new layout
- [x] 6.3 Test layout on different screen sizes
- [x] 6.4 Verify dark mode compatibility
- [x] 6.5 Add NuxtLink navigation between default and survey views
- [x] 6.6 Implement semantic HTML structure (main, section, article, nav, fieldset elements)
- [x] 6.7 Add ARIA attributes and accessibility improvements
- [x] 6.8 Fix template syntax errors and proper Vue component structure
- [x] 6.9 Optimize survey view layout (increased width to max-w-5xl, side-by-side buttons)
- [x] 6.10 Refine survey UX (simplified button text, subtle "not applicable" option)
