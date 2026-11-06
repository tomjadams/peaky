# SSE family catalog channels design

## Context

The SSE fan-out is the "doorbell" that tells a connected browser to pull immediately instead of waiting for the 30s poll. It uses PostgreSQL LISTEN/NOTIFY, which is exact-match only (no wildcard patterns). Today the subscription side and the notification side derive channel names from different taxonomies, so the doorbell silently never rings for affected actors and sync degrades to polling.

The full audit, the agreed contract, and the proof obligations live in `formal_verification/sync/sse_gap_register.md` and are formalised in `formal_verification/sync/sse_channel_alignment.fizz` (invariants I1–I7, reported Correct by the FizzBee runner). This change encodes that same contract in OpenSpec so the four code layers can conform to it.

Current state (the gaps this change closes):

- **GAP-1** LISTEN keys on the entitlement family (`sync:review:…`); NOTIFY keys on the resolved subject (`sync:team:<id>`). For reviews these never align.
- **GAP-2** Wildcard entitlements become `LISTEN "sync:review:*"`; PG treats `*` literally, so the subscription matches nothing.
- **GAP-3** `notifySSE` returns after the first subject, so a multi-family batch wakes only one channel.
- **GAP-4** NOTIFY only fires for reviews; product/template changes emit nothing.
- **GAP-5/6** The payload is duplicated across four structs and carries a per-subject hint.
- **GAP-9** A partially accepted event is persisted but classified as `rejected`, so `notifySSE` (which walks only the `accepted` set) rings no doorbell.

## Goals / Non-Goals

**Goals:**

- One channel taxonomy for both LISTEN and NOTIFY: `sync:{family}:catalog`, `family ∈ {review, product, template}`.
- Wildcard and specific entitlements collapse to the same family channel; no literal `*` ever reaches `LISTEN`.
- All synced families notify; notifications dedup per family per batch.
- Partially accepted events notify their family channel (any persisted change rings the doorbell).
- Payload `{ cursor, family }` with a single shared Go type and matching TS type; no domain data on the wire.

**Non-Goals:**

- The client per-subject indicator rework (GAP-8) is a downstream UX decision tracked separately; this change only fixes the payload shape it consumes.
- No change to the conflict-resolution / HLC semantics themselves (that contract lives in `sync_engine_push_pull.fizz`).
- No change to entitlements, auth, or the `/pull` endpoint's authorization model.

## Decisions

**1. Family catalog channel as the single routing key.** Both sides derive `sync:{family}:catalog`.

```text
BEFORE (diverging taxonomies)
  LISTEN  sync:review:*            (wildcard, matches nothing)   ← GAP-2
  LISTEN  sync:team:<id>           (per subject)                 ← GAP-1
  NOTIFY  sync:team:<id>           (resolved owning subject)     ← GAP-1
  NOTIFY  (reviews only)                                         ← GAP-4

AFTER (one family catalog taxonomy)
  entitlement key  ──family before ":"──►  sync:{family}:catalog   (LISTEN)
  accepted event   ──entity.Family(type)─►  sync:{family}:catalog   (NOTIFY)
  review:*  and  review:review-001  ──►  sync:review:catalog        (no "*")
```

**2. Notify trigger is "persisted", not "fully accepted".** `notifySSE` must emit for every event that persisted a change, including partial accepts. A wholly rejected event (nothing persisted) stays silent.

```text
FULLY ACCEPTED   all fields win   → persisted → NOTIFY sync:{family}:catalog
PARTIAL          some win/lose    → persisted → NOTIFY sync:{family}:catalog   (GAP-9 fix)
FULLY REJECTED   all fields lose  → not saved → no NOTIFY
```

**3. Dedup per distinct family across the whole batch.** Collect the distinct family channels for all persisted events in the batch, then emit one `pg_notify` per channel (replacing the early `return`).

**4. Single payload type.** Replace the three duplicated Go structs and the anonymous struct with one `{ cursor, family }` type, mirrored by one TS type the client parses.

## Testing strategy

```text
unit (Go) — fast, no DB
  ├─ channel derivation: review:* and review:review-001 → sync:review:catalog; assert no "*"
  ├─ entity.Family(entityType) → family for review/product/template
  ├─ notifySSE: full accept   → 1 notify on family channel
  ├─ notifySSE: partial accept→ 1 notify on family channel        (GAP-9)
  ├─ notifySSE: full reject   → 0 notify
  ├─ notifySSE: 2 events same family → 1 notify (dedup)
  └─ notifySSE: 2 families    → 1 notify each
alignment (Go) — fast, no DB
  └─ a review:* actor's LISTEN set contains the exact channel a review push notifies
integration (Go, local Postgres — `go test -tags integration`, via `make test:go:integration`)
  ├─ real pg_notify round-trip: an accepted review push emits exactly one frame
  │  to a connection LISTENing on sync:review:catalog
  ├─ partial-accept push still delivers a frame (GAP-9); full-reject delivers none
  └─ a product push reaches sync:product:catalog only (not review)
     (lives beside services/internal/syncengine/repo/postgres_integration_test.go,
      which already exercises pg_notify)
contract (TS) — unit
  └─ client parses { cursor, family } and triggers pullChanges()
```

The FizzBee model (`sse_channel_alignment.fizz`) is the source of truth for the invariants; each unit and integration test is the conformance counterpart of an invariant (see the traceability matrix in the gap register).

### Manual verification (local Postgres)

This change must be verifiable by hand against a real database, not only in automated tests. Bring the stack up with `make watch` (postgres on `5432`, api on `3001`, sse on `3002`), then:

```bash
# 1. Watch the family channel directly in PostgreSQL (proves NOTIFY fires there)
PGPASSWORD=peaky psql -h localhost -p 5432 -U peaky -d peaky \
  -c 'LISTEN "sync:review:catalog";' -c "SELECT pg_sleep(120);"

# ...or observe it as a browser would, on the SSE service (port 3002)
curl -N -H 'x-actor-id: actor_alice' http://localhost:3002/api/sse/events

# 2. In another shell, push an accepted review event as an entitled actor
#    (see services/internal/syncengine/handler_test.go for the exact push body shape)
curl -s -X POST http://localhost:3001/api/sync/push \
  -H 'x-actor-id: actor_alice' -H 'content-type: application/json' \
  -d '{ "events": [ /* one accepted review field event */ ] }'

# 3. Inspect persisted server state
PGPASSWORD=peaky psql -h localhost -p 5432 -U peaky -d peaky \
  -c 'SELECT id, entity_type, entity_id, actor_id, pushed_at FROM events ORDER BY pushed_at DESC LIMIT 5;'
PGPASSWORD=peaky psql -h localhost -p 5432 -U peaky -d peaky \
  -c 'SELECT * FROM field_versions ORDER BY hlc DESC LIMIT 10;'
```

Confirm by hand:

- a `review:*` (wildcard) actor receives one frame per accepted review batch on `sync:review:catalog`;
- a product push wakes `sync:product:catalog` listeners only, never review;
- a partial-accept push (some fields conflict) still delivers a frame (GAP-9);
- the frame body is `{ cursor, family }` with no domain data.

## Security Considerations

1. **New endpoint / event type?** No new endpoint. The payload shape changes to `{ cursor, family }`; it carries no domain data, so there is nothing sensitive to validate on the SSE frame itself.
2. **New browser-stored data?** No. The cursor already lives in SQLite; `family` is a non-sensitive routing marker.
3. **Who can access/modify data?** Unchanged. Over-notification is intentional and safe: the SSE frame is a content-free doorbell, and the entitlement-scoped `/pull` remains the authorization boundary. An actor woken for a family it cannot fully view still only receives entitled rows on pull.
4. **Renders user content?** No.
5. **New `window.*` globals?** No.

## Risks / Trade-offs

- **Over-notification.** Family channels are coarser than per-subject, so an actor may be woken for a family change they ultimately cannot view a specific row of. Accepted: the frame carries no data and pull re-filters. This is the explicit trade-off in the contract.
- **Coordinated deploy.** Payload shape changes across server and client; the client must tolerate the new shape. Mitigated because the client already falls back to 30s polling if a frame is unparseable.

## Migration Plan

1. Land the contract (this change: formal model + OpenSpec) ahead of code.
2. Implement layer by layer with tests (Step 5): NOTIFY (`push.go` family derivation, dedup, partial), LISTEN (`handler.go` family collapse), payload unification, client parse.
3. Fix the stale `cmd/peaky-sse/main.go` package comment alongside the code change.
4. Rework the client indicator (GAP-8) as a separate follow-up.
5. Rollback is trivial: SSE is a latency optimisation; disabling it degrades to 30s polling with no data-correctness impact.

## Open Questions

- GAP-8: should the family-scoped client indicator say "a review changed" or be dropped entirely? Deferred to a UX decision.
