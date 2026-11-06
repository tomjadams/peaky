## Context

Work item [#140](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/140) is the second prerequisite in the staged Template synchronization plan.

Peaky currently has three incompatible representations:

```text
Browser authoring              Shared/server schema              Nitro fixtures
─────────────────              ────────────────────              ──────────────
template_drafts                templates                         one flattened Template
template_draft_pillars         template_versions                 mutable version/status/content
template_draft_questions       template_pillars                  no Revision identity
template_draft_imports         template_questions
```

The Studio publishes by changing a mutable local draft from `draft` to `active`. Review selections are named as version references but normal creation stores ordinary Template/draft IDs. Selection rows are not transported in the Review outbox, published tables are not populated by the active runtime, and Template lifecycle owners exist only in a process-local Nitro map.

The accepted replacement is:

```text
Template
├─ current authoring/catalog metadata
├─ status: active | archived
├─ ownerTeamId
├─ createdByActorId
├─ updatedByActorId
│
└─ TemplateRevision
   ├─ status: draft | published | retired
   ├─ complete metadata snapshot
   ├─ revisionNumber: null | positive integer
   ├─ revisionSummary: null | <= 120 chars
   ├─ createdByActorId
   ├─ updatedByActorId
   ├─ publishedByActorId: null | actor ID
   │
   └─ TemplatePillar
      └─ TemplateQuestion
```

Rules removal is complete. Publication, Template draft synchronization, and generic atomic PostgreSQL projection remain later stages.

## Goals / Non-Goals

**Goals:**

- Establish the Template/Revision aggregate and remove separate local draft tables.
- Enforce lifecycle, cardinality, numbering, ownership, actor provenance, and immutability invariants in SQLite, PostgreSQL, runtime schemas, and services.
- Intentionally reset all legacy Template and dependent Review data/history/replay state while preserving unrelated domains.
- Rebuild deterministic demo fixtures with exact Revision references.
- Freeze all publication paths and Template authoring transport without false success.
- Store and validate exact ordered Revision IDs in local and deterministic fixture Review creation without claiming cross-client transport.
- Make all affected OpenSpec, documentation, security, and testing contracts truthful.

**Non-Goals:**

- Implement server-authoritative publication, number allocation, automatic retirement activation, Revision history/picker UX, authenticated publisher assignment, or publication concurrency.
- Synchronize Template drafts, Pillars, or Questions.
- Decide collaborator grants or non-editor draft visibility.
- Materialize PostgreSQL Review domain projections before generic atomic persistence exists.
- Ingest trustworthy Team membership, permit Team members to manage lifecycle, or expose any remote Template create/update/lifecycle mutation before a trusted server authority exists.
- Preserve legacy Template or Review data.
- Infer cross-Revision Question lineage.
- Settle fully offline creation of a new Review against stale availability.

## Decisions

### D1. Template is identity; Revision is authored content

`templates` stores aggregate identity, current authoring metadata, lifecycle, Team ownership, and actor provenance. `template_revisions` stores complete draft or immutable content snapshots. The old `template_drafts` hierarchy disappears; `template_versions` is replaced rather than retained as a second concept.

This is a deliberate two-level model, not `TemplateFamily → Template → Version`.

### D2. Relational schema

Desired logical end state:

```text
templates
  id                       TEXT PK
  name                     TEXT NOT NULL
  description              TEXT NOT NULL
  status                   active | archived
  owner_team_id            TEXT NOT NULL
  created_by_actor_id      TEXT NOT NULL
  updated_by_actor_id      TEXT NOT NULL
  created_at               timestamp NOT NULL
  updated_at               timestamp NOT NULL

  1 ─────── * template_revisions
                 id                       TEXT PK
                 template_id              TEXT NOT NULL FK -> templates
                 name                     TEXT NOT NULL
                 description              TEXT NOT NULL
                 status                   draft | published | retired
                 revision_number          INTEGER NULL
                 revision_summary         TEXT NULL
                 created_by_actor_id      TEXT NOT NULL
                 updated_by_actor_id      TEXT NOT NULL
                 published_by_actor_id    TEXT NULL
                 created_at               timestamp NOT NULL
                 updated_at               timestamp NOT NULL
                 published_at             timestamp NULL

                 1 ─────── * template_pillars
                                id
                                template_revision_id FK
                                slug/name/description/order_key/timestamps

                                1 ─────── * template_questions
                                               id
                                               pillar_id FK
                                               authored Question fields/timestamps

client-only template_revision_imports
  id                       TEXT PK
  template_revision_id     TEXT NOT NULL FK -> template_revisions
  source_type              TEXT NOT NULL: markdown | json
  source_file              TEXT NULL
  imported_at              timestamp NOT NULL
  conflicts                JSON array NOT NULL DEFAULT []
  resolved                 JSON array NOT NULL DEFAULT []

review_template_selections
  review_id                TEXT FK -> reviews
  template_revision_id     TEXT FK -> template_revisions ON DELETE RESTRICT
  position                 INTEGER
  PRIMARY KEY (review_id, template_revision_id)
  UNIQUE (review_id, position)

```

`template_revision_imports` deliberately retains the legacy `source_type`, `source_file`, `imported_at`, `conflicts`, and `resolved` fields unchanged; only `draft_id` becomes `template_revision_id`. Import creation and conflict-resolution updates require a draft Revision at the service boundary. If that Revision is later published, its existing import provenance remains attached and becomes immutable with the Revision. The table remains SQLite-only and creates no event, outbox, or PostgreSQL projection in #140.

Constraints:

- `templates.status IN ('active', 'archived')`.
- `template_revisions.status IN ('draft', 'published', 'retired')`.
- Draft implies `revision_number IS NULL`, `published_at IS NULL`, and `published_by_actor_id IS NULL`.
- Published/retired implies positive, non-null `revision_number`, `published_at`, and `published_by_actor_id`.
- `updated_by_actor_id` starts as the creator, changes with each mutable aggregate/draft edit, and freezes with immutable Revision content.
- Partial unique indexes allow at most one draft and one published Revision per Template.
- A partial unique index makes non-null `(template_id, revision_number)` unique.
- A non-null summary has trimmed length 1–120; application validation normalizes blank input to null.
- Pillar slug is unique within a Revision.
- Question identity is globally unique per immutable row and Revision-specific.
- New or changed `template_revision_imports` rows require a draft Revision through service validation; existing rows remain attached and immutable if that Revision later becomes published or retired.
- Review selection position is an integer from 0 through 2; `(review_id, position)` and `(review_id, template_revision_id)` are unique.
- The creation transaction enforces one to three contiguous positions and distinct parent Template IDs; row constraints alone cannot enforce aggregate cardinality or cross-row parent distinctness.
- `review_template_selections.template_revision_id` uses restrictive deletion semantics.

Questions reference Revision transitively through Pillars. A redundant Revision FK on Questions is rejected because it creates a second parent-consistency invariant.

Invariant enforcement by layer:

| Invariant | Database | Transactional service |
| --- | --- | --- |
| Status values, number/publisher/null coupling, summary length | CHECK constraints | Runtime validation mirrors constraints |
| One draft/published Revision and unique Revision number | Partial unique indexes | Friendly conflict errors |
| Creator/updater/publisher provenance | NOT NULL plus status coupling CHECKs | Initialize/update/freeze actor IDs at mutation boundaries |
| Published/retired content immutability | Structural FK protection only | All mutation entry points reject before writes |
| Selection duplicate Revision/position and position bounds | PK, UNIQUE, CHECK | Canonical ordered insertion |
| Selection count, contiguous order, distinct parent Templates | Not expressible as ordinary row CHECKs | Validated atomically before insertion |
| Import-provenance writes target only a draft | FK to Revision | Draft-status validation; freeze with immutable Revision |

### D3. No current-Revision pointer

`published` is the sole current-Revision marker. Partial uniqueness enforces one current published Revision per Template. Template archive overlays availability without changing Revision status.

A pointer would duplicate state and would be equally stale offline. MR B must retire the old Revision and publish the new one in one authoritative transaction.

### D4. Revision number and summary

`revisionNumber` is model data; `vN` is presentation. Drafts have no number. Fixture published Revisions use 1. MR B owns next-number allocation.

`revisionSummary` is optional snapshot metadata. This change stores and validates it but adds no final authoring/history UI. Successor drafts do not inherit a predecessor summary.

### D5. Snapshot presentation boundary

```text
Template management / Studio  -> current Template + draft metadata
New-Review picker             -> current published Revision snapshot
Existing Review               -> selected Revision snapshot
```

A draft rename updates Template and draft atomically but never changes published or historical display data. Remote reads return aggregate metadata and deterministic published fixture snapshots only; they never distribute a draft body. Local Studio opens a draft only when it exists in SQLite and the current cached edit entitlement permits editing, without deciding MR A's future non-editor visibility policy.

### D6. Revision-specific Question identity

A copied or equivalent Question in another Revision is a distinct row. Improvement Plan exact grouping uses `templateRevisionId + questionId`. No content fingerprint or semantic lineage is inferred. Future cross-Revision trend analysis requires the separate explicit design tracked by [issue #141](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/141).

### D7. Team ownership and actor provenance

Each Template has exactly one non-null `ownerTeamId` selected from a successfully persisted `directory_groups` snapshot. If no snapshot exists, first save is blocked; this change introduces no freshness TTL and permits the last successfully stored snapshot during offline authoring. The ID is stored as text without a database FK because the SQLite mirror is replaced during refresh and PostgreSQL has no mirror table. Missing display data later falls back to the ID and never cascades deletion.

Actor provenance is explicit and never grants access:

```text
Template.createdByActorId          immutable identity creator
Template.updatedByActorId          last aggregate-metadata editor
TemplateRevision.createdByActorId  immutable Revision/draft creator
TemplateRevision.updatedByActorId  last actor to change draft metadata or authored child content
TemplateRevision.publishedByActorId null for draft; immutable publisher for published/retired
```

`updatedByActorId` is initialized to the creator. A Pillar or Question edit updates the parent draft Revision's `updatedAt` and `updatedByActorId` in the same local transaction. This is intentionally coarse last-editor provenance, not a substitute for future per-field/contributor history.

Published fixtures set `publishedByActorId` to the system actor. #140 adds the storage, coupling constraints, fixtures, and validation; MR B assigns the authenticated publisher during the authoritative publication transition. Publisher provenance belongs to the Revision, not the Template.

The initial Template and draft Revision normally share a creator; later draft creators may differ. `ownerTeamId` is immutable in this stage because transfer requires a trusted server authority.

Current mirror data has no member identities. This change records Team ownership and actor provenance but exposes no remote Template lifecycle mutation while Template authority is local-only. A later trusted server path must combine server-enforced lifecycle authorization with trustworthy Team membership; edit entitlement remains independent.

### D8. Local-only draft transport freeze

Template and draft-Revision mutations use a new explicit `LocalMutation.localOnly()` path: one shared SQLite state transaction with no event, outbox row, or push trigger. Local Template writes emit no legacy or new sync entity type; the existing server entity allow-list remains unchanged in #140. UI and docs describe drafts as local-only and warn that clearing local data removes unpublished work.

Nitro remains read-only for deterministic published fixture projections. Remote Template create/update/archive/restore/whole-draft-delete/permanent-delete calls return HTTP 503 with machine code `template_write_unavailable` before reads or writes. Client Template mutation services return `{ success: false, code: "template_write_unavailable" }`. Corresponding management controls are absent. This avoids both process-local Nitro authority and browser-only authorization claims.

Issue #137 must bootstrap the complete current draft/Pillar/Question state before enabling incremental transport. Review transport remains enabled.

### D9. Publication freeze and rollout gate

One `templatePublishingEnabled` config concept defaults false everywhere. `nuxt.config.ts` parses only `NUXT_TEMPLATE_PUBLISHING_ENABLED` once and assigns both private and public projections from that value; an independent `NUXT_PUBLIC_*` override is not accepted.

```text
Public projection   -> hides UI controls (UX only)
Private server gate -> rejects endpoint before reads/writes
Client service gate -> rejects before local state/event/outbox/UI mutation
```

The legacy mutation is removed. Client calls return `{ success: false, code: "template_write_unavailable" }`; Nitro calls return HTTP 503 with the same machine code. Enabling the flag before MR B still cannot execute publication; MR B installs the real implementation before activation and owns eventual flag cleanup.

### D10. Review consumption uses exact local Revision references

Canonical browser Review creation resolves one to three distinct current `published` Revisions belonging to distinct active Templates. One SQLite transaction writes the Review and ordered `review_template_selections` rows using composite `(review_id, template_revision_id)` identity and contiguous positions `0..2`.

Draft and retired Revisions and Revisions of archived Templates are rejected for new Reviews. Once a Review exists, its exact Revision reference remains valid if that Revision later retires; no content is silently migrated.

Nitro Team/Product Review creation remains explicitly process-local fixture compatibility. It validates deterministic fixture Revision IDs and stores them only in fixture Review state; it does not claim browser SQLite, PostgreSQL, or synchronization persistence.

### D11. Review selection synchronization and projection remain deferred

This change does not add `templateRevisionIds` to Review outbox fields, Go push validation, field versions/events, inbound replay, or two-client sync coverage. It also does not populate PostgreSQL `reviews` or `review_template_selections` domain tables.

The existing selection-transport gap remains assigned to Generic Sync Hardening, which owns complete/atomic Review creation transport, stale-client cutover, and domain projection. The fully offline race where cached local availability differs from the server is documented but not solved by #140.

### D12. Template lifecycle and deletion freeze

The schema models `active | archived` lifecycle, but this change exposes no user-created Template archive, restore, whole-draft-delete, or permanent-delete transition. Every remote lifecycle call returns the stable Template-write-unavailable outcome and the UI renders no lifecycle controls. Local-only admin checks are not treated as authorization.

The target lifecycle semantics—archive as a reversible overlay, Team-or-admin enforcement, whole-draft deletion, and reference-safe permanent deletion—remain deferred until a trusted server Template authority and authoritative Review-reference query exist.

### D13. Intentional destructive reset

No legacy Template or Review identity mapping is attempted. The migration uses an explicit platform-aware manifest.

Domain/provenance rows removed where the table exists:

```text
templates                       reviews
template_versions               review_template_selections
template_pillars                review_answer_state
template_questions              review_note_state
template_drafts                 review_attachments
template_draft_pillars          review_score_state
template_draft_questions        review_participants
template_draft_imports          draft_answer_imports
                                draft_answer_evidence
```

Shared operational rows are deleted only when their exact identity matches:

```text
entity_type IN (
  review, review_checkpoint, review_answer, review_note, review_attachment,
  template, template_version, template_pillar, template_question,
  template_draft, template_draft_pillar, template_draft_question
)
```

Apply that allow-list to `local_outbox`, `pending_review_queue`, `field_versions`, and `field_version_events` where present. For `events`, also delete rows with non-null `review_id` or exact event types:

```text
ReviewAnswerRecorded.v1, ReviewCheckpointSaved.v1,
ReviewNoteRecorded.v1, ReviewNoteDeleted.v1,
ReviewAttachmentUploaded.v1, ReviewAttachmentDeleted.v1,
ReviewProgressUpdated.v1, ReviewCreated.v1, ReviewArchived.v1,
ReviewRestored.v1, ReviewDeleted.v1,
TemplateDraftCreated.v1, TemplateDraftUpdated.v1,
TemplateDraftDeleted.v1, TemplatePublished.v1, TemplateImported.v1,
TemplatePillarCreated.v1, TemplatePillarUpdated.v1,
TemplatePillarDeleted.v1, TemplateQuestionCreated.v1,
TemplateQuestionUpdated.v1, TemplateQuestionDeleted.v1
```

SQLite `entitlement_snapshots` is invalidated wholesale because embedded Review/Template grants are JSON and cannot be filtered safely. Actor-scoped `sync_cursors` remain; new deterministic fixture events use newer positions. Products, Teams, catalog-directory data, migration tables/logs, and unrelated domain/history rows remain.

Every migration test seeds at least one row for each applicable table, entity type, nullable-entity legacy event shape, exact event type, and preserved class. The one-time purge is an explicit exception to ordinary append-only audit retention and does not change runtime entity-deletion semantics. External attachment blobs need no cleanup because object storage is not implemented.

### D14. Deterministic fixtures

Source-controlled content is rebuilt, not migrated. Every fixture declares deterministic Template/Revision/Pillar/Question IDs, owner Team, and system creator/updater provenance; immutable fixture Revisions also use the system publisher. Existing active fixtures receive Revision 1 plus a distinct editable draft copy. The current draft-only fixture remains draft-only. Demo Reviews reference exact published Revision IDs. Fabricated `${templateId}-v-1` workspace IDs are removed.

### D15. Breaking Preview cutover without protocol expansion

The reset is intentionally incompatible with stale bundles, but #140 adds no sync protocol version floor, Review creation marker, or Template entity-type migration. The deployment-version banner and chunk recovery prompt stale tabs to reload and apply the destructive SQLite migration; this is rollout UX, not a correctness proof.

There is no supported mixed-version or data-preservation window. A stale client can theoretically repush legacy Review/Template-shaped state after the reset; preventing that is explicitly assigned to Generic Sync Hardening rather than solved here. The Preview deployment must be coordinated, and release notes/MR evidence must call out the destructive reset, stale-client limitation, and local-only draft risk.

### D16. PostgreSQL and SQLite schema authority

Follow `site/docs/development/walkthroughs/local-first/upgrades.md` and `site/docs/development/postgresql.md` while reflecting the runtime paths that exist today:

- edit `services/schema.sql` as the PostgreSQL desired end state;
- add Goose migration 008 with honest destructive Up/Down semantics;
- regenerate sqlc/Go models with `make gen:sqlc`;
- update the hand-written runtime Drizzle schemas under `shared/db/schema/`;
- add and register SQLite migration 0016;
- regenerate embedded `sqlite-content.ts`;
- verify fresh and upgraded PostgreSQL plus fresh and upgraded SQLite through persistence behavior tests;
- treat `scripts/generate-drizzle-from-sql.ts` and `shared/db/schema/generated/` as non-authoritative unused tooling; do not run or extend them in #140. Issue [#142](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/142) owns their removal and the associated live documentation/OpenSpec cleanup.

Historical migrations remain immutable.

## Testing strategy

Implementation follows RED → GREEN → REFACTOR per acceptance criterion.

```text
Schema/model RED
  ├─ SQLite migration upgrade fixture
  ├─ PostgreSQL Goose upgrade fixture
  ├─ constraint matrix
  └─ unrelated-data preservation
        ↓
Domain/service RED
  ├─ Template + draft atomic creation
  ├─ metadata dual-write to Template/draft
  ├─ immutable Revision rejection
  ├─ owner and actor provenance boundaries
  └─ local-only draft writes
        ↓
API/UI RED
  ├─ publication flag and zero-write rejection
  ├─ required owner-Team selection
  ├─ management vs Review snapshot presentation
  └─ remote lifecycle/delete zero-write unavailability
        ↓
Local consumer RED
  ├─ exact Review-to-Revision rows
  ├─ draft/retired/archived selection rejection
  ├─ Revision snapshot workspace resolution
  └─ no new outbox or cross-client claim
```

Test layers:

| Layer | Evidence |
| --- | --- |
| Type/unit | Schema validators, status/number/summary matrix, exact rollup keys, publication gates |
| SQLite integration | Existing-through-0015 destructive upgrade, fresh schema, FK/index/CHECK inspection, unrelated rows preserved |
| PostgreSQL integration | Existing-through-007 Goose upgrade, reset scope, schema parity, Down restores empty legacy shape only |
| Nitro integration | Deterministic fixture reads/Review references plus zero-write unavailable outcomes for Template create/update/publication/lifecycle endpoints |
| Nuxt component | Owner Team required, Publish/lifecycle controls absent, lifecycle/Revision indicators, Review card snapshot metadata |
| Browser E2E | New Template local-only authoring, local exact Revision selection, deterministic fixture Review, destructive migration recovery |
| Guards/docs | Threat-model drift, schema pipeline, OpenSpec strict validation, decision/changelog consistency |

The full gate is `make mr`; no new sync-stack E2E is introduced by this model migration.

## Security Considerations

1. **API and local validation.** Remote Template create/update/publication/lifecycle surfaces return a stable unavailable outcome before reads or writes. Local and process-local fixture Review creation validate exact current published Revision IDs without changing sync push behavior.
2. **Browser storage.** OPFS now stores Team ownership, creator/updater/publisher IDs, draft content, and exact Revision references. The browser remains untrusted; owner and actor provenance values never establish authorization. Debug globals remain under their existing test-helper gate.
3. **Authorization.** UI controls are UX only. No remote Template lifecycle mutation is available while authority is local-only. Draft edit authorization remains separate and is not expanded here.
4. **User content.** Existing Question/metadata HTML remains user-supplied. This change does not add a render sink or weaken sanitization. Publication is disabled, so it cannot be used to bless unsafe content.
5. **Runtime config.** `templatePublishingEnabled` is exposed publicly only for UI gating and is not sensitive. Private endpoint checks remain authoritative. The canonical threat model must list the new public value and local-only draft risk; #140 does not change the sync entity allow-list.
6. **Destructive migration.** Reset SQL uses explicit entity/table filters and tests unrelated-data preservation. It must not use broad `CASCADE` to hide unknown dependencies. Migration logs remain available for support.
7. **Offline/stale state.** Local creation rejects a Revision currently cached as draft/retired or owned by an archived Template. A fully offline client may have stale availability; the eventual sync acceptance/recovery policy remains deferred and is not claimed by this change.

## Risks / Trade-offs

- **Intentional data loss:** all Template/Review state and history is deleted under the explicitly approved disposable-data contract for Preview and must remain prominently documented.
- **Local-only unpublished drafts:** clearing OPFS before #137 loses work. UI/documentation must not claim server durability.
- **Offline availability race remains:** local creation rejects cached draft/retired/archived selections, but #140 does not define what sync does when that cache is stale.
- **Frozen lifecycle:** Team ownership and lifecycle state are modeled, but no user-created Template lifecycle mutation is available until a trusted server Template authority and Team-membership policy exist.
- **Review transport/projection remains incomplete:** exact local references do not populate PostgreSQL Review tables or fix the existing cross-client selection gap.
- **Large cross-layer MR:** schema, migrations, fixtures, UI, Nitro compatibility, tests, OpenSpec, and docs may receive an XL/XXL label. Tasks are sequenced into independently reviewable green checkpoints; implementation packaging can split only if each intermediate state remains deployable.
- **No cross-Revision Question trends:** exact rollups intentionally separate Revisions to avoid false semantic continuity.
- **Stale client reset risk:** old clients may repush legacy state because #140 intentionally adds no protocol barrier; coordinated Preview rollout and later Generic Sync Hardening own mitigation.

## Migration Plan

1. Land strictly valid OpenSpec artifacts and issue #140 traceability; do not implement before approval.
2. Add failing SQLite/PostgreSQL reset and constraint tests using databases at migrations 0015/007.
3. Add fail-closed publication and remote Template create/update/lifecycle gates before exposing any new schema behavior.
4. Update PostgreSQL desired schema and Goose 008; regenerate derived artifacts.
5. Add SQLite 0016, register it, regenerate embedded migration SQL, and verify fresh/incremental paths.
6. Replace runtime schemas/models/repositories with Template/Revision names and constraints.
7. Rebuild deterministic Template/Review fixtures and remove fabricated identities.
8. Migrate Template Studio to one local draft Revision, owner-Team selection, and no Template outbox.
9. Migrate local and process-local fixture Review selections, picker, workspace, and Improvement Plan consumption to exact Revision IDs without changing outbox, Go push, or inbound replay.
10. Remove legacy publish logic, the process-local Template owner map, writable Nitro Template compatibility behavior, and obsolete flattened mappers/tests while retaining deterministic read fixtures and existing sync behavior.
11. Update threat model, domain/data-model/Template Studio walkthroughs, user guides, decision log, changelog, issue #137 terminology, and required drift markers.
12. Run focused tests continuously, then strict OpenSpec validation, `make mr`, adversarial reviewers, and CodeRabbit after MR creation.

Rollback:

- SQLite rollback cannot restore deleted user data. A follow-up migration or local DB recreation can restore an empty legacy/new schema, and `_migration_log` records the attempt.
- Goose Down may recreate the historical table shapes empty; it MUST NOT claim to recover deleted rows.
- Server backups are the only path to recover pre-migration PostgreSQL data, though the approved Preview disposable-data policy does not require preservation.
- If deployment fails before merge, discard the unshipped migration files. After deployment, fix forward rather than rewriting applied migration history.

## Open Questions

No question blocks this change. Deferred owners are explicit:

- MR B: publication transition, number allocation, automatic retirement, publisher assignment, Revision history/picker UX, fully offline new-Review policy, and rollout-gate activation/removal.
- Issue #137: Template draft entity/root/authorization/replay contracts, collaborator grants, non-editor visibility, and bootstrap of locally authored drafts.
- Generic Sync Hardening: atomic field/event/domain projection and authoritative global Review-reference queries.
- Template authority follow-up: trusted server persistence for Template identity/lifecycle, Team membership authorization, ownership transfer, and lifecycle/delete actions.

---

### Component Map

| Element | NuxtUI Component | Key Props | Semantic Classes | Notes |
| ------- | ---------------- | --------- | ---------------- | ----- |
| Owner Team field | `USelect` | `v-model`, `items`, `size` | `text-default`, `text-muted` | Existing select pattern; required before first save |
| Template lifecycle | `UBadge` | `color`, `variant` | semantic status colors | Read-only state, distinct from Revision status |
| Revision status/number | `UBadge` + text | `color`, `variant` | `text-muted`, `text-dimmed` | Draft has no `vN` |
| Publish control | existing `UButton` | conditional render | existing primary style | Absent while flag false; no disabled fake action |
| Templates management | existing `DataTable` | columns/data/actions | `bg-elevated`, `text-default` | Aggregate rows with draft/current Revision summary; no lifecycle actions |
| Review Revision card | existing `ReviewWizardTemplateStep` card | exact Revision ID | existing selection classes | Snapshot metadata only |

### Spatial Composition

- Reuse the current Templates list width, table, Studio header, and Review wizard card grid.
- Place required owner-Team selection with Template metadata during initial creation; do not create a separate wizard solely for one field.
- Keep Template lifecycle and Revision status adjacent but visually distinct.
- Remove Publish without leaving an empty separator or command-palette gap.
- Preserve current responsive card/table behavior and dark-mode semantic surfaces.

### Visual Assertions

- AND the Template management row distinguishes aggregate lifecycle, draft availability, and current published `vN`.
- AND the Review picker never displays draft, retired, or archived-Template Revisions.
- AND Review cards and workspaces display immutable Revision snapshot metadata.
- AND the Studio has no Publish button or command while the rollout gate is false.
- AND owner-Team validation is visible before first save and does not rely on color alone.
- AND Template management renders lifecycle as read-only state and exposes no archive, restore, whole-draft-delete, or permanent-delete control during the authority freeze.
