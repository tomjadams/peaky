# Maturity Score Specification

## ADDED Requirements

### Requirement: Versioned Maturity Definition

The system SHALL store one maturity definition as part of each immutable published TemplateRevision and SHALL keep reviews pinned to that definition.
**ID:** REQ-009

#### Scenario: Published definition is pinned

- **WHEN** a review selects a published TemplateRevision
- **THEN** every maturity calculation SHALL use the definition stored with that TemplateRevision
- **AND** later draft or published revisions SHALL NOT change the review's calculation
- **ID:** AC-009

#### Scenario: Definition uses configured defaults

- **WHEN** an author has not changed maturity configuration
- **THEN** the definition SHALL persist boundaries at 5, 25, 50, and 75 percent
- **AND** the narrow first band SHALL keep `Not implemented` below 5 percent
- **AND** checklist practices SHALL use equal shares
- **AND** stage guidance SHALL remain unset
- **ID:** AC-010

#### Scenario: Definition publishes atomically

- **WHEN** a shared template draft is published
- **THEN** its validated maturity definition SHALL freeze in the same TemplateRevision as its template content
- **AND** publication SHALL NOT expose a TemplateRevision with only one of those parts updated
- **ID:** AC-040

#### Scenario: Retired revision keeps calculating

- **WHEN** a review is pinned to a TemplateRevision whose status is retired
- **THEN** maturity SHALL continue to calculate from that pinned definition
- **AND** the result SHALL identify the pinned TemplateRevision as retired
- **ID:** AC-044

### Requirement: Maturity Authoring Contract

Template Studio SHALL distinguish the calculated Score stage from authored Follow-up placement, while the stored definition continues to call placement a stage association. It SHALL keep direct score-range editing separate, provide one static scoring reference for authors, and preserve compatible allocation and guidance data that the simplified UI does not expose.
**ID:** REQ-010

#### Scenario: Five-stage Score profile supports direct stage-start editing

- **WHEN** an author views a template's maturity configuration
- **THEN** the action row SHALL keep `Score stages` on the left and the stable label `Adjust score ranges` with a trailing down or up chevron on the right
- **AND** the only stage object SHALL be one raised spectrum plate containing all five fixed stage names and range labels
- **AND** every default, custom, or invalid stored range label SHALL use `<lower> to under <upper>%`, except the final range SHALL use `<lower> to 100%`
- **AND** closed range editing SHALL render no sliders or numeric boundary fields
- **WHEN** the author opens `Adjust score ranges`
- **THEN** the same plate SHALL add one 0 to 100 rail whose five bands use the exact threshold widths and four ordered seam sliders with plain percentage labels and visible grips
- **AND** it SHALL state `Drag a handle. Select it to type an exact percentage.` before selection
- **AND** focusing or selecting a seam SHALL reveal one compact numeric editor in a fixed-height lane, labelled only with the next stage such as `Ad-hoc starts at`
- **AND** selection SHALL remain visible while the numeric editor has focus and SHALL NOT resize the plate
- **AND** each seam SHALL expose a permanent left-to-right tab stop, a 44 by 44 pixel target, its next-stage name, current value and text, and dynamic legal minimum and maximum
- **AND** the equal-width stage legend SHALL remove its full-width accents and vertical dividers while editing, retaining only short color swatches, names, and live ranges
- **AND** Arrow keys SHALL move one point, Page keys five points, Home to the legal minimum, End to the legal maximum, and Enter SHALL focus its numeric editor
- **AND** pointer movement SHALL snap to whole percentages, update the rail and range labels in the same frame, use pointer capture, and serialize exactly one threshold mutation on pointer end when changed
- **AND** legal values SHALL use base intervals `[5,30]`, `[15,50]`, `[40,70]`, and `[65,90]`, intersected with each neighboring boundary plus or minus the five-point minimum stage width
- **AND** stored or typed invalid values SHALL stay visible with a field error, SHALL NOT be silently clamped, and SHALL disable dragging until a valid numeric repair or reset
- **AND** Enter or blur SHALL commit a valid integer numeric value, while Escape SHALL cancel the text edit and return focus to its seam
- **AND** `Use default ranges` SHALL remain in the action row for the edit session, SHALL be disabled at 5, 25, 50, and 75 percent, and SHALL reset all four values atomically
- **AND** one polite live region SHALL announce completed pointer, numeric, reset, and paused keyboard changes without announcing pointer movement
- **AND** narrow layouts SHALL keep the same plate, stack five stage rows, and place one full-width slider and compact numeric field at each adjacent-stage seam without horizontal page overflow
- **ID:** AC-032

#### Scenario: Existing severity derives maturity weight

- **WHEN** an author changes a question's severity through ordinary question authoring
- **THEN** maturity SHALL derive Medium weight 1, High weight 2, or Critical weight 3 from that severity
- **AND** maturity authoring SHALL NOT expose an independent editable weight
- **ID:** AC-033

#### Scenario: Score range editing is isolated

- **WHEN** an author enters Adjust score ranges
- **THEN** only stage boundaries SHALL become editable
- **AND** question guidance, stage associations, and checklist allocation SHALL remain unchanged
- **ID:** AC-011

#### Scenario: Advanced thresholds are valid

- **WHEN** an author saves advanced thresholds
- **THEN** every boundary SHALL be within 10 percentage points of the current or supported legacy default profile
- **AND** every stage SHALL span at least 5 percentage points
- **AND** invalid boundaries SHALL prevent publication with field-addressable errors
- **ID:** AC-012

#### Scenario: Stored custom checklist allocation remains compatible

- **WHEN** a legacy definition contains a custom allocation for a checklist question
- **THEN** a valid allocation whose practice percentages total exactly 100 percent SHALL continue to round-trip and score unchanged
- **AND** Template Studio SHALL expose no custom-share editor or per-practice point arithmetic
- **AND** it SHALL identify the compatibility state and offer Use equal weighting as a one-way reset
- **AND** a checklist structure change that makes stored custom shares incompatible SHALL recover to equal weighting
- **AND** any other invalid allocation SHALL block local save and publication with a field-addressable error and the same equal-weight recovery
- **ID:** AC-013

#### Scenario: Guidance does not affect scoring

- **WHEN** only question or practice stage guidance changes
- **THEN** the calculation trace and maturity result SHALL remain byte-equivalent
- **ID:** AC-014

#### Scenario: Authoring enforces ten-question maximum

- **WHEN** an author attempts to add an eleventh question
- **THEN** Template Studio SHALL prevent the addition with a field-addressable maximum-question error
- **AND** publication validation SHALL independently reject any draft containing more than ten questions
- **ID:** AC-041

#### Scenario: Authoring scoring reference stays static

- **WHEN** an author opens `How scoring works` in maturity authoring
- **THEN** the stable label SHALL remain unchanged and its trailing chevron SHALL point up
- **AND** bare compact rows SHALL state the formula `points earned ÷ weighted points available = maturity`, the Medium 1, High 2, and Critical 3 question weights, and the checklist, unanswered, and N/A answer rules
- **AND** the rows SHALL add no card, panel, border, or shadow
- **AND** authoring SHALL NOT show earned values, point totals, current question mix, coverage, percentage, or a calculated stage because it has no answers
- **AND** it SHALL NOT show per-practice percentages or maximum-point arithmetic beside Follow-up placement
- **ID:** AC-045

#### Scenario: Follow-up placement stays separate from scoring

- **WHEN** an author sets the Follow-up placement for a question or practice
- **THEN** Template Studio SHALL state that placement groups explicit gaps in Follow-ups
- **AND** the definition SHALL persist that choice as a stage association
- **AND** placement SHALL NOT change the percentage or Score stage earned
- **ID:** AC-046

#### Scenario: Stored guidance remains bounded

- **WHEN** a definition contains legacy stage, question, or practice guidance
- **THEN** each guidance value SHALL be at most 240 characters
- **AND** the system SHALL preserve valid guidance without exposing guidance controls in the simplified authoring UI
- **AND** over-limit guidance SHALL block local save and publication with a field-addressable error and an action to remove the invalid hidden value
- **ID:** AC-047

#### Scenario: Authoring teaches scoring through Template Preview

- **WHEN** an author views maturity configuration
- **THEN** the overview SHALL show all five stage names and score ranges without a separate grouping example
- **AND** hovering or focusing any stage SHALL reveal its canonical description in the shared stage popover
- **AND** a `Test maturity scoring` action SHALL open the ordinary Template Preview
- **WHEN** the author answers questions in that Preview
- **THEN** it SHALL run those temporary answers through the production calculator and show only the rounded score, exact Score stage resolved before rounding, coverage, and provisional or no-result state by default
- **AND** `How scoring works` SHALL keep one stable label beside coverage with a trailing down/up chevron for closed/open state
- **AND** it SHALL open a `Live calculation` section labelled `Updates with every answer`
- **AND** one raised plate SHALL contain the earned-points divided by weighted-available-points equation in persistent inline flow
- **AND** the available operand SHALL state how many questions supply that weighted total
- **AND** a compact `Current question mix` row SHALL show only nonzero Medium, High, and Critical question counts with their point multipliers
- **AND** one wrapping `Scoring rules` row SHALL show checklist, unanswered, and N/A cues with small semantic icons
- **AND** a `Note` row after `Scoring rules` SHALL explain that assessment participants see the live maturity result but not severity labels, point totals, available points, or the current question mix, so answers stay focused on evidence instead of increasing the score
- **AND** these supporting rows SHALL add no panel, border, divider, or shadow
- **AND** hovering or focusing the live stage SHALL reveal its canonical meaning, proportionally sized stage bands, the current percentage, and the next stage threshold
- **AND** the fixed Preview header SHALL state `Answers are not saved. Reloading this page clears them.` before the answer controls
- **AND** closing and reopening Preview SHALL retain temporary answers while reloading SHALL clear them and SHALL NOT persist them to a review
- **ID:** AC-048

#### Scenario: Default configuration presents as publishable

- **WHEN** an author opens maturity configuration for a draft that still uses defaults
- **THEN** the profile SHALL present as complete and publishable with no error affordance
- **AND** advanced threshold editing SHALL remain disclosed behind one action rather than shown by default
- **ID:** AC-049

#### Scenario: Authoring persists locally while publication is frozen

- **WHEN** an author saves maturity configuration while template publication returns `template_write_unavailable`
- **THEN** the definition SHALL commit atomically to the shared local draft Revision together with template content
- **AND** every validation in REQ-010 and REQ-017 SHALL run at local save with field-addressable errors
- **AND** Template Studio SHALL identify the configuration as local-only and offer no publish affordance
- **AND** publication SHALL remain the enforcement point for immutable pinning once the freeze lifts
- **ID:** AC-063

### Requirement: Mandatory Practice Stage Association

Every scored question and checklist practice SHALL have exactly one stored maturity stage association. Template Studio SHALL present that association to authors as Follow-up placement, and the system SHALL block publication until every association exists.
**ID:** REQ-017

#### Scenario: Every scored item carries one association

- **WHEN** an author configures maturity for a template draft
- **THEN** each question SHALL carry exactly one stage association
- **AND** each checklist practice SHALL carry exactly one stage association when its question distributes practices across stages
- **AND** no question or practice SHALL remain associated with more than one stage
- **ID:** AC-050

#### Scenario: Follow-up placement supports both editing modes

- **WHEN** an author edits Follow-up placement in Compact or Guided mode
- **THEN** a Yes or No question SHALL have one question-level placement control
- **AND** a checklist question SHALL have one placement control per practice
- **AND** the checklist SHALL also have one bulk control that sets every practice in one action
- **ID:** AC-051

#### Scenario: Unassociated item blocks publication and is discoverable

- **WHEN** a draft contains a question or practice with no stage association
- **THEN** publication SHALL be rejected with field-addressable errors identifying each unassociated item
- **AND** Template Studio SHALL provide an action that locates every unassociated question and practice
- **ID:** AC-052

#### Scenario: Association order is deterministic

- **WHEN** more than one question or practice is associated with the same stage
- **THEN** the definition SHALL persist a deterministic order within that stage
- **AND** every consumer SHALL present that same order
- **ID:** AC-053

#### Scenario: Association does not affect scoring

- **WHEN** only stage associations change
- **THEN** the calculated percentage, resolved stage, and calculation trace SHALL remain byte-equivalent
- **AND** stage association SHALL NOT guarantee or override the resolved stage
- **ID:** AC-054

### Requirement: Deterministic Maturity Calculation

The system SHALL calculate maturity per pinned TemplateRevision using questions as the primary scoring unit.
**ID:** REQ-011

#### Scenario: Yes or No question contributes

- **WHEN** a Yes or No question is applicable and answered
- **THEN** Yes SHALL produce a question result of 100 percent
- **AND** No SHALL produce a question result of 0 percent
- **AND** the contribution SHALL equal the result multiplied by the question's fixed severity weight
- **ID:** AC-015

#### Scenario: Checklist question contributes

- **WHEN** a checklist question has a recorded answer and applicable practices
- **THEN** its question result SHALL equal the summed configured share of met applicable practices divided by the summed configured share of all applicable practices
- **AND** its exact earned points SHALL equal its fixed severity weight multiplied by the summed configured share of met applicable practices
- **AND** its exact available points SHALL equal its fixed severity weight multiplied by the summed configured share of applicable practices
- **AND** its maximum earned points SHALL NOT exceed its fixed severity weight
- **AND** every applicable unchecked practice in an explicitly recorded empty or partial answer SHALL be an unmet gap
- **AND** an explicitly recorded empty answer SHALL count as answered while retaining the same zero earned points and full available points as the unanswered checklist
- **ID:** AC-016

#### Scenario: Severity supplies fixed weight

- **WHEN** a question contributes to maturity
- **THEN** Medium SHALL have weight 1
- **AND** High SHALL have weight 2
- **AND** Critical SHALL have weight 3
- **ID:** AC-017

#### Scenario: Template result uses questions directly

- **WHEN** at least one question has a scored applicable answer
- **THEN** the template result SHALL equal exact total earned points divided by exact total available applicable points
- **AND** exact total available applicable points SHALL include the full fixed weight of every unanswered question
- **AND** starting or recording another applicable answer SHALL NOT add weight that was absent from the prior denominator
- **AND** it SHALL NOT average pillar results
- **ID:** AC-018

#### Scenario: Arithmetic stays exact

- **WHEN** the system resolves a result against stage boundaries
- **THEN** it SHALL compare exact integer ratios
- **AND** it SHALL NOT round, scale, or convert to floating point before resolving the stage
- **AND** equal shares SHALL be represented as an exact ratio rather than distributed remainders
- **ID:** AC-055

### Requirement: Applicability and Coverage

The system SHALL keep applicability, answer coverage, and maturity as separate values.
**ID:** REQ-012

#### Scenario: Unanswered question is Not assessed

- **WHEN** a question has no stored answer
- **THEN** it SHALL remain in the unanswered state and reduce answer coverage
- **AND** it SHALL earn zero points while its full fixed severity weight remains available in the maturity denominator
- **AND** its question or practices SHALL be Not assessed and SHALL NOT become unmet gaps
- **ID:** AC-019

#### Scenario: N/A practice is excluded

- **WHEN** a checklist practice is marked N/A
- **THEN** only that practice's exact configured share of the question's fixed weight SHALL be removed from available points
- **AND** that practice SHALL earn zero points and remain excluded from gap projection
- **AND** remaining applicable practice shares SHALL NOT be normalized back to the question's full fixed weight for aggregate earned or available points
- **ID:** AC-020

#### Scenario: Whole checklist or all practices are N/A

- **WHEN** a checklist question is marked N/A as a whole or every practice is marked N/A
- **THEN** the question SHALL count as answered for coverage
- **AND** the question's full fixed weight SHALL be removed from available points
- **AND** the whole question and all of its practices SHALL be excluded from scoring and gap projection
- **ID:** AC-021

#### Scenario: No question has a scored applicable answer

- **WHEN** every configured question is unanswered or every recorded answer is wholly N/A
- **THEN** the system SHALL return no maturity result
- **AND** it SHALL NOT return a zero-percent maturity result or Stage 1
- **AND** an unanswered question SHALL remain applicable and available as specified by AC-019
- **ID:** AC-022

### Requirement: Stage Resolution

The system SHALL resolve one immutable stage name and canonical description from the unrounded normalized result and the pinned threshold profile.
**ID:** REQ-013

#### Scenario: Canonical ORR stages are fixed

- **WHEN** the system displays or exports a maturity stage
- **THEN** Stage 1 SHALL be `Not implemented` with canonical description `Practices are absent or not yet repeatable.`
- **AND** Stage 2 SHALL be `Ad-hoc` with canonical description `Practices exist in places but depend on individual effort.`
- **AND** Stage 3 SHALL be `Defined` with canonical description `Shared practices are documented and used consistently.`
- **AND** Stage 4 SHALL be `Measured` with canonical description `Practices are measured and improved using evidence.`
- **AND** Stage 5 SHALL be `Optimized` with canonical description `Practices are continuously improved and embedded.`
- **AND** template authors SHALL NOT rename a stage or replace its canonical description
- **ID:** AC-034

#### Scenario: Default stage boundaries

- **WHEN** equal Beta bands apply
- **THEN** results SHALL map to `0–<20`, `20–<40`, `40–<60`, `60–<80`, and `80–100`
- **AND** an exact boundary SHALL enter the higher stage
- **ID:** AC-023

#### Scenario: Display rounding does not change stage

- **WHEN** the displayed percentage is rounded
- **THEN** the stage SHALL remain the stage selected from the unrounded result
- **AND** the explanation SHALL identify the pinned threshold boundary
- **ID:** AC-024

#### Scenario: Primary percentage uses whole-number precision

- **WHEN** a maturity percentage is displayed in a result summary
- **THEN** the UI SHALL round it to a whole percentage
- **AND** How is this calculated SHALL expose the exact unrounded result used for stage resolution
- **AND** when display rounding crosses a threshold, the explanation SHALL state why the displayed percentage and stage appear to straddle that boundary
- **ID:** AC-035

### Requirement: Maturity Result Projection

The system SHALL project one maturity result per review and pinned TemplateRevision without creating cross-template maturity.
**ID:** REQ-014

#### Scenario: Multi-template review stays separate

- **WHEN** a review contains two or three pinned TemplateRevisions
- **THEN** the workspace SHALL return one result for each pinned TemplateRevision
- **AND** it SHALL NOT return a combined review maturity
- **ID:** AC-025

#### Scenario: Pillar result remains explanatory

- **WHEN** a result includes pillar breakdowns
- **THEN** a pillar SHALL have no percentage or stage until at least one question in that pillar has a scored applicable answer
- **AND** after such an answer exists, the pillar result SHALL use exact earned and available points and include every unanswered applicable question in that pillar at full fixed weight
- **AND** each resulting pillar SHALL show percentage, stage, coverage, and unanswered count
- **AND** no pillar value SHALL alter the complete template result
- **ID:** AC-026

#### Scenario: Result carries interpretation context

- **WHEN** a maturity result is displayed or exported
- **THEN** it SHALL identify review scope, status, coverage, calculated value, effective value, and override provenance
- **AND** it SHALL identify its TemplateRevision by both the user-facing revision number and the opaque revision identifier
- **ID:** AC-027

#### Scenario: Incomplete coverage qualifies the stage

- **WHEN** answer coverage for a pinned TemplateRevision is incomplete
- **THEN** every display of that result's stage SHALL qualify it as provisional
- **AND** the qualification SHALL be removed only when every applicable question is answered
- **ID:** AC-056

#### Scenario: Review Details keeps maturity inside the existing breakdown

- **WHEN** Review Details shows the active pinned TemplateRevision
- **THEN** the existing Breakdown section SHALL show one compact maturity estimate band with the effective stage, whole percentage, coverage, and provisional or Advisor-reviewed qualifier
- **AND** the band SHALL sit between the Revision selector and pillar table without becoming a separate page section
- **AND** it SHALL NOT show a combined Review score
- **ID:** AC-036

#### Scenario: Review Details adds pillar maturity on demand

- **WHEN** the Breakdown table lists the active TemplateRevision's pillars
- **THEN** it SHALL add one Maturity column without replacing progress, question, or attention data
- **AND** each available pillar value SHALL reveal its percentage, stage, canonical meaning, and one non-redundant coverage expression on hover or keyboard focus
- **AND** leaving a pointer-triggered value SHALL close its detail without stale or flickering overlays
- **AND** selecting a pillar row SHALL open a contribution drawer with the weighted pillar result and each question's current evidence
- **AND** a pillar without a result SHALL show an explicit compact unavailable state rather than zero percent
- **ID:** AC-037

#### Scenario: Review Details keeps maturity concise

- **WHEN** Review Details renders the active TemplateRevision's maturity
- **THEN** it SHALL show one Maturity estimate label, effective percentage, stage, and settled or provisional reason
- **AND** desktop layouts SHALL place it beside the active template selector with a quiet divider, while narrow layouts SHALL stack it
- **AND** it SHALL use the page's ordinary border rhythm without a tinted result card
- **AND** the pillar table SHALL calculate Progress from resolved checklist items and answered Yes or No questions, show question coverage as `Answered`, and reserve the weighted percentage for Maturity
- **AND** the compact summary SHALL NOT expose question weights, point fractions, thresholds, practice shares, a stage explorer, or a technical calculation control
- **AND** an authorized Advisor override entry MAY remain a quiet secondary action
- **AND** a non-result summary SHALL NOT duplicate the page's assessment action
- **ID:** AC-038

#### Scenario: Narrow Follow-ups switches between work areas

- **WHEN** review Follow-ups renders below the desktop workspace width
- **THEN** it SHALL show one two-view switch for Needs attention and Handoff with the selected count
- **AND** switching views SHALL preserve queue filters, selection, order, and focus context
- **AND** it SHALL NOT use a fixed handoff overlay or a draft slideover
- **ID:** AC-059

#### Scenario: Practice lists are filterable with a visible count

- **WHEN** a result surface lists practices
- **THEN** it SHALL offer pillar and question-severity filters scoped to one TemplateRevision
- **AND** each filter SHALL list only values present in the current queue
- **AND** it SHALL keep each displayed evidence state explicit rather than deriving state from placement
- **AND** it SHALL display how many practices the active filters show
- **ID:** AC-057

#### Scenario: Follow-ups restores severity as the scan order

- **WHEN** Follow-ups lists source questions with explicit gaps
- **THEN** it SHALL group and order them Critical, High, then Medium
- **AND** stage placement SHALL NOT repeat on each practice row or control action priority
- **ID:** AC-058

#### Scenario: Missing definition has an explicit state

- **WHEN** a pinned TemplateRevision carries no maturity definition
- **THEN** the surface SHALL present an explicit no-definition state that explains why no result exists
- **AND** it SHALL NOT present a zero-percent result, an empty stage path, or a duplicate assessment action
- **ID:** AC-060

#### Scenario: Filtered-empty list has an explicit state

- **WHEN** active filters match no practices
- **THEN** the surface SHALL present an explicit empty state
- **AND** it SHALL offer an action that clears the active filters
- **ID:** AC-061

#### Scenario: Review Follow-ups keeps maturity subordinate to the handoff

- **WHEN** review Follow-ups displays maturity
- **THEN** it SHALL show one compact result context for the active pinned TemplateRevision beside related practices
- **AND** the ordered handoff SHALL remain visible while the user scans and selects practices
- **AND** it SHALL NOT show a combined Review maturity
- **ID:** AC-039

#### Scenario: Maturity views stay navigable

- **WHEN** maturity is presented outside Review Details
- **THEN** review Follow-ups SHALL keep compact per-TemplateRevision context and team and product Follow-ups SHALL keep compact per-review context
- **AND** review Follow-ups SHALL preserve one assessment deep link per source question and a return path after that visit
- **AND** team and product context SHALL link to the contributing review
- **ID:** AC-062

#### Scenario: Over-limit pinned definition has no result

- **WHEN** a pinned TemplateRevision contains more than ten questions
- **THEN** the system SHALL return a maturity configuration error for that TemplateRevision
- **AND** it SHALL return no calculation trace, percentage, stage, pillar result, or effective maturity value
- **ID:** AC-042

### Requirement: Follow-ups Template Structure

Review Follow-ups SHALL keep compact maturity context, evidence selection, and an ordered handoff under one visible pinned TemplateRevision at a time. The route and internal component names MAY retain `/plan` and `ImprovementPlan` for compatibility, but the visible product name SHALL be Follow-ups.
**ID:** REQ-018

#### Scenario: Template identity scopes Follow-ups

- **WHEN** a review has pinned TemplateRevisions
- **THEN** Follow-ups SHALL present visible desktop Revision tabs and a compact mobile selector when more than one is pinned, and a static Revision identity when exactly one is pinned
- **AND** each option or identity SHALL show the template name, revision, and result or explicit non-result summary
- **AND** the maturity context, evidence list, pillar filter, and handoff selection SHALL be scoped to the active TemplateRevision
- **AND** no combined cross-template maturity SHALL appear
- **ID:** AC-064

#### Scenario: Maturity stays context on Follow-ups

- **WHEN** Follow-ups shows the active TemplateRevision
- **THEN** the cut mat SHALL label the active choice `Selected template` and show its effective percentage, stage, coverage, and provisional or Advisor-reviewed state
- **AND** a selected handoff preview SHALL remain hidden until the Stage popover is opened
- **AND** it SHALL NOT render a persistent stage explorer, route, waypoint selection, pillar score table, or technical calculation
- **AND** maturity SHALL remain subordinate to the Needs attention queue and Handoff composer
- **ID:** AC-065

#### Scenario: Queue filtering does not repeat Review Details

- **WHEN** a template's Follow-ups view renders
- **THEN** its pillar, available-severity, and Handoff status filters SHALL apply to every evidence group with a visible count per AC-057
- **AND** `Refine` SHALL open a right-side panel rather than a viewport-dependent popover
- **AND** it SHALL leave the percentage, stage, and coverage table on Review Details rather than repeat it beside the handoff
- **ID:** AC-066

#### Scenario: Follow-up selection leads into one ordered handoff

- **WHEN** Follow-ups renders evidence for a pinned Revision
- **THEN** it SHALL show explicit unmet practices in a Needs attention queue grouped Critical, High, then Medium by source-question severity
- **AND** each source question SHALL retain Question details with one exact assessment action
- **AND** every explicit unmet practice SHALL show its authored text, per-practice calculated potential, and a full-row handoff selection control
- **AND** unanswered evidence SHALL appear once per source question in a separate non-selectable section, and N/A evidence SHALL remain excluded
- **AND** a Revision without an effective maturity result SHALL use the same severity-first queue without relative stage language
- **AND** an in-page Handoff composer SHALL remain beside the queue on desktop and in a dedicated Handoff view on narrow screens
- **AND** the composer SHALL expose visible ordering, optional rationale, removal, Copy Markdown, potential movement toward the next stage, local completion, completion history, existing-ticket association, degraded-sync truth, and replacement recovery
- **AND** copying immediately after a reorder SHALL use the visible order
- **AND** no duplicate practice list, fixed mobile handoff overlay, or draft slideover SHALL render
- **ID:** AC-067

#### Scenario: Rollup Follow-ups group by contributing review

- **WHEN** team or product Follow-ups renders
- **THEN** it SHALL rank repeated items by contributing-review count and label the source table Contributor factors
- **AND** each source SHALL retain its review's per-template stage context and coverage
- **AND** it SHALL NOT compute or imply a team or product maturity score
- **ID:** AC-068

#### Scenario: Selected practices preview exact maturity movement

- **WHEN** a user selects unmet practices from one pinned TemplateRevision
- **THEN** the preview SHALL derive exact weighted movement from that Revision's calculation trace
- **AND** a negative Yes or No practice SHALL use the full question weight while a checklist practice SHALL use its saved share of the question weight
- **AND** per-practice potential, current result, projected result, delta, stage crossing, and remaining stage gap SHALL use the same exact calculation
- **AND** a full movement bar SHALL say that the next stage was reached, while rounded display values SHALL NOT fill the bar unless the exact result crosses the threshold
- **AND** the UI SHALL keep each Revision separate, label the preview as calculated, and SHALL NOT alter an Advisor-reviewed result
- **ID:** AC-069

#### Scenario: Assessment teaches maturity through live answers

- **WHEN** a user changes an answer in Assessment
- **THEN** the active Revision's maturity estimate SHALL update from in-memory answers before the local save debounce
- **AND** the live result SHALL stay inside the existing Progress row without adding a second result card
- **AND** an information control SHALL state that Template Authors set question severity, higher severity gives more points, checklist items share their question's points, unanswered questions earn zero points, and N/A removes the question or item's points instead of scoring them as zero
- **ID:** AC-070

#### Scenario: Pillar drawer explains question contribution

- **WHEN** a user selects a pillar row in Review Details
- **THEN** the drawer SHALL show the weighted pillar result and each question's answer state and own evidence percentage
- **AND** a checklist meter SHALL progressively reveal the first five met, unmet, or not-counted checklist items, with an explicit action to show any remaining items
- **AND** only one question's checklist evidence SHALL be expanded at a time
- **AND** the drawer SHALL NOT forecast question opportunity or present a question evidence percentage as template percentage points
- **ID:** AC-071

### Requirement: Calculation Explanation

The system SHALL derive any maturity explanation or export from the same calculation trace rather than a separate recalculation. Review Details and Follow-ups MAY omit technical calculation detail when it competes with their primary task.
**ID:** REQ-015

#### Scenario: Explanation identifies inputs

- **WHEN** a user opens How is this calculated
- **THEN** the system SHALL render question text, severity weight, answer result, practice shares, exclusions, earned points, available points, thresholds, coverage, and override provenance from the trace
- **ID:** AC-028

#### Scenario: Complete denominator is used

- **WHEN** the UI displays only representative question rows
- **THEN** the explanation SHALL still calculate from every applicable question in the pinned TemplateRevision
- **AND** it SHALL identify any summarized remaining contribution
- **ID:** AC-029

### Requirement: Advisor-Reviewed Maturity

The system SHALL preserve calculated maturity when an authorized Advisor records a reviewed result.
**ID:** REQ-016

#### Scenario: Advisor result is primary

- **WHEN** a current Advisor-reviewed result exists
- **THEN** the UI SHALL display it as the effective result with an override indicator
- **AND** the calculated result, actor, explanation, evidence, and time SHALL remain available
- **ID:** AC-030

#### Scenario: Override is append-only

- **WHEN** an Advisor replaces or revokes a reviewed result
- **THEN** the system SHALL preserve the prior override in history
- **AND** every consumer SHALL resolve the same current effective value
- **ID:** AC-031

#### Scenario: Any current Advisor may transition the override

- **WHEN** any currently assigned Advisor authorized by the Advisor Override Authorization requirement supersedes or revokes the current override
- **THEN** the new transition SHALL become current
- **AND** prior transitions and their actors SHALL remain immutable history
- **ID:** AC-043
