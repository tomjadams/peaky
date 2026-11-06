## ADDED Requirements

### Requirement: AI Tooling Reference Documentation

The decision log SHALL include an AI Tooling Reference section documenting the artifact pipeline, model assignments, token economics, and design artifact patterns.

#### Scenario: Pipeline documentation

- **WHEN** a developer reads the AI Tooling Reference section
- **THEN** they find an ASCII diagram showing the full artifact pipeline
- **AND** a model assignment table with phases, model names, IDs, and multipliers
- **AND** each section is self-contained (progressive disclosure)

#### Scenario: Token budget reference

- **WHEN** a developer considers adding a new subagent or workflow step
- **THEN** they find a before/after token comparison for front-loading vs. fix prompts
- **AND** an inline vs. subagent cost comparison with cache reasoning
- **AND** a decision framework: "does adversarial value justify cold-start cost?"

#### Scenario: Component Map pattern reference

- **WHEN** a developer creates a design artifact for a UI change
- **THEN** they find a documented Component Map table pattern
- **AND** examples showing exact NuxtUI props, semantic classes, and layout notes
- **AND** guidance on Spatial Composition and Stacking/Interaction concerns
