# common-ui Spec Delta

This change reorganizes specs by domain. Requirements are migrated manually from `layout` and `backend` specs.

## ADDED Requirements

### Requirement: Spec Organization by Domain

The OpenSpec specifications SHALL be organized by business domain rather than by technical layer.

#### Scenario: Domain-based spec discovery
- **WHEN** a developer needs to understand a feature area
- **THEN** they can find all related requirements in a single domain spec
- **AND** the spec includes both UI and API requirements for that domain
- **AND** the spec name clearly indicates the business domain (e.g., `reviews`, `templates`)

#### Scenario: Retired layer-based specs
- **WHEN** the reorganization is complete
- **THEN** the `layout` spec is retired (requirements distributed to domain specs)
- **AND** the `backend` spec is retired (requirements distributed to domain specs)
- **AND** all requirements are preserved in their new locations
