## Why

The recent global NuxtUI `input` style override in `app.config.ts` introduced visual regressions across multiple components. The command palette lost its centering and has a broken escape-after-outside-click flow. The homepage "Search applications" input has incorrect focus states in dark mode, and table row hover makes checkboxes disappear due to contrast issues. These are user-facing regressions that erode trust in the UI and need to be fixed before they accumulate.

## What Changes

- **Command Palette**: Restore modal centering; fix escape key not working after clicking outside the modal overlay
- **Homepage Search Input**: Fix focus ring visibility when hovering in dark mode (hover state overrides focus ring color)
- **Homepage DataTable**: Fix checkbox contrast disappearing on row hover in dark mode
- **Global Input Styles**: Refine `app.config.ts` input base styles so hover and focus states compose correctly (focus should always win over hover)
- **Template Studio PillarTabs**: Hide pillar delete button by default; reveal on hover with width animation. Fix vertical centering of the trash icon
- **Audit pass**: Verify all components using `UInput` render correctly after the global style change

## Capabilities

### New Capabilities

_None_ — this is a bug-fix change with no new capabilities.

### Modified Capabilities

- `command-palette`: Fix centering and escape-key behavior regressions
- `common-ui`: Refine global NuxtUI input theme so focus states take precedence over hover states
- `applications`: Fix dark-mode contrast issues on homepage table and search input
- `template-studio`: Improve pillar delete button UX (hide until hover, animate reveal)

## Impact

- **Components**: `AppCommandPalette.vue`, `SearchInput.vue`, `DataTable.vue`, `PillarTabs.vue`, `app.config.ts`
- **Styles**: Global NuxtUI input slot overrides in `app.config.ts`
- **Testing**: Existing E2E and accessibility tests should pass; may need new visual checks via playwright-cli
