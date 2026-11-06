# Implementation Tasks: Maturity Score

## Prerequisites

> Issue:
> MR:

- [x] 0.1 Load the `glab` skill before tackling any task with GitLab.
- [x] 0.2 Create a GitLab issue in RFC style using `glab`, describing the problem and the approach from `design.md`. (Reused existing issue #129 per user decision; it already covers the problem and approach.)
- [x] 0.3 Confirm the existing `feat/maturity-score` branch is the intended feature branch, or create a branch named after this change without overwriting local work.
- [x] 0.4 Create the MR from the pushed feature branch using a conventional title and `.gitlab/merge_request_templates/default.md`. (MR !345 already existed from this branch; retitled and redescribed with the group default template.)
- [x] 0.5 Confirm the settled contracts remain represented in acceptance fixtures: Advisor authorization, the ten-question maximum and over-limit error, TemplateRevision ownership, mandatory stage association, binary evidence state, and the character-based handoff limits. Keep Template upgrade policy deferred.
- [x] 0.6 Record the two shipped blockers in the issue before planning delivery: template create/update/publish/delete return HTTP 503 `template_write_unavailable` (`drift:template-write-freeze`), so authoring groups cannot ship until that freeze lifts; and exact `review_template_selections` rows are local-only (`drift:review-selection-transport-deferred`), so fresh-device maturity depends on Generic Sync Hardening. Sequence calculation and read paths first. (Recorded as a note on #129.)

## 1. Acceptance Fixtures and Pure Maturity Domain

> Can proceed independently from UI and persistence after prerequisite 0.5.

- [x] 1.1 RED: add shared acceptance vectors for severity weights, Yes/No answers, equal and custom checklist allocations, partial and all N/A, unanswered coverage, no-applicable results, exact stage boundaries, advanced thresholds, whole-percent display versus exact-ratio stage resolution, pillar calculations, and complete-template calculation. Include canonical ten-question and smaller fixtures plus an eleven-question configuration-error fixture with no result. Cite each vector to `maturity-score/REQ-011` through `REQ-015`, including `AC-015` through `AC-029`, `AC-034`, `AC-035`, `AC-042`, and `AC-055`.
- [x] 1.2 GREEN: implement immutable maturity-definition, calculation-input, calculation-trace, coverage, stage, pillar, and no-result TypeScript domain types, comparing opaque `templateRevisionId` values exactly and never parsing them (`maturity-score/REQ-009`, `REQ-011` through `REQ-015`; `AC-009`, `AC-015` through `AC-029`).
- [x] 1.3 GREEN: implement definition validation with field-addressable threshold, custom-allocation, guidance-length, and missing-association errors (`maturity-score/REQ-010`, `REQ-017`; `AC-011` through `AC-013`, `AC-047`, `AC-050`, `AC-052`).
- [x] 1.4 GREEN: implement the pure calculator and stage resolver on exact integer ratios, deriving question weights from severity, comparing thresholds by cross multiplication with no scaling or floating point, and calculating template results directly from questions (`maturity-score/REQ-011` through `REQ-013`; `AC-015` through `AC-024`, `AC-055`).
- [x] 1.5 GREEN: build explanation and pillar projections from the returned trace, never from a second calculation (`maturity-score/REQ-014`, `REQ-015`; `AC-025` through `AC-029`).
- [x] 1.6 REFACTOR: prove guidance-only and association-only changes leave the serialized calculation trace byte-equivalent, and centralize every maturity consumer on the pure service (`maturity-score/REQ-010`, `REQ-017`; `AC-014`, `AC-054`).

## 2. Versioned Definition Persistence, Publication, and Migrations

> Dependencies: Acceptance Fixtures and Pure Maturity Domain. Authoring-side publication behavior is blocked by the template write freeze (0.6).

- [x] 2.1 RED: add schema and repository tests for one immutable maturity definition per published TemplateRevision, atomic publication with template content, explicit defaults, ordered thresholds, checklist allocations, stage associations, stage guidance, and continued calculation for a `retired` Revision (`maturity-score/REQ-009`, `REQ-010`, `REQ-017`; `AC-009` through `AC-014`, `AC-040`, `AC-044`, `AC-050`).
- [x] 2.2 GREEN: persist the definition as one schema-versioned JSON column on the Revision, integrated with the shared draft and authoritative publication model, preserving opaque Revision identity and decoding older definition schema versions.
- [x] 2.3 GREEN: integrate the shared validator into draft authoring and publication so invalid ranges, allocation totals, over-length guidance, unassociated questions or practices, and more than ten questions cannot publish (`maturity-score/REQ-010`, `REQ-017`; `AC-011` through `AC-014`, `AC-041`, `AC-047`, `AC-052`).
- [x] 2.4 GREEN: persist equal bands, equal shares, and unset guidance when authors retain configured defaults, without reading mutable draft state for pinned reviews (`maturity-score/REQ-009`; `AC-009`, `AC-010`).
- [x] 2.5 GREEN: add Drizzle tables and types for the definition column, add a numbered migration under `shared/db/migrations/sqlite/`, register it in `shared/db/migrations/index.ts`, and run `pnpm db:migrations:embed` to regenerate `shared/db/migrations/sqlite-content.ts`.
- [x] 2.6 GREEN: update `services/schema.sql` as the desired end state, scaffold the goose migration with `make migrate:new`, write both `Up` and `Down`, update `services/internal/syncengine/repo/queries.sql` if queried columns change, then run `make gen:sqlc` and `make test:go`. Never run `pnpm gen:schemas` or `scripts/generate-drizzle-from-sql.ts`; both are unused legacy tooling.
- [x] 2.7 REFACTOR: extend `tests/integration/migrations.test.ts` with the new enum `CHECK` assertions and exercise an incremental upgrade from the preceding schema, not only a fresh install.
- [x] 2.8 GREEN: add a deterministic seed or migration step that backfills configured defaults for identified published Revisions while template writes remain frozen, without mutating review selections.

## 3. Per-Revision Maturity in the Review Workspace

> Dependencies: the pure domain and the definition read model.

- [x] 3.1 RED: add workspace and adapter tests for Reviews holding one, two, and three Revision selections, asserting every Pillar and Question retains its `templateRevisionId` and no Questions collapse onto a first Revision (`reviews/REQ-006`; `AC-018`, `AC-019`, `AC-029`; `maturity-score/REQ-014`; `AC-025`).
- [x] 3.2 GREEN: add one per-Revision maturity collection to the existing flat workspace shape (`templateRevisions[]` plus `pillars[]`), exposing trace, pillar breakdown, coverage, and effective override state keyed by `templateRevisionId`; do not restructure Pillars under Revisions (`reviews/AC-030`; `maturity-score/REQ-014`, `REQ-015`; `AC-025` through `AC-029`).
- [x] 3.3 GREEN: update `workspaceToReviewContext` and the internal `ImprovementPlan` projection to consume every Revision without producing a cross-Revision score (`maturity-score/AC-025`, `AC-039`).
- [x] 3.4 RED/GREEN: return a scoped configuration error and no maturity result for an over-limit pinned Revision while keeping sibling Revisions' results available (`reviews/AC-031`; `maturity-score/AC-042`).
- [x] 3.5 REFACTOR: remove obsolete first-Revision assumptions from consumers and keep projection ordering stable.

## 4. Advisor Override History and Authorization

> Dependencies: Versioned Definition Persistence; Per-Revision Maturity in the Review Workspace.

- [x] 4.1 RED: add domain tests for authorized override creation, supersession, revocation, current-effective resolution, and immutable provenance, including transition by any current Advisor (`maturity-score/REQ-016`; `AC-030`, `AC-031`, `AC-043`).
- [x] 4.2 GREEN: implement the append-only `review_maturity_override` model keyed by Review and `templateRevisionId`, preserving actor, explanation, evidence, prior transition, and time; add its SQLite and PostgreSQL persistence following the migration steps in 2.5 and 2.6.
- [x] 4.3 RED: add server authorization tests proving override mutations require a current persisted `reviewer` assignment plus Review edit access, that an edit-access-only actor is rejected with no fields written, and that a view-or-edit capability check without an action parameter or participant lookup is insufficient (`authorization/REQ-008`; `AC-022` through `AC-024`).
- [x] 4.4 GREEN: enforce action-specific override authorization at the server boundary with a server-side review-participants lookup, allow any current Advisor to create, supersede, or revoke, and synchronize override children through the owning Review.
- [x] 4.5 GREEN: project reviewed maturity as effective while retaining calculated maturity and complete override history in every consumer (`maturity-score/REQ-014`, `REQ-016`; `AC-027`, `AC-030`, `AC-031`).

## 5. Practice Projection and Handoff Domain Models

> Can proceed in parallel with Advisor Override History once Revision-scoped identities exist.

- [x] 5.1 RED: add projection tests proving each unmet checklist practice is independently selectable, a negative Yes/No question reuses its question ID as practice ID, `templateRevisionId` values are compared exactly, rows carry evidence provenance and an assessment deep link, and evidence state is binary with N/A excluded (`improvement-plans/REQ-005`; `AC-015` through `AC-020`).
- [x] 5.2 GREEN: implement the structured practice-reference value object over `(review_id, template_revision_id, question_id, practice_id)` with deterministic entity IDs, and update plan-item projection for every selected Revision.
- [x] 5.3 RED: add domain tests for ordered practice snapshots, the non-editable active Handoff label, empty selection, one bulk external reference, one current association per practice, duplicate rejection, explicit replacement, immutable association history, one local active lifecycle, one-ever practice ownership, and automatic or manual local completion (`improvement-plans/REQ-006` through `REQ-008`, `REQ-010`; `AC-021` through `AC-033`, `AC-037`, `AC-047` through `AC-051`).
- [x] 5.4 GREEN: keep synchronized `review_handoff_practice` state and append-only `review_handoff_association` history provider-neutral, then add device-only `local_review_handoffs` lifecycle history plus local practice ownership. Do not add a lifecycle sync entity, server handoff pointer, external-work-item entity, or provider-observed status.
- [x] 5.5 GREEN: implement atomic confirmation validation that associates every selected practice with one existing work item or identifies every conflict, with no partial success (`improvement-plans/AC-030`, `AC-031`).
- [x] 5.6 GREEN: verify assessment saves can complete an eligible local handoff while leaving external association state unchanged and emitting no provider behavior (`improvement-plans/REQ-010`; `AC-033`, `AC-037`, `AC-038`, `AC-048`).
- [x] 5.7 RED: add one versioned `HandoffLimits` fixture covering rationale, identifier, and HTTPS URL character limits at limit and limit plus one, multi-byte rationale at exactly the limit, per-practice link and evidence counts, the 50-practice maximum, and a limit-maximal draft that must fit the 500-event and 100-field push caps. Consume that one fixture from a single table-driven test per runtime rather than repeating the vectors per layer (`improvement-plans/REQ-011`; `AC-039` through `AC-043`; `local-first/REQ-013`; `AC-021` through `AC-023`).
- [x] 5.8 GREEN: enforce the central limits in TypeScript domain and UI validation, reject atomically with field-addressable errors, count characters rather than encoded bytes, and never truncate a value or drop a collection entry.

## 6. Review-Root Sync and Replay

> Dependencies: Versioned Definition Persistence; Practice Projection and Handoff Domain Models.

- [x] 6.1 RED: add Go registry, root-resolution, authorization, field-validation, and replay tests for the three new entity types (`review_maturity_override`, `review_handoff_practice`, `review_handoff_association`) (`local-first/REQ-011`; `AC-018`; `authorization/REQ-007`, `REQ-008`; `AC-021` through `AC-024`).
- [x] 6.2 GREEN: register the three types in `services/internal/syncengine/entity/registry.go` as review children (no new pull root) and map each entity ID to its owning Review for push, pull, and SSE family routing.
- [x] 6.3 GREEN: add PostgreSQL field-version persistence and client inbound handlers for practice selections, association transitions, and override transitions.
- [x] 6.4 GREEN: make replayed events idempotent so stable transition IDs cannot duplicate history, and resolve the current association as the latest non-revoked transition rather than a mutable pointer (`local-first/REQ-011`; `AC-018`).
- [x] 6.5 RED/GREEN: implement degraded-sync behavior so local selection, rationale editing, and ordering stay available while association and replacement confirmation are disabled with a stated reason (`local-first/REQ-012`; `AC-019`, `AC-020`).
- [x] 6.6 RED/GREEN: run the 5.7 fixture through Go sync validation, proving exact-boundary acceptance, over-limit atomic rejection, character-not-byte counting, the limit-maximal push-contract case, and TypeScript/Go parity (`local-first/REQ-013`; `AC-021` through `AC-023`; `improvement-plans/AC-039` through `AC-043`).

## 7. Copy Markdown Handoff and Provider Boundary

> Dependencies: Review-Root Sync and Replay; Practice Projection and Handoff Domain Models.

- [x] 7.1 RED: add rendering and clipboard tests for ordered Markdown with a review-derived heading, review link, summary table, detailed practice sections, escaped user content, success, and copy-failure feedback (`improvement-plans/REQ-009`, `REQ-012`; `AC-034`, `AC-044`, `AC-045`).
- [x] 7.2 GREEN: implement the pure `renderHandoffMarkdown` renderer over synchronized practice snapshots and keep Copy Markdown as the primary always-available handoff action (`improvement-plans/REQ-009`, `REQ-012`; `AC-034` through `AC-036`, `AC-044`, `AC-045`).
- [x] 7.3 GREEN: add the private server capability boundary with no provider adapter, rejecting any provider operation before network invocation when the capability or Review authorization is absent.
- [x] 7.4 Add one guard test under `tests/guards/` proving no current handoff journey (selection, draft edit, reorder, copy, cancellation, existing-ticket association, replacement, completion) can reach a provider adapter, and that handoff UI availability alone cannot authorize a provider operation (`improvement-plans/AC-022`, `AC-034`, `AC-035`; `authorization/AC-021`).

## 8. Template Studio Maturity Authoring UI

> Dependencies: Versioned Definition Persistence (the local `maturity_definition` column) and local draft editing (`template-studio/AC-007`). Publication remains frozen: authoring commits to the shared local draft, validates at local save, and presents the configuration as local-only (`maturity-score/AC-063`); publish-time enforcement resumes with the follow-up change. Load the `nuxt-ui` skill before implementation.

- [x] 8.1 RED: add component and browser tests for five visible stage names and ranges, shared stage popovers, direct spectrum editing, pointer and keyboard sliders, one selected numeric editor, dynamic limits, invalid repair, atomic reset, narrow stacked seams, the static scoring reference, Follow-up placement in both modes, legacy compatibility, progressive Template Preview, the ten-question limit, and absence of custom-share controls (`maturity-score/REQ-009`, `REQ-010`, `REQ-013`; `AC-010` through `AC-014`, `AC-032` through `AC-034`, `AC-041`, `AC-045` through `AC-049`, `AC-063`).
- [x] 8.2 GREEN: make the raised spectrum the sole range editor. **Adjust score ranges** adds proportional bands and four grippable stage-start sliders with plain percentage labels. Selection opens one fixed-lane editor such as **Ad-hoc starts at**; pointer, keyboard, and numeric input share the same constrained operation. **Use default ranges** restores all starts atomically (`maturity-score/AC-032`).
- [x] 8.3 GREEN: keep **How scoring works** static and bare with Formula, Question weights, and Answer rules rows; preserve valid legacy custom weighting and guidance; offer equal-weight or invalid-guidance recovery; and expose no custom-share, per-practice point, or guidance editor (`maturity-score/AC-013`, `AC-045` through `AC-047`).
- [x] 8.4 GREEN: persist mandatory stage association while presenting it as Follow-up placement in Compact and Guided modes: one control for a Yes/No question, per-practice and bulk controls for a checklist, deterministic in-stage ordering, local-save blocking, and an unassociated-item locator (`maturity-score/REQ-017`; `AC-050` through `AC-053`).
- [x] 8.5 GREEN: expose all five stage meanings through the shared hover and focus popover; open Template Preview through **Test maturity scoring**; show only live score, exact stage, coverage, and provisional or no-result state by default; expand a live earned ÷ weighted available equation with question-count context, a nonzero Current question mix row, icon-led Scoring rules, and a fixed-header answer-lifetime warning; and reveal proportional score position plus the next threshold on demand (`maturity-score/AC-048`).
- [x] 8.6 GREEN: retain ordinary Template Studio severity editing, update the derived Medium 1, High 2, or Critical 3 weight immediately, expose no separate weight input, and prevent editing stage names or canonical descriptions (`maturity-score/AC-033`, `AC-034`).
- [x] 8.7 GREEN: commit the configuration atomically to the local draft Revision's `maturity_definition` together with template content, identify it as local-only in the studio chrome, and register no publish control while the freeze holds (`maturity-score/AC-063`; `template-studio/AC-007`, `AC-019`).
- [x] 8.8 REFACTOR: keep the default state free of error affordances with advanced controls behind one disclosure, and verify keyboard operation, visible focus, both themes, narrow layouts, and reduced motion against the Visual Assertions (`maturity-score/AC-049`).

## 9. Maturity Results and Explanation UI

> Dependencies: Per-Revision Maturity in the Review Workspace; Advisor Override History and Authorization. Load the `nuxt-ui` skill before implementation.

- [x] 9.1 RED: keep component and browser coverage for per-Revision result cards, provisional coverage, Review Details stage disclosure, pillar results, explicit non-result states, Revision identity, filtering, and no combined score; add routed team and product assertions for compact per-review context. The routed page, component, and browser tests now cover the rollup composition (`maturity-score/REQ-013` through `REQ-015`; `AC-023` through `AC-029`, `AC-035` through `AC-039`, `AC-042`, `AC-056` through `AC-062`).
- [x] 9.2 GREEN: keep rich per-Revision context on Review Details and review Follow-ups, then mount compact per-review maturity context on the routed team and product Follow-ups pages with effective stage, whole percentage, coverage, status, and visible pinned Revision identity (`maturity-score/AC-027`, `AC-039`, `AC-062`).
- [x] 9.3 GREEN: qualify the displayed stage as provisional wherever it appears while answer coverage is incomplete, removing the qualifier only at full coverage (`maturity-score/AC-056`).
- [x] 9.4 GREEN: implement the Review Details stage path so an earlier stage reveals associated evidence, the current stage reveals its gaps, and a later stage reveals non-prescriptive guidance; retain Revision context and deep links (`maturity-score/AC-036` through `AC-038`).
- [x] 9.5 GREEN: announce revealed stage content through a live region and move focus to it on stage selection (`maturity-score/AC-059`).
- [x] 9.6 GREEN: implement the Review Details pillar and met/unmet filters with a visible count and announced resets; use one Revision-scoped pillar filter across every relation group and Not assessed on review Follow-ups (`maturity-score/AC-057`, `AC-058`).
- [x] 9.7 GREEN: implement **How is this calculated?** as a trace-backed slideover containing the exact unrounded result, all questions or an explicit summarized remainder, exclusions, points, thresholds, provenance, and an explanation when whole-number display appears to cross a stage boundary (`maturity-score/AC-024`, `AC-028`, `AC-029`, `AC-035`).
- [x] 9.8 RED/GREEN: implement the Advisor override form and persistent override indicator while keeping calculated maturity discoverable (`maturity-score/REQ-016`; `AC-030`, `AC-031`, `AC-043`).
- [x] 9.9 GREEN: implement the explicit no-definition, over-limit configuration-error, and filtered-empty states, each naming the action that resolves it (`maturity-score/AC-042`, `AC-060`, `AC-061`).

## 10. Handoff UI

> Dependencies: Practice Projection and Handoff Domain Models; Review-Root Sync and Replay; Copy-Text Handoff and Provider Boundary. Load the `nuxt-ui` skill before implementation.

- [x] 10.1 RED: add component tests for independent and cross-Revision practice selection, Yes/No practices, pinned-Revision and evidence context, assessment deep links, ordered draft snapshots, the derived draft label, the empty-selection state, current-reference display, and the always-visible copy-first action group (`improvement-plans/REQ-005`, `REQ-006`, `REQ-009`, `REQ-012`; `AC-015` through `AC-027`, `AC-034`, `AC-044`, `AC-045`).
- [x] 10.2 GREEN: add accessible selectable practice rows and a reversible in-page composer with remove, Clear all, pointer reorder, and keyboard reorder, exposing no draft-title field (`improvement-plans/AC-023`, `AC-025`, `AC-026`, `AC-047`).
- [x] 10.3 GREEN: announce the moved practice's new position out of the total on keyboard reorder, exposing title, position, count, and movement keys, and keep focus on the moved practice (`improvement-plans/AC-024`).
- [x] 10.4 RED/GREEN: implement the provider-neutral existing-ticket-only form with one validated `https` URL, derived provider and external ID, whole-handoff confirmation, and no creation control (`improvement-plans/REQ-007`; `AC-028` through `AC-030`).
- [x] 10.5 RED/GREEN: display every duplicate conflict with its current reference, and implement explicit replacement confirmation with immutable-history feedback (`improvement-plans/REQ-008`; `AC-031` through `AC-033`).
- [x] 10.6 GREEN: show local-only draft status during degraded sync, keep editing and the existing-ticket form available, and disable confirmation with duplicate-prevention guidance (`local-first/REQ-012`; `AC-019`, `AC-020`).
- [x] 10.7 Add negative UI assertions that no Jira-only input, epic, child-work, one-ticket-per-practice, editable provider title or content, creation-preview semantic, or third evidence state such as "needs validation" appears (`improvement-plans/AC-019`, `AC-030`, `AC-036`).
- [x] 10.8 RED/GREEN: show field-addressable handoff-limit errors, prevent a 51st selected practice, and prove the UI never truncates or silently drops invalid draft data (`improvement-plans/REQ-011`; `AC-039` through `AC-042`).
- [x] 10.9 REFACTOR: add Review Details and Follow-ups to `tests/e2e/a11y/pages.spec.ts`, then verify focus, accessible names, live-region announcements, both themes, reduced motion, narrow viewports, sparse lists, and larger practice lists.

## 11. Security, Documentation, and Release Evidence

> Dependencies: all implementation groups.

- [x] 11.1 Update `site/docs/development/threat-model.md` and the mirrored entity-type list in `site/docs/development/walkthroughs/local-first/security.md` for the three new sync entity types, review-root mappings, stored browser data, field limits, and the new authorization surface; run the drift guard.
- [x] 11.2 Add security tests for malformed IDs, cross-Review ownership, every centralized handoff limit, unsafe URL schemes, unauthorized handoff writes, unauthorized overrides, and provider-operation attempts without the private capability (`authorization/REQ-007`, `REQ-008`; `AC-021` through `AC-024`; `improvement-plans/REQ-011`; `AC-039` through `AC-043`).
- [x] 11.3 Confirm no new `v-html`, provider credentials, unrestricted ticket bodies, client-authoritative authorization, or production debug global is introduced.
- [x] 11.4 Update maintainer and user documentation for maturity interpretation, provisional stages, coverage, mandatory stage association, overrides, degraded-sync behavior, existing-ticket association, replacement history, and the explicit no-provider-side-effect boundary.
- [x] 11.5 Add release evidence for the copy-text handoff and verify the private provider capability remains disabled in deployment configuration.

## 12. Merge Check

> One command. Run after `make mr` passes; exit 0 means all clear.

- [x] 12.1 Run `/merge-check --change implement-maturity-score` and capture the report.
- [x] 12.2 Exit must be 0; if not, auto-fix every mechanical BLOCK, manually address any remaining product or security decision, and re-run.
- [x] 12.3 Commit the attestation at `attestations/mr-<iid>.md` on the branch. Its frontmatter `commit_sha` must point at the reviewed code commit; later code changes require a fresh merge check and updated attestation.
- [ ] 12.4 Re-run `/merge-check --change implement-maturity-score` after groups 8, 13, and 14 land, and refresh the attestation so its `commit_sha` covers them. The existing stamp covers groups 1–7 and 9–11 at the stamped commit; the re-stamp is currently blocked on merge-check's trusted-droid policy assuming in-repo reviewer definitions while the droids are harness-managed, which is tracked outside this change.

## 13. Review Follow-ups redesign

> Dependencies: Maturity Results and Explanation UI; Handoff UI. Brings the consolidated sketch direction (discovery E-012/td14; `sketches/maturity-authoring.html`, Follow-ups view) to the existing `/plan` route, replacing the severity-bucket table and duplicate flat handoff list. Internal `ImprovementPlan` names remain for compatibility. Load the `nuxt-ui` skill before implementation.

- [x] 13.1 RED: add component tests for per-Revision tabs with result or non-result summaries, active-Revision scoping, the single-Revision static identity, and the continued absence of a combined score (`maturity-score/AC-025`, `AC-039`, `AC-064`).
- [x] 13.2 GREEN: implement the Revision switch directly under the Follow-ups header, removing stacked maturity and summary cards from this route while Review Details keeps its result cards (`maturity-score/AC-064`).
- [x] 13.3 RED: add tests for one flat route of five equal categorical waypoints, a fixed effective-result marker separate from selection, focused and announced explanation changes, and the absence of completion, aspiration, priority, prerequisite, or schedule semantics (`maturity-score/AC-059`, `AC-065`).
- [x] 13.4 GREEN: implement the neutral position route from the workspace trace and effective result, retaining the provisional qualifier and keeping all Follow-up groups visible when selection changes (`maturity-score/AC-056`, `AC-065`).
- [x] 13.5 RED/GREEN: render explicit unmet evidence together in stacked Earlier-stage, Current-stage, and Later-stage groups, with a separate Not assessed group, absolute authored stage, evidence state, Revision and pillar context, assessment deep links, and explicit empty states (`maturity-score/AC-061`, `AC-067`; `improvement-plans/AC-019`).
- [x] 13.6 RED/GREEN: add the active Revision's per-pillar breakdown and one filter with a visible count that applies to every gap group and Not assessed (`maturity-score/AC-026`, `AC-057`, `AC-066`).
- [x] 13.7 RED/GREEN: keep every explicit unmet row handoff-actionable regardless of placement and integrate the ordered draft, copy-text, and existing-ticket association in the same flow; suppress the duplicate flat list for result tabs and keep one active-Revision fallback for a non-result tab (`maturity-score/AC-067`; `improvement-plans/AC-046`).
- [ ] 13.8 REFACTOR: add the restructured Follow-ups route to `tests/e2e/a11y/pages.spec.ts` and verify keyboard operation, visible focus, live-region announcements, both themes, reduced motion, narrow viewports, and sparse and larger lists. Component tests cover route focus behavior, but the promised accessibility sweep does not include this route (`maturity-score/AC-059`; `improvement-plans/AC-024`).

## 14. Team and product Follow-ups redesign

> Dependencies: Review Follow-ups redesign. Applies the same product language to rollup routes without introducing aggregate maturity.

- [x] 14.1 RED: add routed component and browser coverage proving repeated-item and contributor grouping includes each review's per-template stage context and coverage, links back to that review, keeps multiple Revisions isolated, shows explicit non-results, and never implies a team or product maturity score (`maturity-score/AC-062`, `AC-068`).
- [x] 14.2 GREEN: mount compact per-review maturity context in the contributor and repeated-item source groupings on team and product Follow-ups. Each contributor shows every pinned Revision; a repeated item shows the matching source Revision (`maturity-score/AC-068`).
- [ ] 14.3 REFACTOR: after compact context is mounted, verify both themes, narrow viewports, and keyboard operation on both routed rollup pages, and update user-documentation screenshots if they exist.
- [ ] 14.4 FOLLOW-UP MR: refresh Team and Product aggregate Follow-ups after the review-level experience settles. Plan rollout separately; decide whether handoff remains review-only or gains an aggregate workflow; carry per-Revision maturity, contribution context, and Cartographer interaction patterns without inventing an aggregate score; then update the rollup specification, tests, and guidance in that MR. This work is explicitly deferred from the current implementation.

## 15. Calm Review Details and handoff-led Follow-ups

> Dependencies: Review Follow-ups redesign; Team and product Follow-ups redesign. Applies the final end-to-end UX direction without changing recent changes.

- [x] 15.1 RED: add focused component tests for a compact active-Revision Review Details summary, pillar maturity popovers, secondary calculation and Advisor actions, and no duplicate assessment action (`maturity-score/AC-036` through `AC-038`, `AC-060`).
- [x] 15.2 GREEN: remove standalone maturity cards from Review Details, place one compact result inside Breakdown, and add one maturity column to the existing pillar table on application, team, and product reviews (`maturity-score/AC-025`, `AC-036` through `AC-038`).
- [x] 15.3 RED/GREEN: make review Follow-ups handoff-led with a persistent sequence rail, checkbox practice selection, severity-ordered source questions, restored More information, one assessment link per question, and the five-stage route behind one disclosure (`maturity-score/AC-039`, `AC-058`, `AC-062`, `AC-065` through `AC-067`).
- [x] 15.4 REFACTOR: remove the duplicate Follow-ups pillar score table, keep one filter across relation groups, flatten draft rows and empty states, and retain the header's Continue assessment as the sole assessment CTA (`maturity-score/AC-038`, `AC-060`, `AC-061`, `AC-066`).
- [x] 15.5 REFACTOR: flatten repeated-item sections and empty states on team and product Follow-ups, name the source table Contributor factors, and preserve per-review maturity context (`maturity-score/AC-068`).
- [x] 15.6 Run `rtf-ux-reviewer` through Review Details, review Follow-ups, the handoff draft, and team and product Follow-ups in both themes and narrow and wide layouts; resolve every finding. The final fresh-context pass returned `APPROVE` with no findings.
- [x] 15.7 RED/GREEN: follow direct user feedback with `rtf-ui-reviewer` and a fatigued engineering-lead persona; add a semantic Maturity subheading, explain provisional impact inline, remove redundant pillar coverage, and rebuild the calculation explanation around plain language and progressive disclosure (`maturity-score/AC-037`, `AC-038`).
- [x] 15.8 RED/GREEN: restore the Cartographer result landmark on Follow-ups, replace tiny checkboxes with full drafted selection keys, remove the decorative handoff rail, widen the preparation slideover, and make immediate post-reorder copy use the visible order (`maturity-score/AC-039`, `AC-065`, `AC-067`; `improvement-plans/AC-024`, `AC-034`).
- [x] 15.9 RED/GREEN: replace the reviewer-driven patch set with a product-designed Review Details ledger and severity-first Follow-ups work queue; add narrow template selectors, an in-page handoff composer, question-level Unanswered projection, More information assessment action, and larger Template Studio Score stage type (`maturity-score/AC-036` through `AC-039`, `AC-057` through `AC-059`, `AC-064` through `AC-067`).

## 16. Exact Preview, Question Contributions, and Local Handoff Lifecycle

- [x] 16.1 RED/GREEN: calculate exact per-practice and selected-handoff maturity movement within one TemplateRevision, show one-decimal movement consistently, and never combine Revision scores.
- [x] 16.2 GREEN: use visible desktop Revision tabs and a compact mobile selector, with the selected Revision controlling the mat, queue, preview, and assessment links.
- [x] 16.3 GREEN: keep aggregate preview in Handoff, magnify small movement against the current gap to the next stage, and show the full-scale blue and temporary-green comparison only in the Stage popover.
- [x] 16.4 RED/GREEN: add device-only sequential handoff lifecycle history, exclusive active ownership, automatic resolved closing, unresolved manual closing with release and a required note, reopenable local history, and SQLite migration coverage (`improvement-plans/AC-047` through `AC-051`).
- [x] 16.5 RED/GREEN: add live Assessment maturity and clickable Review Details pillar rows. The pillar drawer SHALL explain weighted question contribution and progressively reveal checklist evidence without opportunity forecasts.
- [x] 16.6 REFACTOR: finish focused browser and accessibility coverage for live Assessment maturity, rapid maturity-overlay traversal, checklist evidence disclosure, Refine radio filtering, long Handoff sequences, closing, release, reopen, and exclusive active ownership.

## Housekeeping

- [x] Run `make mr`; all quality gates must pass before submitting the MR.
- [x] Update `site/docs/development/decisions.md` with the maturity calculation, derived-result, append-only review-root sync, and provider-boundary decisions.
- [x] Update `CHANGELOG.md` with the user-visible maturity and copy-text handoff behavior.
- [x] Update the GitLab issue with task completions and links to validation evidence.
- [x] Update maintainer and user documentation for local-first maturity authoring during the freeze and the restructured plan surfaces. (User guide: `reviews.md` plan description and authoring note, `authoring-templates.md` maturity section; maintainer walkthroughs: `template-studio.md` section 8, `improvement-plan.md` plan-surface rewrite.)
- [x] Update `CHANGELOG.md` with local maturity authoring and template-grouped Follow-ups. (`CHANGELOG.md` is a pointer file; the August 2026 `product_changelog.md` entry covers both with refreshed `/plan` route screenshots.)

## Manual Tasks

- [ ] Manually review areas ordered by risk and user impact.
  - [ ] Validate immutable ORR 2026 stage copy, exact range labels, progressive disclosures, the static grouping example, the temporary-answer Template Preview, provisional results, and whole-percent boundary explanation with Product, PX, Template Authors, and Team Leads.
  - [ ] Validate stored stage association through Follow-up placement in both authoring modes, including Yes/No, per-practice and bulk checklist controls, compatibility recovery, the unassociated-item locator, and local-only save identity during the freeze.
  - [ ] Validate template-grouped review Follow-ups: Revision tabs or static identity, the flat route and fixed result marker, stacked Earlier-stage, Current-stage, Later-stage, and Not assessed groups, pillar filtering, and the integrated ordered handoff.
  - [ ] Validate Advisor override authority, provenance, supersession, and revocation with Security and review owners.
  - [ ] Exercise multi-Revision Review Details and Follow-ups with Team Leads and Engineering Leads.
  - [ ] Exercise cross-Revision practice selection, reversible draft review, existing-ticket association, duplicate conflicts, replacement, offline draft recovery, completion independence, and the absence of Jira creation semantics.
  - [ ] Verify keyboard-only use, screen-reader announcements, dark/light themes, reduced motion, narrow viewport, sparse plans, and larger plans.
