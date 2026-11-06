## Context

The current AI workflow generates artifacts (proposal, design, spec, tasks) with Opus, then applies with Sonnet 4.5. UI changes consistently require 5-10 post-apply fix prompts because:

1. Design artifacts say "use URadioGroup" but don't specify `size="md" color="primary"`
2. Spec scenarios say "auto-expands" but not "fills 100% of parent container width"
3. No adversarial review catches bare components or wrong semantic classes before human review
4. The `ui-review` subagent uses `model: inherit` -- the same model reviewing its own work

The `fix-template-studio-ux` change (Feb 2026) is the case study. N/A overlay rendered behind the modal (z-index issue invisible to code review), inputs didn't stretch to full width (correct classes, wrong layout context), bare `UInput` components missing size props.

## Goals / Non-Goals

**Goals:**
- Reduce post-apply fix prompts from 5-10 to 0-2 for UI changes
- Document the artifact pipeline with model assignments for team reference
- Document token economics so future decisions about inline vs. subagent are grounded in data
- Make design artifacts precise enough that Sonnet 4.5 can implement correctly on first pass
- Enable adversarial review using a different model family (Kimi K2.5)

**Non-Goals:**
- Creating new subagents (playwright-cli inline is cheaper than a ux-verify subagent)
- Changing the OpenSpec schema or artifact structure
- Automating the entire review process (human click-around remains the final gate)
- Modifying the nuxt-ui skill or visual-design.md

## Decisions

### Decision 1: Documentation in decisions.md, Not a New Doc

**Choice**: Expand the existing AI Tooling Reference section in `decisions.md`.

**Rationale**: The section already houses skills and subagents. Adding the pipeline, token budget, and design patterns keeps "how we use AI tools" in one place. `config.yaml` already points to `decisions.md`, so any model generating artifacts will see this guidance.

**Alternatives considered**:
- New `ai-workflow.md` doc -- adds another file to maintain and reference; fragments the AI guidance
- Add to `llm-context.md` -- that doc is about doc structure strategy, not workflow process

### Decision 2: Progressive Disclosure Documentation Style

**Choice**: Structure the AI Tooling Reference as layered sections, each self-contained:

```
Quick reference table     → 5 second scan
Pipeline diagram          → 30 second read
Model assignments         → 10 second scan
Token budget              → 1 minute read
Inline vs Subagent guide  → 1 minute read
Component Map pattern     → Deep dive
```

**Rationale**: Matches the project's existing doc style (visual-design.md, architecture.md). A reader can stop at any level and have useful knowledge. Uses ASCII diagrams, tables, and real examples from the `fix-template-studio-ux` change.

### Decision 3: Kimi K2.5 for Adversarial Review

**Choice**: Change `ui-review` subagent from `model: inherit` to `model: kimi-k2.5`.

**Rationale**: Different model family prevents self-confirmation bias. If Opus writes the design and Sonnet implements, having Kimi review creates genuine adversarial tension. At 0.25x multiplier, it's 1/5th the cost of a Sonnet call per token.

**Model assignment table**:

| Phase | Model | ID | Multiplier |
|---|---|---|---|
| Proposal, Design, Spec, Tasks | Opus 4.6 | `claude-opus-4-6` | 2x |
| Apply | Sonnet 4.5 | `claude-sonnet-4-5-20250929` | 1.2x |
| Adversarial Review | Kimi K2.5 | `kimi-k2.5` | 0.25x |

### Decision 4: Component Map Pattern in Design Rules

**Choice**: Add a `config.yaml` rule requiring UI designs to include a Component Map table with exact NuxtUI props and semantic classes.

**Example** (from what `fix-template-studio-ux` should have had):

```markdown
| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
|---|---|---|---|---|
| Reason selection | URadioGroup | size="md" color="primary" | space-y-3 | -- |
| Comment field | UTextarea | size="md" :rows="3" autoresize | -- | Fills container width |
| Slideover | USlideover | side="right" | -- | Must stack above preview UModal |
```

**Rationale**: Every fix prompt sent after apply for the template-studio change was information that should have been in the design. The Component Map makes this explicit.

### Decision 5: Visual Assertions in Spec Rules

**Choice**: Add a `config.yaml` rule requiring UI specs to include visual assertions -- layout stretch, z-index stacking, hit areas.

**Example**:
```markdown
- AND the slideover renders ABOVE the preview modal
- AND the textarea fills 100% of its parent container width
- AND the clickable area spans the full bordered container
```

**Rationale**: The N/A overlay z-index bug and input stretching issue would both have been caught if the spec had explicit visual assertions. The model implementing the code would have tested these conditions.

### Decision 6: Inline playwright-cli Over ux-verify Subagent

**Choice**: Use `playwright-cli` skill inline during apply tasks for high-risk visual verification. Do not create a separate `ux-verify` subagent.

**Rationale**: The apply session's prompt cache is warm -- all context is already loaded. Adding a playwright step costs ~500-1K new tokens. A subagent starts cold, needing ~3-5K tokens just to load context before running the same commands. The subagent only wins when adversarial value (different model) justifies the cold-start cost.

### Decision 7: Post-Apply ui-review Sub-Task in Task Rules

**Choice**: Add a `config.yaml` rule that UI implementation tasks must include a sub-task to run `ui-review` (Kimi) on modified `.vue` files.

**Rationale**: Catches bare components, wrong semantic classes, and missing props before human review. At 0.25x multiplier, one review pass costs less than a single fix prompt.

## Risks / Trade-offs

**[Risk] Component Map adds design effort** → Acceptable because it's a one-time cost per change that prevents ~5x the effort in fix prompts. Opus is good at generating these tables when given the /nuxt-ui skill reference.

**[Risk] Kimi K2.5 may miss nuanced issues** → It has no reasoning mode (None only). Mitigated by the 8-point checklist being mechanical -- color compliance, prop presence, sizing -- not subjective judgment. Human review remains the final gate for UX judgment.

**[Risk] Too many config rules slow artifact generation** → Monitor. If artifact generation becomes verbose or slow, consolidate rules. Current addition is 4 new rules across 3 phases.

**[Trade-off] Inline playwright-cli can't use a different model** → Accepted. Visual spot-checks don't need adversarial review -- they're binary (overlay visible or not, input stretches or not). The adversarial value is in the static code review (ui-review with Kimi).
