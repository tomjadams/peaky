## Why

AI-generated UI code frequently requires 5-10 fix prompts after apply -- bare NuxtUI components, wrong semantic classes, z-index stacking issues, inputs not stretching to full width. The `fix-template-studio-ux` change demonstrated this pattern clearly. Root cause: design and spec artifacts lack the precision needed for Sonnet 4.5 to get it right the first time, and there's no automated quality gate before human review.

## What Changes

- **Artifact pipeline documentation**: Add ASCII diagram showing the full proposal-to-review flow with model assignments (Opus 4.6 for artifacts, Sonnet 4.5 for apply, Kimi K2.5 for adversarial review)
- **Token budget analysis**: Document economics of front-loading quality vs. post-apply fix prompts, including inline vs. subagent cost comparison
- **Design artifact enhancements**: Document the Component Map pattern, Spatial Composition guidance, and Stacking/Interaction notes for UI changes
- **OpenSpec config rules**: Add rules for design (Component Map, Spatial Composition), spec (visual assertions), and tasks (ui-review sub-task, playwright-cli for high-risk interactions)
- **ui-review subagent model**: Switch from `model: inherit` to `model: kimi-k2.5` for adversarial review using a different model family

## Capabilities

### New Capabilities

_None_ -- this change is about AI workflow process and documentation, not application capabilities.

### Modified Capabilities

_None_ -- no domain spec behavior changes.

## Impact

- `site/docs/development/decisions.md` -- Expand AI Tooling Reference section with pipeline, token budget, and design patterns
- `openspec/config.yaml` -- Add rules for design, spec, and tasks artifacts
- `.factory/droids/ui-review.md` -- Change model from `inherit` to `kimi-k2.5`
