# Local-First — the browser is the source of truth, not the server

> Peaky writes to a local SQLite database in the browser first and syncs to PostgreSQL in the background, so a save never waits on the network; conflicts resolve per field with Hybrid Logical Clocks, and PostgreSQL's own LISTEN/NOTIFY wakes peers in real time without ever putting domain data on the wire.

*Interactive explainer: `local-first-architecture-explainer.html` — single self-contained HTML (open in a browser; press `P` to present).*

## Slides

1. **Hero · Local-first: write here, sync in the background** — the browser is the primary source of truth for a save; the server catches up, not the user
2. **01 · The problem · Every save waits on the network** — 170–420ms round trip per save, worldwide, because the server is in the critical path of every write
3. **02 · The fixes that fail · Replication and pub-sub trade one problem for another** — multi-region databases and message buses add coordination and failure modes without moving where writes land first
4. **03 · Flip the model · Write local. Sync later.** — same product, four concerns, compared: latency, offline, conflicts, real-time — local-first wins all four the same way, by keeping the network out of the write path
5. **04 · The shape · Two processes, one shared schema** — the browser owns the write path (app/local-db, app/services/sync); the server owns durability and fan-out (services/cmd/peaky-api, peaky-sse); shared/db/schema/* is the one authority both read
6. **05 · Global sync · The write is local. The sync is a pipeline.** — write to SQLite, push in the background, resolve per field on the server, wake every entitled peer — the same four steps from any continent
7. **06 · Resilience · The client doesn't depend on the server being up** — no internet, a Postgres maintenance window, or a service restart all degrade to 'the outbox is a little behind', never to 'the app is down'
8. **07 · Conflicts & HLC · Two people, one field, at the same time** — wall-clock last-write-wins fails under clock drift; a Hybrid Logical Clock orders writes deterministically even within the same millisecond
9. **07 · Conflicts & HLC · Four scenarios, one deterministic rule** — push order never decides — a newer HLC wins regardless of arrival order, ties break on actor id, and every field resolves independently
10. **07 · Conflicts & HLC · Four protection layers** — per-field resolution, an atomic SQL WHERE clause, clock sync on pull, and a 60-second drift guard — each closes a different way the others could be defeated
11. **08 · Real-time updates · Real-time, without domain data on the wire** — PostgreSQL's own pg_notify wakes peaky-sse, which fans out a cursor pointer only — a compromised stream leaks a timestamp, nothing else
12. **09 · Peaky, end to end · One save, start to finish** — nine steps from Alice's click in Amsterdam to Bob's screen updating in Singapore — only two of them touch the network, and neither one is on Alice's critical path
13. **Guardrails · Three invariants to hold in your head** — write local first; the server resolves conflicts, not the client; SSE is an optimization, not a dependency
14. **Close · The user never waits. The server catches up.** — every layer above exists to keep that one property true

## Key facts

- Traditional round trip: Amsterdam → Singapore ~170ms one-way, Chicago → Singapore ~210ms one-way, 340–420ms perceived per save
- Local write lands in browser SQLite (WASM + OPFS) in ~1ms via LocalMutation.commit() in app/services/local-mutation.ts — state, domain event, and outbox entry in one transaction
- Background sync runs through app/services/sync/SyncEngine.ts, pushing the local_outbox table to peaky-api with adaptive retry and backoff
- Conflict resolution is per field, not per entity or per row, using a Hybrid Logical Clock: wallclock:counter:actorId, compared lexicographically
- HLC logic lives in services/internal/syncengine/conflict/conflict.go (WinsOver, ApplyFields); the atomic safety net is a SQL upsert in services/internal/syncengine/repo/queries.sql: ON CONFLICT ... WHERE EXCLUDED.hlc > field_versions.hlc OR (equal hlc AND actor_id greater)
- Client-side drift guard: app/services/sync/HLCClock.ts sets MAX_DRIFT_MS = 60000; receive() advances the local clock on every pull to stay causally current
- peaky-sse (services/cmd/peaky-sse) holds a PostgreSQL LISTEN connection and fans a cursor-pointer-only frame to entitled browsers on pg_notify; it never holds domain data, so a compromised stream leaks nothing but a timestamp
- A client without SSE still converges — it falls back to 30-second polling; SSE is an optimization, not a correctness dependency
- shared/db/schema/* (Drizzle) is the single schema authority for both the browser's SQLite database and the server's PostgreSQL database

---

<!-- assembled by .factory/skills/explainer v1.4.1 · style=editorial · theme=dark · components=[comparison,stat,ledger,before-after,contrast,filetree,stepper,flow] · source=explainers/_sources/local-first-architecture.html · motion=motion-12.23.26.min.js -->
