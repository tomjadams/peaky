## MODIFIED Requirements

### Requirement: Documentation Site Structure

The project SHALL maintain a documentation site built with Zensical that serves multiple audiences from a single source of truth.

#### Scenario: Landing page for potential users
- **WHEN** a potential user visits the documentation site
- **THEN** they see a marketing-focused landing page
- **AND** the page includes a hero section with value proposition
- **AND** the page showcases key features with screenshots
- **AND** the page uses ORR branding (indigo primary, dark mode support)

#### Scenario: User guide for product users
- **WHEN** a user needs help using the product
- **THEN** they can access a user guide section at `site/docs/user-guide/`
- **AND** the guide covers all major workflows (applications, reviews, templates, survey mode)
- **AND** the guide includes visual aids (screenshots, diagrams)

#### Scenario: Development documentation for developers and LLMs
- **WHEN** a developer or LLM agent needs project guidance
- **THEN** they can access development documentation at `site/docs/development/`
- **AND** the docs include setup, frontend patterns, backend patterns, testing
- **AND** the docs include domain model, architecture, decision log
- **AND** this is the single canonical source (no separate `docs/` or `AGENTS.md` content)

#### Scenario: LLM agent entry point
- **WHEN** an LLM agent reads `AGENTS.md`
- **THEN** it finds a redirect pointing to `site/docs/development/`
- **AND** the redirect is a single line with no duplicated content

## ADDED Requirements

### Requirement: Pointer-based LLM Context

The project SHALL use pointer-style references in `openspec/config.yaml` instead of inline documentation.

#### Scenario: Config context references docs
- **WHEN** an LLM reads `openspec/config.yaml` context
- **THEN** it finds pointers like "For testing patterns: read site/docs/development/testing.md"
- **AND** it does NOT find duplicated inline documentation
- **AND** the pointers cover: frontend, backend, testing, decisions, domain

#### Scenario: Config context references specs
- **WHEN** an LLM needs domain requirements
- **THEN** the config points to `openspec/specs/{domain}/spec.md`
- **AND** it lists the key domains (applications, reviews, templates, testing, assessment, common-ui)

## REMOVED Requirements

### Requirement: Separate docs/ directory

**Reason**: Consolidated into `site/docs/development/` to eliminate duplication
**Migration**: All content moved to `site/docs/development/`. Update any references from `docs/` to `site/docs/development/`.

### Requirement: Full AGENTS.md content

**Reason**: Content duplicated human-readable docs; now redirects to canonical source
**Migration**: `AGENTS.md` becomes a one-liner redirect. LLMs follow the pointer to `site/docs/development/`.
