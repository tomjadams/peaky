## No Spec Changes Required

This bugfix does not modify any specification requirements. The existing specifications already correctly describe the expected behavior:

- **Command palette actions** (from `openspec/specs/command-palette/spec.md`): "WHEN a user selects an action from the palette, THEN the action is executed"

The bug is purely in the implementation - the command palette action was navigating incorrectly (using query parameters instead of page navigation). The fix aligns the implementation with the existing spec.

## Verification

After the fix:
- **WHEN** a user opens the command palette on the assessment page and selects "Enter survey mode"
- **THEN** the application navigates to the survey page
- **AND** the command palette closes

- **WHEN** a user opens the command palette on the survey page and selects "Exit survey mode"
- **THEN** the application navigates to the assessment page
- **AND** the command palette closes
