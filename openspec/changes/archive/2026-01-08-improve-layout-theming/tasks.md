# Implementation Tasks

## 1. Color System Refinement
- [x] 1.1 Define extended color palette with better contrast ratios
- [x] 1.2 Update primary color usage in light theme for better contrast
- [x] 1.3 Define colors for action types (positive, negative, dangerous)
- [x] 1.4 Define secondary text color variables
- [x] 1.5 Update NuxtUI and Tailwind theme configuration

## 2. Component Renaming and Structure
- [x] 2.1 Rename ConnectedHeader to Header
- [x] 2.2 Rename SidebarMenu to NavigationSidebar
- [x] 2.3 Rename RightSidebar to MoreInfoPanel
- [x] 2.4 Update all component references and imports

## 3. UI Mode Switching Improvement
- [x] 3.1 Replace Power User/Survey toggle with single button radio
- [x] 3.2 Implement clearer visual indication of current mode
- [x] 3.3 Update navigation logic to handle mode switching
- [x] 3.4 Remove "Power User" terminology from UI

## 4. Question UI Refinement
- [x] 4.1 Remove redundant dropdown per question in Power User mode
- [x] 4.2 Refine question display to use separators instead of cards
- [x] 4.3 Keep cards only for key elements (progress bar, info panel); use the layout and color contrast to make it clear what is important instead of cards
- [x] 4.4 Improve typography for better readability

## 5. Navigation Enhancements
- [x] 5.1 Add collapsible functionality to sidebar
- [x] 5.2 Implement consistent tooltips across all navigation elements
- [x] 5.3 Add tooltip to theme toggle button
- [x] 5.4 Create subtle expand/collapse button for sidebar
- [x] 5.5 Set profile icon to gender-neutral
- [x] 5.6 Add tooltip to expand/collapse button
- [x] 5.7 Add tooltip to settings, profile, theme toggle button
- [x] 5.8 De-emphasize Progress section visual hierarchy
- [x] 5.9 Correct color contrast for header and content
- [x] 5.10 Mimic real-life button pressed state for Surview mode *(no more survey vs default view text)*

## 6. Code Quality and Best Practices
- [x] 6.1 Install and configure @vueuse/core dependency
- [x] 6.2 Replace manual event listeners with VueUse composables (e.g., onKeyStroke for Escape key handling)
- [x] 6.3 Refactor global event listeners to be component-scoped
- [x] 6.4 Configure Husky for pre-commit formatting
- [x] 6.5 Ensure consistent formatting across all components
