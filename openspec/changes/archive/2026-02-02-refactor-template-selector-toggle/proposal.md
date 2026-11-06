## Why

The current toggle button for the TemplateSelectorSidebar uses chevron arrow icons positioned outside the sidebar, which feels visually disconnected and out of place. Moving the toggle to a fixed position within the template selector (top-right corner) with a custom sidebar panel icon will improve visual cohesion and provide a more intuitive collapse/expand experience.

## What Changes

- Replace `heroicons:chevron-left` and `heroicons:chevron-right` icons with Lucide `panel-left-close` and `panel-left-open` icons
- Reposition the toggle button from external floating position to inside the template selector at top-right
- Ensure toggle position adjusts correctly when sidebar is collapsed vs expanded
- Remove the separate external toggle buttons that currently float beside the sidebar

## Capabilities

### New Capabilities

None - this is a UI refinement that doesn't introduce new capabilities.

### Modified Capabilities

None - the collapsible navigation requirement in `common-ui` spec remains unchanged. This change is purely an implementation detail (icon choice and positioning) that doesn't alter the specified behavior.

## Impact

- **Code**: `app/components/TemplateSelectorSidebar.vue` - toggle button markup and positioning
- **Visual**: Toggle will move from external floating position to integrated top-right corner with Lucide panel icons
- **No breaking changes**: Collapse/expand functionality remains identical
