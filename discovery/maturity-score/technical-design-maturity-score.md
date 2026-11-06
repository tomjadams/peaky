---
discovery_version: "2.7.0"
---

# Tech Design Document: Maturity Score

| Document control | Detail |
| --- | --- |
| **Authors** | Unassigned |
| **Asks to the reader** | Develop the calculation, data, audit, and projection design from the agreed product rules. Sections marked "Not explored yet." are deliberately deferred, not gaps. |
| **Reviewers** | To be identified |
| **Last updated** | 2026-08-26 |
| **Status** | Draft |
| **Revision** | td18 |
| **Decision** | Maturity contracts accepted; Template upgrade policy deferred |
| **Supporting documents** | [`discovery-notes-maturity-score.md`](discovery-notes-maturity-score.md) |

ID legend: TQ = technical question · TE = technical evidence · RISK = risk · SR-E = synthetic engineering review finding · PQ / DEC = product question / decision, owned by the briefing notes.

## 1. Executive Summary

Peaky needs to infer one live Maturity Score per pinned template version from yes/no and checklist assessment answers. Each result describes the full named review scope, not inherent team, service, or product maturity. Questions remain the primary scoring unit. Severity supplies fixed question weights: Medium 1, High 2, and Critical 3. Checklist items use equal shares by default, with advanced custom percentages contained inside the parent question. N/A and untouched questions are excluded. Fixed names and descriptions define five user-facing stages. Beta uses equal 20% bands, with bounded advanced thresholds. Each projection shows the current stage, percentage, coverage, completed evidence, current gaps, and a categorical five-stage path.

Template Studio is the first authoring surface for this contract. It presents one canonical five-stage profile edited in place rather than in a modal, so the distribution stays visible while boundaries move; fixed severity-derived question weights; equal or validated custom checklist allocations showing each practice's share and maximum points; one mandatory author-assigned stage association per question and practice, assignable in bulk; optional scoring-independent stage guidance bounded to 240 characters; and a live worked example computed by the same calculator from the draft definition. A result stage reads as provisional until answer coverage is complete, practice lists filter by pillar and met or unmet state with a visible count, and missing-definition, over-limit, and filtered-empty states are explicit rather than rendered as zero. The first Beta increment has no required Jira, ITSM, Looker, or other external-system dependency. The provider-neutral handoff UI may be implemented behind a deployment flag that is disabled before release. A separate integration capability gates every network side effect. Review analytics and live provider operations remain deferred. The flagged handoff iteration persists and synchronizes ordered practice drafts and existing-ticket associations without calling any provider.

The current consolidated validation artifact presents Authoring and the prioritized Improvement Plan as two product views under one persistent runtime toolbar, not as product options. Only the prioritized cross-template handoff remains from the earlier handoff comparison. This artifact composition supports lifecycle walkthroughs but does not expand first-increment Beta scope.

Advisor-reviewed maturity remains the primary displayed result while calculated maturity and override provenance remain available. Initial override actions require current persisted `reviewer` assignment, displayed as Advisor, plus review edit access; any current Advisor may supersede or revoke through append-only history. Maturity configuration belongs to TemplateRevision and publishes atomically with template content. Template patch/minor/major classification, explicit review upgrades, reassessment, migration, and impact preview remain deferred.

## 2. Background

### 2.1. Terminology

| Term | Definition |
| --- | --- |
| Maturity Score | A result inferred for one template from its applicable assessment answers and scoring configuration |
| Fixed severity weight | The question's influence within its template: Medium 1, High 2, or Critical 3 |
| Checklist item percentage | An item's share inside one checklist question; all applicable shares are recalculated together and never increase the parent question's fixed severity weight |
| Maturity calculation inputs | Template-version data used by the calculation, including questions, severity, checklist percentages, N/A state, and stage thresholds |
| Calculated maturity | The score produced from answers and scoring configuration before an Advisor override |
| Advisor-reviewed maturity | The primary displayed maturity after an Advisor records an alternative with actor, explanation, and evidence |
| Answer coverage | The proportion of questions answered; unanswered questions stay outside the live score denominator |
| Canonical stage description | The immutable meaning of a maturity stage across every template |
| Maturity profile | The one canonical five-stage overview in Template Studio, including immutable stage meaning and the configured score ranges |
| Stage guidance | Optional author-written question or practice context associated with a stage; it never changes scoring or guarantees that stage |
| Configured default | The saved starting behavior used until an author changes it: equal 20% stage bands, equal checklist shares, and no stage guidance |
| Checklist allocation | Equal or custom practice shares inside one checklist question; custom shares must total 100% |
| Template stage context | Optional author-written guidance that applies the canonical meaning without replacing or redefining it |
| Threshold profile | A template-specific mapping from normalized attainment to the immutable 1–5 stages |
| Legacy ORR normalization | Beta compatibility mapping where ORR `0–4` values map to Peaky `1–5` values and exports reverse the mapping |
| N/A | An answer explicitly excluded from the applicable scoring denominator |
| Review scope | The complete set of applications or services covered by one review |
| Operational cue | A limited, actionable signal in Peaky; it is not a ranking, benchmark, or analytics view |
| Comparison cohort | Reviews analyzed under the same template version with scope, status, coverage, and override context |
| Pillar maturity | A per-pillar breakdown derived from the same template result; it is context, not an independent review, team, or product score |
| Provider work-item reference | An optional external key, URL, status, destination, sprint or iteration reference, or last-known update; Peaky does not thereby own the provider lifecycle |
| Suggested impact | An optional signal or initial ordering informed by fixed question severity; it is not priority or cost of delay |
| Practice | One handoff unit: a checklist item, or a Yes/No question represented as a standalone practice |
| Current ticket association | Peaky's single selected external reference for one practice; it is independent from assessment completion and observed ticket status |
| TemplateRevision | One immutable published template revision containing template content and its validated maturity definition |
| Maturity configuration error | A no-result state returned when a pinned definition violates publication invariants, including more than ten questions |
| HandoffLimits | One versioned contract for handoff character, collection, practice-count, and URL limits across TypeScript and Go, counted in Unicode characters and collection members |
| Stage association | The author-assigned stage a scored question or practice belongs to; mandatory, presentation-only, and never a guarantee of that stage |

### 2.2. Context

The linked briefing notes own product evidence and decisions. ORR 2026 supplies the feature-parity context, while Peaky must support templates authored by PX, Team Leads, Engineering Leads, and Staff+ engineers. Team Leads and Engineering Leads will usually prepare handoffs. They may associate existing Jira, YouTrack, or ITSM tickets because current ORR work can predate Peaky. Authoring and publishing permissions are outside this design. The product contract forbids cross-template and cross-version maturity comparison. Peaky exposes only enough cross-review context to support action in Review Details, Team views, and Improvement Plans. Looker owns deeper trends, segmentation, and cohort analysis.

### 2.3. Current State

The inspected ORR fixture contains one active 2026 template with four pillars, ten checklist questions, and 179 checklist items. Every ORR question in that fixture is a medium-risk checklist. No score, stage, threshold, or weight fields are present.

The question model permits yes/no and checklist answers. It supports `"yes"`, `"no"`, `"na"`, checklist item IDs, checked and N/A item sets, question-level N/A reasons, and item-level N/A reasons.

Merge request !368 removes Rules Manager, `ruleSets`, Rules persistence, and the old live `maturity-score` capability that described Rules rather than a runtime score. Its design explicitly leaves replacement Maturity Score behavior undefined.

Draft merge request !346 preserves shared structured Template authoring through metadata, pillar, and question units. It states that legacy `template_draft*` names are not the target model, that draft synchronization has no publication side effect, and that the future unified Template model and publication work own exact version fields. These sources establish boundaries for this design but do not define storage.

Review Improvement Plans already load a review workspace, derive attention items, show summary cards, and link each gap back to its assessment question. Team and product plans aggregate active review contributors and exact repeated gaps. Their contributor models carry gap summaries but no per-template maturity results.

The current review-plan adapter projects only the first selected template. Product and team plan loading caps contributors at ten. Exact gap rollups use template and question IDs but omit template-version identity. These constraints remain relevant to later scoped maturity context, but are not first-increment Beta dependencies.

The current Integrated Template Studio sketch is synthetic and uses no network. It exercises score-range editing, question and practice stage guidance, equal and custom checklist allocations, validation recovery, and a direct calculation explanation. The assembled HTML demonstrates interaction behavior only. Its authored source is the better input for tracing state names and transitions. Neither artifact establishes production storage, components, authorization, or accessibility compliance.

The corrected authoring fixture calculates its worked result from all 14 configured synthetic questions, displaying three representative rows and aggregating the remaining 11 to produce 39%. This confirms the full-template denominator rule, but the fixture is invalid under the settled ten-question maximum. Canonical acceptance fixtures use ten and fewer questions; over-limit pinned data returns a configuration error and no maturity result.

The consolidated lifecycle artifact keeps one static shared toolbar while swapping only product content below it. Authoring and prioritized Improvement Plan are views, not runtime options. Shared theme and density controls remain stable across the switch, while each embedded view preserves its product state.

The production Improvement Plan currently derives question-level `PlanItem` values rather than persisting them. Its identity includes review, template, pillar, question, optional template-version, and optional checklist-item IDs. The workspace adapter attributes all pillars to the first selected template. No handoff entities exist in the sync registry.

The sync engine resolves fields with HLC last-writer-wins ordering and returns rejected fields as `hlc_conflict`. This supports deterministic convergence for provider-neutral associations while no external side effect occurs. Public runtime configuration already gates client features, but no maturity-handoff flag exists.

### 2.4. Assumptions & Constraints

- **Constraint:** A template has at most ten questions, based on discovery-session product context.
- **Constraint:** Template Studio prevents an eleventh question, publication independently rejects over-limit drafts, and over-limit pinned data returns a configuration error with no maturity result.
- **Constraint:** A review uses at most three templates, based on discovery-session product context.
- **Constraint:** Maturity remains per template and is never rolled up across different templates, from [DEC-001](discovery-notes-maturity-score.md#dec-001).
- **Constraint:** Each score describes the entire named review scope, from [DEC-005](discovery-notes-maturity-score.md#dec-005).
- **Constraint:** Stage names and canonical descriptions are immutable across every template, from [DEC-007](discovery-notes-maturity-score.md#dec-007).
- **Constraint:** Peaky displays stages 1–5; legacy ORR import and export normalizes 0–4 values during Beta, from [DEC-007](discovery-notes-maturity-score.md#dec-007).
- **Constraint:** Beta maps normalized attainment to stages using equal 20% bands, from [DEC-007](discovery-notes-maturity-score.md#dec-007).
- **Constraint:** Advanced stage boundaries may move at most 10 percentage points from their equal-band default, and every stage must cover at least 10 percentage points, from the engineering deep-dive on 2026-08-14.
- **Assumption to validate:** Advanced threshold profiles can improve contextual fit, be versioned, and remain comparable safely; investigate through [TQ-001](#tq-001) and [TQ-006](#tq-006).
- **Constraint:** Unanswered questions stay outside the live denominator and answer coverage remains visible, from [DEC-008](discovery-notes-maturity-score.md#dec-008).
- **Constraint:** Peaky provides operational cues while Looker owns deeper analysis, from [DEC-009](discovery-notes-maturity-score.md#dec-009).
- **Assumption to validate:** Same-template-version partial results remain useful when scope, status, coverage, and override context are explicit; investigate through [TQ-005](#tq-005).
- **Constraint:** Questions use fixed severity weights: Medium 1, High 2, and Critical 3.
- **Constraint:** Reviews remain pinned to their selected published template version. Publishing a new version never updates existing reviews automatically, from [DEC-013](discovery-notes-maturity-score.md#dec-013).
- **Constraint:** Maturity configuration belongs to TemplateRevision and freezes atomically with template content. Existing reviews remain pinned.
- **Deferred policy:** Patch/minor/major classification, review upgrades, reassessment, migration, and impact preview belong to Template Versioning.
- **Assumption to validate:** Every score display can derive from one canonical calculation contract; investigate through [TQ-002](#tq-002).
- **Assumption to validate:** The high-signal projection remains accessible across themes, densities, list sizes, keyboard use, and reduced motion; investigate through [TQ-008](#tq-008).
- **Assumption to validate:** Provider work-item preview state can preserve provenance and remain reversible without changing remote state; investigate through [TQ-009](#tq-009).
- **Assumption to validate:** Per-pillar and next-stage context can clarify uneven maturity without creating target pressure; investigate through [PQ-011](discovery-notes-maturity-score.md#pq-011) and [TQ-004](#tq-004).
- **Assumption to validate:** Provider-neutral work-item references can make handoff trackable without Peaky owning external lifecycle; investigate through [TQ-010](#tq-010).
- **Constraint:** Score-range editing and stage-guidance authoring are separate jobs in Template Studio, from [DEC-014](discovery-notes-maturity-score.md#dec-014).
- **Constraint:** Stage guidance is optional, may be assigned to a question or checklist practice, and never changes the score or guarantees a stage, from [DEC-014](discovery-notes-maturity-score.md#dec-014).
- **Constraint:** The first Beta increment has no required external-system dependency. The provider-neutral handoff UI is deployment-flagged, while live provider operations require a separate integration capability, from [DEC-015](discovery-notes-maturity-score.md#dec-015).
- **Constraint:** One bulk handoff maps many practices to one external ticket. Each practice has at most one current external-ticket association, from [DEC-016](discovery-notes-maturity-score.md#dec-016).
- **Constraint:** Checklist items are practices. A Yes/No question is one standalone practice.
- **Constraint:** Assessment completion never changes the current ticket association. Only explicit replacement does.
- **Constraint:** Template-version identifiers are opaque strings; this domain compares them exactly and does not parse their format.
- **Constraint:** Initial override actions require a current `reviewer` assignment plus review edit access. Product labels that role Advisor; future Admin or exceptional grants require an explicit server-side Cedar action.
- **Constraint:** Handoff limits are rationale 2,000 characters; external and evidence IDs 128 characters; HTTPS URLs 2,048 characters; 10 helpful links and 20 evidence IDs per practice; and 50 practices per handoff. Every limit counts Unicode characters or collection members; the earlier serialized-byte caps are removed (td18) and replaced by the obligation that a limit-maximal draft fits the existing 500-event and 100-field push contract.
- **Constraint:** Every scored question and checklist practice carries exactly one author-assigned stage association; publication is blocked while any item is unassociated, from [DEC-021](discovery-notes-maturity-score.md#dec-021).
- **Constraint:** A practice's evidence state is binary — met or unmet, with N/A excluded; no third validation state exists, from [DEC-022](discovery-notes-maturity-score.md#dec-022).
- **Prerequisite:** Template create, update, publish, and delete routes return HTTP 503 `template_write_unavailable` (`drift:template-write-freeze`), so authoring and publication behavior cannot ship until that freeze lifts; see [TE-019](#te-019).
- **Prerequisite:** Exact `review_template_selections` rows are local-only and are not transported by Review sync (`drift:review-selection-transport-deferred`), so per-Revision maturity on a fresh device depends on Generic Sync Hardening; see [TE-020](#te-020).
- **Assumption to validate:** Suggested impact based on fixed question severity will not be read as priority or cost of delay; investigate through [TQ-011](#tq-011).

## 3. Problem Statement

Peaky stores template structure and assessment answers but has no supported scoring contract. A naive item-based calculation would let large checklists dominate. A score without review-scope and answer-coverage context could be mistaken for inherent team or product maturity. Same-version analysis may still combine materially different scopes, partial states, or override histories. Mutable configuration, separate calculations, unaudited overrides, and ambiguous Looker defaults can further change or weaken meaning.

The design must implement the agreed product rules without changing Improvement Plan rollups, version migration, campaigns, or dry-run behavior. The current authoring sketch is discovery evidence only. It does not establish production components, persistence, authorization, or runtime placement. The first Beta increment remains self-contained: Jira, ITSM, Looker, review analytics, and live provider operations are not dependencies. The flagged provider-neutral handoff synchronizes drafts and existing-ticket associations without provider network calls.

## 4. Objectives

### 4.1. Goals

- Present one canonical five-stage maturity profile in Template Studio.
- Enforce a maximum of ten questions in Template Studio and publication.
- Keep **Adjust score ranges** single-purpose and separate from question or practice stage guidance.
- Store equal 20% bands, equal checklist shares, and no stage guidance as explicit configured defaults.
- Validate custom checklist allocations as a complete 100% total and expose invalid and recovery states.
- Support bulk association of checklist practices to optional stage guidance without removing per-practice control.
- Prove that stage-guidance edits cannot change calculated maturity.
- Calculate one live score per template.
- Use each question as the primary unit of maximum influence.
- Use fixed question weights from severity: Medium 1, High 2, and Critical 3.
- Give checklist items equal shares by default and allow advanced custom percentages.
- Keep checklist percentages inside the parent question's fixed severity weight.
- Map Yes to 100% and No to 0%, with no author setting for partial Yes/No values.
- Exclude N/A answers and explain the denominator.
- Exclude unanswered questions and show answer coverage beside every live result.
- Map normalized results to five user-facing stages numbered 1–5.
- Preserve immutable stage names and canonical descriptions.
- Support optional template context that cannot replace canonical stage meaning.
- Use equal 20% bands for Beta and support advanced, identifiable threshold profiles for prototype validation.
- Keep each advanced threshold boundary within 10 percentage points of its default and require every stage to cover at least 10 percentage points.
- Normalize legacy ORR 0–4 values to Peaky 1–5 values during Beta import and export.
- Produce template and pillar breakdowns from one canonical contract.
- Calculate the complete template result directly from applicable questions; never average pillar results into it.
- Show each pillar's stage, percentage, coverage, and unanswered count using the pinned template version's thresholds.
- Show the current stage, progress toward the next stage, and position across the full five-stage path.
- Show explicit Score / Maturity wording, per-pillar context, current-stage gaps, and next-stage requirements while preserving author-defined context under immutable canonical stage meanings.
- Show Advisor-reviewed maturity as primary while preserving calculated maturity with actor, explanation, evidence, and time.
- Require current Advisor assignment plus review edit access for override actions and preserve append-only supersession or revocation history.
- Support separate per-template projections in team review and review-detail experiences.
- Preserve template version, services, owning teams, status, coverage, and override context beside every score and export.
- Support limited operational cues in Review Details, Team views, and Improvement Plans.
- Explain every result from the actual pinned template version and review answers.
- Persist and synchronize ordered handoff drafts before provider integration exists.
- Select checklist practices directly; represent a Yes/No question as one practice.
- Associate an existing Jira, YouTrack, or ITSM ticket without creating remote work.
- Keep one current external-ticket association per practice and preserve explicit replacement history.
- Keep assessment state, current association, and observed provider status independent.
- Allow selection and ordering while sync is degraded, but disable association confirmation when shared uniqueness is not reliable.
- Enforce one versioned handoff-limits contract in TypeScript and Go without truncation or partial persistence.

### 4.2. Non-Goals

- Cross-template maturity comparisons or rollups across templates, reviews, teams, products, or the organization.
- Rankings, benchmarks, trends, segmentation, exploratory filters, or a new analytics view in Peaky.
- Authoring, publishing, or template-governance authorization.
- Campaign orchestration or analytics-driven program management.
- Dry-run review semantics.
- Full template versioning and migration.
- Template patch/minor/major classification, review upgrades, reassessment, migration, and impact preview.
- ORR 2026 content reduction.
- AWS application and infrastructure deployment.
- Improvement Plan generation, rollups, prioritization, ownership, or lifecycle.
- Provider work-item creation, editing, closure, prioritization, assignment, or lifecycle ownership.
- Live provider submission or status refresh before the platform integration exists and is enabled.
- Automatic ticket updates when a practice becomes complete.
- Continuous bidirectional provider lifecycle synchronization.
- Analytics and cross-review insights in the first Beta increment.
- Treating the assembled HTML sketch, its styling, or synthetic runtime as a production specification.
- Roadmap sequencing, backlog ownership, sprint scope, priority, cost-of-delay ranking, or provider-specific work-item lifecycle.

### 4.3. Success Criteria

- A Template Author can adjust stage ranges without entering or changing question-level guidance.
- A Template Author can leave guidance unset, associate all checklist practices in bulk, and refine practices individually.
- Invalid custom shares block a valid configuration until the total returns to 100%.
- An eleventh question is prevented during authoring and rejected during publication.
- Changing only stage guidance leaves every calculation output unchanged.
- A worked assessment produces the same per-template result in every consuming view.
- Adding unweighted checklist items does not increase a question's maximum influence.
- Template configuration cannot rename stages or modify canonical descriptions.
- Each result identifies whether it uses default or advanced threshold-profile configuration.
- Optional template context remains visibly distinct from the canonical stage description.
- N/A exclusions and advisor overrides remain visible in the score explanation.
- Unanswered questions never reduce the live result, and answer coverage remains visible.
- A review with several templates never presents one combined maturity score.
- Over-limit pinned data produces a per-TemplateRevision configuration error and no maturity result while valid sibling revisions remain available.
- Every score projection and export identifies the template version, full service and team scope, status, coverage, and override provenance.
- A shared multi-team review is distinguishable without presenting separate service or team maturity.
- Operational cues in Peaky lead to an action and do not present rankings or an analytics experience.
- Users can distinguish the current stage, next-stage progress, full five-stage path, and pillar breakdown.
- Maturity can link to an existing Improvement Plan without changing that plan's behavior or external work-item lifecycle.
- Review plans answer where the review stands, what gaps exist, and which pillar paths may deserve attention in one view.
- Team and product plans preserve contributor and template identity while showing compact maturity context.
- A preview preserves template, version, evidence, practice, review, source, leading-practice, helpful-link, rationale, and selected-order information and makes no live provider call.
- Checklist practices can be selected independently; a Yes/No question appears as one standalone practice.
- A selected practice with a current external-ticket association blocks duplicate handoff creation and identifies the conflicting ticket.
- Team Leads and Engineering Leads can associate an existing provider ticket without creating remote work.
- Explicit replacement keeps one current association and immutable per-practice history.
- Completing a practice does not remove its current external-ticket reference or change the external ticket.
- Concurrent associations converge through HLC before side effects exist; the losing local value is shown for review.
- When sync is degraded, users can keep editing a draft but cannot confirm a shared association.
- Handoff values exactly at each centralized limit synchronize, while limit-plus-one values are rejected atomically and identically by TypeScript and Go.
- Users can use the core review flow with keyboard navigation, dark and light themes, reduced motion, sparse lists, and larger gap lists.

### 4.4. Non-Functional Requirements

Not explored yet.

## 5. Proposed Approach(es)

The engineering deep-dive agreed this first-release calculation:

```text
question fixed weight:
  Medium = 1
  High = 2
  Critical = 3

yes/no question:
  Yes = 100%
  No = 0%

checklist question:
  sum(percentages for met applicable items)
  ─────────────────────────────────────────
  sum(percentages for all applicable items)

question contribution =
  question result × fixed severity weight

template result =
  sum(question contributions)
  ───────────────────────────
  sum(applicable fixed severity weights)
```

Checklist items have equal shares by default. Advanced Template Authors may set custom percentages that total 100%. An item above 50% remains allowed, but the explanation should advise creating a separate question or changing to Yes/No when one item controls most of the result. Custom percentages never increase the parent question's fixed severity weight.

An untouched question has no answer record. It stays outside maturity and lowers coverage. Once a checklist answer exists, each item is met, not met, or N/A. Items that are neither met nor N/A are not met and remain areas needing attention. N/A items are removed and the remaining percentages are recalculated. A question with every item N/A counts as answered for coverage but stays outside maturity. When every question is N/A, the result is "No applicable questions", not 0%.

Example:

```text
High question: weight 2

Current runbook exists       60%   not met
Service owner is named       20%   met
Runbook was reviewed         20%   met

question result = 40%
question contribution = 40% × 2 = 0.8 out of 2
```

The complete template result uses every applicable question directly. Pillar results use the same question calculation and stage thresholds, but they are explanatory breakdowns only:

```text
Reliability:
  maturity 100%
  coverage 1 of 4 questions
  unanswered 3

Complete template:
  calculate from all applicable questions
  never average pillar percentages
```

The current synthetic walkthrough applies this rule to all 14 configured fixture questions. It may display three representative question rows only when the remaining 11 questions contribute through an explicit aggregate. The worked fixture resolves to 39%; calculating only the visible rows is invalid. Because the fixture exceeds ten questions, it remains explanatory interaction evidence rather than an acceptance vector. Canonical vectors use ten and smaller templates, plus an eleven-question case that returns a configuration error and no result.

Beta stage bands are `0–<20`, `20–<40`, `40–<60`, `60–<80`, and `80–100`. Exact boundaries enter the higher stage. Advanced profiles may move each boundary at most 10 percentage points from its default and must keep every stage at least 10 percentage points wide. Stage names and fixed descriptions cannot change; authors may add context. Internal calculations use exact integer ratios compared by cross multiplication, with no scaling to basis points and no floating point; equal shares stay `1/n` ratios, so no remainder-distribution rule is needed (td18). Summaries display whole percentages, while the calculation explanation exposes the exact value and explains any apparent boundary straddle.

Every "How is this calculated?" projection needs the pinned template name and version, review scope, template and pillar results, stage thresholds, question text, severity and fixed weight, yes/no or checklist result, checklist percentages, unanswered questions, N/A exclusions, coverage, and Advisor change provenance.

The Integrated Template Studio sketch exercises the settled authoring behavior. One large five-stage profile is always visible. **Adjust score ranges** enters threshold editing only. Optional stage guidance is edited inside questions and checklist practices, may remain unset, supports a bulk practice association, and never participates in arithmetic. Equal checklist shares are the configured default; custom shares expose synchronized controls, a total, and invalid or recovery states. The calculation explanation opens directly from the profile and expresses earned points out of available points. These are product contracts and acceptance inputs, not accepted production architecture.

### 5.1. High Level Design

Use one versioned **maturity score definition** owned by an immutable published TemplateRevision. Conceptually it contains fixed severity-derived question weights, checklist allocation mode and shares, the threshold profile, and optional question or practice stage guidance. One collaborative shared draft carries content and maturity configuration; publication validates and freezes both atomically. Reviews reference the published revision rather than mutable draft configuration.

Keep four contracts distinct even if implementation later colocates them:

1. **Authoring contract:** edits draft configuration and reports validation errors without calculating from review answers.
2. **Publication contract:** rejects invalid ranges or allocations and freezes one score definition into a published template version.
3. **Calculation contract:** deterministically maps the pinned definition plus answers to question, pillar, and template results.
4. **Explanation contract:** projects the exact inputs, exclusions, earned points, available points, thresholds, coverage, and override provenance used for a result.
5. **Provider-neutral handoff contract:** persists and synchronizes one ordered practice draft, supports existing-ticket association, resolves current references through HLC, and records replacement history. UI visibility and integration side effects use separate capabilities.

Concrete table integration follows the future shared-draft and authoritative TemplateRevision publication model. Runtime calculation placement and module boundaries remain open in [TQ-002](#tq-002).

### 5.2. Main Flows

#### Author a maturity definition

1. Load the shared template draft and its inherited configured defaults.
2. Show the complete five-stage profile and all questions.
3. Prevent an eleventh question and surface the maximum through the shared validator.
4. Enter **Adjust score ranges** to edit threshold boundaries only; validate ordering, ±10-point movement, and minimum 10-point stage widths.
5. Expand a question to inspect its fixed severity weight and edit optional question or practice stage guidance.
6. For a checklist, retain equal shares or enable custom shares; validate that custom shares total 100%.
7. Present validation next to the owning control and prevent a valid publishable state while errors remain.

#### Publish and pin

1. Validate the complete maturity score definition, including the ten-question maximum.
2. Publish it atomically with template content in the new immutable TemplateRevision.
3. Pin each new review to the selected published revision.
4. Never change an existing review when the shared draft or a newer published version changes.

#### Calculate and explain

1. Resolve the review's pinned template version and its score definition.
2. Combine it with current answers using the arithmetic in section 5.
3. Return question, pillar, and complete-template results plus coverage and exclusions.
4. Map the unrounded normalized result through the pinned threshold profile.
5. Build the explanation from the same calculation trace; optional stage guidance may be displayed as context but is never an arithmetic input.

#### Prepare and associate a provider-neutral handoff

1. Project each unchecked checklist item as a practice. Project a negative Yes/No answer as one practice whose practice ID equals its question ID.
2. Select practices across pinned template versions and preserve their order in a synchronized draft.
3. Resolve each structured practice reference: review, opaque template version, question, and practice.
4. If sync is degraded, allow draft edits but disable confirmation because shared uniqueness is not reliable.
5. Resolve each practice's current external-ticket association. Block confirmation on any conflict and show the existing reference.
6. Build one payload containing practice text, leading practices, helpful links, rationale, and review, template-version, question, practice, evidence, plan-item, and source identifiers.
7. Validate the payload against the versioned `HandoffLimits` contract and reject any violation without truncation or partial persistence.
8. Associate an existing provider ticket or, after a future integration exists, submit one reserved bulk ticket.
9. Synchronize the current association. HLC resolves concurrent field writes; the losing value becomes visible conflict context.
10. On explicit replacement, update the current association and append history. Assessment completion does not change either record.

#### Handle future provider side effects

1. Atomically reserve every selected practice on the server before creating external work.
2. If any reservation conflicts, create nothing.
3. Create one external ticket only after every reservation succeeds.
4. Confirm the associations after the provider returns an identifier.
5. A future `PracticeCompletionChanged` event may feed an optional background integration worker. Provider updates require a separate product decision, policy, capability, idempotency, and audit contract. Failure never rolls back assessment completion.

### 5.3. Component Designs

These are logical contracts for OpenSpec, not proposed file or class names:

- **Maturity score definition:** versioned thresholds, checklist allocation mode and shares, and optional stage-guidance associations. Fixed severity weights are derived from question severity rather than duplicated author input.
- **Definition validator:** returns field-addressable errors for threshold ordering and bounds, minimum stage widths, missing practice references, and custom allocation totals.
- **Calculation input:** pinned definition identity, question structure, answers, N/A state, and coverage state.
- **Calculation trace:** exact per-question earned and available points, applicable denominator, exclusions, pillar breakdowns, normalized template result, and resolved stage.
- **Explanation projection:** customer-facing labels derived from the trace, never recalculated independently.
- **Authoring view state:** separately tracks whether range editing is active, expanded questions, allocation mode, and guidance associations so one control does not silently change another concern.
- **Practice reference:** structured review ID, opaque TemplateRevision ID, question ID, and practice ID. Checklist items use their own IDs; Yes/No practices reuse the question ID. It gives the practice-selection entity a deterministic ID.
- **Handoff practice selection:** one synchronized review child per selected practice, carrying order key, practice snapshot, rationale, and selection state. The draft itself is the set of a review's selected practices; it has no row, no editable title, and a label derived from review plus practice count (td18).
- **Association transition:** one append-only review child per association event, carrying provider, external ID, HTTPS URL, and the prior transition. The current association is the latest non-revoked transition and replacement history is the earlier ones, so no separate external-work-item, current-state, or history entity exists and no provider-observed status is stored (td18).
- **Handoff conflict validator:** rejects confirmation when sync is degraded or a selected practice already has a current association.
- **Handoff limits validator:** applies one versioned character, collection, practice-count, and URL contract in TypeScript and Go and rejects the complete invalid mutation.

```text
handoff_draft 1 ─── * handoff_draft_practice

external_work_item 1 ─── * practice_handoff_state
                                  │
                                  └── * practice_handoff_history

practice reference =
  review_id + template_version_id + question_id + practice_id
```

OpenSpec should express these as invariants, transitions, and acceptance examples. It should not copy sketch DOM structure, CSS, synthetic event wiring, or Studio chrome.

### 5.4. Dependencies

#### 5.4.1. Upstream Dependencies (Consumers)

- Integrated Template Studio authors and validates the draft definition.
- Assessment and result views consume the published definition and calculation explanation.
- Later Improvement Plan and analytics consumers may reuse the same result contract, but are not first-increment dependencies.

#### 5.4.2. Downstream Dependencies (Systems Depended On)

- The future shared-draft and authoritative TemplateRevision publication model provides published-revision identity and immutable review pinning for persistence integration.
- The existing question and answer models provide severity, question type, answers, and N/A state.
- No external service is required for the first Beta authoring and calculation path.
- The existing sync engine must add review-child entities and inbound handlers for handoff drafts, practice state, external references, and history.
- Platform engineering owns provider-specific ticket templates and the future submission and status transport contract.

#### 5.4.3. Delivery Dependencies

- Integrate maturity ownership and atomic publication with TemplateRevision; coordinate separately with Template Versioning for patch/minor/major semantics and any explicit future review-update flow.
- Resolve [TQ-002](#tq-002) before committing runtime module boundaries. TQ-001, TQ-003, TQ-004, and TQ-012 now provide accepted contracts.
- Analytics and live provider integration work remain deferred and must not block Beta. The provider-neutral UI may proceed behind a disabled deployment flag.

#### 5.4.4. Technologies & Platform Capabilities

- Field-level HLC conflict resolution provides deterministic convergence for synchronized current associations before external side effects exist.
- The local outbox and review-root sync channel carry handoff entities.
- Public runtime configuration gates the handoff UI. A separate server capability gates future provider calls.
- Existing degraded-sync feedback explains why confirmation is unavailable while draft editing remains possible.

### 5.5. Risks & Mitigations

#### RISK-001 — A newer template changes the meaning of an older result

- **Problem:** Reading current draft or published settings instead of the review's pinned version could change an existing review's maturity without changing its answers.
- **Probability / impact:** Probability not assessed; impact includes historical score drift and inconsistent Improvement Plans.
- **Prevention:** Keep every review pinned to one immutable TemplateRevision whose maturity definition published atomically with its template content.
- **Mitigation:** Every result and explanation identifies the exact template version and maturity calculation inputs used.
- **Owner:** Peaky engineering and product

#### RISK-002 — Untrusted advisor override

- **Problem:** An override that replaces the calculated result or lacks authorization and evidence could hide readiness gaps or social pressure.
- **Probability / impact:** Probability not assessed; impact includes misleading readiness signals and weak auditability.
- **Prevention:** Preserve both values and require current `reviewer` assignment plus review edit access for every initial override action. Keep transitions append-only and reserve future exceptions for explicit server-side Cedar actions.
- **Mitigation:** Show Advisor-reviewed maturity as primary with a strong cue, preserve calculated maturity, and export both values with provenance.
- **Owner:** Peaky engineering and product

#### RISK-003 — False comparison confidence

- **Problem:** Same-template-version scores may look comparable even when review scope, service count, answer coverage, N/A use, assessor judgement, or override state differs.
- **Probability / impact:** Direct ORR feedback shows active demand for comparison and concern about subjectivity; impact includes misleading team or product decisions.
- **Prevention:** Define one projection contract through [TQ-005](#tq-005) and the product boundaries in [DEC-006](discovery-notes-maturity-score.md#dec-006) and [DEC-009](discovery-notes-maturity-score.md#dec-009).
- **Mitigation:** Keep scope, status, coverage, and override metadata visible; avoid rankings; keep exploratory analysis in Looker.
- **Owner:** Peaky engineering and product

#### RISK-004 — Preview side effects or provenance loss

- **Problem:** A handoff preview could create live provider work or omit the template and evidence identifiers needed to trace its source.
- **Probability / impact:** Probability not assessed; impact includes unintended external changes and untrustworthy follow-through.
- **Prevention:** Define the local-only preview state, stable identifiers, and explicit cancellation behavior through [TQ-009](#tq-009).
- **Mitigation:** Persist synchronized practice snapshots, support existing-ticket association, keep provider calls disabled, and require atomic reservation before any future live creation.
- **Owner:** Peaky application engineers and Jira/ITSM owners

#### RISK-005 — Accessibility and density regression

- **Problem:** The high-signal layout, sticky navigation, categorical profile, filters, and reorder controls may fail for keyboard users, themes, reduced motion, or large lists.
- **Probability / impact:** Probability not assessed; impact includes blocked review follow-through and misleading evidence interpretation.
- **Prevention:** Define an accessibility and responsive quality contract through [TQ-008](#tq-008).
- **Mitigation:** Retain More context, keyboard ordering, visible focus, theme coverage, and reduced-motion behavior as testable requirements.
- **Owner:** Peaky frontend and accessibility engineers

#### RISK-006 — Pillar and next-stage context becomes a target

- **Problem:** Per-pillar results or next-stage requirements could be read as a new score, exact distance, or mandatory roadmap.
- **Probability / impact:** Probability not assessed; impact includes grade pressure, answer gaming, and false precision about uneven practice.
- **Prevention:** Derive pillar context from the canonical per-template result and distinguish canonical stage meaning, author context, current gaps, and future-stage guidance through [TQ-004](#tq-004).
- **Mitigation:** Use explicit Score / Maturity wording, keep results provisional, avoid exact distance, and test the explanation with Template Authors and ORR participants.
- **Owner:** Peaky product and frontend engineers

#### RISK-007 — External handoff lifecycle coupling

- **Problem:** A reference, status, sprint, or link in a handoff could imply that Peaky creates, updates, or owns Jira/ITSM work.
- **Probability / impact:** Probability not assessed; impact includes duplicate backlogs, unauthorized external changes, and unclear recovery when provider state changes.
- **Prevention:** Define a provider-neutral reference and side-effect boundary through [TQ-009](#tq-009) and [TQ-010](#tq-010).
- **Mitigation:** Preserve external metadata only when available, make ownership and freshness explicit, and require a later integration decision for write-through lifecycle.
- **Owner:** Peaky application engineers and Jira/ITSM owners

#### RISK-008 — Suggested impact mistaken for priority

- **Problem:** Fixed question severity could be displayed as a mandatory priority, ranking, or cost-of-delay estimate.
- **Probability / impact:** Probability not assessed; impact includes Peaky prescribing sequencing it cannot observe and teams delegating roadmap decisions to a partial signal.
- **Prevention:** Define an optional, explainable signal through [TQ-011](#tq-011) and the product boundary in [DEC-012](discovery-notes-maturity-score.md#dec-012).
- **Mitigation:** Label it suggested impact, preserve arbitrary selection and manual reordering, and never block handoff on it.
- **Owner:** Peaky product and application engineers

#### RISK-009 — Stage guidance silently changes scoring

- **Problem:** Reusing one field or transformation for guidance and thresholds could make optional guidance alter a result or imply a guaranteed stage.
- **Probability / impact:** Probability not assessed; impact includes unexplainable score drift and misleading author expectations.
- **Prevention:** Keep guidance outside calculation inputs and add invariant tests proving guidance-only changes leave every score unchanged.
- **Mitigation:** Label guidance as optional context and include it only in authoring and explanation projections.
- **Owner:** Peaky application and frontend engineers

#### RISK-010 — Invalid draft configuration reaches publication

- **Problem:** Overlapping ranges, undersized stages, stale practice references, or custom shares that do not total 100% could produce undefined or contradictory results.
- **Probability / impact:** Probability not assessed; impact includes publication failure, inconsistent calculations, and difficult recovery.
- **Prevention:** Use one definition validator for interactive feedback and publication gating; cover boundary and allocation cases with shared examples.
- **Mitigation:** Keep the last valid configured values, identify the exact invalid field, and let the author recover without losing unrelated guidance or question edits.
- **Owner:** Peaky application and frontend engineers

#### RISK-011 — UI activation bypasses the provider integration boundary

- **Problem:** Enabling the handoff UI could accidentally expose submission controls or trigger network side effects before platform integration is ready.
- **Probability / impact:** Probability not assessed; impact includes unauthorized or duplicate external tickets.
- **Prevention:** Use separate deployment and integration capabilities. The UI capability never authorizes network calls. Future creation also requires atomic server-side reservation of every selected practice.
- **Mitigation:** Default both capabilities off, reject submission without integration capability, and audit enabled capability combinations.
- **Owner:** Peaky application engineering and platform engineering

#### RISK-012 — HLC convergence cannot prevent duplicate external tickets

- **Problem:** Two offline clients could create different external tickets before HLC selects one current association.
- **Probability / impact:** Impossible in the flagged no-network iteration; possible after live creation exists, with duplicate work and unclear ownership.
- **Prevention:** Require one atomic server reservation across every selected practice before any provider call.
- **Mitigation:** Create nothing on reservation conflict. Record idempotency and audit data for every later provider request.
- **Owner:** Peaky application engineering and platform integration owners

#### RISK-013 — Over-limit legacy data produces misleading maturity

- **Problem:** Truncating an over-limit pinned definition or calculating it despite failed publication invariants could silently change the denominator.
- **Probability / impact:** Synthetic over-limit data already exists; impact includes unrepeatable results and acceptance fixtures that contradict product constraints.
- **Prevention:** Prevent an eleventh authored question, reject over-limit publication, and return a configuration error with no maturity result for over-limit pinned data.
- **Mitigation:** Keep canonical worked fixtures at ten or fewer questions and preserve the fourteen-question sketch only as interaction evidence.
- **Owner:** Peaky application engineering and Product

#### RISK-014 — Handoff limits drift across runtimes

- **Problem:** TypeScript and Go may count characters or serialized bytes differently, accepting a draft in one runtime and rejecting it in another.
- **Probability / impact:** Probability not assessed; impact includes stuck outbox events, partial user workflows, and inconsistent security boundaries.
- **Prevention:** Define one versioned `HandoffLimits` contract, one canonical serialization rule, and shared exact-boundary, boundary-plus-one, and multi-byte vectors.
- **Mitigation:** Reject invalid mutations atomically with field-addressable errors; never truncate values or drop collection members.
- **Owner:** Peaky application and sync engineering

## 6. Considered Alternatives

### Checklist item as the primary scoring unit

#### High-Level Design

Each applicable checklist item contributes directly to the template result.

#### Rejection Reason

This rewards templates with larger checklists and encourages authors to improve the wrong lever. It also conflicts with the ten-question guardrail and the product principle that one question represents one capability.

### Assessor-selected question maturity

#### High-Level Design

The assessor selects a level from 0 to 4 for every question after reviewing guidance.

#### Rejection Reason

This copies the burden imposed by Google Docs. The product direction is to infer maturity from answers so assessors do not optimize their behavior around visible stages.

### Aggregated review, team, or product maturity

#### High-Level Design

Combine template results into broader maturity scores.

#### Rejection Reason

Templates measure different capabilities. Aggregation would combine unlike signals and could penalize teams for running more reviews.

### Question-level handoff identity

#### High-Level Design

Associate one external ticket with the whole assessment question, including every missing checklist practice.

#### Rejection Reason

ORR 2026 has ten questions and 179 checklist practices. Question-level identity would block unrelated practices after one practice receives a ticket. Practice-level identity matches the handoff selection unit.

### HLC-only live provider submission

#### High-Level Design

Let offline clients create provider tickets, then use HLC to select the current association.

#### Rejection Reason

HLC can converge Peaky state but cannot undo duplicate external tickets. Future live creation requires atomic practice reservation before the provider call.

## 7. Execution Plan

Not explored yet.

## 8. Open Questions and Next Steps

**Suggested Product–Engineering working session:** Peaky Product, application engineering, and PX should validate [PQ-011](discovery-notes-maturity-score.md#pq-011) with canonical ten-question-or-smaller worked calculations and the accepted exact-ratio explanation contract.

| ID | Status | Area | Question | Why it matters | Driver / contributors | Next step | Blocks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [TQ-001](#tq-001) | Answered | Approach | How should maturity calculation inputs fit the unified versioned Template model? | Older reviews must keep the calculation from their pinned version | Peaky data and application engineers; Product | Integrate with the future shared-draft and atomic TemplateRevision publication model | Sections 5.1 and 5.3 |
| [TQ-002](#tq-002) | Open | Flow | Where is the canonical calculation performed and how is it projected to clients? | Separate calculations could disagree across offline and server-backed views | Peaky local-first and application engineers | Trace answer writes, local reads, sync, and review-detail projections | Sections 5.1 and 5.2 |
| [TQ-003](#tq-003) | Answered | Risk | What authorization and audit contract governs advisor overrides? | An untrusted override could hide the computed signal | Peaky security, data, and application engineers | Implement current `reviewer` assignment plus review edit access and append-only audited transitions | Sections 5.2, 5.3, and RISK-002 |
| [TQ-004](#tq-004) | Answered | Approach | What precision and display rules complete the agreed arithmetic? | Rounding must not change a stage or contradict its explanation | Peaky application engineers; PX; Product | Encode integer-basis-point, exact-ratio, whole-summary, and boundary-explanation vectors | Section 5 |
| [TQ-005](#tq-005) | Open | Flow | How are scoped maturity results projected to review, team, product, and Looker consumers? | Missing context could imply false rollups or make action cues misleading | Peaky data and application engineers; Product | Define one version-aware projection contract and bounded view models for each consumer | Section 5.2 and RISK-003 |
| [TQ-006](#tq-006) | Deferred | Approach | What stable identity contract covers review scope, template version, and threshold profiles? | Historical scopes or versions could silently change meaning | Peaky data and application engineers | Resume after Template Versioning defines the explicit review update flow and version rules | Sections 2.4 and 5.3; RISK-001 and RISK-003 |
| [TQ-007](#tq-007) | Answered | Flow | What lifecycle rules cover active, superseded, or revoked overrides? | Consumers could interpret historical Advisor overrides differently | Peaky application engineers; Looker data owners | Encode append-only create, supersede, revoke, and effective-value vectors | Sections 5.2 and 5.3; RISK-002 and RISK-003 |
| [TQ-008](#tq-008) | Open | NFR | What quality contract covers themes, density, keyboard access, reduced motion, sticky layers, and list sizes? | The review flow could become inaccessible or unreadable | Peaky frontend and accessibility engineers | Test the sketch across themes, densities, keyboard paths, reduced motion, and sparse or large lists | Review-plan components and RISK-005 |
| [TQ-009](#tq-009) | Answered | Flow | What contract preserves practice provenance and unique current associations without live provider side effects? | Users could lose provenance or create duplicate handoffs | Peaky local-first and application engineers | Encode the session decision as OpenSpec invariants and shared sync examples | Handoff flow, RISK-004, and RISK-012 |
| [TQ-010](#tq-010) | Investigating | Flow | What provider-neutral contract carries external references, links, status, sprint scope, and update boundaries? | A handoff may not be trackable, or Peaky may accidentally own lifecycle | Peaky application engineers, Jira/ITSM owners, and Product | Inventory provider fields, define freshness and read/write boundaries, and specify confirmation and failure recovery | Handoff flow and RISK-007 |
| [TQ-011](#tq-011) | Deferred | Approach | How should fixed question severity contribute to an optional impact signal and ordering? | A useful suggestion could be mistaken for priority or cost of delay | Peaky application engineers, Product, and Template Authors | Resume in the later handoff increment | Future handoff flow and RISK-008 |
| [TQ-012](#tq-012) | Answered | Flow | What authoring-state and validation contract should Template Studio use before publication? | Coupled controls or inconsistent validation could publish an invalid definition or make guidance alter scoring | Peaky frontend and application engineers; Template Authors | Implement one shared validator for field feedback and atomic publication, including the ten-question maximum | Sections 5.1–5.3; RISK-009, RISK-010, and RISK-013 |

<a id="tq-001"></a>

### TQ-001 — Maturity calculation inputs in the unified Template model

> - **Status / area:** Answered · Approach
> - **Driver / contributors:** Peaky data and application engineers; Product
> - **Technical basis:** TE-001, TE-002, TE-008, TE-009, and TE-016; the target Template model is not implemented
> - **Affects:** Data model, recomputation, historical explanations, and section 5.3
> - **Blocks:** Nothing yet; concrete persistence integrates with the future Template model
> - **Origin / revisit:** Revisit only for patch/minor/major classification or explicit review upgrade policy

**Question and current understanding.** One published template version owns its fixed severity weights, checklist percentages, threshold profile, and optional stage context. A single shared draft inherits those maturity calculation inputs until an author changes them. Reviews remain pinned to their selected published version and never update automatically.

**Why it matters and competing interpretations.** Rules and `ruleSets` are being removed and must not become the replacement model. The planned unified Template model and publication work deliberately leave exact version storage undefined. Choosing another score revision or snapshot now would duplicate or conflict with that work.

**Investigation and current answer.** Maturity configuration belongs to TemplateRevision. One collaborative shared draft carries template content and maturity configuration, and publication validates and freezes both atomically into an immutable published revision. Existing reviews remain pinned. Exact transitional tables integrate with that model; patch/minor/major classification, explicit upgrades, reassessment, migration, and impact preview remain deferred.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-002"></a>

### TQ-002 — Canonical calculation and projection flow

> - **Status / area:** Open · Flow
> - **Driver / contributors:** Peaky local-first and application engineers
> - **Technical basis:** TE-003; no scoring implementation was inspected
> - **Affects:** Assessment, team review rows, review details, pillar drill-down, and sync
> - **Blocks:** High-level design and main flows
> - **Origin / revisit:** Revisit after tracing current answer writes and review projections

**Question and current understanding.** The score must appear live from the first answer and remain consistent in several per-template views. Peaky is local-first, so calculation placement and persisted versus derived state require deliberate design.

**Why it matters and competing interpretations.** Client-only derivation gives immediate feedback but can duplicate logic. Server-only calculation may not satisfy offline behavior. Persisted results add synchronization and invalidation concerns, while derived results require stable configuration inputs.

**Investigation and current answer.** Trace assessment writes, local query paths, sync events, review-detail data, and Improvement Plan consumers. Identify one canonical calculation contract and generated test vectors that every runtime can share or reproduce.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-003"></a>

### TQ-003 — Advisor override authorization and audit

> - **Status / area:** Answered · Risk
> - **Driver / contributors:** Peaky security, data, and application engineers
> - **Technical basis:** Product decisions DEC-003 and DEC-018; TE-017
> - **Affects:** Override flow, score display, analytics, and RISK-002
> - **Blocks:** Nothing yet
> - **Origin / revisit:** Revisit when Cedar grants Admin or exceptional fallback authority

**Question and current understanding.** An advisor may record a different maturity result after reviewing a team's self-assessment. The product requires explanation, evidence, actor, and time, and must preserve the computed value.

**Why it matters and competing interpretations.** A mutable field is simple but weakens provenance. An append-only override event better supports later analysis but needs a clear active-value rule, revocation behavior, and authorization boundary.

**Investigation and current answer.** Persisted role `reviewer` is displayed as Advisor. Initial create, supersede, and revoke actions require current `reviewer` assignment plus review edit access. Any current Advisor may transition the override. Store transitions append-only with actor, explanation, evidence, time, and authorization outcome. Future Admin or exceptional authority must come from an explicit server-side Cedar action, never a client label or cached entitlement.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-004"></a>

### TQ-004 — Complete arithmetic and edge cases

> - **Status / area:** Answered · Approach
> - **Driver / contributors:** Peaky application engineers; PX; Product
> - **Technical basis:** Engineering deep-dive decisions on 2026-08-14; DEC-002, DEC-004, DEC-007, DEC-008, and DEC-013
> - **Affects:** Calculation library, score explanation, pillar breakdown, and tests
> - **Blocks:** Proposed approach
> - **Origin / revisit:** Revisit only if accepted boundary vectors expose an ambiguity

**Question and current understanding.** The first-release arithmetic is agreed. Questions use fixed severity weights of 1, 2, and 3. Yes is 100%; No is 0%. Checklist items use equal shares unless an advanced author sets percentages totaling 100%. N/A is excluded. Untouched questions stay outside maturity and lower coverage. A touched checklist treats items that are neither met nor N/A as not met. All-N/A questions count as answered but stay outside maturity. Pillar results use the same arithmetic and thresholds but never feed an average into the template result. Equal 20% stage bands are the default; advanced boundaries stay within ±10 points and every stage spans at least 10 points.

**Why it matters and competing interpretations.** Internal precision and presentation must not disagree. A displayed rounded value never moves a result into another stage or contradicts the calculation explanation.

**Investigation and current answer.** Compare exact integer ratios by cross multiplication for stage resolution, with no basis-point scaling and no floating point. Display whole percentages in summaries. Expose the exact result in "How is this calculated?" and explain apparent threshold straddles caused by summary rounding. Encode Yes/No, untouched, all-not-met, partial checklist, partial N/A, all-N/A, exact stage boundary, bounded advanced threshold, template aggregation, and pillar breakdown examples as shared test vectors.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-005"></a>

### TQ-005 — Scoped maturity projection

> - **Status / area:** Open · Flow
> - **Driver / contributors:** Peaky data and application engineers; Product
> - **Technical basis:** TE-004 and TE-005; product decisions DEC-006, DEC-009, and DEC-010
> - **Affects:** Review, team, and product Improvement Plans; Looker exports; RISK-003
> - **Blocks:** Scoped view models and explanation contract
> - **Origin / revisit:** Revisit after template-version persistence and all-template workspace projection are designed

**Question and current understanding.** Review Improvement Plans need rich per-template maturity beside gaps. Team and product plans need compact maturity context for each contributor and template, never an aggregate stage. Looker needs exact values and provenance. The current plan projections do not carry maturity results. The workspace itself now projects every selected Revision with `templateRevisionId` on each Pillar and Question, so only the maturity collection and the plan projections remain to be added (td18).

**Why it matters and competing interpretations.** One broad projection risks excess data and false rollups. Independent projections risk semantic drift. A shared version-aware result contract with bounded consumer view models can preserve one meaning while limiting each view to its needs.

**Investigation and current answer.** Define one maturity result per review and pinned template version. Derive rich review-plan, compact contributor, and Looker view models from it. Fix all-template projection, version-sensitive identities, and contributor completeness before deciding component boundaries.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-006"></a>

### TQ-006 — Stable scope and template identity

> - **Status / area:** Deferred · Approach
> - **Driver / contributors:** Peaky data and application engineers
> - **Technical basis:** [SR-E-001](#sr-e-001); TE-001 and product decisions DEC-005 and DEC-006
> - **Affects:** Review lineage, comparison equality, sections 2.4 and 5.3, RISK-001, and RISK-003
> - **Blocks:** Comparison identity contract
> - **Origin / revisit:** [SR-E-001](#sr-e-001); revisit after Template Versioning defines version rules and the explicit review update flow

**Question and current understanding.** Review scope may contain one service, several services owned by one team, or services owned by several teams. Every score and export must show services, owners, team count, and a shared-review cue. Membership capture, edits, renames, ownership changes, and historical identity remain undefined. Reviews remain pinned to one published template version, but Template Versioning still needs to define which changes require a new version and how an explicit review update works.

**Why it matters and competing interpretations.** The system could snapshot scope and scoring configuration, derive identity from mutable records, or introduce narrow immutable revisions. These choices affect historical reads and comparison equality.

**Investigation and current answer.** Defer exact identity to Template Versioning. That work must cover services, teams, threshold profiles, every maturity calculation input, explicit review updates, and warnings that a newer version may change maturity and reporting.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-007"></a>

### TQ-007 — Advisor override lifecycle

> - **Status / area:** Answered · Flow
> - **Driver / contributors:** Peaky application engineers; Looker data owners
> - **Technical basis:** [SR-E-002](#sr-e-002); product decisions DEC-003 and DEC-006
> - **Affects:** Live scoring, override display, comparison eligibility, sections 5.2 and 5.3, RISK-002, and RISK-003
> - **Blocks:** Nothing yet
> - **Origin / revisit:** [SR-E-002](#sr-e-002); revisit if analytics requires another historical projection

**Question and current understanding.** Scores appear after the first answer, unanswered questions stay outside the denominator, and status plus coverage signal partial work. Advisor-reviewed maturity is primary in Peaky and the default in Looker. Calculated maturity and full provenance remain available. Override transitions are append-only.

**Why it matters and competing interpretations.** Peaky and Looker now share one default value, but they could still disagree about which override is active. Mutable replacement, append-only supersession, and explicit revocation produce different audit and projection behavior.

**Investigation and current answer.** Any current authorized Advisor may create, supersede, or revoke. A superseding or revoking transition references the prior current event; no transition is overwritten. Every consumer resolves the same latest authorized non-revoked effective value and retains the complete history. Encode partial-review and override cases as shared test vectors for every consumer.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-008"></a>

### TQ-008 — Accessible high-signal review flow

> - **Status / area:** Open · NFR
> - **Driver / contributors:** Peaky frontend and accessibility engineers
> - **Technical basis:** TE-006; product direction in `feedback.md`
> - **Affects:** Review-plan profile, template switch, filters, evidence rows, sticky navigation, and reorder controls
> - **Blocks:** Component quality contract
> - **Origin / revisit:** Revisit after keyboard, theme, reduced-motion, and list-size tests identify required corrections

**Question and current understanding.** The sketch defaults to High signal and offers More context. It supports dark and light themes, opaque sticky navigation, keyboard reorder controls, responsive layouts, and reduced-motion CSS. These are properties of a synthetic fixture, not production guarantees.

**Why it matters and competing interpretations.** A dense default can reduce cognitive load but can also hide evidence, focus state, or recovery controls. A broader default may improve explanation but increase scanning effort. Define the minimum accessible and responsive contract before component design.

**Investigation and current answer.** Run the named sketch paths with keyboard, screen-reader-oriented landmarks, both themes, reduced motion, narrow viewports, sparse lists, and larger lists. Record failures and expected focus recovery. No technical threshold is established yet.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-009"></a>

### TQ-009 — Reversible provider work-item preview contract

> - **Status / area:** Answered · Flow
> - **Driver / contributors:** Peaky local-first and application engineers; Product
> - **Technical basis:** TE-006, TE-012, TE-013, TE-014, DEC-016, and the 2026-08-26 engineering session
> - **Affects:** Handoff drafts, practice identity, sync, conflict feedback, and future provider integration
> - **Blocks:** Nothing yet; OpenSpec must encode the accepted contract
> - **Origin / revisit:** Revisit if practice-level selection fails testing, shared drafts need another sync root, or live provider creation starts

**Question and current understanding.** One ordered handoff selects checklist practices across pinned template versions; each Yes/No question becomes one standalone practice. The stable reference contains review, opaque template version, question, and practice IDs. Drafts, snapshots, current associations, and replacement history synchronize under the review root.

**Why it matters and competing interpretations.** Question-level identity would block unrelated ORR practices. Local-only state would not support several testers. HLC resolves concurrent Peaky associations while no external call occurs, but it cannot prevent duplicate provider tickets after live creation exists.

**Investigation and current answer.** Persist synchronized drafts and one HLC-resolved current association per practice. Keep draft editing available during degraded sync, but disable confirmation. Support existing-ticket association and explicit replacement history. Practice completion never changes the current link. Future live creation requires atomic server reservation before any provider call.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-010"></a>

### TQ-010 — Provider-neutral external work-item contract

> - **Status / area:** Investigating · Flow
> - **Driver / contributors:** Peaky application engineers; platform integration owners; Product
> - **Technical basis:** TE-007; proposed [PQ-013](discovery-notes-maturity-score.md#pq-013)
> - **Affects:** Handoff references, status display, destination metadata, sprint or iteration context, and RISK-007
> - **Blocks:** External handoff boundary
> - **Origin / revisit:** Sanitized internal walkthrough feedback supplied 2026-08-13; revisit when provider owners inventory required fields

**Question and current understanding.** A handoff should be trackable after it leaves Peaky, but the product must remain neutral across Jira, YouTrack, and other ITSM providers. Existing-ticket association is a primary path. A provider reference may include an external key, URL, destination, observed status, and last-known update.

**Why it matters and competing interpretations.** Storing no external reference makes follow-through hard to find. Treating every provider field as writable makes Peaky a second backlog or silently changes external work. Read-only metadata, explicitly bounded write-through, and provider-specific adapters have different authorization, freshness, failure, and ownership consequences.

**Investigation and current answer.** Peaky controls the provider-neutral payload and stores provider, ticket ID, and URL. Observed status and refresh time are deferred to the future platform integration (td18): status is external information rather than Peaky workflow state, and persisting it now would imply a freshness contract this increment cannot honour. Platform engineering controls provider-specific templates and transport. A future background worker may consume `PracticeCompletionChanged`, but outbound updates require a separate product decision. Inventory status vocabulary, freshness, authentication, confirmation, failure recovery, and stale or deleted ticket behavior.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-011"></a>

### TQ-011 — Optional suggested impact signal

> - **Status / area:** Deferred · Approach
> - **Driver / contributors:** Peaky application engineers; Product; Template Authors
> - **Technical basis:** TE-007; proposed [PQ-015](discovery-notes-maturity-score.md#pq-015) and DEC-012
> - **Affects:** Gap ordering, handoff explanation, question configuration, and RISK-008
> - **Blocks:** Impact-aware handoff
> - **Origin / revisit:** Sanitized internal walkthrough feedback supplied 2026-08-13; revisit after users test suggested and manual ordering

**Question and current understanding.** Fixed question severity may provide a useful signal for an initial suggested impact order. It does not capture dependencies, cost of delay, capacity, or team-owned sequencing, and must not be called priority or cost of delay.

**Why it matters and competing interpretations.** A fixed order can reduce effort for a first pass, but a mandatory ranking could prescribe a roadmap from incomplete data. Alternatives include no suggestion, a transparent signal with manual override, or an author-controlled score. Each has different explanation, fairness, and configuration risks.

**Investigation and current answer.** Deferred from the first Beta increment. Resume only when provider work-item handoff is shaped again. Do not persist a Peaky backlog or make this a dependency of maturity authoring or calculation.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

<a id="tq-012"></a>

### TQ-012 — Template Studio authoring state and validation

> - **Status / area:** Answered · Flow
> - **Driver / contributors:** Peaky frontend and application engineers; Template Authors
> - **Technical basis:** DEC-014, DEC-017, and DEC-019; current Integrated Template Studio sketch
> - **Affects:** Draft schema, interactive validation, publication gating, calculation invariants, and sections 5.1–5.3
> - **Blocks:** Nothing yet; implementation integrates with the shared Template draft
> - **Origin / revisit:** Revisit if shared-draft integration cannot expose field-addressable validation

**Question and current understanding.** The settled interaction separates profile-level threshold editing from question-level guidance. Checklist allocations use equal defaults or custom shares totaling 100%. Guidance may be unset, associated in bulk, and refined per practice. Guidance changes must never affect arithmetic.

**Why it matters and competing interpretations.** The UI could keep transient interaction state beside one persistent definition, or persist partially valid edits directly. Separate validators for the browser and publication path could disagree. Bulk guidance edits could also overwrite intentional practice-level differences if merge semantics are undefined.

**Investigation and current answer.** Use one maturity-definition schema and validation-result contract for interactive field feedback and atomic TemplateRevision publication. Prevent an eleventh question and reject any over-limit publication. Encode transitions for entering and leaving range editing, enabling custom shares, invalid and recovered totals, unset guidance, bulk association, individual refinement, and guidance-only edits that leave calculation traces unchanged.

[Back to engineering questions summary in the briefing notes](discovery-notes-maturity-score.md#engineering-questions-summary)

## 9. Revisions

| Revision | Date | Author | Change and reason | Product-note impact |
| --- | --- | --- | --- | --- |
| td1 | 2026-08-05 | Discovery draft | Seeded technical context, product rules, risks, alternatives, and engineering questions | None; product decisions remain canonical in the linked briefing notes |
| td2 | 2026-08-05 | Discovery update | Added review-scope semantics, same-version comparison context, RISK-003, and TQ-005 after real ORR feedback | Briefing notes r2 owns PQ-003, DEC-005, and proposed DEC-006 |
| td3 | 2026-08-05 | Synthetic review triage | Added TQ-006 and TQ-007, then recomputed Product collaboration | Briefing notes r3 mirrors both questions and owns the linked product decisions |
| td4 | 2026-08-06 | Discovery update | Added fixed stages, partial-score coverage, visible scope, Peaky-versus-Looker boundaries, and Advisor-reviewed maturity rules | Briefing notes r4 owns DEC-006 through DEC-009 and PQ-005 |
| td5 | 2026-08-06 | Discovery checkpoint | Made stage names and canonical descriptions immutable while preserving optional template context | Briefing notes r5 refines DEC-007 and prototype validation |
| td6 | 2026-08-10 | Discovery update | Changed Peaky display stages to 1–5, added ORR legacy normalization, and introduced advanced threshold-profile questions | Briefing notes r6 updates DEC-007 and PQ-001 |
| td7 | 2026-08-10 | Discovery update | Set equal 20% Beta bands, chose Advisor-reviewed maturity as Looker's default, added progression projections, and excluded Improvement Plan and Jira changes | Briefing notes r7 answers PQ-001 and PQ-005 and narrows the product boundary |
| td8 | 2026-08-10 | Discovery update | Added scoped centralization, current Improvement Plan evidence, and version-aware projection constraints | Briefing notes r8 adds DEC-010 and the scoped-centralization sketch brief |
| td9 | 2026-08-12 | Discovery update | Added the supplied sketch’s two reversible handoff variants, accessibility and preview risks, and TQ-008/TQ-009 | Briefing notes r9 adds DEC-011, PQ-006 through PQ-010, and the feedback provenance |
| td10 | 2026-08-13 | Discovery update | Added sanitized walkthrough feedback on per-pillar context, provider-neutral tracking, bounded handoff scope, optional impact ordering, TE-007, TQ-010/TQ-011, and related risks | Briefing notes r10 adds PQ-011 through PQ-015 and proposed DEC-012 |
| td11 | 2026-08-13 | Discovery update | Added the human-clickable live sketch URL to TE-006 | Briefing notes r11 adds the same linked sketch |
| td12 | 2026-08-14 | Engineering deep-dive checkpoint | Added fixed severity weights, advanced checklist percentages, complete N/A and unanswered rules, bounded thresholds, direct template and pillar calculations, version pinning, explanation data, and the Rules and Template Sync boundaries | Briefing notes r12 owns DEC-013 and the updated product rules |
| td13 | 2026-08-17 | Authoring contract checkpoint | Added settled Template Studio authoring semantics, conceptual contracts and flows, validation risks, first-increment dependency boundaries, TQ-012, and OpenSpec handoff guidance | Briefing notes r13 owns DEC-014, DEC-015, and the updated sketch direction |
| td14 | 2026-08-26 | Consolidated sketch checkpoint | Recorded prioritized-only handoff, Authoring and Improvement Plan as views under static shared chrome, the corrected all-question 39% calculation example, and the 14-versus-10 fixture mismatch | Briefing notes r14 owns the current artifact direction and reconciliation point |
| td15 | 2026-08-26 | Engineering deep-dive checkpoint | Defined the flagged provider-neutral UI, one bulk ticket, one active association per item, conflict blocking, replacement history, external status boundary, and separate integration capability | Briefing notes r15 owns DEC-015, DEC-016, and the updated product boundary |
| td16 | 2026-08-26 | Engineering deep-dive checkpoint | Refined handoffs to synchronized practice-level identity, current association semantics, HLC convergence, degraded confirmation, existing-ticket association, and future reservation and outbound-event boundaries | Briefing notes r16 refines DEC-016 and marks TQ-009 answered |
| td17 | 2026-08-26 | Design-resolution checkpoint | Resolved TemplateRevision ownership, Advisor authorization and lifecycle, the ten-question over-limit contract, exact display precision, and centralized handoff limits | Briefing notes r17 owns DEC-017 through DEC-020 and answers TQ-001, TQ-003, TQ-004, TQ-007, and TQ-012 |
| td18 | 2026-08-26 | Adversarial artifact review | Recorded the template write freeze and Review selection transport as delivery prerequisites (TE-019, TE-020), replaced integer basis points with exact integer ratios, collapsed the definition into one schema-versioned document, reduced the new sync entity types from six to three append-only types, removed the serialized-byte handoff caps and the provider-observed status, and corrected the superseded first-template workspace claim (TE-021) | Briefing notes r18 owns DEC-021 and DEC-022 and amends DEC-020 |

## Appendices

### Technical Evidence and Sources

#### Approved technical evidence

- **TE-001 · [observed]** ORR 2026 is represented by one active template fixture with four pillars, ten checklist questions, and 179 checklist items; no score, stage, threshold, or weight fields appear — `server/data/template-details-1.ts`, inspected 2026-08-05. **Implication:** Scoring configuration requires a new representation.
- **TE-002 · [observed]** Template question types permit `"yes-no"` and `"checklist"` and risk levels permit `"critical"`, `"high"`, and `"medium"` — `app/models/template.ts`, inspected 2026-08-05. **Implication:** The calculation contract must support mixed question types and must not assume the ORR fixture's uniform medium risk.
- **TE-003 · [observed]** Question answers permit yes, no, N/A, checklist checked and N/A sets, null, and N/A reasons — `app/models/question.ts`, inspected 2026-08-05. **Implication:** The arithmetic and explanation contract must cover unanswered, question-level N/A, and item-level N/A.
- **TE-004 · [observed]** Review Improvement Plans derive gap summaries from the review workspace, provide state, severity, and pillar filters, and deep-link gaps to assessment questions — `app/components/review/ReviewPlanPage.vue`, `app/composables/reviews/useReviewPlanData.ts`, and live UI inspected 2026-08-10. **Implication:** The review plan can host rich maturity context without another data-loading flow.
- **TE-005 · [observed]** Team and product plans aggregate contributors and repeated gaps, but contributor models carry no per-template maturity; the review adapter projects only the first template, contributor loading caps at ten, and exact rollups omit template-version identity — `app/models/improvement-plan.ts`, `app/services/review/ImprovementPlanProjection.ts`, `app/composables/reviews/useReviewPlanData.ts`, `app/composables/teams/useTeamPlanData.ts`, and `app/composables/products/useProductPlanData.ts`, inspected 2026-08-10. **Implication:** Scoped centralization requires version-aware multi-template projections before UI composition. **Partly superseded td18:** the first-template limitation no longer applies to the workspace itself; see [TE-021](#te-021).
- **TE-006 · [observed]** The supplied assembled HTML sketch declares synthetic data, no network, two variants, High signal and More context densities, dark and light themes, keyboard and pointer ordering controls, and local provider-work-item draft or plan previews — [`/tmp/maturity-score.html`](https://pagenest-content.is.adyen.com/heitor-lessa/peaky-maturity-score-sketch/), inspected 2026-08-12. **Implication:** The next technical discussion needs separate accessibility, local-state, provenance, and external-side-effect contracts; the sketch does not establish production architecture.
- **TE-007 · [reported]** Sanitized internal walkthrough feedback requested explicit Score / Maturity wording, per-pillar and next-stage context, trackable external references and status, arbitrary handoff selection and reordering, and optional severity/weight-informed impact ordering without mandatory priority — internal walkthrough feedback supplied 2026-08-13. **Implication:** TQ-010 and TQ-011 must define a provider-neutral boundary and an explainable, non-prescriptive signal.
- **TE-008 · [observed]** Draft merge request !368 removes Rules Manager, `ruleSets`, Rules persistence, and the old live `maturity-score` OpenSpec capability because no production runtime evaluates Rules. Replacement Maturity Score behavior is explicitly outside that change — merge request description, design, tasks, and OpenSpec deltas inspected 2026-08-14. **Implication:** Maturity Score must define its own model and must not reuse Rules concepts.
- **TE-009 · [observed]** Draft merge request !346 keeps shared structured Template authoring as metadata, pillar, and question units, states that legacy `template_draft*` names are not the target model, and assigns exact version storage and publication behavior to separate prerequisite work — merge request description, design, and OpenSpec deltas inspected 2026-08-14. **Implication:** This design sets TemplateRevision ownership and atomic publication now, while concrete transitional storage integrates with the unified Template model.
- **TE-010 · [observed]** The Integrated Template Studio authored source and assembled HTML exercise a single five-stage profile, dedicated score-range editing, optional question and practice guidance, bulk association, equal and custom checklist allocations, validation recovery, and an earned-versus-available-points explanation — `sketches/_sources/maturity-authoring-inline.html` and `sketches/maturity-authoring.html`, inspected 2026-08-17. **Implication:** These artifacts provide interaction states and acceptance inputs, but not production architecture, persistence, or customer evidence.
- **TE-011 · [observed]** The current authored and assembled lifecycle artifacts consolidate Authoring and the prioritized Improvement Plan as views under one persistent toolbar. The corrected authoring fixture uses all 14 configured synthetic questions, shows three representative rows plus an aggregate for 11, and produces 39% — `sketches/_sources/maturity-feature-lifecycle.html`, `sketches/maturity-feature-lifecycle.html`, and `sketches/_sources/maturity-authoring-inline.html`, inspected 2026-08-26. **Implication:** View switching must not replace shared chrome and explanations must use the complete configured denominator. The over-limit fixture remains interaction evidence, not an acceptance vector.
- **TE-012 · [observed]** Improvement Plans currently derive question-level `PlanItem` values. `PlanItemIdentity` includes review, subject, template, pillar, question, optional template-version, and optional checklist-item IDs; workspace adaptation projected only the first template — `app/models/improvement-plan.ts`, `app/services/review/ImprovementPlanProjection.ts`, and `app/composables/reviews/useReviewPlanData.ts`, inspected 2026-08-26. **Implication:** Practice-level handoffs need a durable synchronized identity and all-Revision projection. **Partly superseded td18:** see [TE-021](#te-021).
- **TE-013 · [observed]** The sync engine resolves fields by lexicographically ordered HLC and reports losing writes as `hlc_conflict` — `services/internal/syncengine/conflict/conflict.go`, inspected 2026-08-26. **Implication:** Current practice associations can converge before provider side effects exist.
- **TE-014 · [observed]** The sync entity registry carries review children under the review pull root and currently contains no handoff entities — `services/internal/syncengine/entity/registry.go`, inspected 2026-08-26. **Implication:** Synchronized drafts, practice state, external references, and history require registry, authorization, handler, schema, and threat-model updates.
- **TE-015 · [observed]** Public Nuxt runtime configuration already exposes client feature values, but currently defines only test-helper and OIDC values — `nuxt.config.ts`, inspected 2026-08-26. **Implication:** The handoff UI needs a new default-off public flag, while future provider calls require a separate server capability.
- **TE-016 · [observed]** Current normalized template-version storage and mutable `template_drafts` are transitional, while draft merge request !346 describes a stable Template aggregate with one collaborative draft Revision and immutable published Revisions — `shared/db/schema/template.ts`, `shared/db/schema/local.ts`, `app/services/entity/TemplateMutations.ts`, `server/api/templates/[id]/publish.post.ts`, and merge request !346, inspected 2026-08-26. **Implication:** Maturity configuration belongs to TemplateRevision and publishes atomically with template content; upgrade classification remains separate.
- **TE-017 · [observed]** Review participant roles persist as `assessor` and `reviewer`; the application labels reviewers Advisors; current server authorization exposes review `canView` and `canEdit` decisions and child-to-review resolution — `shared/db/schema/review.ts`, `app/models/review.ts`, `services/internal/authz/authz.go`, and `services/internal/authz/resource.go`, inspected 2026-08-26. **Implication:** Initial override actions require current `reviewer` assignment plus review edit access, with future exceptional authority expressed as a server-side Cedar action.
- **TE-018 · [observed]** Sync currently limits a push to 500 events and 100 fields per event, while Nuxt limits request bodies to 2 MB; neither defines domain field-value, collection, or snapshot limits for handoffs — `services/internal/syncengine/push.go` and `nuxt.config.ts`, inspected 2026-08-26. **Implication:** One stricter versioned `HandoffLimits` contract and shared TypeScript/Go boundary vectors must govern handoff mutations, and a limit-maximal draft must be proven to fit those push caps.

<a id="te-019"></a>

- **TE-019 · [observed]** Template create, update, publish, and delete routes return HTTP 503 `template_write_unavailable` before touching domain state, and the delete boundary also keeps archive, restore, whole-draft deletion, and permanent deletion unavailable — `site/docs/development/threat-model.md` (`drift:template-write-freeze`) and `openspec/specs/template-studio/spec.md`, inspected 2026-08-26. **Implication:** Every authoring and publication acceptance criterion is blocked until the write freeze lifts; calculation, projection, explanation, and handoff read paths must be sequenced first and seeded definitions used until then.

<a id="te-020"></a>

- **TE-020 · [observed]** Exact `review_template_selections` rows are local-only and omitted from Review sync; a manually supplied `templateRevisionIds` field is stored by generic Go field handling without domain validation and never replayed or projected — `site/docs/development/threat-model.md` (`drift:review-selection-transport-deferred`), inspected 2026-08-26. **Implication:** A fresh client cannot reconstruct a Review's pinned Revisions, so per-Revision maturity there depends on Generic Sync Hardening; this change must not claim to close that gap.

<a id="te-021"></a>

- **TE-021 · [observed]** The Review workspace already returns `templateRevisions[]` plus a flat `pillars[]`, where every Pillar and Question carries `templateRevisionId`, and `review_score_state.score_type` already accepts `"maturity"` — `app/models/workspace.ts`, `server/api/reviews/[id]/workspace.get.ts`, and `shared/db/schema/review.ts`, inspected 2026-08-26. **Implication:** Multi-Revision projection is shipped; the remaining work is one per-Revision maturity collection beside the existing arrays, not a nested restructure, and the plan projections still need Revision-aware maturity.

### Synthetic engineering-readiness review

**Review type:** Synthetic engineering-readiness review (`SR-E-###`). This is generated feedback, not engineering evidence.

<a id="engineering-readiness-review-summary"></a>

#### Findings at a glance

| ID | Status | Finding | Affects | Triage |
| --- | --- | --- | --- | --- |
| [SR-E-001](#sr-e-001) | Triaged | Scope and version identity lack one contract | [TQ-006](#tq-006) | → [TQ-006](#tq-006) |
| [SR-E-002](#sr-e-002) | Fixed | Comparison lifecycle and effective value were undefined | [TQ-007](#tq-007) | → fixed td17 |

<a id="sr-e-001"></a>

#### SR-E-001 · [synthetic engineering-readiness review] — Comparison identity contract missing

> - **Status:** Triaged
> - **Artifact basis:** TQ-005 — Scoped maturity projection
> - **Affects:** [TQ-006](#tq-006)
> - **Triage:** → [TQ-006](#tq-006)

**Reviewer concern.** Review scope lacks stable capture and mutation semantics, while same-template-version equality has no enforceable rule for changes that can alter maturity. The shared comparison projection also lacks one defined input and reason contract.

**Why it matters and recommended response.** Historical scopes or versions could silently change meaning, and consumers could disagree about eligibility. Inspect scope persistence, template mutation, and review lineage. Define immutable identity and equality rules, then specify one projection contract with eligible, ineligible, and indeterminate test vectors.

[Back to engineering-readiness review summary](#engineering-readiness-review-summary)

<a id="sr-e-002"></a>

#### SR-E-002 · [synthetic engineering-readiness review] — Comparison state and override rules resolved

> - **Status:** Fixed
> - **Artifact basis:** TQ-004 — Complete arithmetic and edge cases
> - **Affects:** [TQ-007](#tq-007)
> - **Triage:** → fixed td17

**Reviewer concern.** Live scores can appear before completion, and calculated plus Advisor-reviewed values are preserved. Without one supersede and revoke contract, consumers could resolve different effective values.

**Why it matters and recommended response.** Consumers could disagree about which historical override is active. Revision td17 defines append-only create, supersede, and revoke transitions plus one effective-value resolver; implementation must encode the same partial-review and override cases as shared tests for Peaky and Looker.

[Back to engineering-readiness review summary](#engineering-readiness-review-summary)
