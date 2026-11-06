## ADDED Requirements

## MODIFIED Requirements

### Requirement: Review Details Page

The application SHALL provide a dedicated page for viewing review status, progress, and metadata before entering the assessment flow.

#### Scenario: Review details header

- **WHEN** viewing the review details page
- **THEN** the page displays the review name as the main heading
- **AND** displays template names using readability-first inline text/chips (1-3 template labels)
- **AND** displays a status badge (draft, in-progress, completed)
- **AND** provides a prominent "Continue Assessment" button
- **AND** includes breadcrumb navigation: "Teams / [Team Name] / [Review Name]" for team reviews, "Products / [Product Name] / [Review Name]" for product reviews

#### Scenario: Review metric cards

- **WHEN** viewing the review details page
- **THEN** metric cards are displayed with gradient borders for visual distinction
- **AND** cards show: Overall Progress (%), Items Needing Attention (count), Questions Answered (X of Y), Last Activity (relative date)
- **AND** the Items Needing Attention card shows a sub-label splitting follow-up and not-assessed counts
- **AND** the Items Needing Attention card is clickable and navigates to the contextual `/plan` page for the review
- **AND** Last Activity card shows who performed the last action if available
- **AND** cards match the styling of Application Details metric cards

#### Scenario: Pillars breakdown table

- **WHEN** viewing the review details page with pillars
- **THEN** a "Pillars" section displays a data table
- **AND** the table shows columns: Pillar Name, Progress, Questions (answered/total), Actions Needed
- **AND** the Progress column shows a visual progress bar with percentage
- **AND** rows are clickable for future pillar navigation
- **AND** the table uses the reusable DataTable component

#### Scenario: Pillars empty state

- **WHEN** the review has no pillars loaded
- **THEN** an appropriate empty or loading state is displayed
- **AND** the empty state uses consistent styling with other empty states

#### Scenario: Reviewers display

- **WHEN** viewing the review details page
- **THEN** assigned reviewers are displayed as an avatar group
- **AND** avatars show stacked circles with initials
- **AND** hovering reveals a tooltip or popover with full names
- **AND** if no reviewers are assigned, an appropriate empty state is shown

#### Scenario: History section placeholder

- **WHEN** viewing the review details page
- **THEN** a "History" section is displayed
- **AND** the section shows a placeholder indicating lineage features are coming
- **AND** the placeholder uses appropriate styling and iconography

#### Scenario: Continue Assessment action

- **WHEN** a user clicks "Continue Assessment"
- **THEN** the application navigates to the assessment page
- **AND** the assessment page loads with the review's current state
- **AND** the route is `/:context/:contextId/reviews/:reviewId/assessment` where context is `teams` or `products`

#### Scenario: Review details navigation

- **WHEN** clicking a review from a Team Details or Product Details page
- **THEN** the application navigates to the Review Details page (not directly to assessment)
- **AND** the route is `/teams/:teamId/reviews/:reviewId` for team reviews
- **AND** the route is `/products/:productId/reviews/:reviewId` for product reviews

#### Scenario: Command palette integration

- **WHEN** the command palette is open on the Review Details page
- **THEN** a "Continue Assessment" command is available
- **AND** a "View Improvement Plan" command is available
- **AND** pillar jump commands are available (e.g., "Go to Security pillar")
- **AND** commands navigate appropriately

### Requirement: Actions Needed Calculation

The backend and local read model MUST calculate items needing attention based on assessment answers, checklist completeness, and N/A state.

#### Scenario: Items from unanswered questions

- **WHEN** calculating items needing attention for a review
- **THEN** each unanswered question counts as one not-assessed item
- **AND** not-assessed items are included in the items-needing-attention total
- **AND** questions marked as "Not Applicable" do not count as not-assessed items

#### Scenario: Items from negative answers

- **WHEN** calculating items needing attention for a review
- **THEN** each yes/no question answered "No" counts as one follow-up item
- **AND** follow-up items are included in the items-needing-attention total
- **AND** the calculation excludes inactive questions

#### Scenario: Items from checklist gaps

- **WHEN** calculating items needing attention for a checklist question
- **THEN** unchecked checklist items that are not marked N/A create one checklist gap item for the question
- **AND** the item includes counts for checked, N/A, and still-needs-review checklist items
- **AND** a checklist question with every item checked or marked N/A does not count as an active item needing attention

#### Scenario: Documented N/A exceptions

- **WHEN** calculating items needing attention for questions marked N/A
- **THEN** N/A questions are excluded from the primary total
- **AND** N/A questions are available as documented exceptions in the plan filters
- **AND** N/A reasons are preserved for user review

#### Scenario: Attention count breakdown

- **WHEN** displaying review-level attention counts
- **THEN** the system provides separate counts for follow-up, checklist gaps, not assessed, and documented exceptions
- **AND** the primary count is the sum of follow-up, checklist gaps, and not-assessed items
- **AND** documented exceptions are not included in the primary count

## REMOVED Requirements
