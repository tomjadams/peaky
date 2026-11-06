## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/91>
> MR: !328

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Issue #91 already exists describing the problem
- [x] 0.3 Feature branch `fix/outbox-empty-fields` already created
- [x] 0.4 MR will be created from the branch after all slices are committed

## 1. Inbound handler delete branches

> Each handler gets a delete branch at the top of `handle()` that calls `localMutation.replay()` with a `stateWrite` that deletes from the correct table(s).
> Satisfies: MODIFIED "Outbox-Based Background Synchronization" requirement, new scenario "Inbound event handlers honor delete operations"

- [x] 1.1 ProductHandler — delete from `productProfiles` + `subjects`
- [x] 1.2 ReviewHandler — delete from `reviews` (add `eq` import)
- [x] 1.3 TeamHandler — delete from `teamProfiles` + `subjects`
- [x] 1.4 ReviewAnswerHandler — delete from `reviewAnswerState` (add `eq` import)
- [x] 1.5 AttachmentHandler — delete from `reviewAttachments` (add `eq` import)
- [x] 1.6 ReviewNoteHandler — delete from `reviewNoteState` (add `eq` import)
- [x] 1.7 ReviewNoteHandler upsert path — parse identity from composite `entityId` (`reviewId:scopeType:scopeId`) instead of field map
- [x] 1.8 `dispatchInboundEvent` — log and skip events with operations outside `{upsert, delete}`

## 2. Tests

- [x] 2.1 Extend `makeCaptureTx()` to capture `delete().where()` calls
- [x] 2.2 Update `runStateWrite()` to return `{ calls, deleteCalls }`
- [x] 2.3 Add 6 delete tests (one per handler) verifying correct table(s) deleted

## 3. OpenSpec change proposal

- [x] 3.1 Create spec delta in `openspec/changes/add-inbound-delete-handling/specs/local-first/spec.md`
- [x] 3.2 Create `design.md`
- [x] 3.3 Create `tasks.md`
- [x] 3.4 Validate change with `openspec validate --strict`

## Housekeeping

- [x] Run `make mr` — all quality gates must pass before submitting MR
- [x] Update decision log site/docs/development/decisions.md
- [x] Update Gitlab issue #91 with task completions
