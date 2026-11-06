## Context

Peaky's live OpenSpec tree accumulated 22 capability directories across several
generations of the product. Four directories are invalid pointer stubs, some
archived deltas were appended under headings the OpenSpec parser does not count,
CI Automation requirements live in the consuming repository rather than the
owning repository, and several current specs mix historical REST or prototype
language with the local-first implementation.

Strict validation currently passes 18 live specs and fails only `branding`,
`checklist-questions`, `documentation`, and `scoring-rules`. The cleanup must
improve ownership without destroying the deep UX and architectural decisions in
the large Assessment, Template Studio, Reviews, and sync specifications.

Two active changes modify `sync-engine`: `sync-pull-scoping` and
`sse-family-catalog-channels`. Their deltas remain authoritative until they are
archived, so this change does not rewrite the same Sync Engine requirements.

## Goals / Non-Goals

**Goals:**

- Make every directory under `openspec/specs/` a valid, maintained capability.
- Move CI Automation's specification and history to its owning repository before
  removing the Peaky copy.
- Extract the independently navigable System Diagnostics and Recent Changes
  capabilities.
- Preserve `maturity-score` as the future home of weighted readiness scoring.
- Repair malformed archived-delta headings without losing intended behavior.
- Remove obsolete visual-regression, mock-API, no-op, and ownership statements.
- Put product Improvement Plan behavior in the shared Improvement Plans context.
- Document the sync-plane authorization boundary explicitly.
- Add strict OpenSpec validation to the normal quality gate.

**Non-Goals:**

- Replacing the current rules UI with weighted maturity scoring in this change.
- Renaming `maturity-score` to match the transitional rules implementation.
- Removing application compatibility routes before their product lifecycle is
  decided.
- Rewriting Sync Engine requirements while active changes target the same
  requirement headers.
- Changing runtime database schema, APIs, synchronization behavior, or UI.
- Reformatting historical archived designs merely to match current source paths.

## Decisions

### 1. Capability ownership, not file size, determines splits

The repository's DDD rule remains the governing test. Technical implementation
details do not each become their own capability.

```text
BEFORE                              AFTER
──────────────────────────────      ──────────────────────────────
local-first                        local-first
  ├─ replication invariants          └─ replication invariants
  └─ complete /system product UI    system-diagnostics
                                      └─ /system product UI

reviews / DESIGN.md                recent-changes
  └─ implicit edit-history UI        └─ explicit edit-history contract

products                           products
  └─ product plan behavior         improvement-plans
                                      └─ review/team/product plans
```

`sync-engine`, `auditing`, `reviews`, `assessment`, and `template-studio`
remain cohesive capabilities. They may be reorganized internally but are not
fragmented into implementation-layer specs.

### 2. CI Automation moves with a copy-before-delete gate

The target repository receives a custom `rtf-workflow` schema adapted to its
Python/Pydantic/GitLab architecture. It receives:

- current capability specs extracted from its implementation;
- the Peaky `ci-automation` live requirements, reconciled with current code;
- the complete `2026-06-23-ci-automation-event-actions` archive;
- target-native OpenSpec configuration and lifecycle guidance.

The Peaky directory is removed only after the target branch exists and passes
strict OpenSpec validation. Peaky retains `.gitlab/ci-automation.yaml`, because
that file is consumer configuration rather than implementation ownership.

```text
Peaky source exists
       │
       ▼
ci-automation/docs/adopt-openspec
  copy → adapt to rtf-workflow → strict validate
       │
       ▼
remove Peaky live spec and migrated archive
```

Historical design and task content remains historical. Only metadata required
to recognize `rtf-workflow` is migrated.

### 3. Maturity Score keeps its future-facing name

`maturity-score` remains live. Its current rules-canvas requirements are
transitional and will be removed or modified by the planned weighted maturity
change. This cleanup does not create `template-rules`.

The invalid `scoring-rules` pointer is deleted because history already records
the supersession and the live capability remains discoverable.

### 4. Invalid stubs are deleted, not replaced by more stubs

`branding`, `checklist-questions`, `documentation`, and `scoring-rules` contain
no requirements and fail strict validation. Their destinations already exist:

| Stub | Maintained destination |
| --- | --- |
| `branding` | `DESIGN.md` and visual-design documentation |
| `checklist-questions` | Assessment runtime and Template Studio authoring |
| `documentation` | `site/docs/` |
| `scoring-rules` | `maturity-score` |

Historical provenance remains in archived changes and Git history.

### 5. Hidden delta sections are normalized into valid requirements

Assessment and Template Studio contain archived delta wrappers inside live
specs. OpenSpec stops counting requirements after the extra top-level headings,
which currently hides checklist and local-first authoring requirements.

The files are normalized to one `## Requirements` section. Duplicate checklist
requirements are consolidated around current answer shapes and validation.
Local-first authoring requirements become ordinary capability requirements.

This is a specification migration only; runtime behavior does not change.

### 6. Current facts replace prototype-era promises

The cleanup applies these ownership rules:

- domain pages read replicated domain state through local-first mutations where
  implemented;
- legacy REST endpoints are documented only when they remain real compatibility
  or catalog surfaces;
- no-op backend promises are removed;
- Reviews use the canonical subject model rather than application ownership;
- template consumption remains in `templates`, while authoring and publishing
  remain in `template-studio`;
- exact team/product/review plan rollups live in `improvement-plans`;
- bounded Recent Changes history is not described as compliance audit evidence.

Unresolved product decisions are stated rather than guessed. Application
compatibility routes remain until a dedicated decision retires them.

### 7. Validation becomes enforceable

The Makefile receives an OpenSpec validation target. The quality gate validates
all live specs and each active change in strict, non-interactive mode.

The bulk `openspec validate --changes` command currently discovers no custom
workflow changes even though item-specific validation succeeds. The gate
therefore enumerates names from `openspec list --json` and validates each change
explicitly until the CLI behavior is fixed upstream.

## Testing strategy

```text
structural edits
      │
      ├─ openspec validate --specs --strict
      ├─ explicit strict validation per active change
      ├─ openspec list --specs (no zero-requirement stubs)
      ├─ guard tests for documented requirement ownership
      └─ make quality / narrow docs tests
```

- Run strict validation after generating the change artifacts.
- After applying, run strict validation across the live tree.
- Confirm the four deleted stubs no longer appear in the capability list.
- Confirm Assessment and Template Studio requirement counts include normalized
  local-first and checklist sections.
- Run existing Recent Changes, assessment, migration, authorization, and
  threat-model drift tests because the specifications cite those behaviors.
- Run documentation lint and the repository quality gate.
- Validate the CI Automation target independently before deleting Peaky's copy.

## Security Considerations

This change adds no endpoint, event type, browser storage, or runtime
authorization mechanism. It documents security behavior already implemented by
sync push, pull, and SSE services.

The authorization delta is intentionally server-side:

1. Push permission is checked before fields are applied.
2. Pull scope is enforced in the database query and fails closed when empty.
3. Child entities resolve their canonical authorization root.
4. SSE subscriptions derive from actor entitlements.

The System Diagnostics extraction preserves prohibitions on local database
export, arbitrary SQL, cursor reset, and forced bootstrap. Recent Changes is
explicitly bounded operational history, not permanent audit evidence.

No threat-model facts are changed. If implementation evidence contradicts a
documented rule during cleanup, the canonical threat model decides the wording
and its drift guard must remain green.

## Risks / Trade-offs

- **History loss:** aggressive rewriting could erase valuable UX decisions.
  Mitigation: preserve scenarios, use explicit removals, and rely on archives
  and Git history rather than pointer stubs.
- **Concurrent sync deltas:** rewriting Sync Engine headers could break archive
  matching. Mitigation: defer those requirements until both active changes are
  archived.
- **Cross-repository partial move:** deleting Peaky first would orphan CI
  Automation requirements. Mitigation: target validation is a hard prerequisite.
- **Maturity terminology:** current rules do not match the future capability
  name. This is accepted because a weighted system is imminent; the spec Purpose
  continues to state both current and planned scope until replacement.
- **Application ambiguity:** applications are currently both catalog projections
  and compatibility navigation. The cleanup removes false ownership claims but
  does not prematurely delete working routes.

## Migration Plan

1. Create and validate this OpenSpec change.
2. In parallel, adopt `rtf-workflow` and imported capabilities on
   `ci-automation/docs/adopt-openspec`.
3. Delete the four invalid pointer stubs.
4. Extract System Diagnostics and Recent Changes.
5. Normalize Assessment and Template Studio headings and requirements.
6. Move Product Improvement Plan requirements to `improvement-plans`.
7. Clean Common UI and Testing requirements.
8. Reconcile domain Purpose and stale prototype wording without changing
   runtime behavior.
9. Confirm the CI Automation target copy and validation, then remove Peaky's
   migrated live spec and archive.
10. Add strict validation to the quality gate and update decision/changelog
    documentation.
11. Run validation and repository checks.

Rollback is a normal Git revert. There is no runtime or data migration.

## Open Questions

- Whether Applications remains a long-term member-facing catalog capability or
  becomes a compatibility facade can be decided separately without blocking
  structural cleanup.
- Template publish authority remains a product/architecture decision; this
  cleanup describes current behavior but does not change it.
- The active Sync Engine changes must be archived before their live requirement
  wording is reconciled.
