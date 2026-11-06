> **Note:** The `specs/documentation/` spec has been archived. The documentation site grew beyond what a single spec could capture and is now authored directly in `site/docs/`. See `site/docs/development/` for developer guidance and `site/docs/user-guide/` for end-user docs.

## ADDED Requirements

### Requirement: Documentation Site Structure

The project SHALL maintain a documentation site built with Zensical that serves multiple audiences.

#### Scenario: Landing page for potential users
- **WHEN** a potential user visits the documentation site
- **THEN** they see a marketing-focused landing page
- **AND** the page includes a hero section with value proposition
- **AND** the page showcases key features with screenshots
- **AND** the page uses ORR branding (indigo primary, dark mode support)

#### Scenario: User guide for product users
- **WHEN** a user needs help using the product
- **THEN** they can access a user guide section
- **AND** the guide covers all major workflows (applications, reviews, templates, survey mode)
- **AND** the guide includes visual aids (screenshots, diagrams)

#### Scenario: Maintainer documentation for developers
- **WHEN** a new maintainer joins the project
- **THEN** they can access internal documentation
- **AND** the docs include domain model, architecture, decision log
- **AND** the docs include development setup and testing guides

### Requirement: Documentation Tooling

The project SHALL use Zensical as the static site generator for documentation.

#### Scenario: Local development
- **WHEN** editing documentation locally
- **THEN** run `zensical serve` for live preview
- **AND** changes are reflected immediately without manual rebuild

#### Scenario: Production build
- **WHEN** building for deployment
- **THEN** run `zensical build` to generate static files
- **AND** output is self-contained (no server required)

### Requirement: Documentation Branding

The documentation site SHALL use consistent ORR branding.

#### Scenario: Color scheme
- **WHEN** viewing the documentation site
- **THEN** the primary color is indigo (#6366f1)
- **AND** the site supports both light and dark themes
- **AND** the favicon matches the ORR application icon

#### Scenario: Screenshot presentation
- **WHEN** displaying product screenshots
- **THEN** both light and dark mode variants are shown where available
- **AND** screenshots are high quality and representative of current UI
