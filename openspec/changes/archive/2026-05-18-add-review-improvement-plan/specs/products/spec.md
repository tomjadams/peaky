## ADDED Requirements

### Requirement: Product Improvement Plan

The application SHALL provide a product-level Improvement Plan that explains which contributors are affecting product readiness.

#### Scenario: Product plan route

- **WHEN** a user opens a product plan
- **THEN** the route is `/products/:productId/plan`
- **AND** the page title is "Improvement Plan"
- **AND** the page subtitle frames the view as product readiness contributors rather than team or application judgement

#### Scenario: Product-level reviews as contributors

- **WHEN** a product has reviews whose subject is the product itself
- **THEN** those reviews appear as first-class readiness contributors
- **AND** product-level reviews are included even when no applications are selected for the review
- **AND** product-level review areas such as launch readiness, roadmap, communications, branding, support, and go-to-market readiness are not forced into application or team categories

#### Scenario: Application contributors

- **WHEN** product-associated applications have linked reviews or are selected within product reviews
- **THEN** those applications appear as readiness contributors
- **AND** each application contributor shows follow-up, not-assessed, and top-area counts derived from its contributing reviews
- **AND** users can drill into the relevant review plan or assessment

#### Scenario: Team contributors

- **WHEN** product-associated teams have reviews that contribute to the product's readiness
- **THEN** those teams appear as readiness contributors
- **AND** each team contributor shows follow-up, not-assessed, and top-area counts derived from its contributing reviews
- **AND** users can drill into the relevant review plan or assessment

#### Scenario: Contributor summary table

- **WHEN** the product plan displays contributors
- **THEN** contributors are shown in a table-first view by default
- **AND** each contributor row shows name, contributor type, follow-up count, not-assessed count, and top area
- **AND** contributor type distinguishes Product review, Application, and Team
- **AND** the table uses the layered section-card pattern so contributors remain visually separated from the page background
- **AND** the view can be filtered by contributor type without shifting page layout

#### Scenario: Product plan tone

- **WHEN** contributor readiness is displayed
- **THEN** the UI uses language such as "Where readiness needs attention", "Where confidence is still unknown", and "Which contributors need support"
- **AND** the UI does not rank contributors as failing or passing
- **AND** severity and counts are used to guide prioritization without assigning blame

### Requirement: Product Cross-Review Rollups

The product plan SHALL aggregate exact repeated plan items across the product's contributing reviews.

#### Scenario: Exact product rollup grouping

- **WHEN** the same template question appears in multiple contributing reviews
- **THEN** the product plan groups the item only when template identity and question identity match exactly
- **AND** the grouped item lists each source review and contributor
- **AND** the product plan does not merge similar wording from different templates

#### Scenario: Product rollup drilldown

- **WHEN** a user selects a repeated item in the product plan
- **THEN** the user can see which product-level reviews, applications, or teams contributed to the rollup
- **AND** the user can open the source assessment question

#### Scenario: Many source contributors

- **WHEN** a repeated item appears in many contributing reviews
- **THEN** only the first few source links are shown inline
- **AND** remaining source links are available from a "+N more" dropdown
- **AND** each link opens the exact assessment question in a new tab

## MODIFIED Requirements

## REMOVED Requirements
