---
discovery_version: "2.7.0"
---

# Discovery Briefing Notes: Maturity Score

## Artifact control

- **Notes status:** Shaping
- **Steward:** Peaky Product team
- **Revision:** r18
- **Last reviewed:** 2026-08-26
- **Canonical notes:** `discovery/maturity-score/discovery-notes-maturity-score.md`
- **Technical design:** [`technical-design-maturity-score.md`](technical-design-maturity-score.md)

ID legend: E = evidence · PQ = product question · DEC = product decision · TQ = technical question (detail in the Tech Design Document) · SR-P = synthetic premise challenge · SR-C = synthetic customer review finding.

## Executive Card

### Customer

Template Authors configuring maturity for a template, and Team Leads or Staff+ engineers interpreting results from reviews pinned to that template version.

### Problem

Authors need a safe way to configure score ranges, question influence, and optional stage guidance without changing fixed maturity meaning or making guidance affect the score.

### Outcome

Authors can publish an explainable, validated maturity definition that produces consistent per-template results and remains stable for every pinned review.

### Integrated customer experience

Template Studio, assessments, score explanations, Improvement Plan handoffs, and pinned versions share one traceable contract without making Peaky own external ticket work.

### Biggest risk

Authors or assessors mistake optional stage guidance for scoring logic or a guaranteed stage, weakening trust in the calculated result.

### Teams involved

Template Authors, Team Leads, Staff+ engineers, Advisors, Peaky Product, PX, ORR, application engineering, and platform engineering.

### Suggested next step

Product and Engineering should implement from the validated OpenSpec change while Template Versioning separately defines upgrade and reassessment policy.

### Top Evidence

- **E-005 · [reported]** PX expects question weights plus sparse checklist-item weighting, while other Template Authors need safe defaults — corrected discovery context supplied 2026-08-05
- **E-006 · [reported]** ORR participants questioned what a score means for multi-service teams and how results compare across different templates — team feedback supplied 2026-08-05
- **E-008 · [reported]** PX said Improvement Plans provide tactical actions but no staged measure; Maturity Score must add that measure without exposing incentives to assessors — PX answers supplied 2026-08-06

## Product context

**Current experience and problem context.** ORR currently presents a static five-level maturity scale in Google Docs. Teams assess operational practices through questions and checklist items. Improvement Plans can turn unmet practices into tactical actions, but they do not provide a staged maturity measure. Real ORR participants questioned what a score describes when one team covers several services and whether results remain comparable across teams using different templates. Peaky reviews may cover one service, several services owned by one team, several services owned by different teams, or team-wide processes. A review may use up to three intentionally different templates.

**Why now and strategic context.** Maturity Score is one of two major items named for moving Peaky from Preview to beta. PX expects Maturity Score, Improvement Plans, operational cues, Template Authors, and Advisors to work together. This should help Leadership decide where to mobilize expertise, change priorities, improve tools or processes, or stop ineffective work. PX authors ORR at this stage, while Team Leads, Engineering Leads, and Staff+ engineers may author other templates. Who may author or publish remains outside this feature.

## Outcome and validation

- **Outcome signal:** Users explain each provisional template result, its coverage, completed evidence, current gaps, and useful action areas.
- **Product guardrails:** Do not combine scores across templates. Keep coverage separate from maturity. Treat results as provisional. Do not present team or product maturity as inherent properties. Do not reward authors for adding checklist items. Do not ask assessors to select maturity stages directly. Do not build an analytics view in Peaky.
- **Measurement:** First validate whether Template Authors can configure ranges, allocations, and optional guidance without confusing them with scoring. After review use produces enough data, evaluate coverage, override reasons, N/A patterns, and later analytics separately.

## Integrated customer experience

- **Experience it supports:** A team assesses a named scope, then uses one review Improvement Plan to understand per-template maturity, gaps, and possible action areas.
- **What must work together:** One canonical five-stage maturity profile, fixed severity weights, checklist allocations, optional stage guidance, pinned template versions, assessment answers, coverage, N/A handling, Advisor evidence, and calculation explanations.
- **Connected journey:** A Template Author sees the full five-stage profile, adjusts score ranges through one dedicated action, configures optional guidance inside questions and practices, validates checklist allocations, and publishes a template version; teams then self-assess against that pinned definition and inspect how their result was calculated.
- **Shared expectations:** Score-range editing and stage-guidance authoring are separate jobs. Guidance is optional, never changes the score, and never guarantees a stage. Every result identifies the pinned template version, scope, coverage, and override provenance.
- **Teams that need to work together:** Peaky Product and PX define maturity meaning. Template Authors validate authoring clarity. Engineering defines the versioned calculation and validation contracts. Staff+ Advisors and ORR participants validate explanations during assessment.
- **Product integration question:** Later Improvement Plan, Looker, and work-item experiences must consume the same versioned result without becoming Beta dependencies or changing authoring semantics.

## Product scope and guardrails

### In scope

- Infer one maturity score per template.
- Use the question as the primary scoring unit.
- Give questions fixed weights from severity: Medium 1, High 2, and Critical 3.
- Give checklist items equal shares by default.
- Allow advanced Template Authors to set checklist-item percentages within the parent question.
- Require checklist-item percentages to total 100% and never increase the parent question's fixed severity weight.
- Allow one checklist item to exceed 50%, but explain that a separate question or Yes/No question may be clearer.
- Map Yes to 100% and No to 0%, with no author setting for partial Yes/No values.
- Exclude N/A answers and recalculate from applicable answers.
- Exclude unanswered questions from the live denominator and show answer coverage.
- Show live per-template scores while a review is in progress.
- Show progress toward the next stage and position across the full five-stage path.
- Show separate template scores in team review rows and template breakdown views.
- Show explicit Score / Maturity wording, per-pillar context, current-stage gaps, and next-stage requirements for each template.
- Treat the full named review scope as the subject of each attached template score.
- Display maturity as stages 1–5 in Peaky, with ORR's legacy 0–4 values normalized during Beta import and export.
- Keep stage names and canonical descriptions immutable across every template.
- Start with equal threshold bands and allow advanced Template Author threshold profiles.
- Limit each advanced threshold boundary to 10 percentage points above or below its default, and require every stage to cover at least 10 percentage points.
- Keep one large five-stage maturity profile visible as the canonical overview in Template Studio.
- Provide one top-level **Adjust score ranges** action that edits only stage thresholds and exits through **Done adjusting**.
- Keep optional stage guidance inside question and practice editors, separate from profile-level threshold editing.
- Allow stage guidance to be unset, associate it in bulk across checklist practices, and make clear that guidance never affects the score or guarantees a stage.
- Allow Template Authors to add optional contextual guidance without replacing or redefining the canonical stage description.
- Allow same-template-version analysis to include in-progress reviews when status, coverage, scope, and override context remain visible.
- Never compare different template versions or different templates as one maturity measure.
- Show a compact scope label beside every score and export, including services, owners, team count, and a shared-review cue when needed.
- Show limited operational cues in Review Details, Team views, and Improvement Plans without building an analytics view.
- Centralize rich per-template maturity context in review Improvement Plans.
- Show compact per-review and per-template maturity context in team and product Improvement Plans without aggregating maturity.
- Show each pillar's stage, percentage, answer coverage, and unanswered count using the template version's thresholds.
- Keep the provider-neutral handoff UI behind a deployment flag that is disabled before release.
- Let one bulk handoff select many practices into one external ticket.
- Limit one handoff to 50 practices and reject over-limit drafts without truncation.
- Include leading practices, helpful links, why each item matters, and review, template-version, evidence, plan-item, and source identifiers.
- Keep at most one current external-ticket association per practice.
- Block a new handoff when any selected practice already has a current association.
- Allow explicit association with an existing Jira, YouTrack, or ITSM ticket, or replace a current association while retaining history.
- Store the provider, ticket ID, and URL for an associated external work item. Observed provider status and refresh time are out of scope for this increment (r18) and belong to a future platform integration with its own status vocabulary and freshness rules.
- Require exactly one author-assigned stage association for every scored question and checklist practice, assignable individually or in bulk.
- Present a result stage as provisional until answer coverage is complete, and offer pillar and met/unmet filters with a visible count.
- Explain each maturity result from the actual pinned template version and review answers through a subtle "How is this calculated?" entry point.
- Allow any currently assigned Advisor with review edit access to create, supersede, or revoke an override with explanation and evidence.
- Show Advisor-reviewed maturity as the primary result, preserve calculated maturity, and export both with provenance.
- Limit templates to ten questions in authoring and publication; return a configuration error and no maturity result for over-limit pinned data.
- Publish maturity configuration atomically with template content as part of one immutable TemplateRevision.
- Enforce one versioned handoff-limits contract across TypeScript and Go.

### Not in scope

- Cross-template score comparisons or rollups across templates, reviews, teams, or products.
- Rankings, benchmarks, exploratory analytics, or an analytics view inside Peaky.
- Authoring, publishing, or template-governance permissions.
- Company campaigns created from external analytics.
- Dry-run reviews and their exclusion from reports or Improvement Plans.
- Full template versioning or historical-score migration.
- Reducing the ORR 2026 checklist content.
- Deploying Peaky and its infrastructure to AWS.
- Changing Improvement Plan generation, rollups, prioritization, or ownership.
- Creating, closing, or synchronizing Jira ticket lifecycle from maturity changes.
- Owning external backlog sequencing, sprint scope, priority, cost-of-delay ranking, or provider-specific work-item lifecycle.
- Creating live provider work items or other network side effects before the platform integration exists and is enabled.
- Requiring Jira, ITSM, Looker, or another external system for the Beta authoring and calculation path.
- Letting Peaky edit, prioritize, assign, or own the lifecycle of external tickets.
- Delivering analytics or cross-review insights in the first Beta increment.

### Product constraints and assumptions

- **Constraint:** A template contains at most ten questions and normally five checklist items per question; a review contains at most three templates.
- **Constraint:** Template Studio prevents an eleventh question and publication independently rejects over-limit drafts. Over-limit pinned data returns a configuration error and no maturity result.
- **Constraint:** ORR 2026 remains a legacy 0–4 source and export format during Beta; Peaky displays 1–5.
- **Constraint:** Template Authors cannot rename stages or edit their canonical descriptions.
- **Constraint:** Reviews remain pinned to the published template version selected at review creation. Publishing a newer version never updates an existing review automatically.
- **Constraint:** Maturity configuration belongs to TemplateRevision and freezes atomically with template content. Patch/minor/major classification, review upgrades, reassessment, migration, and impact preview remain deferred to Template Versioning.
- **Constraint:** Questions use fixed severity weights: Medium 1, High 2, and Critical 3.
- **Constraint:** Yes/No questions map Yes to 100% and No to 0%.
- **Constraint:** The initial override policy requires a current persisted `reviewer` assignment, displayed as Advisor, plus review edit access. Any current Advisor may supersede or revoke; future Admin or exceptional grants require server-side Cedar policy.
- **Constraint:** Handoff limits are rationale 2,000 characters; external and evidence IDs 128 characters; HTTPS URLs 2,048 characters; 10 helpful links and 20 evidence IDs per practice; and 50 practices per handoff, all counted in Unicode characters or collection members with no serialized-byte cap, from [DEC-020](#dec-020).
- **Assumption to test:** Equal default 1–5 bands produce understandable results across intentionally different templates.
- **Assumption to test:** Advanced threshold profiles improve contextual fit without creating misleading same-version comparisons.
- **Assumption to test:** Authors understand that score ranges and stage guidance are separate controls.
- **Assumption to test:** Optional author-written context improves assessment without being mistaken for scoring logic, a different stage meaning, or a guaranteed stage.
- **Assumption to test:** Same-template-version partial results provide useful early signals when coverage, scope, and override state stay visible.
- **Assumption to test:** High signal remains understandable while More context can explain evidence, provenance, and navigation when needed.
- **Assumption to test:** Direct handoff reduces effort for a clear single gap without hiding cross-template prioritization.
- **Assumption to test:** Cross-template selection and ordering supports team-owned sequencing without becoming a Peaky planning tool.
- **Assumption to test:** Per-pillar context and next-stage requirements clarify uneven maturity without creating targets or a second stage vocabulary.
- **Assumption to test:** Provider-neutral work-item references and status make handoff trackable without requiring Peaky to own external lifecycle.
- **Assumption to test:** Fixed question severity can suggest impact order without being interpreted as priority or cost of delay.

## Evidence and open validation

### Evidence ledger

- **E-001 · [observed] · operations** ORR 2026 contains 4 pillars, 10 checklist questions, and 179 checklist items. The fixture contains no score, stage, threshold, or weight fields — `server/data/template-details-1.ts`, inspected 2026-08-05. **Proximity:** direct. **Implication:** The first scoring model must add new configuration while handling a large imported checklist.
- **E-002 · [reported] · operations** PX and Peaky agreed that maturity is calculated per template and is not rolled up across reviews, teams, or products — discovery session, 2026-08-05. **Proximity:** firsthand stakeholder report. **Implication:** Every product display and calculation must retain template identity.
- **E-003 · [reported] · operations** ORR uses cumulative levels 0–4: Not Implemented, Ad-hoc, Defined, Measured, and Optimized. Checklist items are guidance rather than strict gates, and Google Docs asks assessors to apply judgement — ORR 2026 scale excerpt supplied in discovery, 2026-08-05. **Proximity:** direct excerpt, origin supplied by stakeholder. **Implication:** Peaky needs inferred scoring for parity without copying the document's manual burden.
- **E-004 · [reported] · operations** Teams report that some questions do not apply to certain teams or applications, and static documents do not support varied templates or useful N/A collection — discovery context, 2026-08-05. **Proximity:** proxy report. **Implication:** N/A handling is part of trustworthy scoring.
- **E-005 · [reported] · operations** PX authors ORR and expects question weights plus sparse checklist-item weighting; Team Leads, Engineering Leads, and Staff+ engineers may author other templates and need safe defaults — corrected discovery context, 2026-08-05. **Proximity:** firsthand stakeholder report. **Implication:** Authoring must disclose complexity progressively without defining publishing governance.
- **E-006 · [reported] · operations** ORR participants asked what a per-template score means for multi-service teams and how maturity can be compared when teams use different templates — team feedback supplied 2026-08-05. **Proximity:** direct participant feedback relayed verbatim. **Implication:** Score subject and comparison eligibility must be explicit.
- **E-007 · [reported] · operations** In the first ORR round, a team listing several services was reported using its most critical service, and leads considered team maturity subjective — team feedback supplied 2026-08-05. **Proximity:** direct participant feedback relayed verbatim. **Implication:** Peaky should not silently reproduce a single-service proxy or imply that a score is an inherent team property.
- **E-008 · [reported] · operations** PX described Improvement Plans as tactical guidance that lacks a staged measure. PX expects Maturity Score, Improvement Plans, analytics, Template Authors, Advisors, and Leadership action to form a multi-layer answer — PX answers supplied 2026-08-06. **Proximity:** firsthand stakeholder report. **Implication:** Maturity Score should add measurement without replacing action guidance or deeper analysis.
- **E-009 · [reported] · operations** PX said the maturity model needs an early opinionated prototype and substantial feedback from people conducting ORR — PX answers supplied 2026-08-06. **Proximity:** firsthand stakeholder report. **Implication:** Prototype comprehension and decision usefulness are the next validation step.
- **E-010 · [reported] · product** Stakeholder direction frames review follow-through around separate provisional template results, evidence-backed gaps, and two reversible Jira handoff options — `discovery/maturity-score/feedback.md`, supplied 2026-08-12. **Proximity:** firsthand stakeholder direction. **Implication:** The next prototype test must compare direct gap handoff with a cross-template priority handoff without adding aggregate maturity or prescribed planning.
- **E-011 · [reported] · product** Sanitized internal walkthrough feedback asked for clearer Score / Maturity wording, per-pillar results, visible next-stage gaps, trackable provider references and status, bounded handoff scope, and impact-aware ordering without mandatory priority — internal walkthrough feedback supplied 2026-08-13. **Proximity:** firsthand internal walkthrough report. **Implication:** Product and Engineering must test comprehension and define a provider-neutral handoff boundary before implementation.
- **E-012 · [reported] · product** Stakeholder sketch iteration selected the prioritized cross-template Improvement Plan handoff as the only handoff direction retained in the current validation artifact. Authoring and Improvement Plan are consolidated as two product views under one persistent toolbar; they are not option A/B variants — stakeholder iteration, 2026-08-17 through 2026-08-26. **Proximity:** firsthand stakeholder direction. **Implication:** Future walkthroughs should test continuity between the two views, not compare direct and batch handoff variants.
- **E-013 · [observed] · product** The corrected synthetic authoring walkthrough calculates its example from all 14 configured fixture questions, shows three representative rows plus an aggregate for the remaining 11, and resolves to 39%. The fixture exceeds the ten-question product maximum — `sketches/_sources/maturity-authoring-inline.html`, inspected 2026-08-26. **Proximity:** direct artifact inspection. **Implication:** The walkthrough remains useful evidence for the complete-denominator rule but is not a valid acceptance fixture; canonical worked fixtures cover ten and smaller templates, while over-limit pinned data returns a configuration error and no maturity result.
- **E-014 · [observed] · authorization** Persisted review participant roles are `assessor` and `reviewer`; application models present reviewers as Advisors, while the current authorization port exposes review-level view and edit decisions — `shared/db/schema/review.ts`, `app/models/review.ts`, and `services/internal/authz/authz.go`, inspected 2026-08-26. **Proximity:** direct source inspection. **Implication:** Initial override authorization can require current `reviewer` assignment plus review edit access without adding a persisted Advisor role.
- **E-015 · [observed] · architecture** The repository has transitional normalized template-version data plus mutable shared template drafts, while draft merge request !346 describes the future stable Template aggregate with one collaborative draft Revision and immutable published Revisions — repository source and merge request !346, inspected 2026-08-26. **Proximity:** direct source and change-plan inspection. **Implication:** Maturity belongs to TemplateRevision and publishes atomically with template content, while upgrade classification remains a separate Template Versioning decision.
- **E-016 · [observed] · security** Sync currently caps pushes at 500 events and 100 fields per event, and Nuxt caps request bodies at 2 MB, but no central handoff field-value contract exists — `services/internal/syncengine/push.go` and `nuxt.config.ts`, inspected 2026-08-26. **Proximity:** direct source inspection. **Implication:** Handoff needs stricter domain limits and shared TypeScript/Go drift tests rather than relying on transport caps.

### Validation status

- **Real people consulted:** PX representatives, Peaky Product, and ORR participants whose verbatim questions were supplied in this update. The new sketch adds synthetic walkthrough observations, not validated customer evidence.
- **Evidence mix:** Direct template inspection, a supplied ORR scale excerpt, firsthand PX framing and direction, sanitized internal walkthrough feedback, product decisions, relayed participant feedback from static ORR sessions, and synthetic prototype observations.
- **Highest-risk unsupported claim:** Fixed boundaries will produce stages that teams find useful across intentionally different templates without becoming targets.
- **Next validation conversation:** PX, ORR participants, and Peaky Product should test [PQ-006](#pq-006), [PQ-007](#pq-007), [PQ-011](#pq-011), and [PQ-015](#pq-015) using valid ten-question-or-smaller worked assessments and the prioritized Improvement Plan view.

## Product collaboration questions

<a id="product-questions-summary"></a>

### Product questions at a glance

| ID | Status | Evidence gap | Who to involve | Blocks | Question |
| --- | --- | --- | --- | --- | --- |
| [PQ-001](#pq-001) | Answered | Validate equal 20% Beta bands and advanced profiles through prototypes | PX and Peaky Product | Nothing yet | Beta uses equal 20% bands; prototypes test whether advanced profiles improve meaning without weakening comparison. |
| [PQ-002](#pq-002) | Answered | Validate whether excluded unanswered questions make early scores too volatile | PX, Peaky Product, team assessors | Calculation contract | Unanswered questions stay outside the live score; answer coverage remains visible. |
| [PQ-003](#pq-003) | Answered | Validate whether partial same-version signals support action without false ranking | PX, team leads, Peaky Product | Operational cues and Looker analysis | Same-version analysis includes in-progress reviews with status, coverage, scope, and override context. |
| [PQ-004](#pq-004) | Answered | Validate the compact label with multi-service teams | Team leads, participants, Peaky Product | Score explanation | Every score shows template version, service and team scope, owners, and a shared-review cue. |
| [PQ-005](#pq-005) | Answered | Validate the default against real analytics questions | Peaky Product and Looker data owners | Nothing yet | Looker defaults to Advisor-reviewed maturity and keeps calculated maturity available. |
| [PQ-006](#pq-006) | Open | Users may expect one review-wide number | ORR participants, Team Leads, Peaky Product | DEC-011 and review experience | Do users understand why pinned template results stay separate? |
| [PQ-007](#pq-007) | Open | Users may confuse coverage with maturity | ORR participants, PX, Peaky Product | Result interpretation | Can users distinguish answer coverage, provisional maturity, current gaps, and future-stage context? |
| [PQ-008](#pq-008) | Answered | Prioritized handoff remains unvalidated with real participants | ORR participants, Team Leads, Peaky Product | Nothing yet | Use the prioritized cross-template handoff as the sole current sketch direction; validate its effort and sequencing semantics. |
| [PQ-009](#pq-009) | Open | Navigation and evidence filters may fail at different list sizes | ORR participants, accessibility reviewers, Peaky Product | Sketch usability | Do Open review, Open assessment, filters, evidence rows, and previews remain clear in sparse and large lists? |
| [PQ-010](#pq-010) | Deferred | Team and product recurring-gap views are not defined | Team and Product users, Peaky Product, Looker data owners | Future scope | Which repeated-gap and provenance views help teams without creating rollups or rankings? |
| [PQ-011](#pq-011) | Open | Score wording and pillar context may be unclear | ORR participants, Template Authors, Peaky Product | Result interpretation | Do users understand Score / Maturity, per-pillar results, and the gaps between the current and next stage? |
| [PQ-012](#pq-012) | Open | Template-specific meaning and next-stage guidance may create pressure | Template Authors, ORR participants, PX, Peaky Product | Stage explanation | Can fixed stage names and author-defined context explain maturity without turning next-stage requirements into mandatory targets? |
| [PQ-013](#pq-013) | Investigating | Provider integration fields and status transport remain undefined | Peaky Product, platform engineering, Jira/ITSM owners, Team Leads | Live integration contract | Which provider-neutral references and observed status fields can the platform integration supply safely? |
| [PQ-014](#pq-014) | Answered | Validate whether the 50-practice envelope is usable without becoming a backlog | Team Leads, Staff+ engineers, Peaky Product | Nothing yet | One handoff supports manual selection and ordering of at most 50 practices; Peaky does not own roadmap sequencing. |
| [PQ-015](#pq-015) | Deferred | Impact ordering could be mistaken for priority | Team Leads, Staff+ engineers, Peaky Product, Template Authors | Handoff comprehension | Can fixed question severity inform suggested impact order without prescribing priority or cost of delay? |

<a id="pq-001"></a>

### PQ-001 — Default maturity-stage mapping

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; PX
> - **Best source:** Worked ORR 2026 answer sets reviewed by PX
> - **Blocks:** Nothing yet
> - **Evidence / origin:** E-003 and the discovery discussion
> - **Revisit when:** PX and Peaky compare stage outcomes across representative completed assessments

**Question and context.** Peaky will infer a weighted result and display stages 1–5. ORR remains a legacy 0–4 import and export format during Beta, with a one-step normalization. Stage names and canonical descriptions stay immutable. The group decided that Beta uses equal 20% bands. Advanced Template Authors may propose threshold profiles for a template.

**Why it matters and next step.** A simple default lets engineering implement one stable mapping. Prototype tests should compare equal bands and author profiles against worked assessments. Revisit the decision when PX or domain experts repeatedly disagree with the inferred stage.

[Back to product questions summary](#product-questions-summary)

<a id="pq-002"></a>

### PQ-002 — Unanswered questions in live scores

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; PX; team assessors
> - **Best source:** Observed assessments and worked partial-review examples
> - **Blocks:** Calculation contract
> - **Evidence / origin:** E-004 and the decision to show scores from the first answer
> - **Revisit when:** Worked partial reviews show misleading volatility despite visible coverage

**Question and context.** Review status identifies an assessment as In Progress. The group decided that unanswered questions stay outside the current denominator and answer coverage appears beside maturity and pillar completion.

**Why it matters and next step.** This preserves early signals without treating missing answers as failures. Validate that teams can distinguish a partial result from a final result and that score movement remains explainable.

[Back to product questions summary](#product-questions-summary)

<a id="pq-003"></a>

### PQ-003 — Same-version comparison eligibility

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; PX; Team Leads and Engineering Leads
> - **Best source:** Same-version in-progress and completed reviews
> - **Blocks:** Nothing yet
> - **Evidence / origin:** E-006 and E-007; [SR-C-002](#sr-c-002)
> - **Revisit when:** Users treat partial operational cues as rankings or final maturity

**Question and context.** The group decided never to compare different templates or versions as one maturity measure. Same-version analysis may include in-progress reviews because waiting for completion can hide where teams are stuck. Status, answer coverage, scope, and override context must remain visible.

**Why it matters and next step.** Peaky should show limited operational cues rather than rankings or an analytics view. Looker owns deeper cohort analysis. Validate that early cues lead to support without making partial scores look final.

[Back to product questions summary](#product-questions-summary)

<a id="pq-004"></a>

### PQ-004 — Multi-service review scope summary

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; Team Leads; review participants
> - **Best source:** Observed multi-service review setup and score interpretation
> - **Blocks:** Nothing yet
> - **Evidence / origin:** E-006 and E-007; [SR-C-001](#sr-c-001)
> - **Revisit when:** Multi-service teams cannot identify the assessed scope from the compact label

**Question and context.** Every score and export will show its template version, service count, team count, services and owners, and a shared-review cue when several teams own the scope. The score remains attached to the review scope, not copied into team or service scores.

**Why it matters and next step.** Review Details currently omits scope even for a single-service review. Work item 131 tracks that gap. Test the compact summary with single-team and shared multi-team reviews.

[Back to product questions summary](#product-questions-summary)

<a id="pq-005"></a>

### PQ-005 — Looker default after Advisor override

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; Looker data owners; Staff+ Advisors
> - **Best source:** Worked analytics questions using calculated and Advisor-reviewed maturity
> - **Blocks:** Nothing yet
> - **Evidence / origin:** DEC-003 and the discovery discussion on 2026-08-06
> - **Revisit when:** Looker data owners define default measures and filters for overridden reviews

**Question and context.** Peaky will show Advisor-reviewed maturity as the primary result, with a strong override cue and access to the calculated result. The group decided that Looker also defaults to Advisor-reviewed maturity while retaining calculated maturity as an explicit measure.

**Why it matters and next step.** One default keeps Peaky and Looker interpretation consistent. Validate it against real analytics questions. Revisit when analysts need calculated maturity as the default for a defined use case.

[Back to product questions summary](#product-questions-summary)

<a id="pq-006"></a>

### PQ-006 — Separate template results

> - **Status:** Open
> - **Driver / contributors:** Peaky Product; PX; Team Leads; ORR participants
> - **Best source:** ORR participant testing of the current sketch
> - **Blocks:** DEC-011 and review experience
> - **Evidence / origin:** E-006, E-010, and synthetic walkthrough observation
> - **Revisit when:** Users still seek or infer a review-wide maturity number

**Question and context.** A review may pin several templates that measure different capabilities. The current direction shows one provisional result, coverage, completed evidence, current gaps, and external work-item provenance for each template. It does not calculate a review-wide score.

**Why it matters and next step.** A combined number would be inaccurate, but separate results can feel fragmented. Ask ORR participants to explain the template switch and the absence of a combined score before choosing the default review layout.

[Back to product questions summary](#product-questions-summary)

<a id="pq-007"></a>

### PQ-007 — Coverage and provisional maturity

> - **Status:** Open
> - **Driver / contributors:** Peaky Product; PX; ORR participants
> - **Best source:** Worked partial assessments and participant testing
> - **Blocks:** Result interpretation
> - **Evidence / origin:** E-009 and E-010; synthetic walkthrough observation
> - **Revisit when:** Users read coverage as a score or treat future stages as required targets

**Question and context.** Coverage describes how much evidence exists. Maturity describes the current template result. The current sketch labels results provisional and uses a categorical profile, but the distinction needs testing with partial and sparse evidence.

**Why it matters and next step.** Confusing these facts can create grade pressure or false confidence. Test whether participants can state what the current stage means, what remains unanswered, and why future stages are context rather than a required distance.

[Back to product questions summary](#product-questions-summary)

<a id="pq-008"></a>

### PQ-008 — Prioritized handoff working direction

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; Team Leads; Staff+ engineers; ORR participants
> - **Best source:** Participant walkthroughs using the prioritized Improvement Plan view
> - **Blocks:** Nothing yet
> - **Evidence / origin:** E-010, E-011, and E-012; synthetic walkthrough observation
> - **Revisit when:** Participant testing shows the prioritized flow adds unnecessary effort or obscures evidence and team sequencing control

**Question and context.** Earlier exploration compared a direct single-gap draft with a cross-template prioritized handoff. The current working direction retains only the prioritized flow: users select and order up to 50 practices across pinned templates before preparing one reversible handoff preview with no live provider side effect.

**Why it matters and next step.** Consolidating on one direction removes an artificial option comparison and keeps the walkthrough focused on evidence trust, selection effort, and team-owned sequencing. Validate those assumptions with participants before any provider integration is shaped.

[Back to product questions summary](#product-questions-summary)

<a id="pq-009"></a>

### PQ-009 — Existing navigation and evidence detail

> - **Status:** Open
> - **Driver / contributors:** Peaky Product; ORR participants; accessibility reviewers
> - **Best source:** Sketch walkthroughs across themes, densities, and list sizes
> - **Blocks:** Sketch usability
> - **Evidence / origin:** E-010; synthetic walkthrough observation
> - **Revisit when:** Users cannot reach the exact review or assessment context, or filters hide useful evidence

**Question and context.** Open review and Open assessment are sketch-only notices for existing Peaky destinations. High signal is the default, More context is optional, and evidence filters must support completed evidence and current gaps without changing product scope.

**Why it matters and next step.** Repeated explanations or unclear navigation add effort. Test sparse and large gap lists in dark and light themes, with keyboard and reduced-motion settings, and record the exact recovery point.

[Back to product questions summary](#product-questions-summary)

<a id="pq-010"></a>

### PQ-010 — Team and product recurring gaps

> - **Status:** Deferred
> - **Driver / contributors:** Peaky Product; Team and Product users; Looker data owners
> - **Best source:** Future team and product workflow research
> - **Blocks:** Future scope
> - **Evidence / origin:** Stakeholder recommendation in `feedback.md`; no customer evidence yet
> - **Revisit when:** Team and Product users identify a repeated-gap action that does not need an aggregate maturity score

**Question and context.** Team and Product views may help users see where the same gaps recur, who contributed evidence, and which exact template versions are involved. They must not become leaderboards or calculate team or product maturity.

**Why it matters and next step.** A useful recurring-gap view could guide support, but an aggregate score would revive the comparison problem. Interview affected Team and Product users about the smallest provenance-preserving view that changes an action.

[Back to product questions summary](#product-questions-summary)

<a id="pq-011"></a>

### PQ-011 — Score wording, pillars, and next-stage gaps

> - **Status:** Open
> - **Driver / contributors:** Peaky Product; Template Authors; ORR participants
> - **Best source:** Sanitized internal walkthrough feedback and prototype testing
> - **Blocks:** Result interpretation
> - **Evidence / origin:** E-011; synthetic walkthrough observation
> - **Revisit when:** Participants can explain the overall and per-pillar result without treating the next stage as a required target

**Question and context.** The result should use explicit Score / Maturity wording, show one result per template, and expose per-pillar maturity or coverage. The current stage should show its gaps, while the next stage should explain what would be needed to progress without implying exact distance or a mandatory roadmap.

**Why it matters and next step.** A single headline can hide uneven pillars and ambiguous terminology. Test whether participants can identify the assessed template, current stage, pillar context, current gaps, and next-stage requirements from the same review plan.

[Back to product questions summary](#product-questions-summary)

<a id="pq-012"></a>

### PQ-012 — Author-defined context without new stage meanings

> - **Status:** Open
> - **Driver / contributors:** Template Authors; PX; Peaky Product; ORR participants
> - **Best source:** Sanitized internal walkthrough feedback and DEC-007
> - **Blocks:** Stage explanation
> - **Evidence / origin:** E-011; E-003; synthetic walkthrough observation
> - **Revisit when:** Template Authors and participants agree that context clarifies a fixed stage rather than redefining it

**Question and context.** Stage names and canonical descriptions remain fixed. Template Authors may add contextual guidance and next-stage requirements that explain how a template expresses the canonical stage, but they must not create a second maturity vocabulary or turn guidance into a required score target.

**Why it matters and next step.** Template-specific meaning is useful, but extra labels can fragment interpretation. Test author-written context with representative templates and verify that participants can distinguish canonical meaning, template context, and evidence gaps.

[Back to product questions summary](#product-questions-summary)

<a id="pq-013"></a>

### PQ-013 — Provider-neutral work-item references and lifecycle

> - **Status:** Investigating
> - **Driver / contributors:** Peaky Product; platform engineering; Jira/ITSM owners; Team Leads
> - **Best source:** Platform integration contract and provider field inventory
> - **Blocks:** Live integration contract
> - **Evidence / origin:** E-011; E-010; product decision DEC-016
> - **Revisit when:** Platform engineering defines provider fields, authentication, submission, and status transport

**Question and context.** Peaky will prepare one provider-neutral bulk handoff for many Improvement Plan items. The later platform integration may return a provider, ticket ID, URL, observed status, and refresh time. Peaky does not own ticket work, priority, assignment, or lifecycle.

**Why it matters and next step.** The UI and traceability model can proceed behind a disabled deployment flag, but live submission and status refresh need a platform contract. Platform engineering and Jira/ITSM owners should define available fields, authentication, confirmation, failure recovery, and status freshness.

[Back to product questions summary](#product-questions-summary)

<a id="pq-014"></a>

### PQ-014 — Bounded handoff without a second backlog

> - **Status:** Answered
> - **Driver / contributors:** Peaky Product; Team Leads; Staff+ engineers
> - **Best source:** Sanitized internal walkthrough feedback and Option B testing
> - **Blocks:** Nothing yet
> - **Evidence / origin:** E-011; E-010; synthetic walkthrough observation
> - **Revisit when:** Teams can select and reorder useful gaps without expecting Peaky to store or manage a roadmap

**Question and context.** The prioritized handoff allows manual selection and reordering of practices across pinned templates for one handoff preview, up to a hard maximum of 50 practices. It is not a persistent Peaky backlog, sprint planner, or roadmap, and teams remain responsible for sequencing work in their own systems.

**Why it matters and next step.** The 50-practice maximum bounds payload and review effort without introducing automatic ranking. Test the boundary with large reviews and keep ownership explicit at preview and handoff.

[Back to product questions summary](#product-questions-summary)

<a id="pq-015"></a>

### PQ-015 — Suggested impact order without prescribed priority

> - **Status:** Deferred
> - **Driver / contributors:** Peaky Product; Team Leads; Staff+ engineers; Template Authors
> - **Best source:** Sanitized internal walkthrough feedback and scoring configuration direction
> - **Blocks:** Handoff comprehension
> - **Evidence / origin:** E-011; E-005; synthetic walkthrough observation
> - **Revisit when:** Participants distinguish an optional impact suggestion from team-owned priority and cost of delay

**Question and context.** Fixed question severity may inform a suggested impact signal or initial order. The signal must be labeled as a suggestion, must not be called priority or cost of delay, and must never prevent teams from selecting or reordering any gap.

**Why it matters and next step.** A useful starting order can reduce effort, but a mandatory ranking would make Peaky own decisions it cannot observe. Test unlabeled, suggested, and manually reordered states with several gaps and record whether users infer a roadmap recommendation.

[Back to product questions summary](#product-questions-summary)

## Engineering questions at a glance

<a id="engineering-questions-summary"></a>

| ID | Status | Area | Product impact | Who to involve | Question | Tech Design Document |
| --- | --- | --- | --- | --- | --- | --- |
| TQ-001 | Answered | Approach | Determines how one score definition belongs to a published TemplateRevision | Peaky data and application engineers | Maturity configuration belongs to TemplateRevision and publishes atomically with template content; upgrade policy remains deferred. | [TQ-001 detail](technical-design-maturity-score.md#tq-001) |
| TQ-002 | Open | Flow | Determines whether every UI shows the same live result | Peaky local-first and application engineers | Where is the canonical calculation performed and how is it projected to clients? | [TQ-002 detail](technical-design-maturity-score.md#tq-002) |
| TQ-003 | Answered | Risk | Determines whether overrides are trustworthy and analyzable | Peaky security, data, and application engineers | Current `reviewer` assignment plus review edit access authorizes initial override actions; future exceptions require server-side Cedar policy. | [TQ-003 detail](technical-design-maturity-score.md#tq-003) |
| TQ-004 | Answered | Approach | Determines whether results and explanations remain consistent at every boundary | Peaky application engineers, PX, and Product | Use exact integer ratios compared by cross multiplication for stage resolution, whole percentages for summaries, and exact explanation detail. | [TQ-004 detail](technical-design-maturity-score.md#tq-004) |
| TQ-005 | Open | Flow | Determines whether scoped views remain actionable without implying maturity rollups | Peaky data and application engineers | How are scoped maturity results projected to review, team, product, and Looker consumers? | [TQ-005 detail](technical-design-maturity-score.md#tq-005) |
| TQ-006 | Deferred | Approach | Determines whether historical scopes and versions remain comparable | Peaky data and application engineers | What stable identity contract covers review scope, template version, and every change that can alter maturity? | [TQ-006 detail](technical-design-maturity-score.md#tq-006) |
| TQ-007 | Answered | Flow | Determines how every consumer interprets historical Advisor overrides | Peaky application engineers and Looker data owners | Overrides are append-only; any current authorized Advisor may supersede or revoke while all prior transitions remain history. | [TQ-007 detail](technical-design-maturity-score.md#tq-007) |
| TQ-008 | Open | NFR | Determines whether the high-signal experience remains usable and accessible | Peaky frontend and accessibility engineers | What quality contract covers themes, density, keyboard access, reduced motion, sticky layers, and list sizes? | [TQ-008 detail](technical-design-maturity-score.md#tq-008) |
| TQ-009 | Answered | Flow | Determines whether Jira previews remain reversible and traceable | Peaky application engineers and Jira integration owners | What contract preserves template, evidence, plan-item, and source IDs without live side effects? | [TQ-009 detail](technical-design-maturity-score.md#tq-009) |
| TQ-010 | Investigating | Flow | Determines whether external work-item handoff is useful without owning lifecycle | Peaky application engineers, Jira/ITSM owners, and Product | What provider-neutral contract carries references, links, status, sprint scope, and update boundaries? | [TQ-010 detail](technical-design-maturity-score.md#tq-010) |
| TQ-011 | Deferred | Approach | Determines whether suggested impact is informative without becoming prioritization | Peaky application engineers, Product, and Template Authors | How should fixed question severity contribute to an optional impact signal and ordering? | [TQ-011 detail](technical-design-maturity-score.md#tq-011) |
| TQ-012 | Answered | Flow | Determines how one authoring state validates score ranges, checklist allocations, optional stage guidance, and question count | Peaky frontend and application engineers; Template Authors | One shared validation contract drives field-addressable authoring feedback and atomic TemplateRevision publication, including the ten-question maximum. | [TQ-012 detail](technical-design-maturity-score.md#tq-012) |

## Product decision log

<a id="dec-001"></a>

### DEC-001 — Keep maturity per template

> - **Status / decision source:** Decided · PX and Peaky agreement reported in discovery, 2026-08-05
> - **Owner / needed by:** Peaky Product; Maturity Score design
> - **Evidence:** E-002
> - **Revisit when:** Templates gain a common, validated measurement contract that makes aggregation meaningful

**Decision context.** The group considered review, team, and product rollups. Templates can measure different categories, and one review may contain up to three templates. Aggregation would combine unlike signals and could penalize teams for running more reviews.

**Direction and rationale.** Calculate and display one score per template. Do not calculate a review-wide, team-wide, or product-wide maturity score.

**Consequences and next step.** List and detail views must retain template identity and full review scope. Same-template-version comparison may be explored, but broader patterns must not present team or product maturity as an inherent rollup.

<a id="dec-002"></a>

### DEC-002 — Make the question the primary scoring unit

> - **Status / decision source:** Decided · user confirmation in discovery, 2026-08-05
> - **Owner / needed by:** Peaky Product; Maturity Score design
> - **Evidence:** E-001 and E-005
> - **Revisit when:** Review data shows question-level normalization produces systematic distortion

**Decision context.** Item-level scoring would reward authors for adding checklist items. Direct assessor stage selection would repeat the Google Docs burden. Question-level scoring fits the ten-question limit and mixed yes/no or checklist templates.

**Direction and rationale.** Give questions fixed influence from severity: Medium 1, High 2, and Critical 3. Do not allow authors to set separate question weights. Give checklist items equal shares by default. Advanced Template Authors may set item percentages that total 100% inside the parent question. An item above 50% remains allowed, but the product explains that a separate question or Yes/No question may be clearer.

**Consequences and next step.** The parent question can never count for more than its fixed severity weight. Author guidance should treat one question as one capability and checklist items as evidence. Validate the fixed 1/2/3 relationship and custom checklist percentages during Beta.

<a id="dec-003"></a>

### DEC-003 — Show live scores and preserve advisor judgement

> - **Status / decision source:** Decided · user confirmation in discovery, 2026-08-05
> - **Owner / needed by:** Peaky Product; Maturity Score design
> - **Evidence:** E-003 and E-005
> - **Revisit when:** Team or advisor testing shows live scores influence answers or overrides lack useful evidence

**Decision context.** Waiting for completion hides useful progress. Removing expert judgement would lose the second review that Staff+ advisors provide. Unrecorded overrides, however, would weaken trust and later analysis.

**Direction and rationale.** Show the inferred score from the first answer. Permit Advisors to override it with an explanation and evidence. Show Advisor-reviewed maturity as the primary result with a strong cue, while preserving the calculated value.

**Consequences and next step.** Review status and coverage identify incomplete work. Every export carries both values and override provenance. Looker defaults to Advisor-reviewed maturity and retains calculated maturity.

<a id="dec-004"></a>

### DEC-004 — Exclude N/A from scoring

> - **Status / decision source:** Decided · user confirmation in discovery, 2026-08-05
> - **Owner / needed by:** Peaky Product; Maturity Score design
> - **Evidence:** E-004
> - **Revisit when:** Real reviews show exclusions systematically inflate or hide weak capability

**Decision context.** Counting N/A as failure penalizes teams for irrelevant practices. Counting it as positive or neutral evidence can inflate results. Per-template owner configuration would make score meaning less consistent.

**Direction and rationale.** Exclude N/A answers from the applicable denominator and recalculate the question score from the remaining answers.

**Consequences and next step.** Score explanations must show exclusions. A touched checklist treats every item that is neither met nor N/A as not met. A question where every answer is N/A counts as answered for coverage but is excluded from maturity. If every question is N/A, show no applicable maturity result rather than 0%.

<a id="dec-005"></a>

### DEC-005 — Score describes the full review scope

> - **Status / decision source:** Decided · user confirmation after ORR participant feedback, 2026-08-05
> - **Owner / needed by:** Peaky Product; Maturity Score design
> - **Evidence:** E-006 and E-007
> - **Revisit when:** Peaky introduces explicit per-service assessments inside one review

**Decision context.** Team maturity is a weak subject because one team may own several services. The first ORR round represented multi-service teams by their most critical service, but that proxy hides the rest of the assessed scope.

**Direction and rationale.** Each attached template score describes the entire named review scope. Peaky must not present it as an inherent property of the team, service, or product.

**Consequences and next step.** Score displays and exports need visible scope context. Reviews with materially different scopes may be unsuitable for comparison even when they use the same template version.

<a id="dec-006"></a>

### DEC-006 — Restrict comparison to the same template version

> - **Status / decision source:** Decided · user confirmation after PX answers, 2026-08-06
> - **Owner / needed by:** Peaky Product; comparison experience
> - **Evidence:** E-006 and E-007
> - **Revisit when:** A validated shared contract makes comparisons across different template versions meaningful

**Decision context.** Leads want comparisons, but different templates measure different capabilities. Options considered are same-version comparison, calibrated template families, or no comparison in this feature.

**Direction and rationale.** Treat the same template version as the comparison boundary. Never combine different templates or versions into one maturity measure. Same-version analysis may include in-progress reviews because completion-only analysis would hide early signals.

**Consequences and next step.** Every cue and export retains status, coverage, scope, and override context. Peaky avoids rankings and exploratory analytics; Looker handles deeper analysis.

<a id="dec-007"></a>

### DEC-007 — Use 1–5 stages with advanced threshold profiles

> - **Status / decision source:** Decided · user confirmation in discovery, 2026-08-10
> - **Owner / needed by:** Peaky Product; scoring contract
> - **Evidence:** E-003 and E-008
> - **Revisit when:** Prototype calibration shows equal defaults or author profiles systematically misrepresent different templates

**Decision context.** The sketch showed a 0–4 scale, which is ambiguous as a user-facing maturity scale. The group considered fixed thresholds versus advanced author-defined thresholds. Fixed names and descriptions are needed for shared meaning, while threshold flexibility may fit different practice types.

**Direction and rationale.** Peaky displays five stages, numbered 1–5. Equal threshold bands are the default. Advanced Template Authors may configure a threshold profile for their template, while stage names and canonical descriptions remain immutable. During Beta, legacy ORR values map `0 → 1`, `1 → 2`, through `4 → 5` on import and reverse on export.

**Consequences and next step.** Beta uses equal 20% bands. Advanced boundaries may move at most 10 percentage points from their default, and every stage must cover at least 10 percentage points. Invalid profiles must explain why fixed stage meaning would be weakened. Threshold identity, history, and version rules belong in [TQ-001](technical-design-maturity-score.md#tq-001) and [TQ-006](technical-design-maturity-score.md#tq-006).

<a id="dec-008"></a>

### DEC-008 — Exclude unanswered questions and show coverage

> - **Status / decision source:** Decided · user selection in discovery, 2026-08-06
> - **Owner / needed by:** Peaky Product; live scoring contract
> - **Evidence:** E-004 and E-009
> - **Revisit when:** Partial-review testing shows unstable maturity distracts teams or hides delay

**Decision context.** Unanswered questions could count as unmet, stay outside the denominator, or suppress maturity until a minimum coverage level. Counting them as unmet confuses incomplete work with weak practice. Suppression removes early signals.

**Direction and rationale.** Keep untouched questions outside the live score and show answer coverage beside the result. A stored Yes/No or checklist answer counts as answered. In a touched checklist, items that are neither met nor N/A are not met and remain areas needing attention.

**Consequences and next step.** Same-version operational cues may include in-progress reviews. Every template and pillar result must show coverage and unanswered counts so a strong result with little evidence is visibly provisional.

<a id="dec-009"></a>

### DEC-009 — Keep Peaky actionable and Looker analytical

> - **Status / decision source:** Decided · user confirmation in discovery, 2026-08-06
> - **Owner / needed by:** Peaky Product; maturity experience boundary
> - **Evidence:** E-008 and E-009
> - **Revisit when:** Users cannot act without exploratory analysis inside Peaky

**Decision context.** Options were a strict split with no cross-review signals in Peaky, or limited operational cues in existing Peaky views while Looker owns deeper analysis. A new Peaky analytics view would duplicate the existing analytics solution.

**Direction and rationale.** Add limited operational cues to Review Details and Team views, with a narrow connection to existing Improvement Plans. Keep rankings, benchmarks, trends, segmentation, and exploratory analysis in Looker. Looker defaults to Advisor-reviewed maturity and retains calculated maturity.

**Consequences and next step.** Each Peaky cue must connect to an action, not only report a metric. This feature does not change Improvement Plan behavior or external work-item lifecycle. Looker exports need scope, version, coverage, status, and both maturity values.

<a id="dec-010"></a>

### DEC-010 — Centralize maturity context in Improvement Plans by scope

> - **Status / decision source:** Decided · user selection in discovery, 2026-08-10
> - **Owner / needed by:** Peaky Product; Maturity Score experience
> - **Evidence:** E-008 and E-009; current Improvement Plan screenshots and live UI inspection
> - **Revisit when:** Prototype testing shows that combined views reduce clarity, increase pressure, or obscure template identity

**Decision context.** The group considered separate Maturity and Improvement Plan pages, full centralization at every scope, and scoped centralization. Separate pages preserve boundaries but make users move between position and action. Full centralization risks implying team or product maturity rollups.

**Direction and rationale.** Use scoped centralization. Review Improvement Plans show rich per-template maturity, progression, pillar context, and gaps. Team and product Improvement Plans show compact maturity context for each contributing review and template, never one aggregate maturity result.

**Consequences and next step.** Keep stage language psychologically safe, make Stage 5 aspirational rather than required, and preserve leader-controlled sequencing. Test this information architecture in an interactive sketch before component design.

<a id="dec-011"></a>

### DEC-011 — Carry the prioritized Improvement Plan handoff as the sole sketch direction

> - **Status / decision source:** Decided · stakeholder iteration in the consolidated maturity sketch, 2026-08-17 through 2026-08-26
> - **Owner / needed by:** Peaky Product; review follow-through design
> - **Evidence:** E-010, E-011, and E-012; synthetic walkthrough observation
> - **Revisit when:** ORR participant testing shows the prioritized flow adds effort without preserving useful evidence or sequencing control

**Decision context.** Earlier sketch exploration compared a direct single-gap draft with a cross-template batch handoff. The consolidated artifact is intended to exercise the final working direction rather than continue an option comparison.

**Direction and rationale.** Retain only the prioritized cross-template Improvement Plan handoff. Users may select and reorder any gap for one editable, cancellable provider-work-item plan preview. The view may show a suggested impact order based on fixed question severity, but teams own sequencing and Peaky does not own a roadmap or backlog.

**Consequences and next step.** The consolidated sketch presents **Authoring view** and **Improvement Plan view** as product views under one persistent toolbar, not schema options. The Improvement Plan view preserves template, evidence, plan-item, and source IDs, shows explicit Score / Maturity and per-pillar context, labels results provisional, and keeps Open review and Open assessment as existing-navigation notices. Provider references and status remain an open, provider-neutral contract in [PQ-013](#pq-013). Production handoff remains deferred by [DEC-015](#dec-015).

<a id="dec-012"></a>

### DEC-012 — Keep impact suggestions optional and team-owned

> - **Status / decision source:** Deferred · `[proposed]` from sanitized internal walkthrough feedback, 2026-08-13
> - **Owner / needed by:** Peaky Product; handoff experience
> - **Evidence:** E-011; E-005
> - **Revisit when:** Users interpret an impact suggestion as mandatory priority or cost of delay

**Decision context.** Teams asked for help seeing which gaps may matter most, but Peaky cannot observe all sequencing inputs and should not become a backlog or roadmap tool. Fixed question severity is an available signal, not a complete prioritization model.

**Direction and rationale.** `[proposed]` Show an optional suggested impact order or signal, explicitly labeled as a suggestion. Never call it priority or cost of delay, never require it, and never block manual selection or reordering within the 50-practice handoff limit.

**Consequences and next step.** Product and Engineering must define the signal and its explanation through [TQ-011](technical-design-maturity-score.md#tq-011). Team-owned sequencing, sprint scope, backlog updates, and external lifecycle remain outside Peaky unless separately decided.

<a id="dec-013"></a>

### DEC-013 — Pin reviews to one published template version

> - **Status / decision source:** Decided · engineering deep-dive, 2026-08-14
> - **Owner / needed by:** Peaky Product and Engineering; Maturity Score calculation
> - **Evidence:** Product decisions DEC-001 and DEC-006; technical source review of planned Rules removal and shared Template draft sync
> - **Revisit when:** Template Versioning defines an explicit review update flow

**Decision context.** A template may have several published versions while one shared draft prepares the next version. The group considered automatic review updates, an update prompt, and permanent pinning. Automatic updates could silently change maturity and reporting. New drafts inherit the previous version's maturity calculation inputs until an author changes them. Updating severity, checklist percentages, thresholds, questions, or other calculation inputs may change maturity and reporting.

**Direction and rationale.** Every review remains pinned to the published template version selected at review creation. Publishing a new version never updates existing reviews automatically. The pinned version supplies the score definition used by that review.

**Consequences and next step.** Older-version UI and explicit review updates belong to Template Versioning. Any future update flow must warn that moving to a newer version may change maturity, coverage, pillar results, and reporting.

<a id="dec-014"></a>

### DEC-014 — Separate score-range editing from stage guidance

> - **Status / decision source:** Decided · stakeholder iteration in the Integrated Template Studio sketch, 2026-08-17
> - **Owner / needed by:** Peaky Product; Template Studio maturity authoring
> - **Evidence:** E-005 and E-009; synthetic authoring sketch walkthroughs
> - **Revisit when:** Template Authors cannot distinguish threshold configuration from guidance authoring in usability testing

**Decision context.** The earlier **Customize maturity** control mixed profile-level score thresholds with question-level stage alignment. That made one action appear to own two different authoring jobs and duplicated the maturity profile.

**Direction and rationale.** Keep one canonical five-stage profile visible. A top-level **Adjust score ranges** action edits only threshold boundaries. Optional stage guidance stays inside question and practice editors, supports bulk checklist association, remains unset by default, and never changes the score or guarantees a stage.

**Consequences and next step.** Template Studio needs separate state, validation, and save semantics for threshold profiles, checklist allocations, and stage guidance. OpenSpec acceptance examples should prove that guidance changes cannot alter calculated maturity.

<a id="dec-015"></a>

### DEC-015 — Keep the first Beta increment self-contained

> - **Status / decision source:** Decided · stakeholder clarification on 2026-08-17, refined by Product on 2026-08-26
> - **Owner / needed by:** Peaky Product; Beta scope
> - **Evidence:** E-008 and E-009; product scope clarification
> - **Revisit when:** Platform engineering provides an accepted Jira/ITSM integration contract

**Decision context.** Maturity authoring and calculation must not wait for Jira, ITSM, Looker, or another external system. The provider-neutral handoff UI still needs implementation feedback before the platform integration is ready.

**Direction and rationale.** Keep core Beta self-contained. Build the provider-neutral handoff UI behind a deployment flag that is disabled before release. Gate every network side effect through a separate integration capability. Defer analytics and live provider operations.

**Consequences and next step.** OpenSpec may define the local handoff, traceability, conflict, association, and replacement contracts. Live submission, authentication, retries, and status refresh remain blocked on platform engineering. Enabling the UI flag alone must never create external work.

<a id="dec-016"></a>

### DEC-016 — One current external ticket per practice

> - **Status / decision source:** Decided · Product confirmation in discovery, 2026-08-26
> - **Owner / needed by:** Peaky Product; provider-neutral handoff design
> - **Evidence:** E-010, E-011, and E-012; product decisions DEC-011 and DEC-015
> - **Revisit when:** Real handoffs require one practice to remain current in several external tickets

**Decision context.** Team Leads and Engineering Leads will usually prepare one bulk handoff from selected practices. ORR 2026 has ten questions and many checklist practices, so question-level identity would block unrelated practices. Existing tickets are a primary path because teams may already track Peak Season work before Peaky is available.

**Direction and rationale.** Treat every checklist item as one practice. Treat each Yes/No question as one standalone practice. Give each practice at most one current external-ticket association. Block duplicate handoff selection, but let users associate an existing Jira, YouTrack, or ITSM ticket or explicitly replace the current association.

**Consequences and next step.** Completing a practice changes its assessment state only. Its current ticket reference remains until explicit replacement, and replaced references remain history. Peaky never changes ticket content, priority, assignment, or lifecycle. Engineering will synchronize drafts and associations before production use.

<a id="dec-017"></a>

### DEC-017 — Enforce a ten-question maturity maximum

> - **Status / decision source:** Decided · Product and Engineering clarification, 2026-08-26
> - **Owner / needed by:** Peaky Product and Engineering; authoring, publication, and calculation
> - **Evidence:** E-001 and E-013
> - **Revisit when:** Real template needs cannot be represented within ten questions without weakening the question-as-capability model

**Decision context.** ORR has ten questions, while the synthetic authoring sketch has fourteen. Silently scoring over-limit data would turn an invalid fixture into a changed product contract.

**Direction and rationale.** Template Studio prevents an eleventh question and publication independently enforces the same maximum. Canonical worked fixtures cover ten and smaller templates. An over-limit pinned definition returns a configuration error and no maturity result.

**Consequences and next step.** The fourteen-question sketch remains interaction evidence for complete-denominator explanations but is not an acceptance fixture. The system never truncates questions to manufacture a result.

<a id="dec-018"></a>

### DEC-018 — Authorize overrides through current Advisor assignment

> - **Status / decision source:** Decided · authorization investigation, 2026-08-26
> - **Owner / needed by:** Peaky Product, Security, and Engineering; Advisor override flow
> - **Evidence:** E-014
> - **Revisit when:** Cedar action policies introduce an Admin or exceptional fallback grant

**Decision context.** Persisted participant roles use `reviewer`, while the product calls reviewers Advisors. Review edit access alone does not prove Advisor authority.

**Direction and rationale.** Initial override creation, supersession, and revocation require both a current `reviewer` assignment and review edit access. Any current Advisor may perform those transitions. Future Admin or exceptional grants must be explicit server-side Cedar actions and do not change persisted role vocabulary.

**Consequences and next step.** Override history remains append-only with actor and authorization provenance. Client labels, cached entitlements, and public flags never grant override authority.

<a id="dec-019"></a>

### DEC-019 — Publish maturity as part of TemplateRevision

> - **Status / decision source:** Decided · Template ownership investigation, 2026-08-26
> - **Owner / needed by:** Peaky Product and Engineering; Template authoring and publication
> - **Evidence:** E-015
> - **Revisit when:** Template Versioning defines patch, minor, and major classification or explicit review upgrades

**Decision context.** The repository's current template structures are transitional, while the accepted direction is one collaborative shared draft and immutable published TemplateRevisions.

**Direction and rationale.** Maturity configuration belongs to TemplateRevision. Publication validates and freezes maturity configuration atomically with template content. Existing reviews remain pinned, and the pure calculator can proceed independently of upgrade policy.

**Consequences and next step.** Persistence integrates with the future shared-draft and authoritative publication model. Patch/minor/major classification, upgrades, reassessment, migration, and impact preview remain deferred to Template Versioning.

<a id="dec-020"></a>

### DEC-020 — Centralize and version handoff limits

> - **Status / decision source:** Decided · sync and field-limit investigation, 2026-08-26
> - **Owner / needed by:** Peaky Engineering and Security; handoff domain and sync validation
> - **Evidence:** E-016
> - **Revisit when:** Observed valid handoffs exceed a limit or provider contracts require a stricter value

**Decision context.** Existing event, field-count, and request-body caps do not define safe handoff field values or prevent TypeScript and Go from drifting.

**Direction and rationale.** Use one versioned contract counted in Unicode characters and collection members: rationale 2,000 characters; external and evidence IDs 128 characters; HTTPS URLs 2,048 characters; 10 helpful links and 20 evidence IDs per practice; and 50 practices per handoff. The earlier 32 KiB snapshot and 512 KiB draft byte caps are removed (r18): they would reject valid multi-byte content that the character limits already bound, and they assume a canonical serialization neither runtime guarantees. Instead, a limit-maximal draft must demonstrably fit the existing push contract of 500 events per push and 100 fields per event.

**Consequences and next step.** TypeScript and Go share boundary vectors. Invalid mutations are rejected atomically with field-addressable errors; values are never truncated and collection members are never silently dropped.

<a id="dec-021"></a>

### DEC-021 — Require one stage association for every scored item

> - **Status / decision source:** Decided · adversarial artifact review, 2026-08-26
> - **Owner / needed by:** Peaky Product and Template Authors; Template Studio authoring
> - **Evidence:** E-005, E-008
> - **Revisit when:** Authors report the association step blocks publication of otherwise valid templates

**Decision context.** Stage association was previously optional. An unassociated question or practice then disappears silently from the interactive stage path, which is the surface the feature exists to provide, and gap attribution becomes incomplete without any error.

**Direction and rationale.** Every scored question and checklist practice carries exactly one author-assigned stage association. A checklist question associates as a whole or distributes its practices across stages. Authors assign associations individually or in bulk per question. Publication is blocked while any item is unassociated, with field-addressable errors and an action that locates every unassociated item.

**Consequences and next step.** Association is presentation and attribution only: it never changes the percentage, the resolved stage, or the calculation trace, and it never guarantees a stage. Authoring must make bulk assignment cheap so the mandatory step does not become the reason a template stays unpublished.

<a id="dec-022"></a>

### DEC-022 — Keep evidence state binary

> - **Status / decision source:** Decided · adversarial artifact review, 2026-08-26
> - **Owner / needed by:** Peaky Product; Improvement Plan and handoff projection
> - **Evidence:** E-008
> - **Revisit when:** Assessors ask Peaky to record validation of an answer as distinct from the answer itself

**Decision context.** The validation artifact showed a third evidence state, "Needs validation", beside met and unmet.

**Direction and rationale.** A practice's evidence state is exactly met or unmet, derived from the recorded answer; N/A practices are excluded from the projection. Peaky stores no third state, because a validation state has no owner, no transition rules, and no effect on scoring, and it would make every filter and count ambiguous.

**Consequences and next step.** Filters offer met and unmet only. Any future validation concept must arrive with its own lifecycle decision rather than as a projection label.

## Next product learning step

- **Shape:** Integrated Template Studio authoring sketch
- **Includes:** One canonical five-stage profile, dedicated score-range editing, question-level optional stage guidance, bulk checklist association, equal or custom checklist allocations, validation and recovery states, and a direct calculation walkthrough
- **Excludes:** Analytics, live provider operations, publishing permissions, and production architecture; the flagged handoff UI remains included for implementation feedback
- **Continue when:** Template Authors distinguish score ranges from stage guidance, recover from invalid allocations, explain configured defaults, and understand how answers become points and stages
- **Change course when:** Authors expect guidance to alter the score, treat guidance as a guaranteed stage, cannot recover invalid ranges or shares, or need a second maturity profile to understand the configuration

### Consolidated validation artifact

- **Presentation decision:** Authoring and prioritized Improvement Plan are two views of one maturity lifecycle artifact, not competing product options.
- **Shared chrome:** One persistent top toolbar owns view switching, density, theme, reset, and the test guide. Switching changes only the product content below it.
- **Default and state:** Light is the initial theme. Theme and density are shared, while each view preserves its own product state.
- **Handoff direction:** Only the prioritized cross-template Improvement Plan flow remains; the direct single-gap draft is historical exploration.
- **Scope boundary:** The provider-neutral handoff UI may ship in code behind a disabled deployment flag. Live provider operations remain excluded by [DEC-015](#dec-015).

## Experience to sketch

- **Actor:** A Template Author configuring maturity behavior before publishing a template version
- **Trigger:** The author opens maturity configuration in the Integrated Template Studio
- **Happy path:** Review the five-stage profile; optionally adjust score ranges; expand a question; inspect its fixed severity weight; assign optional guidance to the question or checklist practices; keep equal shares or set custom shares totaling 100%; open the calculation explanation; save the draft
- **Critical alternative:** Leave guidance unset, recover an invalid range or share total, use bulk practice association, and understand why a boundary cannot move farther
- **Decision the sketch should unblock:** Whether authors can safely configure a versioned maturity definition without confusing scoring, threshold ranges, and optional stage guidance

## Recent discovery feedback

### Direct stakeholder feedback

- Use the Integrated Template Studio as the only authoring direction.
- Keep one large five-stage profile visible; remove duplicate compact profiles.
- Make the profile action single-purpose: **Adjust score ranges** enters threshold editing and **Done adjusting** exits it.
- Do not use stage cards as question filters while editing ranges.
- Keep stage guidance inside expanded question and practice editors.
- Label unset guidance **No stage guidance (optional)** and explain inline that guidance never affects the score or guarantees a stage.
- Let checklist authors associate all practices in bulk, then refine individual practices.
- Derive question weight from severity: Medium 1, High 2, Critical 3; practices share the parent weight.
- Use equal checklist shares by default. Custom shares use synchronized sliders and numeric values, must total 100%, and show invalid and recovery states.
- Explain calculation as earned points out of available points, with Yes earning the full question weight and No earning zero.
- Make the calculation explanation available directly from the maturity profile summary.
- Keep analytics and live provider operations deferred. Build the provider-neutral handoff UI behind a disabled deployment flag.
- Calculate explanations from every configured template question, not only the rows currently visible in the walkthrough.
- Retain only the prioritized Improvement Plan handoff direction, selecting practices and supporting existing-ticket association.
- Consolidate Authoring and Improvement Plan as views under one static toolbar; do not present their source-sketch options as a new A/B choice.

### Synthetic walkthrough observations

These observations are directional and synthetic. They are not validated customer evidence.

- One canonical profile reduced duplication and made the configuration easier to scan.
- Separating score-range editing from stage guidance clarified the two authoring jobs.
- Inline guidance semantics were clearer than a shallow **Why?** disclosure.
- Sliders plus numeric inputs made custom allocation tangible, while the total meter made recovery visible.
- The assembled HTML demonstrates interactions and state transitions, but does not establish production components, persistence, or accessibility compliance.
- The corrected fixture shows three representative calculation rows and aggregates the remaining 11 questions; using all 14 fixture questions changes the example result to 39%.
- The 14-question fixture is intentionally invalid under the settled ten-question maximum. It remains interaction evidence, while acceptance uses ten-question and smaller fixtures plus an explicit over-limit configuration-error case.
- Keeping the toolbar mounted while switching only the product content made the consolidated artifact read as one lifecycle instead of two sketches.

### Current product direction

- Carry the Integrated Template Studio authoring flow as the working direction.
- Keep equal bands, equal checklist shares, and unset stage guidance as configured defaults.
- Keep advanced configuration progressively disclosed.
- Preserve fixed stage names, descriptions, and severity weights.
- Keep stage guidance optional and scoring-independent.
- Keep review analytics and live external operations out of the first Beta increment.
- Build the prioritized provider-neutral handoff UI behind a disabled deployment flag, with practice-level selection and existing-ticket association.
- Treat Authoring and Improvement Plan as views in the consolidated validation artifact, not product options.

### Open validation questions

- Can Template Authors distinguish score ranges, question weights, checklist allocations, and stage guidance?
- Do authors understand what **configured default** means for ranges, shares, and unset guidance?
- Do authors understand that guidance never changes the score or guarantees a stage?
- Can authors recover when custom shares do not total 100% or a threshold reaches its allowed limit?
- Does bulk association reduce repetitive work without hiding practice-level differences?
- Does the earned-versus-available-points explanation match authors' mental model?
- Does the authoring flow remain usable with keyboard navigation, narrow viewports, dark and light themes, and reduced motion?
- Can authors understand and recover from the ten-question maximum before publication?

## Synthetic customer-perspective review

**Review type:** Synthetic customer-perspective review (`SR-C-###`). This is generated feedback, not customer evidence.

<a id="synthetic-customer-review-summary"></a>

### Findings at a glance

| ID | Status | Finding | Affects | Triage |
| --- | --- | --- | --- | --- |
| [SR-C-001](#sr-c-001) | Fixed | Multi-service scope lacks a consistent summary | [PQ-004](#pq-004) | → fixed r4 |
| [SR-C-002](#sr-c-002) | Fixed | Same version does not ensure fair comparison | [PQ-003](#pq-003) | → fixed r4 |

<a id="sr-c-001"></a>

### SR-C-001 · [synthetic customer-perspective review] — Multi-service scope summary missing

> - **Status:** Fixed
> - **Artifact basis:** DEC-005 — Score describes the full review scope
> - **Affects:** [PQ-004](#pq-004)
> - **Triage:** → fixed r4

**Reviewer concern.** A score covers the named review scope, but the notes do not define how teams consistently describe several services, dependencies, exclusions, or a critical-service proxy. An Engineering Lead could not tell whether a low result reflects broad team risk or one service weakness.

**Why it matters and recommended response.** Unclear scope weakens planning and accountability. Revision r4 requires every score and export to show template version, service and team scope, owners, and a shared-review cue. Work item 131 tracks the missing Review Details scope display. Multi-service testing should confirm the label is sufficient.

[Back to synthetic customer review summary](#synthetic-customer-review-summary)

<a id="sr-c-002"></a>

### SR-C-002 · [synthetic customer-perspective review] — Same-version comparison remains conditional

> - **Status:** Fixed
> - **Artifact basis:** PQ-003 — Same-version comparison eligibility
> - **Affects:** [PQ-003](#pq-003)
> - **Triage:** → fixed r4

**Reviewer concern.** Identical template versions can still compare different service counts, scope shapes, completion states, N/A patterns, assessor judgement, and override histories. The resulting comparison may look more authoritative than its inputs support.

**Why it matters and recommended response.** Leads could prioritize teams unfairly or create unofficial rankings. Revision r4 forbids cross-template and cross-version comparison, keeps status, coverage, scope, and override context visible, limits Peaky to operational cues, and assigns deeper analysis to Looker.

[Back to synthetic customer review summary](#synthetic-customer-review-summary)

## Revision history

- **r1 · 2026-08-05:** Initial discovery draft from supplied ORR context, whiteboard notes, approved repository sources, and product decisions. **Tech Design Document impact:** Seeded scoring, audit, data-model, and flow questions.
- **r2 · 2026-08-05:** Added real ORR participant feedback, corrected the author roles, decided the score subject, and proposed a same-template-version comparison boundary. **Tech Design Document impact:** Added comparison projection and scope semantics to investigate.
- **r3 · 2026-08-05:** Triaged the synthetic customer-perspective review into PQ-003 and PQ-004. **Tech Design Document impact:** Recompute collaboration around TQ-006 and TQ-007.
- **r4 · 2026-08-06:** Added PX framing, resolved partial-score and scope behavior, fixed comparison boundaries, separated Peaky action cues from Looker analysis, and clarified Advisor-reviewed maturity. **Tech Design Document impact:** Updated TQ-004 through TQ-007 and related risks.
- **r5 · 2026-08-06:** Made stage names and canonical descriptions immutable, while allowing optional Template Author context for prototype validation. **Tech Design Document impact:** Clarified immutable scoring semantics and mutable contextual guidance.
- **r6 · 2026-08-10:** Changed the user-facing scale to 1–5, added legacy ORR normalization, and allowed advanced threshold profiles while keeping stage names and descriptions immutable. **Tech Design Document impact:** Added threshold-profile identity, persistence, and comparison questions.
- **r7 · 2026-08-10:** Set equal 20% Beta bands, chose Advisor-reviewed maturity as Looker's default, clarified progression and breakdown expectations, and excluded Improvement Plan and Jira lifecycle changes. **Tech Design Document impact:** Narrowed TQ-004 and TQ-007 and added explicit feature boundaries.
- **r8 · 2026-08-10:** Chose scoped centralization for Maturity and Improvement Plans, with rich review context and compact contributor context at team and product level. **Tech Design Document impact:** Added current UI evidence and expanded TQ-005.
- **r9 · 2026-08-12:** Added stakeholder feedback and the new synthetic sketch direction, narrowed the experience to two reversible handoff options, removed Planning as a separate concept, and added PQ-006 through PQ-010. **Tech Design Document impact:** Added sketch evidence, NFR and handoff questions TQ-008 and TQ-009, and new preview risks.
- **r10 · 2026-08-13:** Added sanitized internal walkthrough feedback on Score / Maturity wording, per-pillar and next-stage context, provider-neutral tracking, bounded handoff scope, and optional impact ordering. Added PQ-011 through PQ-015, DEC-012, and the Jira/ITSM boundary. **Tech Design Document impact:** Add TE-007, TQ-010, TQ-011, and corresponding risks and handoff contracts.
- **r11 · 2026-08-13:** Added the human-clickable live sketch URL to the linked artifacts. **Tech Design Document impact:** Added the same live URL to TE-006.
- **r12 · 2026-08-14:** Added the first-release maturity calculation rules, fixed severity weights, advanced checklist percentages, bounded threshold profiles, review version pinning, per-pillar calculation context, and customer-facing calculation explanations. **Tech Design Document impact:** Updated TQ-001, TQ-004, TQ-005, TQ-006, and TQ-011 with the engineering deep-dive decisions.
- **r13 · 2026-08-17:** Recorded the settled Integrated Template Studio direction, separated score-range editing from optional stage guidance, captured allocation and calculation-explanation behavior, and scoped the first Beta increment away from analytics and external dependencies. **Tech Design Document impact:** Added authoring contracts, conceptual flows and components, Beta dependency boundaries, TQ-012, and OpenSpec handoff guidance.
- **r14 · 2026-08-26:** Recorded the prioritized Improvement Plan as the sole retained handoff direction, consolidated Authoring and Improvement Plan as views under one persistent toolbar, and captured the corrected all-question 39% walkthrough plus the 14-question fixture mismatch. **Tech Design Document impact:** Updated current sketch evidence, the handoff preview question, and calculation-example acceptance inputs.
- **r15 · 2026-08-26:** Included the provider-neutral handoff UI behind a disabled deployment flag and decided one bulk external ticket with one active association per Improvement Plan item plus replacement history. **Tech Design Document impact:** Refined TQ-009 and TQ-010, handoff contracts, dependencies, and risks.
- **r16 · 2026-08-26:** Refined handoff identity to checklist practices and standalone Yes/No practices, retained current ticket references after completion, and made existing-ticket association a primary path. **Tech Design Document impact:** Resolved TQ-009 and added synchronized practice identity, HLC convergence, degraded behavior, and future reservation boundaries.
- **r17 · 2026-08-26:** Resolved Advisor override authority, enforced the ten-question maximum and over-limit no-result behavior, assigned maturity configuration to atomic TemplateRevision publication, and set centralized handoff limits with TypeScript/Go drift tests. **Tech Design Document impact:** Answers TQ-001, TQ-003, TQ-004, TQ-007, and TQ-012 while keeping Template upgrade policy deferred.
- **r18 · 2026-08-26:** Adversarial review of the OpenSpec change. Made stage association mandatory for every scored question and practice (DEC-021), kept evidence state binary by removing "Needs validation" (DEC-022), and removed the serialized byte caps from the handoff limits contract in favour of character limits plus a push-contract fit obligation (DEC-020). Added the missing result-surface behavior discovered in the validation artifact: provisional stages below full coverage, pillar and met/unmet filters with visible counts, announced filter resets, live-region stage announcements, and explicit no-definition and filtered-empty states. **Tech Design Document impact:** td18 records the template write freeze and Review selection transport as delivery prerequisites, replaces basis points with exact integer ratios, collapses the definition into one schema-versioned document, reduces the new sync entity types from six to three append-only types, and drops the deferred provider reservation scope.

## Sources and linked artifacts

- [`technical-design-maturity-score.md`](technical-design-maturity-score.md)
- Integrated Template Studio authoring sketch: [`sketches/maturity-authoring.html`](../../sketches/maturity-authoring.html); assembled synthetic interaction artifact, not customer evidence or an executable specification
- Authored sketch source: [`sketches/_sources/maturity-authoring-inline.html`](../../sketches/_sources/maturity-authoring-inline.html); preferred input when tracing named states, controls, and transitions
- Consolidated maturity lifecycle sketch: [`sketches/maturity-feature-lifecycle.html`](../../sketches/maturity-feature-lifecycle.html); Authoring and prioritized Improvement Plan views under one persistent toolbar
- Consolidated authored source: [`sketches/_sources/maturity-feature-lifecycle.html`](../../sketches/_sources/maturity-feature-lifecycle.html); preferred input for view-switching and shared-control behavior
- Prioritized Improvement Plan sketch: [`sketches/maturity-score-prioritized.html`](../../sketches/maturity-score-prioritized.html); retained handoff direction
- `server/data/template-details-1.ts`
- `app/models/question.ts`
- `site/docs/assets/images/`
- Whiteboard images supplied in the discovery session
- ORR 2026 maturity-scale excerpt supplied in the discovery session
- Verbatim feedback from real static ORR sessions supplied 2026-08-05
- PX answers about maturity, comparison, Template Authors, Advisors, and weights supplied 2026-08-06
- `feedback.md`, supplied 2026-08-12
- Sanitized internal walkthrough feedback, supplied 2026-08-13
- `/tmp/maturity-score.html`, supplied 2026-08-12; assembled synthetic sketch, not a repository artifact
- [Live Maturity Score sketch](https://pagenest-content.is.adyen.com/heitor-lessa/peaky-maturity-score-sketch/), supplied 2026-08-13; hosted synthetic sketch for human walkthroughs
- [Review scope UI gap](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/131)
