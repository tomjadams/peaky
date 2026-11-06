# Remove Template Rules Tasks

## Prerequisites

> Issue: [#138 Remove Template Rules and Rules Manager](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/138)
>
> MR: [!368 feat(template-studio): remove unused template rules](https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/368)

- [x] 0.1 Load GitLab workflow guidance and inspect issue #138.
- [x] 0.2 Create issue #138 under Epic #3 with the approved destructive scope.
- [x] 0.3 Create branch `feat/remove-template-rules` from current `origin/main`.
- [x] 0.4 Resolve product decisions: reject legacy Rules Markdown, remove the live `maturity-score` capability, and use normal not-found behavior for the retired route.
- [x] 0.5 Obtain owner approval in the IDE before the first commit, push, or MR creation.
- [x] 0.6 Create the MR from the reviewed branch using the default template and `Closes #138`.

## 1. Markdown And Runtime Safety Tracer

> dependencies: approved OpenSpec artifacts

- [x] 1.1 RED: add a production-parser test proving Markdown containing `## Rules` is rejected without returning partial Template state. (template-studio REQ-003, AC-005; testing REQ-002, AC-005)
- [x] 1.2 GREEN: remove Rules Markdown serialization/parsing and return a distinguishable Rules-unsupported parse failure while preserving supported Markdown round-trips. (template-studio REQ-003, AC-004, AC-005; template-studio REQ-006, AC-011, AC-012)
- [x] 1.3 REFACTOR: delete `templateMarkdownRules.ts` and Rule-specific Markdown fixtures after surviving Markdown tests are green. (template-studio REQ-006, AC-011)
- [x] 1.4 Verify review projection, Improvement Plan classification, answers, progress, and events remain untouched by the diff. (testing REQ-002, AC-007)

## 2. Rules Route And UI Removal

> dependencies: Markdown tracer is green

- [x] 2.1 RED: add browser coverage proving Template Studio exposes no Rules mode/navigation and `/templates/:id/edit/rules` follows the normal not-found path. (template-studio REQ-001, AC-002; testing REQ-002, AC-006)
- [x] 2.2 GREEN: remove the Rules page, header mode toggle, question-editor command, homepage Rules copy, canvas/sidebar/node components, and unused Vue Flow probe. (template-studio REQ-001, AC-001, AC-002, AC-003; maturity-score REQ-002, REQ-003, REQ-004, REQ-005, REQ-006)
- [x] 2.3 REFACTOR: remove Rules command registrations and route-only state while preserving supported Template Studio layout, preview, share, Markdown, save, and publish actions. (template-studio REQ-001, AC-001, AC-003)
- [x] 2.4 Remove obsolete Rules E2E suites only after replacement regression coverage is green. (testing REQ-002, AC-006, AC-007)

## 3. Rule Model, Validation, And Persistence Removal

> dependencies: Rules UI no longer consumes the model

- [x] 3.1 RED: extend surviving Template validation and persistence tests to prove metadata/pillar/question behavior works without Rule store initialization or `ruleSets`. (testing REQ-002, AC-007)
- [x] 3.2 GREEN: remove Rule types, barrels, stores, validation composables, Template `ruleSets`, Studio overlays/watchers/import branches, Catalog defaults, and dead server Zod schemas. (template-studio REQ-002; maturity-score REQ-001, REQ-007)
- [x] 3.3 GREEN: remove Rules reads/writes from local draft load, save, helper reconstruction, and persistence tests. (template-studio REQ-002; maturity-score REQ-008)
- [x] 3.4 Remove the unused `useTemplatesOrchestrator` wrapper if no production consumer remains after Rule removal. (testing REQ-002, AC-007)
- [x] 3.5 Delete direct Rule store/validation unit suites only after no supported production interface depends on them. (maturity-score REQ-001, REQ-007)

## 4. SQLite Rule Data Removal

> dependencies: application no longer reads or writes Rule tables

- [x] 4.1 RED: add a populated previous-schema migration test that applies through `0014`, seeds published and draft Template hierarchies plus Rules, applies `0015`, and proves only Rules tables/data disappear. (testing REQ-001, AC-001)
- [x] 4.2 RED: extend fresh-schema assertions to require both Rules tables and their indexes to be absent. (testing REQ-001, AC-002)
- [x] 4.3 GREEN: remove active Drizzle definitions for `templateRules`, `templateDraftRules`, and `draftRuleType`. (maturity-score REQ-008)
- [x] 4.4 GREEN: add `0015_remove_template_rules.sql` without `CASCADE` or parent-table recreation and register it after `0014`. (testing REQ-001, AC-001, AC-002)
- [x] 4.5 Regenerate `shared/db/migrations/sqlite-content.ts` with `pnpm db:migrations:embed`; preserve historical `0001` Rules DDL in the embedded history. (testing REQ-001, AC-002)
- [x] 4.6 Run migration-content and SQLite integration tests. (testing REQ-001, AC-001, AC-002)

## 5. PostgreSQL Rule Data Removal And Code Generation

> dependencies: application model and SQLite schema no longer expose Rules

- [x] 5.1 RED: add PostgreSQL migration evidence that seeds Template/version/pillar/question/Rule rows, applies migration `007`, and proves only `template_rules` is removed. (testing REQ-001, AC-003)
- [x] 5.2 RED: cover Goose Down recreating the historical empty Rules table and index without claiming row recovery. (testing REQ-001, AC-004)
- [x] 5.3 GREEN: remove `template_rules` from `services/schema.sql` and the SQL-to-Drizzle table mapping. (maturity-score REQ-008)
- [x] 5.4 GREEN: add `007_remove_template_rules.sql` with non-cascading Up and schema-only Down. (testing REQ-001, AC-003, AC-004)
- [x] 5.5 Regenerate Drizzle and sqlc outputs; verify no generated Rule table/model remains. (maturity-score REQ-008)
- [x] 5.6 Run the focused PostgreSQL migration test with Docker; repository and Rules-removal migration tests pass through Testcontainers. (testing REQ-001, AC-003, AC-004)

## 6. Dependency And Current Documentation Cleanup

> dependencies: UI and model references are gone

- [x] 6.1 Remove `@vue-flow/core`, `@vue-flow/background`, and `@vue-flow/controls` with pnpm; inspect the lockfile for complete removal. (maturity-score REQ-003)
- [x] 6.2 Update the Template Studio walkthrough, user guide, product tour, power-user index, navigation, product walkthrough index, UI walkthrough, Vue examples, and homepage copy to describe supported question authoring only. (template-studio REQ-001, AC-001, AC-002)
- [x] 6.3 Update the roadmap to record Rules Manager removal without defining replacement Maturity Score behavior. (maturity-score REQ-001 through REQ-008)
- [x] 6.4 Update `site/docs/development/decisions.md` with the #138 removal decision and append a current removal entry rather than rewriting historical records.
- [x] 6.5 Preserve archived OpenSpec changes, historical decision rows, generated development changelog entries, and historical product changelog entries unchanged.
- [x] 6.6 Run current-surface reference searches and explain every surviving Rules/Vue Flow match as historical or unrelated prose.

## 7. OpenSpec Completion And Verification

> dependencies: implementation and current docs are green

- [x] 7.1 Strictly validate `remove-template-rules` and all live/active OpenSpec artifacts. (template-studio REQ-001 through REQ-006; maturity-score REQ-001 through REQ-008; testing REQ-001, REQ-002)
- [x] 7.2 Verify the live `maturity-score` capability is removed without adding replacement discovery or modifying historical archives. (maturity-score REQ-001 through REQ-008)
- [x] 7.3 Run focused Markdown, Template validation/persistence, route, migration, schema-generation, and dependency checks. (testing REQ-001, AC-001 through AC-004; testing REQ-002, AC-005 through AC-007)
- [x] 7.4 Run threat-model drift and confirm no unrelated marker or security claim changed.
- [x] 7.5 Run `make mr` and fix every in-scope failure without weakening gates.
- [x] 7.6 Present the complete uncommitted diff and verification evidence for owner IDE review; do not commit until explicitly approved.

## Housekeeping

- [x] Run `make mr` — all quality gates must pass before submitting MR.
- [x] Update `site/docs/development/decisions.md` and the appropriate current changelog surface.
- [x] Keep all implementation changes uncommitted until explicit owner confirmation.

## Manual tasks

- [x] Review the uncommitted diff in the IDE, prioritizing:
  - [x] Legacy Markdown rejection copy and atomicity.
  - [x] Complete Rules UI/model/persistence deletion with supported Template behavior intact.
  - [x] SQLite/PostgreSQL migrations deleting only Rules data.
  - [x] Generated schema/lockfile changes.
  - [x] Live-spec/current-doc removal without historical rewriting.
