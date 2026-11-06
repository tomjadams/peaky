# Remove Template Rules Design

## Context

Rules Manager is a Template Studio authoring feature built around a dedicated Vue Flow page, a module-level Rule store, Template `ruleSets`, Markdown serialization, publish-time validation, and separate persistence tables.

It is not a review runtime. No production function evaluates Rule conditions, executes `escalate_review` or `notify_advisor`, changes assessment answers, assigns advisors, computes scores, or emits Rule-triggered events. Review and Improvement Plan behavior derives directly from questions and answers.

```text
Current Rules island

Questions editor
  ├─ header/command navigation
  └─ /templates/:id/edit/rules
       └─ Vue Flow canvas
            └─ useTemplateRules singleton
                 ├─ Template.ruleSets
                 ├─ publish validation
                 ├─ Markdown Rules section
                 └─ template_draft_rules

Dead published schema
  └─ template_rules (SQLite + PostgreSQL; no runtime query path)
```

Rules are already excluded from Template Sync. Carrying them into the Template model migration would preserve dead concepts and force every later Template contract to account for unused data.

The current live `maturity-score` capability is the Rules Manager specification under a future-facing name. Replacement Maturity Score behavior is intentionally undefined and is not designed in this change.

## Goals / Non-Goals

**Goals:**

- Remove every current Rules Manager route, control, component, model, composable, validation path, persistence path, test, and dependency.
- Reject legacy Markdown containing `## Rules` before applying imported state.
- Remove Rules tables through forward SQLite and PostgreSQL migrations while preserving all non-Rule Template data.
- Remove the current live Rules-based `maturity-score` capability without inventing replacement scoring requirements.
- Preserve supported Template authoring, Markdown, validation, persistence, preview, and publication behavior.
- Preserve the surviving semantics of pre-existing Template Studio requirement blocks while removing Rules references from those contracts.
- Preserve historical OpenSpec archives, decision records, and changelog entries.

**Non-Goals:**

- Designing or implementing replacement Maturity Score behavior.
- Migrating the Template Family, draft, published, or version model.
- Implementing Generic Sync Hardening, Template draft synchronization, or publication redesign. Their existing requirement blocks are copied in full only because OpenSpec `MODIFIED` deltas require complete blocks; this change removes Rules references without changing the surviving semantics.
- Preserving or exporting existing Rule data.
- Providing a redirect for the removed Rules URL.
- Rewriting historical OpenSpec archives, historical decisions, or generated changelog history.

## Decisions

### 1. Remove the complete Rules authoring slice

Rules Manager is removed vertically rather than hidden behind a feature flag.

```text
Remove
├─ /templates/:id/edit/rules
├─ Rules navigation and homepage copy
├─ RulesCanvas / sidebar / nodes / VueFlowTest
├─ useTemplateRules / useTemplateRulesValidation
├─ RuleSet domain types and Template.ruleSets
├─ Rule validation
├─ Rules Markdown serializer/parser
├─ local load/save of Rules
├─ Rule Zod schemas
├─ direct Rules tests
└─ Vue Flow packages
```

Keeping dormant models or tables would make the next Template model look more stable than it is and invite accidental reuse by Maturity Score.

### 2. Preserve review runtime behavior

Rules have no evaluator. The removal must not modify answer storage, review projection, progress, Improvement Plan classification, participants, advisor behavior, or event behavior.

Question/checklist validation and Markdown safety validation remain. Rules no longer block publication.

The Template Studio delta repeats the complete local-first, collaboration, conflict-review, and publication requirement blocks because OpenSpec requires full content for a `MODIFIED` requirement. Those non-Rule contracts predate #138. This change only removes Rules from their authoring-unit and Markdown clauses; it neither implements nor expands Template Sync or publication behavior.

### 3. Reject legacy Rules Markdown atomically

`parseTemplateMarkdown()` currently splits at `## Rules`, parses supported Template content, and attaches parsed Rule Sets. After removal, a document containing the exact Rules section header is rejected before any imported Template object is returned.

```text
Markdown without ## Rules
  → parse supported Template structure

Markdown with ## Rules
  → return Rules-unsupported failure
  → caller applies no imported state
```

The error must be distinguishable from malformed generic Markdown so the UI can explain that Rules are retired. Export never emits `## Rules`.

### 4. Remove the retired route completely

The filesystem route `/templates/:id/edit/rules` is deleted. The Questions editor no longer renders a Rules toggle or command. Requests to the old route use Nuxt's normal not-found behavior; no redirect or compatibility page remains.

### 5. Remove the live Maturity Score capability

All current `maturity-score` requirements describe Rules Manager. The live capability is removed rather than retained as an empty shell or rewritten from unresolved discovery.

Preserved context:

- The roadmap may continue to describe Maturity Score as future work.
- Archived Rules changes and historical decisions remain unchanged.
- No replacement scoring discovery is promoted into an implementation requirement.

### 6. Use forward destructive migrations

Historical migrations are immutable. The desired final schema removes Rules tables through new migrations.

```text
SQLite history
0001 creates template_rules + template_draft_rules
...
0015 drops template_draft_rules, then template_rules

PostgreSQL history
001 creates template_rules
...
007 drops template_rules without CASCADE
```

SQLite `0015_remove_template_rules.sql` intentionally deletes all local draft and published Rule rows. It is registered after `0014`, then embedded with `pnpm db:migrations:embed`.

PostgreSQL `007_remove_template_rules.sql` drops `template_rules` without `CASCADE`, so an unexpected dependent object fails loudly. Its Down migration recreates the historical empty table and index but cannot recover deleted rows.

The active hand-written Drizzle schemas, `services/schema.sql`, generated Drizzle output, generated sqlc models, and table-file codegen mapping are updated together.

### 7. Remove application reads before final schema use

The branch removes all queries and writes to Rules tables in the same release as the migrations. The final application bundle therefore never accesses a table after the migration runner removes it.

The migration tests exercise populated previous schemas, while typecheck and focused Template tests prove the final application no longer depends on Rules.

## Testing strategy

Implementation follows vertical TDD slices:

```text
1. Markdown rejection
   RED legacy Rules Markdown test
   GREEN remove Rules parser/serializer

2. Route and discoverability
   RED browser assertions for no Rules controls + old URL not found
   GREEN remove route/navigation/components

3. Domain and persistence
   RED supported Template save/load/validation tests without Rules
   GREEN remove Rule model/store/validation/persistence

4. SQLite migration
   RED populated 0014 → 0015 upgrade test
   GREEN add/register/embed 0015

5. PostgreSQL migration
   RED populated migration test/schema assertion
   GREEN add 007 and update desired/generated schemas

6. Specs/docs/dependencies
   RED reference/OpenSpec/dependency checks
   GREEN remove Vue Flow and update current documentation
```

Tests verify public behavior rather than deleted implementation details:

- Supported Markdown still round-trips.
- Legacy Rules Markdown is rejected and never partially applied.
- Template Studio exposes no Rules navigation or route.
- Question/checklist validation remains unchanged.
- Existing databases lose only Rule tables/data.
- Fresh schemas contain no Rule tables.
- No current runtime/spec/doc dependency retains Rules.

## Security Considerations

This change adds no endpoint, sync event, authorization capability, browser store, or global.

It removes user-authored Rules data from browser SQLite and PostgreSQL. The deletion is intentional and visible in migrations and issue #138. No migration exports Rule content, and rollback recreates schema only.

Removing Rules does not broaden access. The existing Markdown parser continues to treat imported text as untrusted input; legacy Rules Markdown is rejected rather than rendered or persisted.

Threat-model documents contain no Rules-specific trust-boundary claim, but the filesystem drift guard still runs because implementation and schema files are deleted.

## Risks / Trade-offs

- Existing Rules data is permanently lost. This is accepted for the pre-production feature and is proved by migration tests.
- Rejecting legacy Markdown is less convenient than ignoring Rules, but it prevents silent partial imports.
- Deleting the live `maturity-score` capability temporarily removes that bounded context from OpenSpec; this is more accurate than inventing requirements from unfinished discovery.
- A normal not-found response may break old bookmarks, but avoids retaining a compatibility route for an unused feature.
- SQLite fresh installs still execute historical creation before `0015` removes the tables; this preserves migration history at a small setup cost.
- PostgreSQL Down restores only table shape, not deleted Rule rows.
- Removing Vue Flow also requires deleting the unused probe component; otherwise dependency removal breaks the build.

## Migration Plan

1. Add failing Markdown, route/discoverability, and populated migration tests.
2. Remove Rules UI, state, model, validation, Markdown, and persistence call sites.
3. Remove active hand-written Rules table definitions.
4. Add and register SQLite migration `0015_remove_template_rules.sql`.
5. Regenerate `shared/db/migrations/sqlite-content.ts`.
6. Remove `template_rules` from `services/schema.sql` and the SQL-to-Drizzle table mapping.
7. Add Goose migration `007_remove_template_rules.sql` with schema-only Down.
8. Regenerate Drizzle and sqlc output.
9. Remove Vue Flow packages through pnpm.
10. Update live OpenSpec/current docs, then archive this change so live capabilities reflect removal.
11. Run focused migration/Template tests and the complete `make mr` gate.

Rollback before merge is a normal working-tree revert. After deployment, SQLite data cannot be restored; a follow-up migration could recreate empty tables only. PostgreSQL Goose Down likewise restores schema without data.

Reference: `site/docs/development/walkthroughs/local-first/upgrades.md`.

## Open Questions

None. The user resolved all issue #138 product questions:

- Legacy Rules Markdown is rejected.
- The current live `maturity-score` capability is removed.
- The retired Rules route returns the normal not-found behavior.

---

### Component Map

| Element                | NuxtUI Component                       | Key Props                               | Semantic Classes          | Notes                                   |
|------------------------|----------------------------------------|-----------------------------------------|---------------------------|-----------------------------------------|
| Template Studio header | Existing `TemplateStudioHeader`        | Template, save state, supported actions | Existing classes retained | Remove Questions/Rules toggle only      |
| Question editor        | Existing Template Studio components    | Existing props                          | Existing classes retained | Surviving primary authoring surface     |
| Markdown modal         | Existing `TemplateStudioMarkdownModal` | Template, import/export events          | Existing classes retained | Displays Rules-unsupported import error |
| Not-found page         | Nuxt default                           | None                                    | Framework-owned           | No Rules compatibility route            |

### Spatial Composition

- Container widths: unchanged.
- Gaps and spacing: unchanged after removing the mode toggle.
- Stretch behavior: Questions editor continues to fill the Studio layout.
- Visual hierarchy: Template metadata, pillar navigation, and question editor remain primary; no replacement Rules affordance is introduced.

### Visual Assertions

- AND the Template Studio header has no Rules mode control.
- AND the command palette exposes no Rules Editor navigation.
- AND the question editor retains its existing dimensions and hierarchy.
- AND legacy Rules URLs render the standard not-found experience.
- AND Markdown import presents a clear unsupported Rules error without applying partial state.
