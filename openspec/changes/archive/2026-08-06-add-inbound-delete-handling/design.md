## Context

The sync engine's push side already sends `operation: "delete"` events with empty fields (issue #91, slices 0–5). The pull side, however, had no corresponding handling: every inbound handler treated all pulled events as upserts, regardless of `operation`. A delete event from the server would be applied as an upsert with no fields, leaving the stale row in place.

This change adds a delete branch to each of the 6 inbound handlers that manage deletable entities:

```text
Pulled event
  │
  ├─ operation = "upsert"  → existing upsert path (unchanged)
  │
  └─ operation = "delete"  → tx.delete(table).where(eq(table.id, entityId))
                              └─ localMutation.replay() records audit event
                                 with status='synced', source='peaky.sync'
```

`FieldVersionHandler` is intentionally excluded — field versions are append-only audit records, not deletable entities.

## Goals / Non-Goals

**Goals:**

- Every inbound handler that manages a deletable entity honors `operation: "delete"` by removing the row from local SQLite.
- The delete is recorded as a replayed event (same `localMutation.replay()` path as upserts), so it is marked `synced` and never re-queued.
- OpenSpec spec updated via proper change proposal workflow.

**Non-Goals:**

- Changing the push side (already done in slices 0–5).
- Adding cascade deletes beyond what each handler already manages (e.g., ProductHandler already deletes `productProfiles` + `subjects`).
- Handling delete for `field_version` events (audit records are not deletable).

## Decisions

### D1. Delete branch placement

Each handler checks `event.operation === "delete"` at the top of `handle()`, before any field parsing or entityId validation. This avoids parsing fields that don't exist on a delete event and keeps the early-return path clean.

### D2. Tables deleted per handler

| Handler | Tables deleted |
|---|---|
| ProductHandler | `product_profiles` (by `subjectId`), then `subjects` (by `id` AND `type = "product"`) |
| ReviewHandler | `reviews` (by `id`) |
| TeamHandler | `team_profiles` (by `subjectId`), then `subjects` (by `id` AND `type = "team"`) |
| ReviewAnswerHandler | `review_answer_state` (by `id`) |
| AttachmentHandler | `review_attachments` (by `id`) |
| ReviewNoteHandler | `review_note_state` (by `id`) |

Product and Team handlers delete the profile table first, then the `subjects` row, mirroring the push-side `delete()` order. The `subjects` delete carries a type guard (`and(eq(id), eq(type, "product"/"team"))`) because `subjects` is a shared table — scoping by `id` alone would let a delete event erase the wrong entity type.

### D3. Replay event type names

Each delete branch produces a distinct replay event type (`ProductDeletedSynced.v1`, `ReviewDeletedSynced.v1`, etc.) for audit traceability, consistent with the existing `*Synced.v1` naming convention used by upsert handlers.

### D4. ReviewNoteHandler identity refactor

The upsert path of `ReviewNoteHandler` was refactored in lockstep with the push side (`NoteMutations.save`). Identity (`reviewId`, `scopeType`, `scopeId`) is now parsed from the composite entity ID `reviewId:scopeType:scopeId` instead of read from the field map. Only mutable data (`content`) travels as a field. Events with a non-composite entityId (fewer than 3 colon-separated parts) are silently skipped — they are legacy events from before the composite ID format.

### D5. dispatchInboundEvent operation allow-list

`dispatchInboundEvent` now refuses operations outside the `{upsert, delete}` allow-list. Unsupported values log a warning and are skipped so a single bad event cannot block the pull cursor from advancing. This is a forward-compatibility guard — new operations can be added by extending the allow-list.

## Testing strategy

```text
LAYER               TEST                                    RUN
─────               ────                                    ───
Unit (Vitest)      6 new delete tests in inbound.test.ts   pnpm test
                   Each verifies replay() is called once
                   and the correct table(s) are deleted
                   via the tx.delete().where() mock

Repository lint    tests/guards/outbox-contract.test.ts     pnpm test
                   3 ratcheted rules: no raw insert(localOutbox)
                   outside local-mutation.ts, no create|update
                   operations, no empty fields (except delete
                   and review_checkpoint upsert whose
                   state lives in the events table)

Existing guards     outbox-contract + threat-model-drift     pnpm test
                   stay green: no new entity types,
                   operations, or caps introduced
```

The test infrastructure (`makeCaptureTx`) was extended to capture `delete().where()` calls alongside `insert().values()` calls. `runStateWrite()` now returns `{ calls, deleteCalls }`.

## Security Considerations

1. Does this add a new API endpoint or sync event type? No new wire-format sync event type — `operation: "delete"` was already defined in the push spec. Six local-only `*DeletedSynced.v1` replay event types are inserted into the events table for audit traceability, but they never traverse the network because `LocalMutation.replay()` sets `status = 'synced'`.
2. Does this store new data in the browser? No — it removes data from local SQLite.
3. Does this change who can access or modify data? No — the delete arrives through the existing pull pipeline, which is already authorized server-side.
4. Does this render user-supplied content? No.
5. Are there new `window.*` globals? No.

## Risks / Trade-offs

```text
RISK                                         MITIGATION
────                                         ──────────
A handler skips delete for a new entity      Each current handler has an explicit
type added in the future                     delete test in inbound.test.ts; add a
                                             matching test when introducing a new
                                             handler. No lint-level guard exists yet
                                             — accepted risk.
```

## Migration Plan

No migration needed. The change is purely behavioral — inbound handlers now branch on `operation`. Existing client databases are unaffected.

## Open Questions

None.
