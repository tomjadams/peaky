# STRIDE Threat Model — Peaky Local-First Sync

> Everything inside the browser — OPFS SQLite, the cached entitlement snapshot, every UI gate — is untrusted; the sync push is the only place Peaky enforces anything for synced data, but it is not the only place Peaky writes — a line-by-line audit of this deck's own mitigation claims cut them from 20 to 11 and raised the open ledger from 21 to 29, including 23 Nitro write routes that were never retired.

*Interactive explainer: `stride-threat-model-explainer.html` — single self-contained HTML (open in a browser; press `P` to present).*

## Slides

1. **Hero · The browser is untrusted; the sync push is the boundary** — 11 behaviours are closed by architecture; 29 stay open, 7 of them HIGH — and the audit that produced those numbers deleted 9 claims this deck used to make
2. **01 · Trust boundary · The browser is entirely untrusted** — OPFS SQLite, the entitlement snapshot, and every UI gate are DevTools-readable and DevTools-editable — for synced data the Go sync engine is the only enforcement point
3. **01 · Trust boundary · Walk the data flow** — a field edit crosses the boundary at POST /api/sync/push carrying the x-actor-id header — an unrecognized value isn't rejected, it becomes a wildcard-entitled actor_dev
4. **02 · Closed by architecture · What survived the audit** — 11 behaviours the shape of this system closes with no threat-specific code — down from 20, after every claim was checked against the code it describes
5. **02 · Closed by architecture · Spoofing & tampering — 3 rows** — PKCE state validation, a single-statement guarded upsert, and hard batch caps — the session-cookie and CSRF claims did not survive
6. **02 · Closed by architecture · Repudiation & disclosure — 4 rows** — SaveEvent() stamps a server-side actor on every event row, SSE carries {cursor, family} only, and pull filters entitlements in SQL
7. **02 · Closed by architecture · Availability & privilege — 4 rows** — one pg_notify per family per batch, jittered backoff on both gates, and per-event CanEdit that ignores the client's cached snapshot
8. **03 · Active threats · 29 threats still open** — grouped by risk; the audit added 8 rows the deck had been publishing as mitigations
9. **03 · Active threats · HIGH — 7 tracked** — four trace to the unverified actor headers; the other three are an unvalidated HLC that wins conflicts forever, 23 Nitro write routes that were never retired, and an unauthenticated directory mirror
10. **03 · Active threats · MEDIUM — 9 tracked** — non-atomic state-and-audit writes, no session revocation, stale entitlement registries, and a Vercel-specific debug-globals gate
11. **03 · Active threats · LOW — 13 tracked** — CSRF resting on one attribute, quota and rate-limit gaps, a hardcoded fallback admin, and narrower offline coverage than local-first implies
12. **03 · Active threats · Phase 3 deletes the header path** — services/internal/middleware/actor.go swaps header trust for a verified JWT, and the AuthZ engine landing beside it turns test roles into seeded policy data — so the fallback and the roles header are removed outright, not worked around
13. **04 · Roadmap · Why these wait, not whether** — Cedar, JWT, and an idempotency key are what the scheduled gaps wait on — but three now sit in an Unscheduled tier, waiting on a decision rather than a dependency
14. **04 · Roadmap · The facts announce themselves** — a marked doc line, a test that ties it to the code, and a pre-commit hook that fails the commit before it lands — the mechanical facts held; the prose, which nothing pins, is what rotted
15. **05 · Security review checklist · Before this ships** — 12 items, saved locally as they're reviewed — deployment contracts, plus the three code decisions the audit forced

## Key facts

- POST /api/sync/push is the only server-side enforcement point for synced data; the browser (OPFS SQLite, the entitlement snapshot cache, every UI gate) is entirely untrusted and DevTools-editable.
- It is not the only write surface. 23 write routes still ship under Nitro's server/api/: 9 have no authentication or authorization at all, and 2 authorize from an actor object in the request body that defaults to admin-001 with the admin role. They mutate in-process state, not the Postgres system of record — but that state is what the local-first fallback reads.
- 11 behaviours are closed by architecture, not 20. A line-by-line audit on 29 Jul 2026 found 9 of the deck's 20 mitigation claims were wrong: the CSRF and session-cookie rows both assumed there is no session cookie (there is — sealed, HttpOnly peaky_auth, SameSite=Lax), and the 'one sync funnel replaced 20+ write endpoints' row described endpoints that were never removed.
- 29 active threats are tracked (7 HIGH, 9 MEDIUM, 13 LOW). Four HIGH threats stem from Phase 1 trusting the x-actor-id / x-actor-roles headers; the other three were found by the audit.
- The per-field HLC that decides every conflict is never validated. ParseWire() does not require wallclock to be numeric and WinsOver() compares lexicographically, so a client sending a valid pushedAt with hlc = "zzzzzzzz:9999:actor_x" wins every future conflict on that field, permanently. The 30-second future check applies to pushedAt, a different field.
- State and audit are not written atomically server-side: field_versions is committed one autocommit per field before SaveEvent()'s transaction opens, so a mid-event failure leaves live field values with no events row, no pg_notify, and the event reported to the client as rejected.
- Phase 3 replaces header-based identity with Okta JWT validation in one file, services/internal/middleware/actor.go, and lands the AuthZ engine beside it: test roles become seeded policy data, so the actor_dev fallback and the x-actor-roles header are deleted outright and all four header-trust HIGH threats cease to exist rather than being mitigated.
- Until Phase 3 ships, the reverse proxy / Lambda Web Adapter must strip x-actor-roles and re-inject x-actor-id from the session — a deployment contract, not something enforced in code today.
- Eight FizzBee specs in formal_verification/ formally verify sync/SSE invariants several mitigations rely on — pull-side entitlement scoping, content-free SSE frames, push idempotency, and more — but none run in CI yet (issue #29) and every spec assumes an honest, already-identified client.
- The drift guard is why the mechanical facts held while the prose rotted: it pins paths, caps, and entity types and fails the commit on the author's own machine, but it only asserts that this deck's files exist — no claim on this page was checked until the audit.

---

<!-- assembled by .factory/skills/explainer v2.1.6 · style=editorial · theme=dark · components=[ledger,stat,before-after] · source=explainers/_sources/stride-threat-model.html · motion=motion-12.23.26.min.js -->
