# improvement-plans Specification

## Purpose

This specification covers the Improvement Plan domain — contextual, review-level, team-level, and product-level pages that surface assessment attention items in a non-judgemental, actionable format. Plans turn assessment state (unanswered questions, No answers, checklist gaps, N/A exceptions) into a prioritised list of follow-ups and next conversations.

## Requirements

### Requirement: Review Improvement Plan Page

The application SHALL provide a contextual review-level Improvement Plan page that turns assessment state into a non-judgemental list of follow-up and not-yet-assessed items.

#### Scenario: Review plan route

- **WHEN** a user opens a review plan
- **THEN** the route is contextual and ends in `/plan`
- **AND** team reviews use `/teams/:teamId/reviews/:reviewId/plan`
- **AND** product reviews use `/products/:productId/reviews/:reviewId/plan`
- **AND** application reviews use `/applications/:appId/reviews/:reviewId/plan`
- **AND** the page title is "Improvement Plan"

#### Scenario: Review plan summary

- **WHEN** the plan loads for a review
- **THEN** the page displays summary cards for follow-up items, not assessed items, critical/high items, and checklist gaps
- **AND** the summary uses language such as "Items needing attention", "Follow-up", and "Not assessed"
- **AND** the summary does not use judgemental labels such as "Failed", "Violation", or "Bad answer"
- **AND** a "Continue Assessment" action navigates to the same review's assessment page

#### Scenario: Review plan item list

- **WHEN** plan items are present
- **THEN** the page displays each item with severity, state, question ID, question text, template name, pillar name, and review context
- **AND** similar-looking questions from different templates remain visually disambiguated by source context
- **AND** each item provides an action to open the corresponding assessment question

#### Scenario: Review plan empty state

- **WHEN** there are no active follow-up items and no not-assessed items
- **THEN** the page displays an empty state saying no items need attention right now
- **AND** the empty state explains that N/A exceptions can still be reviewed for context if present
- **AND** the empty state provides a way to return to the assessment

### Requirement: Attention Item Classification

The system SHALL derive Improvement Plan items from assessment answers without requiring users to manually inspect the assessment page.

#### Scenario: Yes/no question answered No

- **WHEN** a yes/no question is answered "No"
- **THEN** the question appears as a follow-up item
- **AND** the item explains that it appears because the team intentionally answered No
- **AND** the item is included in the primary items-needing-attention count

#### Scenario: Unanswered question

- **WHEN** a question has no answer
- **THEN** the question appears as a not-assessed item
- **AND** the item explains that it is not treated as a gap yet
- **AND** the item is included in the primary items-needing-attention count

#### Scenario: Question marked N/A

- **WHEN** a question is marked N/A with a reason
- **THEN** the question is treated as a documented exception
- **AND** the item is excluded from the primary items-needing-attention count by default
- **AND** the user can include documented exceptions through filtering

#### Scenario: Checklist question with missing practices

- **WHEN** a checklist question has unchecked items that are not marked N/A
- **THEN** the question appears as a checklist gap item
- **AND** the item lists missing checklist practices
- **AND** the item summarizes checked, N/A, and still-needs-review counts

#### Scenario: Checklist question fully accounted for

- **WHEN** every checklist item is either checked or marked N/A
- **THEN** the question does not appear as an active follow-up item
- **AND** the question can still appear when documented exceptions are included by filter

### Requirement: Plan Filtering and Sorting

The application SHALL provide quick controls for narrowing and scanning plan items while keeping the default experience dense, calm, and stable.

#### Scenario: Default issue list view

- **WHEN** a user opens a plan for the first time
- **THEN** items are displayed in a single severity-grouped issue list
- **AND** each severity section uses layered section-card depth rather than loud colored borders
- **AND** severity is conveyed by label and dot, not color alone

#### Scenario: Plan filters

- **WHEN** plan items are displayed
- **THEN** users can filter by state, severity, pillar, template, and search text
- **AND** state filters include Follow-up, Checklist gaps, Not assessed, Documented exceptions, and All
- **AND** severity filters include Critical, High, Medium, and All
- **AND** dropdown filters do not lock body scroll or shift the page when opened

#### Scenario: Recommended sorting

- **WHEN** no explicit sort is chosen
- **THEN** items are sorted by recommended priority
- **AND** Critical items appear before High items
- **AND** High items appear before Medium items
- **AND** follow-up and checklist gaps appear before not-assessed items at the same severity

### Requirement: Progressive Learning Details

The application SHALL expose question learning context through progressive disclosure rather than showing all explanatory text by default.

#### Scenario: Inline item context

- **WHEN** a plan item is shown
- **THEN** the row shows concise context for why the item appears in the plan
- **AND** checklist rows show missing practices without requiring navigation away from the plan
- **AND** inline context remains shorter than the full question information panel

#### Scenario: Learning detail panel

- **WHEN** a user selects "Learn why" or equivalent detail action
- **THEN** the existing question information pattern is used to show why the question matters, leading practices, and helpful links
- **AND** the panel content is specific to the selected question or checklist item
- **AND** the panel can be closed without losing filters or scroll position

#### Scenario: Non-judgemental item explanations

- **WHEN** an item explanation is rendered
- **THEN** the copy frames the item as a next conversation, follow-up, or not-yet-assessed check
- **AND** severity is presented as risk context rather than blame
- **AND** color is not the only indicator of state

### Requirement: Exact Cross-Review Rollups

The system SHALL support cross-Review rollups using exact Template Revision and Revision-specific Question identity and SHALL avoid fuzzy or cross-Revision similarity grouping.
**ID:** REQ-003

#### Scenario: Exact repeated item detection

- **WHEN** multiple Reviews use the same Template Revision and Question row
- **THEN** the rollup groups them only when `templateRevisionId` and `questionId` match exactly
- **AND** the grouped item shows each contributing Review and subject
- **AND** equivalent text from another Revision or Template remains separate
- **ID:** AC-010

#### Scenario: Source context display

- **WHEN** a rollup is displayed
- **THEN** it shows Template, Revision number, Pillar, Question ID, Review, and subject context
- **AND** the user can drill into the source assessment Question
- **AND** the UI identifies whether contributors come from Product-level, application-linked, or Team-owned Reviews
- **ID:** AC-011

#### Scenario: Many contributing Reviews

- **WHEN** a repeated item appears in more than three contributing Reviews
- **THEN** the first contributing Review links appear inline
- **AND** remaining Reviews are available through a `+N more` dropdown
- **AND** each item opens the exact Revision Question in a new tab
- **ID:** AC-012

### Requirement: Team Improvement Plan

The application SHALL provide a Team-level Improvement Plan that rolls up exact Revision-specific attention items across Reviews for one Team.
**ID:** REQ-004

#### Scenario: Team plan route

- **WHEN** a user opens `/teams/:teamId/plan`
- **THEN** the page title is `Improvement Plan`
- **AND** the Team Details page links to the Team plan
- **ID:** AC-013

#### Scenario: Team rollup contributors

- **WHEN** active Team Reviews contribute attention items
- **THEN** items group only when Template Revision and Question row identities match exactly
- **AND** each contributor link opens the source assessment Question
- **ID:** AC-014

### Requirement: Product Improvement Plan

The application SHALL provide a product-level Improvement Plan that explains which contributors are affecting product readiness.
**ID:** REQ-001

#### Scenario: Product plan route

- **WHEN** a user opens a product plan
- **THEN** the route is `/products/:productId/plan`
- **AND** the page title is "Improvement Plan"
- **AND** the page subtitle frames the view as product readiness contributors rather than team or application judgement
- **ID:** AC-001

#### Scenario: Product-level reviews as contributors

- **WHEN** a product has reviews whose subject is the product itself
- **THEN** those reviews appear as first-class readiness contributors
- **AND** product-level reviews are included even when no applications are selected for the review
- **AND** product-level review areas such as launch readiness, roadmap, communications, branding, support, and go-to-market readiness are not forced into application or team categories
- **ID:** AC-002

#### Scenario: Application contributors

- **WHEN** product-associated applications have linked reviews or are selected within product reviews
- **THEN** those applications appear as readiness contributors
- **AND** each application contributor shows follow-up, not-assessed, and top-area counts derived from its contributing reviews
- **AND** users can drill into the relevant review plan or assessment
- **ID:** AC-003

#### Scenario: Team contributors

- **WHEN** product-associated teams have reviews that contribute to the product's readiness
- **THEN** those teams appear as readiness contributors
- **AND** each team contributor shows follow-up, not-assessed, and top-area counts derived from its contributing reviews
- **AND** users can drill into the relevant review plan or assessment
- **ID:** AC-004

#### Scenario: Contributor summary table

- **WHEN** the product plan displays contributors
- **THEN** contributors are shown in a table-first view by default
- **AND** each contributor row shows name, contributor type, follow-up count, not-assessed count, and top area
- **AND** contributor type distinguishes Product review, Application, and Team
- **AND** the table uses the layered section-card pattern so contributors remain visually separated from the page background
- **AND** the view can be filtered by contributor type without shifting page layout
- **ID:** AC-005

#### Scenario: Product plan tone

- **WHEN** contributor readiness is displayed
- **THEN** the UI uses language such as "Where readiness needs attention", "Where confidence is still unknown", and "Which contributors need support"
- **AND** the UI does not rank contributors as failing or passing
- **AND** severity and counts are used to guide prioritization without assigning blame
- **ID:** AC-006

### Requirement: Product Cross-Review Rollups

The Product plan SHALL aggregate exact repeated plan items across contributing Reviews by Revision-specific identity.
**ID:** REQ-002

#### Scenario: Exact Product rollup grouping

- **WHEN** the same Revision Question appears in multiple contributing Reviews
- **THEN** the Product plan groups it only when `templateRevisionId` and `questionId` match exactly
- **AND** the grouped item lists each source Review and contributor
- **AND** similar wording from another Revision or Template remains separate
- **ID:** AC-007

#### Scenario: Product rollup drilldown

- **WHEN** a user selects a repeated Product-plan item
- **THEN** the user can see which Product-level Reviews, applications, or Teams contributed
- **AND** each source link opens the exact Revision Question
- **ID:** AC-008

#### Scenario: Many source contributors

- **WHEN** a repeated item appears in many contributing Reviews
- **THEN** only the first source links are shown inline
- **AND** remaining source links are available from a `+N more` dropdown
- **AND** each link opens the exact Revision Question in a new tab
- **ID:** AC-009
