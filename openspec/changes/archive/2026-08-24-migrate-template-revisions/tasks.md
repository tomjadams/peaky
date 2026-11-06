## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/140>
> MR: not created

- [x] 0.1 Load the GitLab workflow skill and verify `glab` authentication, project 4174, labels, and Epic #3.
- [x] 0.2 Create issue #140 from the reviewed RFC-style preview and attach it to Epic #3.
- [x] 0.3 Create local feature branch `feat/template-revisions` from clean `main` at `dd8f4478`; do not push or commit without owner confirmation.
- [x] 0.4 Review and strictly validate all updated OpenSpec artifacts with the owner before implementation.
- [x] 0.5 After implementation and owner approval, create the MR from the pushed branch using `.gitlab/merge_request_templates/default.md`, a conventional title, and `Closes #140`.

## 1. Migration And Schema Contract — RED

> dependencies: approved OpenSpec artifacts

- [x] 1.1 Write a failing SQLite upgrade test from migration 0015 that seeds every design-D13 Template/Review domain/provenance table, exact entity/event type, entitlement/outbox/pending/field-history class, and preserved Product/Team/catalog/cursor/migration/history class. Assert the exact destructive reset and unrelated-data preservation. (testing REQ-007, AC-012; auditing REQ-001, AC-005)
- [x] 1.2 Write a failing PostgreSQL integration test from Goose 007 with every applicable design-D13 domain/provenance/event/field class plus preserved Product/Team/cursor/migration/sync rows. Assert explicit deletion without broad `CASCADE` and an honest empty-schema Down contract. (testing REQ-007, AC-013; auditing REQ-001, AC-005)
- [x] 1.3 Write failing fresh-schema tests for Template/Revision statuses, `revisionNumber`/`publishedAt`/`publishedByActorId` null coupling, positive/unique numbers, one draft/published Revision, summary length, Pillar/Question FKs, retained import-provenance fields/FK, owner/creator/updater requirements and status-coupled publisher provenance, composite Review-selection identity, unique/bounded positions, and restrictive Revision references. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; templates REQ-002, AC-006, AC-007, AC-008; reviews REQ-002, AC-003; testing REQ-007, AC-014)
- [x] 1.4 Write failing durable PostgreSQL/SQLite persistence tests for Review RESTRICT references, composite primary keys, documented cross-database value representations, and partial-index predicates; run the same PostgreSQL constraint behavior matrix against fresh `services/schema.sql` and Goose-built databases without testing migration/generated file presence or exact source/catalog equality. (sync-engine REQ-003, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-013, AC-018; testing REQ-007, AC-014)
- [x] 1.5 Run existing audit-envelope/replay tests unchanged and add the bounded reset-exception evidence without weakening ordinary append-only behavior. (auditing REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005)
- [x] 1.6 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 2. PostgreSQL And SQLite Cutover — GREEN

> dependencies: group 1 RED evidence
>
> Owner-review cadence: complete only one task from 2.1 through 2.6 at a time, present its diff and verification evidence, and wait for explicit owner confirmation before starting the next task.

- [x] 2.1 Update `services/schema.sql` to the Template/Revision end state: `active | archived` Templates, `draft | published | retired` Revisions, owner/creator/updater/publisher fields, complete status/number/time/publisher coupling, numeric/summary constraints, Pillar/Question hierarchy, and exact Review selection column. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; templates REQ-002, AC-006, AC-007, AC-008; authorization REQ-006, AC-016, AC-017, AC-018, AC-020)
- [x] 2.2 Create Goose migration 008 with the explicit Template/Review domain/history reset, unrelated-data preservation, new schema/indexes, and a Down section that restores historical shapes empty without claiming data recovery. (testing REQ-007, AC-013, AC-014; auditing REQ-001, AC-005)
- [x] 2.3 Regenerate sqlc/Go models from `services/schema.sql`, verify Template/Revision and exact Review-selection fields replace legacy version fields, and leave the non-authoritative PostgreSQL-to-Drizzle converter/generated directory untouched; issue #142 owns their removal and live tooling/documentation cleanup. (sync-engine REQ-003, AC-007)
- [x] 2.4 Create SQLite migration 0016 using transaction-safe table recreation and explicit manifest-driven deletes, register it, regenerate `sqlite-content.ts`, invalidate entitlement snapshots, retain cursors/migration logs, and verify fresh/incremental paths. (testing REQ-007, AC-012, AC-014; auditing REQ-001, AC-005; sync-engine REQ-003, AC-009, AC-010, AC-011, AC-012, AC-013, AC-018)
- [x] 2.5 Complete the active hand-written SQLite schema switch atomically with its compile-time consumers, using these owner-reviewed slices:
  - [x] 2.5a Update hand-written Template/Revision/Pillar/Question schemas, exact Review selections, client-only `template_revision_imports`, and enum/CHECK regression coverage; remove legacy draft/version exports and redundant Question-to-Revision ownership. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; reviews REQ-002, AC-003; template-studio REQ-006, AC-012; sync-engine REQ-003, AC-009, AC-010, AC-011, AC-012, AC-013, AC-018)
  - [x] 2.5b Pull forward the public Template/Revision DTO, identity, static validation, immutable-write rejection, and fail-closed creation/publication/lifecycle boundaries needed by the schema switch; introduce no owner/actor placeholder, and keep new Template creation unavailable until the owner-selection group. (group 3 tasks 3.1, 3.2, 3.4)
  - [x] 2.5c Pull forward `LocalMutation.localOnly()`, existing-draft Template/Revision persistence, updater provenance, Pillar/Question ownership, and Revision-scoped Markdown import provenance. (group 3 tasks 3.3, 3.5, 3.6)
  - [x] 2.5d Pull forward the compile-time Review consumer migration to exact `templateRevisionId` rows and immutable Revision snapshot reads without broadening Review transport. (group 7 task 7.2 subset)
  - [x] 2.5e Restore typecheck and relevant unit/integration tests, mark pulled-forward tasks completed early, and present the atomic schema/consumer switch for commit approval.
- [x] 2.6 Run Group 1 behavior tests to GREEN and refactor migration/persistence test helpers without weakening upgrade, preservation, dependency-safety, cross-database representation, or model-constraint assertions.
- [x] 2.7 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 3. Template Revision Domain And Local Persistence — RED/GREEN

> dependencies: group 2 schema

- [x] 3.1 Write failing durable public DTO/service matrices, independent of migration IDs and generated filenames, for Template/Revision DTOs, static status/number combinations, summary normalization, owner Team presence/immutability and creator/updater/publisher initialization, mutation, status coupling, and freeze rules; implement no publication or Template lifecycle transition. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; templates REQ-002, AC-006, AC-007, AC-008; authorization REQ-006, AC-016, AC-017, AC-018, AC-019, AC-020)
- [x] 3.2 Replace flattened `Template.version/status/content` types with aggregate and complete `TemplateRevision` snapshot types; distinguish Template, Revision, Pillar, Question, and Review-selection IDs. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; reviews REQ-001, AC-001, AC-002; reviews REQ-002, AC-003, AC-004, AC-005)
- [x] 3.3 Implement local repositories/services for atomic Template + initial draft creation, current Template/draft metadata updates with atomic updater provenance, Revision-scoped import provenance with the retained legacy fields, and Pillar/Question ownership; call no remote Template write API. (templates REQ-003, AC-009, AC-010; template-studio REQ-004, AC-006, AC-007, AC-031; template-studio REQ-013, AC-025, AC-026)
- [x] 3.4 Add service-boundary rejection for published/retired content or provenance mutation, archived local draft mutation, and every draft Revision status/number/`publishedAt`/publisher transition. (templates REQ-001, AC-004; template-studio REQ-004, AC-031; template-studio REQ-012, AC-032; testing REQ-008, AC-020)
- [x] 3.5 Add `LocalMutation.localOnly()` as one state-only SQLite transaction with no event, outbox, or push trigger. Update unit tests, method docs, `formal_verification/sync/local_mutation_atomicity.fizz`, linkage/drift guards, and run `make verify/sync/local_mutation_atomicity`. (template-studio REQ-004, AC-006, AC-007, AC-031; template-studio REQ-005, AC-008, AC-009, AC-010; local-first REQ-007, AC-001, AC-002, AC-003; local-first REQ-008, AC-004, AC-005, AC-006, AC-007, AC-016, AC-017; local-first REQ-009, AC-009, AC-010, AC-011; testing REQ-008, AC-017, AC-023; auditing REQ-001, AC-006)
- [x] 3.6 Migrate Markdown import/export and Revision-scoped provenance without changing its five legacy fields; permit provenance writes only for drafts and freeze existing rows with immutable Revisions; retain current Rules rejection, Question/checklist validation, and save/load behavior while emitting no free-form version label, Revision number, or publication state for drafts. (template-studio REQ-006, AC-011, AC-012; template-studio REQ-017, AC-033, AC-034; testing REQ-002, AC-005, AC-006, AC-007)
- [x] 3.7 Run focused domain/local-persistence tests to GREEN and refactor duplicate mapping/validation code.
- [x] 3.8 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 4. Deterministic Fixture Rebuild — RED/GREEN

> dependencies: groups 2–3

- [x] 4.1 Write failing fixture contracts for deterministic Template/Revision/Pillar/Question IDs, Team/system creator/updater/publisher provenance, Revision 1 metadata, distinct published/draft rows, exact Review references, and absence of fabricated `${templateId}-v-1` values. (testing REQ-007, AC-015; testing REQ-008, AC-019)
- [x] 4.2 Rebuild existing Template summaries/details into aggregate + published Revision + separate draft fixture projections with system creator/updater provenance on all Template/Revision rows, system publisher on immutable Revisions, and null publisher on drafts; keep published and draft Revision/Pillar/Question ID sets disjoint with only the parent Template ID shared; keep the draft-only fixture non-selectable and install editable fixture drafts idempotently into fresh and migrated client SQLite without event/outbox writes. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; templates REQ-002, AC-006, AC-007, AC-008; template-studio REQ-004, AC-006, AC-007)
- [x] 4.3 Rebuild Team/Product Review and workspace fixtures against exact published Revision/Pillar/Question IDs and immutable Revision metadata; retain explicit process-local non-durability. (reviews REQ-001, AC-001, AC-002; reviews REQ-002, AC-003, AC-004, AC-005; reviews REQ-005, AC-015, AC-016, AC-017, AC-028; reviews REQ-006, AC-018, AC-019)
- [x] 4.4 Run fixture, Nitro read/compatibility, fresh-client seed, and 0015→0016 idempotent bootstrap tests to GREEN; remove obsolete flattened compatibility mappers.
- [x] 4.5 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 5. Fail-Closed Remote Template Writes — RED/GREEN

> dependencies: groups 2–4

- [x] 5.1 Write failing UI/client/Nitro tests requiring exact HTTP 503 + `template_write_unavailable` or matching client result for remote Template create/update/publication/archive/restore/whole-draft-delete/permanent-delete and Revision publication-field transitions, with zero state/event/outbox/timestamp/fixture writes. (template-studio REQ-012, AC-022, AC-023, AC-024, AC-032, AC-035; template-studio REQ-016, AC-027, AC-028, AC-029; testing REQ-008, AC-016)
- [x] 5.2 Parse only `NUXT_TEMPLATE_PUBLISHING_ENABLED` with false default into matching private/public values; reject independent public drift and centralize the stable unavailable result. (template-studio REQ-012, AC-022, AC-023, AC-024, AC-032, AC-035)
- [x] 5.3 Remove legacy draft-to-active mutation, optimistic status update, Publish/lifecycle controls, process-local remote Template create/update/delete behavior, and mutating Nitro publication; retain deterministic read endpoints and exact unavailable responses. (template-studio REQ-016, AC-027, AC-028, AC-029, AC-030; template-studio REMOVED REQ-010, REQ-011, REQ-014, REQ-015)
- [x] 5.4 Update the canonical threat model and drift markers for the public config value, frozen remote Template authority, and local-only unpublished-draft risk; do not change the sync entity allow-list in #140. (template-studio REQ-012, AC-035; local-first REQ-009, AC-010)
- [x] 5.5 Run remote-write freeze tests to GREEN and verify no hidden caller bypasses publication or Template-write gates.
- [x] 5.6 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 6. Template Studio And Management — RED/GREEN

> dependencies: groups 2–5

- [x] 6.1 Load NuxtUI guidance; write failing component/composable tests for owner-Team selection, distinct Template/Revision statuses, immutable snapshot fields, local-only save copy, and absent Publish/lifecycle/delete controls. (template-studio REQ-001, AC-001, AC-002, AC-003; template-studio REQ-008, AC-014, AC-015, AC-016; template-studio REQ-009, AC-017, AC-018, AC-019; template-studio REQ-012, AC-022; template-studio REQ-013, AC-025, AC-026; template-studio REQ-016, AC-029)
- [x] 6.2 Add required owner-Team selection using the last successfully persisted `directory_groups` snapshot and existing `USelect`; block first save without a valid snapshot/selection, add no freshness TTL, persist immutable owner, creators, and initial updater provenance atomically, and use ID fallback rendering. (authorization REQ-006, AC-016, AC-017, AC-018, AC-020; template-studio REQ-013, AC-025, AC-026)
- [x] 6.3 Refactor Studio load/save/edit to one local draft Revision; atomically update active Template metadata, reject archived edits, and render immutable fixture content read-only without remote writes. (template-studio REQ-001, AC-001, AC-002, AC-003; template-studio REQ-004, AC-006, AC-007, AC-031; template-studio REQ-008, AC-014, AC-015, AC-016)
- [x] 6.4 Update Templates list/filter/detail projections for read-only lifecycle, draft availability, current published `vN`, local/demo usage labels, edit-entitlement gating, and no lifecycle/delete actions. (templates REQ-004, AC-011, AC-012, AC-013; templates REQ-006, AC-019, AC-020, AC-021; templates REQ-007, AC-022, AC-023, AC-024, AC-025; templates REQ-008, AC-026, AC-027; templates REQ-009, AC-028; templates REQ-010, AC-029; template-studio REQ-016, AC-029, AC-030)
- [x] 6.5 Run Nuxt component, composable, accessibility, and focused browser tests to GREEN in light/dark modes; verify no empty header or command-palette gaps.
- [x] 6.6 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 7. Local And Fixture Review Revision Consumption — RED/GREEN

> dependencies: groups 2–4

- [x] 7.1 Write failing local Review tests for composite selection identity, one-to-three contiguous positions, distinct Revision/parent Template IDs, current-published/active-parent validation, exact snapshot hydration, immutable existing selections, and draft/retired/archived rejection. (reviews REQ-001, AC-001, AC-002; reviews REQ-002, AC-003, AC-004, AC-005; reviews REQ-005, AC-017, AC-028; testing REQ-008, AC-024)
- [x] 7.2 Refactor local Review creation inputs, selection rows, repositories, and workspace projections from Template/version ambiguity to exact ordered Revision IDs without adding outbox fields or changing sync handlers. (reviews REQ-001, AC-001, AC-002; reviews REQ-002, AC-003, AC-004, AC-005; reviews REQ-005, AC-028; reviews REQ-006, AC-018, AC-019)
- [x] 7.3 Update Team Review wizard behavior completely—selection, application linking/search/skip, confirmation, navigation, progress, and breadcrumbs—while using only current published Revision snapshots. (templates REQ-005, AC-014, AC-015, AC-016, AC-017; reviews REQ-003, AC-006, AC-007, AC-008, AC-009, AC-010)
- [x] 7.4 Update Product Review wizard behavior completely—step order, Full Product default/component preselection, Specific Applications, confirmation, and breadcrumbs—while using only current published Revision snapshots. (templates REQ-005, AC-014, AC-015, AC-016, AC-017; reviews REQ-004, AC-011, AC-012, AC-013, AC-014)
- [x] 7.5 Adapt Nitro Team/Product Review fixture creation to exact Revision IDs while retaining explicit process-local behavior and no browser/PostgreSQL/sync durability claim. (reviews REQ-005, AC-015, AC-016, AC-017)
- [x] 7.6 Update Review hydration, assessment routing, answer lookup, sidebar, and Improvement Plan keys to exact Revision-specific Question rows without claiming cross-client selection transport. (reviews REQ-006, AC-018, AC-019; improvement-plans REQ-002, AC-007, AC-008, AC-009; improvement-plans REQ-003, AC-010, AC-011, AC-012; improvement-plans REQ-004, AC-013, AC-014)
- [x] 7.7 Add regression assertions that #140 changes no Review outbox fields, Go push validation, inbound selection replay, or PostgreSQL Review projection; document those gaps under Generic Sync Hardening. (local-first REQ-009, AC-009; local-first REQ-010, AC-012, AC-013, AC-014, AC-015)
- [x] 7.8 Run focused Review/assessment/Improvement Plan/local fixture tests to GREEN.
- [x] 7.9 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 8. Ownership And Template Lifecycle Freeze — RED/GREEN

> dependencies: groups 3, 5, 6, and 7

- [x] 8.1 Run unchanged Product/Review lifecycle authorization regressions while adding creator/updater/publisher/editor non-escalation, external Team-ID persistence/fallback, owner-Team immutability, and Template lifecycle unavailability for every actor including admins. (authorization REQ-004, AC-008, AC-009, AC-010, AC-011, AC-012; authorization REQ-006, AC-016, AC-017, AC-018, AC-019, AC-020; testing REQ-008, AC-019)
- [x] 8.2 Replace `ownerIds` and the process-local Template owner map with local immutable `ownerTeamId` and separate Template/Revision creator/updater and Revision publisher provenance; persist no remote draft authority. (authorization REQ-006, AC-016, AC-017, AC-018, AC-019, AC-020)
- [x] 8.3 Write endpoint/UI tests proving Template archive, restore, whole-draft delete, and permanent delete return exact HTTP 503/code before authorization/state work and expose no controls; retain Product/Review destructive confirmation behavior. (authorization REQ-005, AC-013, AC-014, AC-015; template-studio REQ-016, AC-029)
- [x] 8.4 Implement centralized zero-write Template lifecycle/delete gates while retaining read-only lifecycle state on fixture/local projections. (templates REQ-004, AC-011, AC-012, AC-013; template-studio REQ-016, AC-029, AC-030)
- [x] 8.5 Run ownership/API/UI tests to GREEN and verify no role, creator, updater, publisher, owner Team, or edit check bypasses the freeze.
- [x] 8.6 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 9. Documentation And Contract Reconciliation

> dependencies: behavior groups 2–8

- [x] 9.1 Update live Template, Template Studio, Review, local-first, authorization, Improvement Plan, auditing, testing, and schema-pipeline documentation to match the implemented model; preserve archived historical specifications. (templates REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010; template-studio REQ-001, REQ-004, REQ-005, REQ-006, REQ-008, REQ-009, REQ-012, REQ-013, REQ-016, REQ-017; reviews REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006; local-first REQ-007, REQ-008, REQ-009, REQ-010; authorization REQ-004, REQ-005, REQ-006; improvement-plans REQ-002, REQ-003, REQ-004; auditing REQ-001; testing REQ-002, REQ-007, REQ-008; sync-engine REQ-003)
- [x] 9.2 Update `site/docs/development/walkthroughs/codebase/domain.md`, local-first data model/upgrades/security, Template Studio walkthrough, PostgreSQL guide, and user Template/authoring guides with the two-level model, local-only interim behavior, and destructive reset. (templates REQ-001, AC-001, AC-002, AC-003, AC-004, AC-005; template-studio REQ-004, AC-006, AC-007, AC-031; auditing REQ-001, AC-005)
- [x] 9.3 Update the canonical threat model for the public publication flag, frozen remote Template authority, local-only unpublished data, Team-ownership enforcement gap, destructive lifecycle, and explicitly unchanged sync allow-list/Review transport. (template-studio REQ-012, AC-035; template-studio REQ-016, AC-027, AC-028, AC-029; local-first REQ-009, AC-010)
- [x] 9.4 Update issue #137 and paused !346 only with prerequisite terminology/boundaries; do not rewrite their implementation contract before Generic Sync Hardening.
- [x] 9.5 Update `site/docs/development/decisions.md` with the Template/Revision rationale and `site/docs/development/changelog.md` with the breaking Preview reset.
- [x] 9.6 Present this group's diff and verification evidence to the owner and wait for explicit confirmation before committing.

## 10. Verification And Owner Review

- [x] 10.1 Run focused lint/typecheck/unit/integration/Go-schema-generation/OpenSpec checks after each green group; stop on the first unexpected failure.
- [x] 10.2 Run strict change and full live OpenSpec validation and prove every AC has an explicit capability-qualified task reference.
- [x] 10.3 Run `make mr` and required accessibility/browser suites; fix every failure without weakening checks.
- [x] 10.4 Present the complete diff, destructive migration evidence, UI screenshots, test output, and deferred sync risks to the owner; wait for explicit approval before commit or push.

## 11. CodeRabbit Review

> Run after the owner approves commits/pushes and the Draft MR exists.

- [x] 11.1 Inspect every CodeRabbit thread; explain the trigger, validity, technical concern, and proposed response to the owner before editing.
- [x] 11.2 Implement only agreed responses, rerun relevant verification, and wait for explicit owner approval before each commit/push.
- [x] 11.3 Reply on every addressed CodeRabbit thread with the resolution and verify no unresolved finding or failed pipeline remains.

## Housekeeping

- [x] Run `make mr` against merged `main` and retain a green final result before archival.
- [x] Confirm `site/docs/development/decisions.md` and `site/docs/development/changelog.md` describe the shipped model and destructive reset.
- [x] Update issue #140 with final task completion, verification evidence, MR link, and deferred follow-ups.
- [x] Archive `migrate-template-revisions` only after implementation verification, merge, and explicit owner approval.

## Manual tasks

- [x] Owner reviews the intentional data-loss statement and unrelated-data preservation evidence.
- [x] Owner reviews Template management and Studio in light/dark modes, including owner-Team validation, separate statuses, and absent Publish/lifecycle/delete controls.
- [x] Owner creates local and process-local fixture Reviews from current published Revisions and verifies exact snapshot metadata/questions.
- [x] Owner confirms publication, Template draft sync, Review selection sync, Team membership authorization, PostgreSQL Review projection, and fully offline stale-availability policy remain visibly deferred.
