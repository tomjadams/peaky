# Change: Improve Layout and Theming

## Why

The current layout and theming have inconsistencies in color contrast, component naming, and UI structure that need to be addressed to improve usability and maintainability.

## What Changes

- Refine color system for better contrast in both light and dark modes
- Rename components to better reflect their purpose (e.g., ConnectedHeader → Header)
- Improve UI mode switching from "Power User/Survey" to a more intuitive toggle. Users are only occasionally switching to the survey layout (and back)
- Remove redundant dropdown per question in Power User mode
- Add collapsible sidebar functionality
- Refine card usage to only wrap key elements instead of everything
- Add consistent tooltips across navigation elements

## Impact

- Affected specs: layout
- Affected code:
  - Component naming and structure
  - Color system and theming
  - Navigation UI and interaction patterns
  - Layout structure and card usage
