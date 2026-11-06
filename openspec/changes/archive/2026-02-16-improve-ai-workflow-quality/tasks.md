## 1. Setup

- [x] 1.1 Create GitLab issue for "docs: improve AI workflow quality with front-loaded artifacts"
- [x] 1.2 Create feature branch `docs/improve-ai-workflow-quality`

## 2. Update decisions.md -- AI Tooling Reference

- [x] 2.1 Update the Subagents sub-section: change `ui-review` model reference from `inherit` to `kimi-k2.5`
- [x] 2.2 Add **Artifact Pipeline** sub-section:
  - ASCII diagram showing full flow (proposal → design → spec → tasks → apply → review → human)
  - Model assignment table (Opus 4.6, Sonnet 4.5, Kimi K2.5 with IDs and multipliers)
  - Quality gates at each stage
- [x] 2.3 Add **Token Budget** sub-section:
  - Before/after comparison table (front-loading vs. fix prompts)
  - Per-phase cost breakdown with model multipliers
  - Key insight paragraph on economics
- [x] 2.4 Add **Inline vs. Subagent** sub-section:
  - Warm cache (inline) vs. cold start (subagent) cost comparison
  - Decision framework: "does adversarial value justify cold-start cost?"
  - Real example: playwright-cli inline (~500-1K tokens) vs. hypothetical ux-verify subagent (~4-6K tokens)
- [x] 2.5 Add **Design Artifact Enhancements for UI Changes** sub-section:
  - Component Map table template with example from `fix-template-studio-ux`
  - Spatial Composition guidance (container widths, gaps, stretch behavior)
  - Stacking/Interaction notes (z-index, overflow, focus traps)
  - "What was missing" table mapping fix prompts to missing design info

## 3. Update OpenSpec Config Rules

- [x] 3.1 Add `design` rule: require Component Map table for UI changes (exact NuxtUI props, semantic classes, layout notes)
- [x] 3.2 Add `design` rule: require Spatial Composition section for UI changes
- [x] 3.3 Add `spec` rules section: require visual assertions in UI scenarios (layout stretch, z-index, hit areas)
- [x] 3.4 Add `tasks` rule: reference Component Map from design.md in UI implementation tasks
- [x] 3.5 Add `tasks` rule: include ui-review (Kimi) sub-task after UI implementation
- [x] 3.6 Add `tasks` rule: include playwright-cli verification for high-risk interactions (overlays, z-index, stacking)

## 4. Update ui-review Subagent

- [x] 4.1 Change `model: inherit` to `model: kimi-k2.5` in `.factory/droids/ui-review.md`

## 5. Documentation & Cleanup

- [x] 5.1 Add row to Implemented Decisions table in `decisions.md`
- [x] 5.2 Create GitLab MR with conventional commit title `docs(dev): improve AI workflow quality with front-loaded artifacts`
