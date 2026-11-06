## ADDED Requirements

(None - this change introduces no new requirements)

## MODIFIED Requirements

(None - this change modifies no existing requirements; it is purely an implementation refactor that reorganizes code structure without changing behavior)

## REMOVED Requirements

(None - this change removes no requirements)

---

## Implementation Notes

This change reorganizes frontend composables into domain-organized folders with decomposed modules. The user-facing behavior remains identical:

- Assessment view and Survey view continue to function identically
- Answer state machine logic is unchanged, only relocated
- Progress calculation logic is unchanged, only relocated
- Navigation logic is unchanged, only relocated

The following existing specs remain valid and require no updates:
- `openspec/specs/assessment/spec.md`
- `openspec/specs/template-studio/spec.md`
- `openspec/specs/common-ui/spec.md`
