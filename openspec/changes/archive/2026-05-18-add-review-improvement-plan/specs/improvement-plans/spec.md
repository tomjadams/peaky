## ADDED Requirements

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

The system SHALL support cross-review rollups using exact identity matches and SHALL avoid fuzzy similarity grouping.

#### Scenario: Exact repeated item detection

- **WHEN** multiple reviews contain the same template question
- **THEN** the rollup groups them only when template identity and question identity match exactly
- **AND** the grouped item shows each contributing review and subject
- **AND** the rollup does not merge merely similar question text from different templates

#### Scenario: Source context display

- **WHEN** a rollup item is displayed
- **THEN** it shows template, pillar, question ID, review, and subject context
- **AND** the user can drill into the source assessment question
- **AND** the UI makes it clear whether repeated items come from product-level, application-linked, or team-owned reviews

#### Scenario: Many contributing reviews

- **WHEN** a repeated item appears in more than three contributing reviews
- **THEN** the rollup shows the first contributing review links inline
- **AND** the remaining contributing reviews are available through a "+N more" dropdown
- **AND** each dropdown item opens the exact assessment question in a new tab

### Requirement: Team Improvement Plan

The application SHALL provide a team-level Improvement Plan that rolls up repeated attention items across reviews for a single team.

#### Scenario: Team plan route

- **WHEN** a user opens a team plan
- **THEN** the route is `/teams/:teamId/plan`
- **AND** the page title is "Improvement Plan"
- **AND** the Team Details page links to the team plan

#### Scenario: Team rollup contributors

- **WHEN** the team plan loads
- **THEN** active team reviews appear as contributors
- **AND** repeated items are grouped by exact template and question identity
- **AND** each contributor link opens the source assessment question

## MODIFIED Requirements

## REMOVED Requirements
