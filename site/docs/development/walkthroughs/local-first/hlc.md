# HLC — Hybrid Logical Clock

This page explains the HLC implementation end-to-end: why it exists, how the wire format works, the four protection layers that prevent data loss, and where each piece lives in the codebase.

## Why HLC

Two users edit the same review question at the same time. Without a conflict resolution strategy, one update silently overwrites the other. A wall clock alone is unreliable — client clocks drift, VMs resume with stale time, and timezone bugs are common.

HLC solves this by combining a physical wall clock with a logical counter. The counter increments when events happen within the same millisecond, guaranteeing a total order even when clocks are imprecise. An actor ID breaks ties deterministically when two nodes produce identical timestamps.

## Wire format

```text
"1716220800000:0001:actor_alice"
 ─────────────  ────  ───────────
   wallclock    counter  actorId
   (Unix ms)   (zero-padded)
```

Three colon-separated parts. Comparison is purely lexicographic on the full string — no integer parsing needed at comparison time. This makes the format resistant to malformed input and fast to compare.

The server stores HLC in two columns: `hlc` as `"wallclock:counter"` and `actor_id` separately. This saves ~50% per row while preserving the full wire format for debugging.

## Four protection layers

Each layer catches a class of bug the others cannot:

```text
                  What could go wrong?

  1. Wrong field wins         (conflict resolution logic)
  2. Concurrent SQL race      (two pushes hit the same row)
  3. Client clock behind      (slow client loses every conflict)
  4. Client clock far ahead   (fast client poisons all peers)

                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
  ┌─────────────┐ ┌───────────┐ ┌───────────────┐
  │ Go conflict │ │ SQL WHERE │ │ Client HLC    │
  │ resolution  │ │ clause    │ │ receive()     │
  │             │ │           │ │               │
  │ Per-field   │ │ Atomic    │ │ Clock sync    │
  │ accept /    │ │ upsert    │ │ + jump guard  │
  │ reject      │ │ safety    │ │ (60s max)     │
  │             │ │ net       │ │               │
  │ Server Go   │ │ Server PG │ │ Client TS     │
  └─────────────┘ └───────────┘ └───────────────┘
```

### Layer 1 — Field-level conflict resolution (Go)

The server compares each pushed field independently. Alice's answer and Bob's naReason are separate fields with separate HLCs — one can win while the other loses.

```text
Alice pushes:  answer = "yes"   hlc = 1000   ← wins (newer)
               naReason = null  hlc = 1000   ← no conflict

Bob pushes:    answer = "no"    hlc = 900    ← rejected (older)
               naReason = "…"   hlc = 1100   ← wins (newer, independent field)

Result:  answer = "yes" (Alice)   naReason = "…" (Bob)
```

Entity-level last-writer-wins would have rejected Bob's entire push, losing the naReason update silently.

Where: `services/internal/syncengine/conflict/conflict.go`

### Layer 2 — Atomic SQL upsert (PostgreSQL)

The Go layer does a pre-flight HLC check to produce accurate accept/reject responses, but a race window exists between the read and write. The SQL WHERE clause is the authoritative safety net:

```sql
ON CONFLICT (entity_type, entity_id, field_name)
DO UPDATE SET ...
WHERE EXCLUDED.hlc > field_versions.hlc
   OR (EXCLUDED.hlc = field_versions.hlc
       AND EXCLUDED.actor_id > field_versions.actor_id)
```

If two pushes arrive concurrently for the same field, PostgreSQL guarantees only the newer HLC survives. The Go layer's accept/reject response may be slightly inaccurate in the race window, but the data is always correct.

This was validated by a PG integration test that runs 20 goroutines pushing to the same field — the newest HLC always wins regardless of arrival order.

Where: `services/internal/syncengine/repo/queries.sql` (UpsertFieldVersion)

### Layer 3 — Clock synchronisation on pull (TypeScript)

After each pull, the client calls `HLCClock.receive()` for every field HLC in the response. This advances the local clock to be causally after all observed remote timestamps:

```text
Before receive():
  Alice's clock:  wallclock = 1000
  Bob's field:    wallclock = 1010

  Alice's next now() would produce ~1000
  → loses to Bob on every conflict, even if Alice writes later

After receive():
  Alice's clock:  wallclock = max(1000, 1010, Date.now()) = 1010
  Alice's next now() produces > 1010
  → correctly wins if she writes after Bob
```

Without this, a client with a slower system clock generates timestamps that lose every conflict against faster peers — correct by HLC rules, but wrong by real-world causality.

Where: `app/services/sync/HLCClock.ts` (receive method), called from `app/services/sync/SyncEngine.ts` (pullChanges)

### Layer 4 — Jump clock guard (TypeScript)

The receive method rejects any remote HLC whose wallclock is more than 60 seconds ahead of local time:

```text
  Local time:   1700000000000
  Remote HLC:   1700000090000:0001:actor_evil   (90s ahead)
                ─────────────
                > 60s drift → rejected

  Local clock is NOT advanced. The poisoned timestamp
  cannot propagate through this client to the server.
```

Without this guard, a single client with a misconfigured clock (NTP drift, VM resume, timezone bug) stamps everything far in the future. Those timestamps win every conflict on the server for the duration of the skew, effectively making one user's writes override everyone else's.

The guard is cooperative, not adversarial — in a trusted-user tool, the risk is accidental misconfiguration, not intentional attack.

Where: `app/services/sync/HLCClock.ts` (receive method, MAX_DRIFT_MS constant)

### Counter overflow guard (Go + TypeScript)

The counter is zero-padded to 4 digits for lexicographic sort. If 10,000 events occur within a single millisecond, `"10000"` is 5 digits and breaks the sort assumption (`"10000" < "9999"` lexicographically).

The fix: when counter reaches 10,000, advance the wallclock by 1ms and reset the counter to 0. This preserves monotonicity without changing the wire format.

In practice, 10,000 writes per millisecond is nearly impossible through normal UI interaction. The guard exists for programmatic clients or bugs that freeze the wallclock.

Found by fuzz testing — see the testing strategy section below.

Where: `services/internal/syncengine/conflict/conflict.go` (Generate function)

## How the layers compose

```text
User writes a field
      │
      ▼
  HLCClock.now()              ← monotonic local timestamp
      │
      ▼
  draft() → SQLite outbox     ← local-first, instant
      │
      ▼
  SyncEngine.pushChanges()    ← POST /api/sync/push
      │
      ▼
  Go conflict resolution      ← Layer 1: per-field accept/reject
      │
      ▼
  SQL upsert with WHERE       ← Layer 2: atomic safety net
      │
      ▼
  pg_notify → SSE → peers     ← cursor pointer only
      │
      ▼
  Peer pulls events
      │
      ▼
  HLCClock.receive()          ← Layer 3: advance clock
      │                         Layer 4: reject if >60s ahead
      ▼
  Peer's next now() is
  causally after all
  observed events
```

## Testing

The HLC implementation has dedicated correctness tests at every layer:

| Layer | Test type | What it proves |
|-------|-----------|----------------|
| Go conflict resolution | Unit (77 tests) | Per-field accept/reject logic, tiebreakers |
| Go conflict resolution | Property (6 tests) | Transitivity, antisymmetry, determinism |
| Go HLC parser | Fuzz (4 targets) | No panics or garbage on hostile input |
| SQL upsert atomicity | PG integration (12 tests) | Concurrent pushes — newest HLC always survives |
| Client receive() | Unit (6 tests) | Clock advancement, jump rejection, counter merge |
| Client now() | Unit (6 tests) | Monotonicity, counter reset, zero-padding |

The fuzz tests found two real bugs before merge: counter overflow past 9999 and empty-segment parsing. Both are now fixed with regression cases in the corpus.

## Codebase map

| Concern | Location |
|---------|----------|
| Client HLC clock (now, receive, parse, compare) | `app/services/sync/HLCClock.ts` |
| Client clock singleton | `app/services/sync/syncClock.ts` |
| Client receive() call site | `app/services/sync/SyncEngine.ts` (pullChanges) |
| Client field stamping | `app/services/entity/AnswerMutations.ts`, `NoteMutations.ts` |
| Server HLC (parse, compare, generate, winsOver) | `services/internal/syncengine/conflict/conflict.go` |
| Server conflict resolution | `services/internal/syncengine/conflict/conflict.go` (ApplyFields) |
| SQL upsert with WHERE clause | `services/internal/syncengine/repo/queries.sql` |
| Fuzz tests | `services/internal/syncengine/conflict/hlc_fuzz_test.go` |
| Property tests | `services/internal/syncengine/conflict/conflict_property_test.go` |
| PG integration tests | `services/internal/syncengine/repo/postgres_integration_test.go` |
| Client HLC tests | `tests/unit/services/sync/HLCClock.test.ts` |
