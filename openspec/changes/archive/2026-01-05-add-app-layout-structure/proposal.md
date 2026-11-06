# Change: Add Application Layout Structure

## Why
The ORR application needs a consistent layout structure to provide a professional user experience and accommodate future functionality.

## What Changes
- Add a Discord-inspired left sidebar menu with logo at the top
- Create a main content area for displaying application content
- Add a hidden right sidebar menu for future functionality
- Optimize layout for minimum device size of 14-inch MacBook (Nov 2023) and larger external monitors
- Apply the defined color palette for consistent styling
- Add dark mode toggle using Nuxt's built-in color mode module

## Impact
- Affected specs: layout
- Affected code: 
  - app/layouts/default.vue (new)
  - app/components/SidebarMenu.vue (new)
  - app/components/RightSidebar.vue (new)
  - app/components/ThemeToggle.vue (new)
  - app/app.vue (modified)
