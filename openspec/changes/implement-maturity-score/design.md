# Technical Design: Implement Maturity Score

## Context

Peaky stores immutable authored snapshots in `template_revisions` (`draft | published | retired`) and pins each Review to its exact selections through `review_template_selections.template_revision_id`. The Review workspace already projects every selected Revision. `review_score_state.score_type` already accepts `"maturity"`, but no maturity definition, calculation, explanation, or projection contract exists, and no synchronized handoff entities exist.

Two shipped facts constrain sequencing:

- **Template write freeze.** Template create, update, publish, and delete routes return HTTP 503 `template_write_unavailable` before touching domain state (`site/docs/development/threat-model.md`, `drift:template-write-freeze`). Local draft editing is unaffected: Template Studio commits draft changes to local SQLite with no outbox row and identifies the draft as local-only (`template-studio/AC-007`). Maturity authoring therefore ships in this change against the shared local draft, validated at local save (`AC-063`); only publication behavior (`AC-040` and the publication leg of `REQ-010` and `REQ-017`) stays deferred to the follow-up change that lands with template synchronization. Calculation, explanation, projection, and handoff read paths shipped first against seeded published Revisions.
- **Selection transport deferred.** Exact `review_template_selections` rows are local-only and are not transported by Review sync (`drift:review-selection-transport-deferred`). A fresh client cannot yet reconstruct a Review's pinned Revision selections, so per-Revision maturity on a fresh device depends on Generic Sync Hardening rather than on this change.

Template Revision identifiers are opaque strings and must be compared, never parsed. The sync engine provides per-field HLC convergence, review-root authorization for review children, and a fixed entity-type registry (`services/internal/syncengine/entity/registry.go`). The browser and its OPFS database remain untrusted; server-side sync validation and authorization are authoritative.

```text
Shipped

template_revisions ── authored snapshot (draft | published | retired)
review ── review_template_selections.template_revision_id (local-only)
       └─ workspace: templateRevisions[] + pillars[] (each carries templateRevisionId)
       └─ answers
       └─ derived question-level plan items

Target

template_revisions ── + immutable maturity definition (one JSON column)
review ── + derived per-Revision maturity trace
       ├─ append-only Advisor override transitions
       ├─ append-only handoff practice selections
       └─ append-only external-association transitions
```

Delivery order:

1. Pure calculation, explanation, projection, and Advisor override behavior over seeded definitions.
2. Provider-neutral handoff — always available, copy-text first — that synchronizes selections and existing-ticket associations without calling any provider.
3. Authoring of definitions against the shared local draft while publication remains frozen; publication, version migration, and definition synchronization follow in the change that lifts the freeze, and this change stays unarchived until then.
4. Results finish as one compact Review Details breakdown and one template-grouped, handoff-led review Follow-ups page, followed by team and product Contributor factors in the same language.

## Goals / Non-Goals

**Goals:**

- Store one immutable maturity definition with each published TemplateRevision.
- Calculate question, pillar, and complete-template results from one pure deterministic function using exact integer ratios.
- Derive every explanation and UI projection from the same calculation trace.
- Keep maturity separate per pinned TemplateRevision, including retired Revisions.
- Require exactly one stage association for every scored question and checklist practice.
- Preserve calculated maturity when an authorized Advisor supersedes or revokes an override.
- Project checklist practices and negative Yes/No questions as stable, Revision-scoped practices.
- Synchronize ordered handoff selections and existing-ticket associations as append-only review children.
- Keep one current association per practice with immutable replacement history.
- Allow local draft editing during degraded sync while disabling operations that claim shared uniqueness.
- Ship copy-text as the primary, always-available handoff action while keeping any future provider network capability behind a dormant private server capability.
- Author maturity scoring in Template Studio against the shared local draft — validated at local save and identified as local-only — while publication remains frozen.
- Present maturity inside the existing Review Details breakdown, then make review Follow-ups a template-grouped selection flow with compact maturity context and a persistent ordered-handoff rail; align team and product plans to the same language.

**Non-Goals:**

- Cross-template scoring, team or product maturity rollups, rankings, or analytics.
- Automatic review migration to a newer TemplateRevision.
- Any provider network call: creation, editing, status refresh, or completion updates.
- Peaky-owned ticket priority, assignment, sequencing, or lifecycle.
- Lifting the template write freeze or transporting Review selections; both are prerequisites owned elsewhere.
- Publication, version migration, and cross-device synchronization of maturity definitions; deferred to the follow-up change, after which this change can archive.
- Changing campaign, dry-run, or external analytics behavior.

## Decisions

### 1. Persist the definition with its TemplateRevision as one schema-versioned document

Maturity configuration belongs to the TemplateRevision aggregate, not to `review_score_state`. One shared draft carries template content and maturity configuration; publication validates and freezes both atomically into one immutable Revision.

Store the definition as a single schema-versioned JSON column on the Revision rather than as four normalized tables. The definition is written once at publication, read as a whole, and never joined or updated in place, so normalization would buy referential integrity that immutability already guarantees while adding four tables to two migration paths. The document contains:

- a definition schema version for forward-compatible decoding;
- four ordered threshold boundaries, defaulting to 5, 25, 50, and 75 percent;
- checklist allocation mode and per-practice shares;
- one stage association per question and per practice, with a deterministic in-stage order; the UI calls this Follow-up placement;
- optional stage, question, and practice guidance, each at most 240 characters.

Question weight is derived from published question severity (Medium 1, High 2, Critical 3) and is never stored as separate editable state. Authors keep editing severity through ordinary question authoring; maturity controls show the derived weight as read-only context.

Stage names and canonical descriptions are immutable application constants:

| Stage | Name | Canonical description |
| ----- | ---- | --------------------- |
| 1 | Not implemented | Practices are absent or not yet repeatable. |
| 2 | Ad-hoc | Practices exist in places but depend on individual effort. |
| 3 | Defined | Shared practices are documented and used consistently. |
| 4 | Measured | Practices are measured and improved using evidence. |
| 5 | Optimized | Practices are continuously improved and embedded. |

Authors may add scoring-independent guidance but cannot rename a stage or replace this ORR 2026 copy.

The calculation service accepts an immutable definition, template structure, and current answers, and returns a serializable trace. Projections, explanations, and exports consume that trace instead of recalculating. Guidance and stage associations are excluded from calculation input, so editing either cannot alter the trace.

Maturity results stay derived rather than synchronized: no invalidation, no HLC conflicts over redundant output, and every client can calculate offline from the pinned definition and synchronized answers. A Revision whose status is `retired` still carries a valid definition and keeps calculating for the Reviews pinned to it.

Advisor overrides are the exception because they are user-authored decisions. Store them as append-only review children keyed by Review and `templateRevisionId`; a superseding or revoking transition points at the prior one. The effective override is the latest authorized, non-revoked transition.

The initial server policy requires current assignment with persisted participant role `reviewer` plus edit access to the owning Review. Product surfaces call that role Advisor. Any currently assigned Advisor may create, supersede, or revoke an override. Authorization must be an action-specific call that resolves participants server-side, not a bare view-or-edit capability check.

During the freeze, the same document is written by local draft editing rather than by publication: the shared draft carries template content and maturity configuration together in local SQLite with no outbox row, the shared validator runs at local save, and the studio identifies the configuration as local-only. When publication resumes, the unchanged publication path validates and freezes that same document atomically, so no data migration separates the two eras.

```text
pinned definition + current answers
                    │
                    ▼
          calculateMaturity()
                    │
                    ▼
       immutable calculation trace
          ├─ template result
          ├─ pillar results
          ├─ coverage/exclusions
          └─ explanation rows
                    │
                    ▼
      effective result resolver
          ├─ no override: calculated
          └─ current override: reviewed + provenance
```

### 2. Use exact integer ratios, never scaled or floating-point values

Represent every configured share, earned point total, available point total, and result as an exact integer ratio. `QuestionTrace.available`, `PillarTrace.available`, and `CalculationTrace.available` use the same serialized ratio shape as earned points. Explanation and remainder projections retain that shape. Compare a result against a threshold by cross multiplication, and resolve the stage from that comparison. Equal shares stay ratios such as `1/n` per practice. No remainder distribution rule or basis-point scaling can lose a boundary case. Custom allocations must total exactly 100 percent.

Every configured question is presumed applicable. An unanswered question earns zero, remains Not assessed, reduces coverage, and keeps its full severity-derived weight in available points. A whole-question N/A removes the full weight. A practice N/A removes only its configured share of that weight. The calculator does not normalize the remaining practice shares back to the full question weight when it adds aggregate earned and available points. A recorded empty checklist therefore has the same zero earned and full available points as the unanswered checklist, but it counts as answered and reports its applicable practices as unmet.

The calculator emits a template result only after at least one question has a scored applicable answer. It then divides exact total earned points by exact total available applicable points, including unanswered questions at full weight. Pillars use the same gate and denominator rule independently. This keeps all-unanswered and N/A-only revisions and pillars in a no-result state instead of presenting zero percent or Stage 1.

Round only at the display boundary. Summaries show whole percentages; **How is this calculated?** exposes the exact ratio and calls out any case where whole-number rounding appears to cross the pinned boundary. Stage resolution always uses the exact ratio first.

A pinned Revision with more than ten questions returns a scoped configuration error and no trace.

### 3. Add three append-only review-child sync entity types

Register exactly three new types in the entity registry, all review children, none a pull root:

| Type | Grain | Content |
| ---- | ----- | ------- |
| `review_maturity_override` | one row per override transition | action, effective value, evidence, explanation, prior transition |
| `review_handoff_practice` | one row per selected practice | order key, practice snapshot, rationale, selection state |
| `review_handoff_association` | one row per association transition | provider, external ID, HTTPS URL, prior transition |

Three types instead of six because every collapsed entity was either derivable or a pointer over history:

- The handoff **draft** is the set of selected practices for a Review. It has no separate title (`AC-025`) and its list label is derived from Review plus selected-practice count (`AC-026`), so it needs no row of its own.
- The **external work item** is the provider, external ID, and URL carried by an association transition. Peaky never owns or refreshes provider content, so it needs no independent identity and no observed-status field.
- The **current practice association** is the latest non-revoked transition for a practice; **replacement history** is the earlier transitions. One append-only stream answers both.

Append-only removes the field-level HLC pointer contest entirely: concurrent clients append distinct transitions and every client resolves the same latest transition, so no losing-value recovery affordance is required for associations. Practice rows still use ordinary field-level HLC for rationale and order-key edits.

Every entity resolves its owning Review for push authorization, pull scoping, and SSE family routing. Extending the registry means extending, in one implementation change: the Go entity registry and root resolution, the authz resource mapping, PostgreSQL field-version persistence, local inbound dispatch, SQLite tables, and the mirrored entity-type list in `site/docs/development/walkthroughs/local-first/security.md`.

Practice identity is the tuple:

```text
(review_id, template_revision_id, question_id, practice_id)
```

For checklist questions `practice_id` is the checklist-item ID; for Yes/No questions it equals `question_id`. Practice-row entity IDs are deterministic from the tuple so concurrent clients converge on one synchronized row instead of creating siblings.

### 4. Extend the shipped flat workspace shape rather than restructuring it

The workspace already returns `templateRevisions[]` plus `pillars[]`, where each Pillar and Question carries its `templateRevisionId` (`app/models/workspace.ts`). Keep that shape and add one per-Revision maturity collection beside it:

```text
ReviewWorkspace
  templateRevisions[]            (shipped)
  pillars[] → questions[]        (shipped, each carries templateRevisionId)
  answers[]                      (shipped)
  maturity[]                     (added)
    templateRevisionId
    trace | configurationError
    effectiveResult
```

Nesting Pillars under Revisions would rewrite every existing consumer for no contract gain. The internal `ImprovementPlan` projection iterates the Revision list, groups practices by `templateRevisionId`, and never combines maturity across Revisions. The pure maturity service must not depend on Nitro, Vue, or database APIs.

### 5. Make stage association mandatory and author-assigned

Every scored question and checklist practice carries exactly one stage association in the definition document. Template Studio exposes the same value as Follow-up placement. A Yes/No question has one placement control. A checklist has one control per practice and one bulk control for setting every practice. Publication is rejected while any item is unassociated, with field-addressable errors and an action that locates each item.

Association is presentation and attribution, not scoring. It decides where explicit gaps appear in Follow-ups and which stage context each practice carries. It never changes the percentage, Score stage, severity order, or trace. Optional association was rejected because an unassociated practice would disappear from Follow-ups.

### 6. Separate offline-safe editing from shared confirmation

Selection, removal, rationale editing, and reordering write locally and enqueue sync events. Confirming an existing-ticket association or a replacement requires healthy synchronization and a current shared view because it claims uniqueness across clients.

When sync is degraded:

- keep draft controls enabled;
- show a not-yet-shared status;
- disable association and replacement confirmation;
- explain that duplicate prevention is unavailable;
- preserve every local edit for later synchronization.

Before confirmation, re-read current associations for all selected practice identities. If any practice is already associated, reject the whole confirmation and identify every conflict. The operation associates all selected practices with one external work item, or none.

### 7. Copy text first, providers later

The handoff UI is always available; no public deployment flag gates it. Its primary action is **Copy handoff text**: a user-directed clipboard write of an ordered, provider-neutral plain-text rendering of the synchronized draft. Copy-text is the ship vehicle because it needs no provider adapter, no reservation endpoint, and no duplicate-prevention confirmation flow, and the same payload pastes into a GitLab issue, a YouTrack ticket, email, or chat. Existing-ticket association remains in this change as the secondary action.

Keep a private server capability, `providerHandoffIntegrationEnabled`, for any future network operation. This change ships no provider adapter, no outbound request, and no reservation endpoint. Any future provider route must reject before adapter invocation unless that private capability is enabled and the actor is authorized for the owning Review. When a provider integration ships, it becomes one option in the handoff action group (a Mintlify-style button group) and may become the default action only when that provider is available.

Because no public config key is added, the public-config list behind `drift:template-publishing-public-config` does not change.

### 8. Compose the UI from existing Nuxt UI patterns

**Authoring.** The stored definition keeps stage associations. Template Studio calls the calculated result the Score stage and calls each authored association Follow-up placement. The always-visible profile shows every stage name and range on one raised spectrum plate. One shared `MaturityStagePopover.vue` reveals the canonical description, proportional bands, range, and next threshold on hover or focus. The default stage starts are 5, 25, 50, and 75 percent, keeping `Not implemented` narrow. **Adjust score ranges** turns the same plate into a proportional rail with four grippable seam sliders. Each slider shows only its percentage; selection opens one fixed-lane numeric editor labelled with the next stage, such as `Ad-hoc starts at`. Pointer, keyboard, and numeric input update the same stage start without a detached input grid. **How scoring works** uses static Formula, Question weights, and Answer rules rows without answer-derived values. **Test maturity scoring** opens the ordinary Template Preview.

Both Compact and Guided modes expose Follow-up placement. A Yes/No question has one question-level control; a checklist has one control per practice and a bulk control. Answers and severity-derived weights determine the score. Follow-up placement only supplies stage context for explicit gaps. Equal checklist weighting is explained once. The definition, validator, serializer, and calculator retain valid legacy custom weighting and guidance, but the UI has no custom-share or guidance editor. Compatibility notices offer an equal-weight reset or removal of invalid hidden guidance.

The existing Template Preview keeps answers temporary and unsaved. `MaturityPreview.vue` sends them to `calculateMaturity()`. Its resting state shows only score, exact Score stage, coverage, and the provisional or no-result qualifier. **How scoring works** expands inline with the live earned ÷ weighted available = maturity equation. The available operand names its source-question count. A compact question mix shows Medium, High, and Critical counts with their multipliers, followed by checklist-splitting, unanswered, and N/A cues. The live stage opens a hover and focus popover with its canonical meaning, proportionally sized score bands, the current percentage, and the next stage threshold. The preview stays in its no-result state while every question is unanswered or the only recorded answers are N/A. Once one scored applicable answer exists, the result includes every unanswered applicable question at full available weight.

**Results.** Review Details embeds the active pinned Revision's maturity in Breakdown. One inline line shows the effective stage, whole percentage, and settled, provisional, or Advisor-reviewed state. The pillar table adds one Maturity column; each value reveals stage meaning and one confidence statement in a viewport-contained popover. Review Details exposes no calculation trace, question weights, point fractions, or practice shares. The authorized Advisor override remains a quiet secondary action. Non-result states stay compact, and no page shows a combined stage.

Review Follow-ups keeps the active Revision's result compact above the work. Explicit unmet evidence groups by Critical, High, then Medium source-question severity. Authored stage placement stays muted row context and never changes queue order, status, deep links, or handoff eligibility. Unanswered evidence appears once per source question in a separate non-selectable section. **More information** keeps guidance in context and offers the exact assessment link. One pillar filter applies to every severity group; the pillar score table and five-stage route stay off this page. Team and product Follow-ups attach compact per-template context to each contributing review and never calculate an aggregate maturity score.

**Handoff.** Review Follow-ups uses an in-page composer beside the queue at desktop widths and a dedicated Handoff view on narrow screens. Each eligible practice has one full 44px Add to handoff control. The composer keeps visible order, optional notes, removal, copy, and existing-ticket association together without a fixed mobile overlay or draft slideover. Copy preserves the derived label, review context, visible order, title, source Revision and question context, evidence state, note, helpful links, and deep link. Existing-ticket association opens a `UModal` with the provider-neutral form. Explicit replacement compares current and proposed references.

No UI renders provider content as HTML. Practice text, rationale, ticket IDs, and links render as text or validated URL attributes. Semantic tokens support dark and light themes; status color never carries meaning alone.

### 9. Treat sketches as interaction evidence, not architecture

The stakeholder sketches establish two visible product views, Authoring and Follow-ups. The accepted interaction evidence is:

- integrated Template Studio authoring with an always-visible Score stage profile and numeric range editing behind one disclosure;
- mandatory stored stage association presented as Follow-up placement in both editing modes, with derived severity weight and hidden legacy allocation and guidance compatibility;
- one static Stage 3 grouping illustration in the overview and a separate production-calculator preview driven by temporary answers;
- a compact per-Revision result inside Review Details and severity-grouped review Follow-ups with authored placement retained as context;
- full-control practice selection, visible manual ordering, optional handoff notes, More information, and exact assessment links;
- compact maturity context plus an in-page ordered Handoff composer on review Follow-ups.

The following prototype behavior is superseded and must not enter implementation:

- Jira-specific labels or assumptions;
- epic, child-issue, or one-ticket-per-practice modeling;
- provider creation or provider-owned title and content editing;
- a third evidence state such as "needs validation";
- gap-level identity that collapses independent checklist practices;
- stage selection based on a rounded display value.

The HTML sketches remain synthetic, local, and architecture-neutral. They define no persistence, authorization, synchronization, or integration behavior.

### 10. Enforce one versioned handoff-limits contract

Define one centrally versioned `HandoffLimits` contract and enforce it at TypeScript authoring and domain boundaries and at Go sync validation:

| Value | Limit |
| ----- | ----- |
| Rationale | 2,000 characters |
| External and evidence identifiers | 128 characters each |
| HTTPS URL | 2,048 characters |
| Helpful links per practice | 10 |
| Evidence identifiers per practice | 20 |
| Practices per handoff | 50 |

Every limit counts Unicode characters or collection members. There is no serialized-byte limit: a byte cap would reject valid multi-byte content that the character limits already bound, and it would need a canonical encoding neither runtime currently guarantees. Instead, a limit-maximal draft is proven to fit the existing push contract of 500 events per push and 100 fields per event (`services/internal/syncengine/push.go:27-28`), so no spec-valid draft can become permanently unsyncable.

Reject an invalid mutation atomically with field-addressable errors; never truncate a string, drop a collection entry, or partially persist a draft. Shared boundary vectors at limit, limit plus one, and multi-byte input prove TypeScript and Go do not drift.

### 11. Separate review interpretation from follow-up action

Review Details already carries dense, useful context through progress, pillar breakdown, milestones, and recent changes. Maturity joins that structure instead of adding a new section:

- the active template gets one compact maturity line inside Breakdown;
- the pillar table adds one Maturity column with an explanatory hover and focus popover;
- trace detail and Advisor override stay available as secondary actions;
- non-result states explain the absence without adding a second assessment CTA;
- milestones and recent changes remain unchanged.

Review Follow-ups is the action handoff. A template switch appears for multiple pinned Revisions, while one Revision uses static identity. The active Revision scopes maturity context, pillar filtering, evidence, and selection. Its fixed score remains compact; the categorical five-stage explorer sits behind one disclosure. Explicit misses stay in Earlier-stage, Current-stage, and Later-stage groups, but source questions sort by severity within each group. Each source question offers More information and one assessment link. Each eligible practice uses one checkbox.

The handoff occupies a persistent right rail on wide screens and appears before the evidence list on narrow screens. It previews the selected order and opens the existing draft for rationale, reorder, copy, and existing-ticket association. This keeps the selection consequence visible without duplicating the full draft. A no-result tab retains one Revision-scoped fallback list.

Stage placement remains categorical context. It never encodes completion, aspiration, priority, prerequisites, or schedule. Team and product Follow-ups rank repeated items by contributing-review count and name their source table Contributor factors. Every source keeps per-review, per-template stage context and coverage; no route computes an aggregate score (`AC-068`).

## Testing strategy

Implementation follows small RED, GREEN, REFACTOR cycles. Requirement and acceptance IDs appear in test names or comments so coverage stays traceable.

```text
Shared acceptance vectors
          │
          ├─ pure calculation unit tests
          ├─ workspace/projection unit tests
          ├─ sync and migration integration tests
          └─ browser journeys and accessibility tests
```

1. **Pure domain unit tests**
   - Severity weights, Yes/No results, equal and custom allocation, partial and all N/A, unanswered coverage, no-applicable result, exact boundaries, advanced boundaries, pillar independence, display rounding, and exact-ratio comparison (`REQ-011` through `REQ-015`, `AC-055`).
   - Guidance-only and association-only edits produce a byte-equivalent trace (`AC-014`, `AC-054`).
   - Override create, supersede, revoke, and effective-result resolution (`REQ-016`).
   - Canonical worked fixtures with ten and fewer questions; an over-limit pinned definition returns a configuration error and no result (`AC-042`).
   - Practice identity and all-Revision `ImprovementPlan` projection (`REQ-005`).
   - Retired-Revision calculation (`AC-044`).

2. **Schema and migration integration tests**
   - Apply the full SQLite migration chain and assert new foreign keys, deterministic practice identity uniqueness, and every new enum `CHECK` constraint, following the enum-migration rule in `AGENTS.md`.
   - Upgrade a fixture database from the preceding schema and verify existing Reviews and answers remain readable.
   - Apply the goose migration up and down in Go service tests.

3. **Sync and authorization tests**
   - Register all three new entity types, resolve each to its Review root, reject malformed identity fields, and reject actors without Review edit access.
   - Prove override mutations require an action-specific policy call plus a server-side participant lookup, allow any current Advisor to supersede or revoke, and reject edit-access-only actors (`AC-022` through `AC-024`).
   - Replay each event and verify append-only idempotency with no duplicate history (`AC-018`).
   - Verify degraded sync permits draft edits and blocks confirmation (`AC-019`, `AC-020`).
   - Run the shared `HandoffLimits` vectors once through one fixture and one table-driven test per runtime, covering limit, limit plus one, multi-byte, and collection-count cases, plus the limit-maximal push-contract case (`AC-039` through `AC-043`, `AC-021` through `AC-023`).

4. **Component and browser tests**
   - Exact range labels, numeric threshold editing behind Adjust score ranges, equal-band reset, separate progressive disclosures, the static Stage 3 grouping example, Follow-up placement in both editing modes, compatibility recovery, and the temporary-answer Template Preview backed by the production calculator and shared grouping projection (`REQ-010`, `REQ-017`).
   - Compact Review Details template summaries, pillar maturity popovers, provisional and non-result states, whole-percent display with exact explanation, and override cues (`REQ-014`, `REQ-015`).
   - Progressively disclosed Follow-ups stage context, severity-ordered source questions, More information, pillar filters and counts, checkbox practice selection, persistent sequence preview, keyboard ordering, reversible draft review, duplicate conflict display, existing-ticket association, replacement, and completion independence.
   - Prevent an eleventh authored question and show the scoped configuration error for over-limit pinned data (`AC-041`, `AC-042`, `AC-031`).
   - Add the new maturity and handoff routes to the existing accessibility page sweep (`tests/e2e/a11y/pages.spec.ts`) rather than adding separate a11y specs; cover keyboard, focus, live-region announcements, reduced motion, both themes, and narrow viewports there.

5. **Guards**
   - Update and run the threat-model drift guard when entity types, the public config list, or cited paths change.
   - One guard test proves no current handoff journey can reach a provider adapter and that handoff UI availability alone cannot authorize a provider operation (`AC-034`, `AC-035`, `AC-021`).
   - Keep one worked fixture containing every question so a representative-row UI cannot become the denominator (`AC-029`).

## Security Considerations

1. **API and sync surface:** This change adds three sync entity types, not a provider REST endpoint. The Go push decoder, entity registry, `HandoffLimits` validation, operation validation, child-to-Review resolution, and server authorization apply to each of them. A future provider route must add schema validation at the edge, private capability checks, Review authorization, reservation, idempotency, and audit before adapter invocation.
2. **Browser storage:** Drafts, rationale, evidence identifiers, ticket references, URLs, and override explanations live in OPFS and are readable or mutable by a local attacker. None is secret or authoritative. The server validates entity shape, Review ownership, allowed fields, URL scheme, and mutation authorization on push. UI entitlements are UX only. Clipboard writes carry the same non-secret data and occur only from an explicit user gesture.
3. **Access changes:** Review editors mutate handoff data through the owning Review's existing edit policy. Override transitions require a current `reviewer` assignment plus Review edit access under an action-specific policy resolved server-side. Pull stays scoped through the Review root. Unauthorized writes are rejected without partial field writes.
4. **Rendered content:** All authored and provider-supplied strings render through Vue text interpolation. Links accept only validated `https` URLs with safe external-link attributes. No `v-html` is introduced.
5. **Globals:** No new `window.*` global is required.
6. **Audit and privacy:** Override transitions are auditable. An existing-ticket association is synchronized domain state, not evidence that Peaky changed the provider. Snapshots must exclude provider credentials, session tokens, and unrestricted ticket bodies.

The implementation must update `site/docs/development/threat-model.md` and the mirrored facts in `site/docs/development/walkthroughs/local-first/security.md` when adding entity types or new authorization surfaces.

## Risks / Trade-offs

- **Published authoring depends on the template write freeze lifting.** Local draft authoring ships during the freeze, but no authored definition reaches reviews until server-authoritative publication returns.
- **Fresh-device maturity depends on selection transport.** Until Review selections sync, a fresh client cannot reconstruct pinned Revisions; maturity is correct but unavailable there. This change must not claim to fix that gap.
- **A JSON definition column trades query power for simplicity.** The definition is never queried field-wise, but validation must be exhaustive at publication and decoding must tolerate older schema versions.
- **Append-only streams grow.** Override and association history is unbounded by design; reads resolve the latest transition and must not scan history for hot paths.
- **Derived scores require identical code paths.** Keeping results unpersisted avoids stale state but makes shared fixtures and one pure service essential.
- **Snapshot data can become stale.** Handoff snapshots preserve what was handed off and stay distinct from current template wording.
- **Legacy over-limit definitions cannot be scored.** A scoped configuration error avoids silently changing the denominator; remediation publishes or pins a valid Revision rather than truncating questions.
- **Central limits can drift across runtimes.** One versioned contract and identical TypeScript and Go boundary vectors make divergence visible before release.
- **Copy-text is user-directed and irreversible once pasted.** The clipboard payload contains review context and practice detail a user may paste anywhere. It contains nothing secret, but the copy confirmation must make the destination the user's explicit choice, and the rendered text must never assume a provider's formatting.
- **Existing identity weaknesses remain relevant.** New entities inherit the Go-service identity boundary described in the threat model; this change must not claim the browser or request headers are trusted.

## Migration Plan

Follow `site/docs/development/walkthroughs/local-first/upgrades.md`.

**PostgreSQL** (`services/schema.sql` is the desired-state authority; `scripts/generate-drizzle-from-sql.ts` and `pnpm gen:schemas` are unused legacy tooling and must not be run):

1. Edit `services/schema.sql` with the maturity definition column and the three new entity persistence needs.
2. `make migrate:new NAME=add_maturity_definition` and write both `Up` and `Down`.
3. Update `services/internal/syncengine/repo/queries.sql` if queried columns change.
4. `make gen:sqlc`, then `make test:go`; CI's behavior-parity drift check compares a fresh `schema.sql` database against one built by all goose migrations.

**SQLite** (`shared/db/schema/*.ts` is the independent runtime authority):

1. Add Drizzle tables and types for the maturity definition and the three review-child entities.
2. Add a numbered migration under `shared/db/migrations/sqlite/`, register it in `shared/db/migrations/index.ts`, and run `pnpm db:migrations:embed`.
3. Extend `tests/integration/migrations.test.ts` with the new enum `CHECK` assertions and unique practice identity, exercising both fresh install and incremental upgrade.

**Rollout:**

1. Deploy readers and sync support; the handoff UI ships with copy-text as its primary action and no public flag.
2. Seed maturity definitions for identified published Revisions through a deterministic seed or migration step while template writes remain frozen. Reviews whose pinned Revision has no definition must render the explicit no-definition state rather than an invented default.
3. Enable core maturity projections once definition coverage is verified.
4. Keep local draft authoring available during the freeze, then enable publication of the same validated definition when server-authoritative template writes return. The private provider capability stays off.

Rollback is forward-fix for browser SQLite because applied client migrations are not safely reversible; the recovery overlay and `/system` local database recreation remain available, and server data resynchronizes afterwards. PostgreSQL uses the goose `Down` migration only while compatible binaries are deployed. Because the handoff UI has no flag, rollback of handoff visibility is a deploy-level revert; synchronized handoff data is unaffected.

## Deferred Template Versioning Policy

Maturity ownership and publication are settled: configuration belongs to TemplateRevision and freezes atomically with template content, and existing Reviews stay pinned. Template Versioning still owns patch, minor, and major classification, explicit Review upgrades, reassessment, migration, and impact preview. Those deferred decisions do not block the pure calculator, the acceptance fixtures, or the shared-draft publication integration.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Maturity profile | section, route, `details` | five stages, fixed grouping marker | `bg-default`, `text-highlighted`, `text-muted` | Exact range labels; static Grouping example only at Stage 3; descriptions and scoring disclosed separately |
| Threshold editing | `UInputNumber`, `UButton` | min/max, step | `space-y-4`, `text-default` | Numeric inputs behind Adjust score ranges; no drag control |
| Compatibility recovery | `UAlert`, `UButton` | custom weighting or invalid hidden guidance | `text-muted` | No custom-share or guidance editor; valid data round-trips; equal-weight and removal recovery stay explicit |
| Follow-up placement | `USelectMenu` | question, per-practice, and bulk modes | `text-default`, `text-dimmed` | Stored as stage association; available in Compact and Guided modes |
| Template Preview maturity | section, `details`, `UBadge` | temporary answers, production trace | `bg-elevated`, `text-muted` | Score, exact Score stage, coverage state, relative gaps, and Not assessed |
| Review Details maturity | inline section | active pinned Revision | `text-highlighted`, `text-muted` | Effective score, stage, and settled or provisional reason inside Breakdown; no calculation control |
| Pillar maturity | `UPopover`, native trigger | percentage, stage, confidence | `text-default`, `bg-elevated` | Viewport-contained stage meaning in one added Breakdown column |
| Breakdown template switch | `UTabs`, `USelectMenu` | desktop tabs, narrow select | `text-default`, `text-muted` | Every option states answered percentage; no compressed narrow tabs |
| Practice filter | `USelect`, `UButton` | pillar filter, count | `text-muted` | Applies to every severity group and Unanswered |
| Follow-ups template switch | `USelectMenu` | one active pinned Revision | `text-default`, `text-muted` | Two-line options; trigger carries identity while compact context carries the result |
| Follow-ups context | inline section | percentage, stage, coverage | `text-highlighted`, `text-muted` | No stage route, explorer, pillar table, or calculation detail |
| Evidence question | section, `UButton`, `NuxtLink` | More information, exact assessment link | `text-default`, `text-muted` | Groups by Critical, High, then Medium |
| Evidence row | drafted role-checkbox key | explicit evidence, placement context, handoff selection | `text-default`, `text-muted`, selected sky tint | Full 44px Add to handoff / In handoff action |
| Handoff composer | section, `UButton`, `UModal` | ordered items, notes, copy, association | `text-highlighted`, `text-muted` | Sticky in-page desktop column; dedicated narrow view; no fixed bar or slideover |
| Advisor override | `UModal`, `UForm`, `UTextarea` | schema, required evidence | `space-y-4` | Shows calculated and proposed values |
| Fallback practice row | drafted role-checkbox key, `UButton` | disabled/conflict state | `text-default`, `text-muted` | Used only when the active Revision has no maturity result |
| Handoff item | `UButton`, native `details`, `UTextarea` | move, remove, optional note | `text-default`, `text-muted` | Controls lead on narrow screens so title and source keep full width |
| Copy handoff text | `UButton` | clipboard write | `text-default` | Primary action; plain text, success or failure feedback, draft untouched |
| Existing-ticket form | `UForm`, `UFormField`, `USelect`, `UInput` | schema, submit | `space-y-4` | Provider-neutral, no lookup call |
| Replacement confirmation | `UModal`, `UAlert`, `UButton` | warning, confirm | `text-default`, `text-muted` | Compares current and proposed reference |
| Sync status | `UBadge`, `UAlert` | warning/neutral variants | `text-muted` | Explains local-only draft and disabled confirmation |
| Empty and error states | `UAlert`, `UButton` | no definition, over limit, filtered empty | `text-muted` | Each names the action that resolves it |

### Spatial Composition

- Container widths: reuse the existing Review Details and Template Studio content containers. More information uses a readable slideover; the handoff itself remains in page.
- Gaps and spacing: page sections use `space-y-6`; compact rows use `gap-4` and table rhythm; form groups use `space-y-4`.
- Stretch behavior: Review Details keeps maturity inside Breakdown. Follow-ups uses a flexible queue and a 22rem composer column. At narrow widths, one two-view switch gives each area the available width and no fixed overlay covers content.
- Visual hierarchy: Review Details template and pillar breakdown lead interpretation. On Follow-ups, severity headings lead the queue; score stage and authored placement stay contextual. Existing associations and degraded-sync warnings appear before confirmation controls.
- Follow-ups page: the template selector sits directly under the page header, compact maturity context comes next, and the in-page Handoff composer stays beside the severity-ordered queue. The pillar score table and five-stage route are not repeated.

### Visual Assertions

- AND Review Details shows one compact maturity line for the active pinned Revision inside Breakdown and never a combined Review score.
- AND the Breakdown table adds one pillar maturity column whose values reveal stage meaning and coverage on hover or focus.
- AND a stage shown below full answer coverage is qualified as provisional.
- AND Review Details and Follow-ups expose no question weights, point fractions, practice shares, or technical calculation control.
- AND an Advisor-reviewed value has a persistent override indicator and authorized override action.
- AND the five range labels use `to under` except the final `to 100%`, while numeric boundary inputs stay behind Adjust score ranges and no drag control is required.
- AND the static Grouping example only marker sits at Stage 3, makes no draft-answer or team-result claim, and does not mark earlier stages complete.
- AND stage descriptions and exact scoring mechanics stay behind separate disclosures.
- AND Template Preview labels answers temporary and shows the production-calculator score and exact stage, coverage state, shared relative gap groups, and Not assessed.
- AND invalid boundaries, custom allocation, hidden guidance, and unassociated practices identify their owning data and offer the implemented recovery where one exists.
- AND a draft that still uses defaults shows no error affordance and keeps advanced controls behind one disclosure.
- AND practice lists show the filtered count, and an empty result set or a Revision without a definition renders one calm explicit state without a duplicate assessment action.
- AND selected practices retain visible order, source Revision, question context, and current association state.
- AND handoff labels remain provider-neutral and no draft-title, epic, child-work, provider-creation, or third evidence state appears.
- AND degraded sync leaves draft editing operable while association confirmation is visibly disabled with an explanation.
- AND a duplicate conflict identifies every affected practice and its current external reference.
- AND dark and light themes use semantic surfaces and text tokens with no hard-coded light background.
- AND every pointer interaction has a keyboard path, visible focus, accessible name, and non-color state cue.
- AND reduced motion removes non-essential movement without hiding state changes.
- AND review Follow-ups scopes compact maturity context, evidence, and handoff to one visible pinned Revision through a labeled selector that never combines results.
- AND explicit unmet evidence groups by Critical, High, then Medium source-question severity; stage placement stays muted context and unanswered evidence stays separate.
- AND each source question offers More information and one exact assessment link, while each eligible practice uses one full 44px handoff control.
- AND one pillar filter applies to every severity group without repeating the Review Details pillar score table.
- AND the in-page Handoff composer exposes visible order, optional notes, removal, copy, and existing-ticket association without a fixed overlay, duplicate practice list, or draft slideover.
- AND narrow Follow-ups switches between Needs attention and Handoff while preserving state and keeping controls clear of content.
