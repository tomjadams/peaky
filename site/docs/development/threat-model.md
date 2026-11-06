# Threat Model — STRIDE

This is the canonical record of Peaky's security posture: what enforces what, what is formally proven, and which risks are open, accepted, or scheduled. It is a reference, not a tutorial — the [local-first security walkthrough](./walkthroughs/local-first/security) teaches *why* the model looks like this, and the interactive deck at `explainers/stride-threat-model-explainer.html` presents it.

Facts on this page and in the walkthrough that can be checked mechanically — file paths, entity types, caps and limits — are enforced by `tests/guards/threat-model-drift.test.ts` in the fast vitest suite. If you change a constant either document cites, that guard fails and points you back here.

Vulnerability reporting is covered in the repository root `SECURITY.md`.

---

## 1. STRIDE at a glance

STRIDE classifies a threat by the security property it violates. Every ledger row below carries its letter, and the deck uses the same tags. *Closed* means the shape of the system closes the threat with no threat-specific code; *open* means it is live today, whether accepted, scheduled, or not yet scheduled (7 HIGH, 14 MEDIUM, 13 LOW).

| Letter | Category | Property violated | What it means here | [Threats closed](#4-closed-by-architecture) | [Threats open](#6-known-gaps) |
|---|---|---|---|---|---|
| **S** | Spoofing | Authentication | Acting as another actor — a forged `x-actor-id`, a stolen session cookie | 1 | 5 |
| **T** | Tampering | Integrity | Changing data in flight or at rest — the OPFS file, an HLC, a field value | 3 | 13 |
| **R** | Repudiation | Non-repudiation | A mutation with no trustworthy actor on record | 1 | 4 |
| **I** | Information disclosure | Confidentiality | Reading data an actor is not entitled to see | 3 | 5 |
| **D** | Denial of service | Availability | Exhausting a resource, or losing work, until the system stops serving | 2 | 4 |
| **E** | Elevation of privilege | Authorization | Gaining an entitlement that was never granted | 2 | 3 |
| | **Total** | | | **12** | **34** |

`tests/guards/threat-model-drift.test.ts` counts the ledger rows and fails if this table disagrees with them, so the totals cannot drift from the sections they summarise. It cannot check whether a row's *claim* is still true — that takes an audit, last done 29 Jul 2026.

---

## 2. Trust boundary

The browser is untrusted: OPFS SQLite holds replicated, cached, and locally authored state, the entitlement snapshot is a cache, and every UI gate is DevTools-editable. For **synced** data the server is the only enforcement point, and that means `services/`: push events are validated and authorized per event in `services/internal/syncengine/push.go`, pull is the disclosure boundary in `services/internal/syncengine/pull.go`, and SSE is a content-free doorbell.

That scope is deliberate: the sync path is not the app's only write surface. 19 write routes remain under Nitro's `server/api/`, 8 of them unauthenticated, and they mutate in-process state rather than the Postgres system of record — a tampering and audit-forgery surface tracked as a HIGH row under [Known gaps](#6-known-gaps). Four additional Template mutation-shaped routes are write-free boundaries that return HTTP 503 before reads or writes. The [walkthrough](./walkthroughs/local-first/security) develops the boundary with diagrams and attack narratives; [authentication](./authentication) covers the Okta login flow itself.

---

## 3. The security stack

### Runtime (nuxt-security module)

| Protection | Value |
|---|---|
| Content-Security-Policy | `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` |
| HSTS | 1 year, includeSubdomains |
| X-Frame-Options / frame-ancestors | DENY / `'none'` |
| Rate limiting | `500` req/min<!-- drift:tokensPerInterval --> — high enough for parallel E2E runs, low enough to slow brute force |
| Request size | `2` MB body<!-- drift:maxRequestSizeInBytes -->, `10` MB uploads<!-- drift:maxUploadFileRequestInBytes --> |
| XSS validation | Enabled |
| Cross-origin isolation | COOP + COEP + CORP (required for OPFS; deliberate functional requirements, not accidental relaxations) |

### Session and identity (Nuxt)

The browser never talks to the Go services with a bearer token today; identity lives in the Nuxt session layer:

| Control | Where |
|---|---|
| OIDC ID-token verification (remote JWKS, audience check) | `server/utils/auth/okta.ts` — `validateIdToken()` |
| Fail-closed actor resolution: sealed session first, 401 in production without one; `x-actor-*` fallback only when OIDC is intentionally unset (dev, tests, E2E) | `server/utils/lifecycleActor.ts` — `getLifecycleActor()` |
| Sealed HttpOnly session cookie (`peaky_auth`, 24h, `secure` in prod, `sameSite: lax`) | `server/utils/auth/session.ts` |
| Cookie stays under the ~4KB ceiling by dropping optional claims in order | `server/utils/auth/cookie-budget.ts` |
| `id_token` kept server-only, never returned to the client | `server/utils/auth/session.ts` |
| OIDC debug route (returns raw token) double-gated: non-production **and** `NUXT_OIDC_AUTH_DEBUG=1` | `server/api/_auth/debug.get.ts`, `server/utils/auth/debug-gate.ts` — flagged in-code for deletion once the OIDC contract settles |

Secrets (`oidcOktaPrivateKey`, `oidcSessionSecret`, …) live in private `runtimeConfig`; the public bundle exposes `testHelpersEnabled`, `oidcEnabled`, and `runtimeConfig.public.templatePublishingEnabled`<!-- drift:template-publishing-public-config -->. The publication value is not a secret or an authorization decision.

### Input validation

| Endpoint | Validation |
|---|---|
| `POST /api/sync/push` (proxied to `peaky-api`) | Go struct decode + entity registry check + operation whitelist + root resolution + pushedAt future-bypass check + batch/field caps — see the [walkthrough](./walkthroughs/local-first/security) for the full list with values |
| `GET /api/sse/events` (`peaky-sse`) | Actor middleware + `entitlementChannels()`; 403 when no entitled channels |
| Template create / update / publish / delete routes | HTTP 503 + `template_write_unavailable` before domain-state access; the delete boundary also keeps archive, restore, whole-draft deletion, and permanent deletion unavailable<!-- drift:template-write-freeze --> |
| `POST /api/products` | Zod schema |
| `POST /api/products/:id/reviews` | Zod schema |
| `POST /api/teams/:id/reviews` | Zod schema |

This lists the validated endpoints, **not** all of them — the remaining Nitro write routes have no schema validation, and some no authentication. See the HIGH row under [Known gaps](#6-known-gaps).

### Authorization enforcement

Cedar is the planned authorization engine; it has **not shipped**. Today's authorizer is a flat JSON registry loaded at startup — which means entitlement changes require a redeploy, and there is no dynamic revocation path.

| Check | Where |
|---|---|
| Per-event entitlement re-check on push | `services/internal/syncengine/push.go` — `authz.CanEdit()` per event |
| Entitlement-scoped pull (the disclosure boundary) | `services/internal/syncengine/pull.go` |
| Child entities gate on their parent resource (`review_answer` → `review`, `template_draft*` → `template`) | `services/internal/authz/resource.go` |
| Actor registry (the Cedar integration point) | `services/internal/authz/registry.go` + `services/seed/actors.json` |
| Template owner-Team selection | New local creation checks only that `ownerTeamId` exists in the last persisted `directory_groups` snapshot; it does not verify actor membership and grants no edit or lifecycle permission |
| Review content access | `server/api/reviews/[id]/workspace.get.ts` requires a sealed authenticated actor before returning in-memory demo data, but does not enforce participant scope; mutation routes that use `server/utils/reviewContentAccess.ts` still require a participant, owner, or admin |
| Admin events access | `server/api/admin/events.get.ts` / `server/api/admin/events/stream.get.ts` — admin role only |
| Permanent delete: archived-status precondition (409 otherwise) | `server/api/reviews/[id].delete.ts` — but its admin check reads the actor from the request body; see the HIGH row under [Known gaps](#6-known-gaps) |

### Test-helper exposure control

| Global | Guard | File |
|---|---|---|
| `window.peakyDB` | `runtimeConfig.public.testHelpersEnabled` | `app/plugins/local-db.client.ts` |
| `window.__peakySeed` | `runtimeConfig.public.testHelpersEnabled` | `app/plugins/test-seed.client.ts` |

Enabled in dev and previews, disabled only when `VERCEL_ENV=production`. This is deliberate: preview deployments intentionally expose these globals for E2E and must not be treated as a production trust boundary.

### Template remote-authority and publication freeze

`NUXT_TEMPLATE_PUBLISHING_ENABLED` is strictly parsed once, defaults to false, and is copied to matching private and public runtime values. `server/plugins/template-publishing-config.ts` rejects startup if runtime overrides make them disagree. The public value is deliberately browser-visible configuration reserved for future rollout UX, not a secret, authorization decision, or current UI/write-enable switch. No current Template control consumes it, and setting it to true before authoritative publication ships changes no client or Nitro write behavior.

Nitro exposes deterministic catalog and published-fixture reads only; those projections are not a remote Template authority. The four mutation-shaped Nitro routes for create, update, publication, and deletion return HTTP 503 with `template_write_unavailable` before Template, Revision, fixture, event, outbox, or timestamp writes. Remote client-service calls for create/update, archive, restore, whole-draft deletion, and permanent deletion fail before network or optimistic mutation. The schema can represent `active | archived`, but no user-created Template lifecycle transition is currently available and management renders no lifecycle or deletion controls.

### Bounded destructive Preview reset

SQLite migration `shared/db/migrations/sqlite/0016_template_revisions.sql` and PostgreSQL Goose migration `services/internal/dbmigrate/migrations/008_template_revisions.sql` perform an intentional one-time Template/Review reset<!-- drift:template-review-preview-reset -->. They delete the enumerated Template/Review domain and provenance rows plus matching outbox, pending-queue, field-version, field-history, and event records where those operational tables exist. Event cleanup also removes every row correlated through a non-null `review_id`, regardless of event or entity type. SQLite invalidates entitlement snapshots. Product, Team, catalog-directory, cursor, migration-log, unrelated domain/history rows, and unrelated events with a null `review_id` remain.

This is a bounded exception to ordinary append-only audit retention, not permission for runtime deletion to erase audit history. The migrations do not preserve legacy Template or Review data, and their rollback paths recreate old shapes empty rather than recovering deleted data.

---

## 4. Closed by architecture

These behaviours would need threat-specific code in a server-rendered app; here they are closed by where the data and the decisions live.

| | Threat | Why it is closed | Where |
|---|---|---|---|
| **S** | OAuth2 redirect / code interception | PKCE verifier and `state` live in a sealed HttpOnly flow cookie (10 min TTL); `state` mismatch is a 400, the cookie is cleared before token exchange, and the stored redirect is open-redirect-guarded | `server/utils/auth/flow.ts`, `server/routes/auth/okta/callback.get.ts` |
| **T** | Concurrent-push field races | The durable write is a single guarded upsert — `ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE ... WHERE EXCLUDED.hlc > field_versions.hlc OR (EXCLUDED.hlc = field_versions.hlc AND EXCLUDED.actor_id > field_versions.actor_id)` — so state converges on the highest (HLC, actor) regardless of arrival order. Caveat: the accept/reject the client is *told* comes from an earlier non-transactional read and can disagree with the stored winner under concurrency | `services/internal/syncengine/repo/queries.sql` |
| **T** | Unbounded batch payloads | Batch and field caps are checked before any storage write; the batch cap fails the whole request, the field cap fails only the offending event | `services/internal/syncengine/push.go` |
| **T** | Remote Template fixture mutation or publication-gate drift | All mutation-shaped routes return one centralized 503 before state access; private/public rollout values derive from one source and a Nitro startup guard rejects disagreement | `server/utils/templateWriteUnavailable.ts`, `server/plugins/template-publishing-config.ts`, `shared/config/template-publishing.ts` |
| **R** | Event rows with no actor | `SaveEvent()` writes each event and its field history in one transaction, stamping `actor_id` from the server-side request context; the client's `actorId` field is never read, and `events.actor_id` is `NOT NULL`. Caveat: that transaction does not cover the `field_versions` state write — a MEDIUM gap below | `services/internal/syncengine/repo/postgres.go` |
| **I** | SSE payload leakage | The wire payload is `{ cursor, family }` and nothing else; the only `pg_notify` producer is `notifySSE`, there are no NOTIFY triggers in SQL, and the hub forwards the payload verbatim. The fixed payload cannot approach `pg_notify`'s 8KB limit | `services/internal/ssecontract/ssecontract.go`, `services/internal/sse/hub.go` |
| **I** | Broad pull overfetch | Entitlement IDs are bound parameters in the `events` `WHERE` clause on `(root_type, root_id)`, so unentitled rows never leave the database; an empty scope returns zero events (explicit fail-closed) | `services/internal/syncengine/pull.go`, `services/internal/syncengine/repo/postgres.go` |
| **I** | Debug globals reachable in production | `runtimeConfig.public.testHelpersEnabled` — not `import.meta.dev` — gates `window.peakyDB` and `window.__peakySeed`. Caveat: that flag is `VERCEL_ENV !== "production"`, a provider-specific build-time gate — a MEDIUM gap below | `app/plugins/local-db.client.ts`, `app/plugins/test-seed.client.ts` |
| **D** | SSE flooding | Push emits at most one `pg_notify` per distinct entity family (`review`, `product`, `template`) *after* the whole batch — never per event or per field — so notification volume tracks batches, not data size | `services/internal/syncengine/push.go` |
| **D** | Reconnect storms after a restart | Two independent `BackoffGate` instances give SSE reconnect and sync polling separate exponential backoff with 50–100% jitter, so failed clients retry at spread-out times | `app/services/sync/BackoffGate.ts`, `app/composables/sync/useSseClient.ts` |
| **E** | Body-supplied actor on push | The push handler never reads the `actorId` in the request body; every authz check, event row, and cursor write uses the middleware-resolved actor | `services/internal/syncengine/push.go` |
| **E** | Client-side entitlement enforcement | `CanEdit()` is re-checked inside the per-event loop regardless of the client's cached snapshot, rejection is per event, and an authorizer error fails closed | `services/internal/syncengine/push.go` |

---

## 5. What formal verification buys the threat model

`formal_verification/` holds FizzBee specs that exhaustively model-check the invariants several mitigations rely on. Run them with `make verify` (all specs) or `make verify/<dir>/<spec>`; `make verify-mbt` replays model-generated action sequences against the real `app/services/sync/ConcurrencyController.ts`. The full index lives in the [formal verification walkthrough](./walkthroughs/formal-verification).

The security-relevant properties, in STRIDE terms:

| Spec | Property | STRIDE relevance |
|---|---|---|
| `sync/root_scope_alignment.fizz` | Wildcards never cross families; exact entitlements never leak sibling roots; children ride with their root | Information disclosure, elevation of privilege — this *is* the pull authorization boundary |
| `sync/sse_channel_alignment.fizz` | `I3_PullRemainsAuthoritative`: SSE frames carry zero domain data; no cross-family wake; rejected events don't notify | Information disclosure (makes accepted over-notification safe) |
| `sync/sync_engine_push_pull.fizz` | `PushIdempotent`, `NewerAlwaysWins`, `NoLostAcceptedEvent` | Tampering — replay is a data no-op, stale writes can't clobber newer ones |
| `sync/local_mutation_atomicity.fizz` | Commit writes state + event + outbox atomically; explicit `localOnly()` writes state atomically with no transport rows | Tampering (local integrity) |
| `resilience/sqlite_single_writer_coordination.fizz` | Two tabs never write concurrently (`app/local-db/write-gate.ts`) | Tampering (local integrity) — note: the write gate is concurrency control, **not** an authorization gate |
| `resilience/aimd_concurrency_controller.fizz` | Batch size bounded, never zero | Denial of service (self-inflicted sync freeze) |
| `sync/outbox_item_lifecycle.fizz` | Bounded retries, every item reaches a terminal state | Denial of service (bounded resource use) |
| `storage/local_db_migration_idempotency.fizz` | Migrations never double-apply | Local integrity |

`formal_verification/sync/sse_gap_register.md` records the audit that produced the SSE specs — nine gaps found, all closed — and is the model for how to retire a threat here: close it, then pin it with an invariant.

**Honest limits of these proofs:**

- **None of the FizzBee gates run in CI.** The checker is not yet approved on GitLab runners (issue #29). `make verify` is developer-machine-only; two specs (`root_scope_alignment`, `sse_channel_alignment`) were verified via the fizzbee.io playground rather than the local CLI. What CI *does* run is `tests/guards/spec-drift.test.ts`, which mechanically keeps specs pointed at the code they model — traceability, not verification.
- The models assume an honest client emitting well-formed HLCs and actor IDs. Spoofing and identity are **out of scope** of every spec — the header-trust gap below is not touched by any proof.
- The scope models are representative abstractions (two actors, three families), argued sufficient by symmetry, not exhaustive over real entitlement data.
- Model-based testing (conformance against real code) covers only the AIMD controller today; the sync/SSE specs are checked as models only.

---

## 6. Known gaps

These are documented, accepted, or scheduled risks — 34 in total, grouped by risk level and tagged with the [STRIDE category](#1-stride-at-a-glance) each one violates. Phase targets are tracked in the roadmap.

### HIGH — 7

| | Gap | Risk | Fix (target) |
|---|-----|------|--------------|
| **S** | Go services take identity from headers; unknown/missing `x-actor-id` falls back to wildcard-entitled `actor_dev` | Trivial spoofing at the service boundary if the proxy contract (strip `x-actor-roles`, inject `x-actor-id`) is broken. The Nuxt surface is already closed: OIDC fails closed and its header fallback needs OIDC unset | Okta JWT validation in Actor middleware + the AuthZ engine (Phase 3). The header path is then deleted outright — self-admin included, since test roles become seeded policy data — so all four header-trust HIGH threats cease to exist rather than being mitigated |
| **S** | `x-actor-roles: admin` self-grants wildcard admin for any actor ID via `buildAdminActor()` (a local-testing affordance) | Privilege escalation with no identity check at all | Same change as above (Phase 3) |
| **R** | A forged or fallback `x-actor-id` is credited in `SaveEvent()`'s audit trail instead of the real actor | Audit misattribution across every synced write | Same change as above (Phase 3) |
| **E** | `x-actor-roles: admin` grants wildcard `CanView`/`CanEdit` on `review:*`, `product:*`, `template:*` | The top privilege-escalation vector in Phase 1 | Same change as above (Phase 3) |
| **T** | The per-field HLC used for conflict resolution is never validated — `ParseWire()` does not require `wallclock` to be numeric, and `WinsOver()` compares lexicographically. The 30s future check applies to `pushedAt`, a different field | A client sending a valid `pushedAt` with `hlc = "zzzzzzzz:9999:actor_x"` wins **every future conflict on that field, permanently**. The 60s guard in `HLCClock.receive()` is client-side and defends only honest clients | Reject non-numeric or far-future `wallclock` values in `conflict.ParseWire()` — issue #117 |
| **E** | 8 of the 19 mutating Nitro routes under `server/api/` have no authentication or authorization, and 2 more authorize from an actor object in the request body that defaults to an admin. The four fail-closed Template mutation-shaped routes are excluded because they perform no write. No global Nitro middleware layer gates them | Unauthenticated mutation of process-wide shared state, and forgeable audit entries where the audit actor is read from the body. Bounded: these handlers mutate in-process state and an in-memory SQLite DB, **not** the Postgres system of record — but they are what the local-first fallback reads | Delete the legacy surface, or gate every route on `getLifecycleActor()` plus per-resource authz — issues #115 (missing checks) and #116 (body-actor default) |
| **I** | `GET /api/catalog-directory-mirror/{users,groups,components}` requires no authentication on either surface. The Nitro handler sets a cache header and returns the snapshot; the Go routes carry no authz option, and the only global middleware resolves an actor without checking a role | The full Okta directory mirror — names, emails, group membership — is readable by anyone who can reach the endpoint. It cannot be admin-gated as-is: `UserAutocomplete.vue` depends on it for ordinary member-facing product creation | Scope the mirror to authenticated actors first, then entitlement-scope it (Phase 3). Give the search UI a narrowed endpoint rather than the whole snapshot |

### MEDIUM — 14

| | Gap | Risk | Fix (target) |
|---|-----|------|--------------|
| **S** | SSE auth is header-based | Same as push/pull — forged IDs get `actor_dev`'s channels; frames carry no data | Okta JWT in SSE `Authorization: Bearer` header (Phase 3) |
| **S** | No session revocation, rotation, or binding — `peaky_auth` is a stateless sealed cookie with a 24h TTL | A stolen cookie stays a usable credential until it expires; there is no server-side revocation path, no rotation on privilege change, and no IP/UA binding. `httpOnly` blocks JS reads and `secure` applies in production | Server-side session registry or short-lived tokens with refresh; re-auth on privilege change |
| **I** | The authenticated Review workspace route does not enforce participant scope | Any signed-in pre-Beta user can read any in-memory demo Review and receives status-based local capabilities. The current fixtures contain no customer data and do not write to the Postgres system of record | Add per-Review AuthZ when a trusted Review authority replaces demo fixtures, before loading real data |
| **T** | OPFS snapshot tampering | DevTools can edit the local SQLite file directly and the UI then reads tampered data; push still rejects bad shapes | Encrypted-at-rest driver evaluation (Phase 4) |
| **D** | Unpublished Template and draft-Revision state is local-only<!-- drift:template-drafts-local-only --> | Clearing site data, recreating the local database, applying the destructive Preview cutover, OPFS corruption, or device loss permanently removes user-authored Template metadata, draft Revision content, Pillars, Questions, and import provenance. `LocalMutation.localOnly()` creates no audit event, outbox row, push trigger, or server copy | Issue #137 must bootstrap complete draft state before Template transport is enabled; until then the UI must identify drafts as local-only and warn before destructive local-data actions |
| **T** | Template `ownerTeamId` is selected and checked only against an untrusted browser-local directory-group snapshot; no trusted Team membership is ingested or enforced<!-- drift:template-owner-team-snapshot-only --> | An actor who can create a local draft can attribute it to any mirrored or DevTools-injected Team. The value grants no permission and remote writes are frozen, bounding the current impact to unpublished local ownership metadata; it must not later be trusted for lifecycle authorization | The trusted server Template authority must validate Team identity and actor membership server-side while keeping draft-edit entitlements independent |
| **T** | The destructive Preview reset has no sync protocol floor or stale-client cutover marker<!-- drift:template-review-stale-resurrection --> | A stale bundle can theoretically repush legacy Review or Template entity shapes after migration 0016 / Goose 008 has purged them. The deployment-version banner and reload prompt reduce likelihood but are rollout UX, not a correctness barrier | Generic Sync Hardening must install a protocol/version cutover and reject obsolete entity/field shapes before relying on the reset as permanent |
| **T** | Exact `review_template_selections` are local-only and omitted from Review sync<!-- drift:review-selection-transport-deferred --> | A Review header can sync with only `subjectId`, `name`, and `status`, leaving a fresh client unable to reconstruct its immutable ordered Revision selection. A manually supplied `templateRevisionIds` field is accepted by generic Go field storage without domain validation, ignored by inbound Review replay, and never projected to PostgreSQL Review tables | Generic Sync Hardening must transport Review creation and selections atomically, validate one-to-three distinct current Revision IDs server-side, project them durably, and replay them as one aggregate |
| **T** | `errorMessage` in sync events is free text | Leaks stack frames once failure events become a server-synced surface | Replace with `{ code, kind }` allow-list before that flip |
| **T** | The server-side write is not atomic across state and audit — `field_versions` is committed one autocommit per field in `conflict.ApplyFields()` **before** `SaveEvent()`'s transaction opens | A failure part-way through an event leaves some field values durably live with no `events` row, no `field_version_events` row, no `pg_notify`, and the event reported to the client as rejected. `repo.SyncRepo` exposes no transaction handle, so no caller can span the two | Pass a transaction through `SyncRepo` so field versions, the event row, and history commit together (Phase 2) |
| **R** | No push event deduplication | Replay writes a second `events` row; duplicate `pg_notify` fires; exact replay can surface as HLC conflict. `ON CONFLICT (id) DO NOTHING` also means a replay by a *different* actor keeps the first actor on the `events` row while `field_versions` carries the second | Processed-events idempotency table (Phase 2) |
| **I** | Full OPFS copy readable on device theft | The local SQLite is readable to anyone with device or DevTools access; OS-level disk encryption is the only control today | Encrypted driver evaluation (Phase 4) |
| **I** | `testHelpersEnabled` is computed at build time as `process.env.VERCEL_ENV !== "production"` | Any build where `VERCEL_ENV` is unset — local `make preview`, CI, a container or self-hosted Nitro deploy — ships `window.peakyDB` and `window.__peakySeed` enabled regardless of `NODE_ENV`. This matters because the Go services are deployed behind ALB, not Vercel | Gate on an explicit opt-in flag rather than a provider-specific variable; add a test asserting the gate is off for a production build |
| **E** | No AuthZ engine — flat JSON registry, loaded at startup | Entitlement changes need a redeploy; no dynamic revocation; stale grants persist until restart, so `access_revoked` only fires if `actors.json` is current | Cedar-backed authorizer behind the existing `Authorizer` interface (Phase 3) |

### LOW — 13

| | Gap | Risk | Fix (target) |
|---|-----|------|--------------|
| **S** | CSRF rests on a single control | There is no CSRF token and no Origin/`Sec-Fetch-Site` check anywhere — `nuxt-security`'s `csrf` option is left at its `false` default. Cross-site forgery against cookie-authenticated Nitro routes is blocked only by `peaky_auth`'s `SameSite=Lax`, plus the absence of CORS allow-origin headers. `GET /auth/okta/logout` is a state-changing GET that Lax *does* send on cross-site top-level navigation (forced logout, nuisance-grade) | Add an Origin check or double-submit token as defence in depth; make logout a POST |
| **T** | Crafted oversized field value | Field values are opaque blobs with shape validation but no size cap; a large value could strain storage | Per-field size cap, needs a `field_versions` migration (Phase 2) |
| **T** | `.envrc` auto-runs `agent-marketplace sync` + `make dev` on `cd` | Developer machines fetch and execute from the harness repo automatically — workstation supply-chain surface, not a production one | Accepted for DX; harness repo access is the control |
| **T** | Formal verification not in CI | Invariants can silently rot between local runs; only the drift guard is CI-enforced | FizzBee runner approval (issue #29) |
| **T** | The deck's and this page's non-mechanical claims are not drift-guarded | `tests/guards/threat-model-drift.test.ts` pins paths, caps, and entity types, but asserts only that the deck *files exist* — prose claims drifted from the code undetected until the 29 Jul 2026 audit | Extend the guard to assert deck rows against this page, or generate the deck's ledgers from it |
| **T** | `FakeSyncRepo.UpsertFieldVersion` overwrites unconditionally, with no HLC guard | Deleting the `WHERE` clause that makes the real upsert safe would not fail `make test`; only the Postgres integration test covers it | Mirror the HLC guard in the fake |
| **T** | CI governance runs in external GitLab components | `components/ci-automation/{mr,repo}@0.0.2` act with `CI_AUTOMATION_TOKEN` (api) and `CI_AUTOMATION_CHANGELOG_TOKEN` (api + write_repository) — a compromised component version can push branches and tamper with MR/changelog content. It **cannot merge**: branch protection requires a +1 from a resilience Taskforce (LDAP) human, any push makes approvals stale, and bot approvals (e.g. CodeRabbit) carry no approval weight. Residual risk is a poisoned diff getting past a human reviewer | Pin versions, review component diffs on bump; tokens stay CI-only, never in logs or artifacts; branch protection + approval rules are the backstop |
| **R** | No read-level audit trail | `GET /api/sync/pull` is not logged — an actor can read everything entitled without leaving a trace | Read logging with a sampling strategy (Phase 4) |
| **R** | The non-OIDC fallback identity is a hardcoded named admin | `DEFAULT_LIFECYCLE_ACTOR = { id: "heitorl", roles: ["admin"] }` attributes unauthenticated dev/test/E2E writes to a real person with admin roles rather than to a system actor. Reachable only when OIDC is unset, and production throws 401 instead | Use an explicit non-human `actor_dev`-style identity for the fallback |
| **I** | Bootstrap entitlement snapshot readable | The client caches its entitlement snapshot in OPFS; device access reveals which entities an actor may view | Encrypted driver evaluation (Phase 4) |
| **D** | OPFS quota exhaustion | Browsers cap OPFS near 60% of free disk; unbounded event history has no server-side purge policy (the client purges local events older than 14 days) | Retention policy (Phase 3) |
| **D** | Push rate limiting absent | No explicit limit beyond the 500-event batch cap; Lambda concurrency is the only soft ceiling on load | Per-actor rate limit (Phase 2) |
| **D** | Offline coverage is narrower than "local-first" implies | Already stored Review/Product state and local Template drafts remain available, but uncached published Template discovery/content still depends on read-only fixture APIs, a cold load needs the network (the service worker precaches no application code), and `useSubjectReviews` re-throws non-404 errors — hiding local reviews on any network failure | Cache published fixture content deliberately; degrade `useSubjectReviews` to local on fetch failure; decide whether cold-start offline is a goal |

---

## 7. Deliberate exclusions on the /system page

The `/system` page is available to every authenticated member, not just admins. To keep that broad audience safe we deliberately omit features that would otherwise feel obvious:

- **No local DB snapshot export.** Allowing a member to download the local SQLite would create an exfiltration channel that bypasses any server-side audit trail. If a "delete my local data + clear server" feature is needed later it ships server-side with full auditing.
- **No raw SQL execution.** Even on local-only data, an unfamiliar power tool on a member-facing page invites accidents and creates support load. The `peakyDB.execSQL()` helper stays gated with the other test helpers.
- **No sync cursor reset / force re-bootstrap.** These mask symptoms of real bugs by making them disappear; valuable for support diagnosis but not for self-serve.

The page's only action is **Recreate local DB** — destructive but bounded (only the local copy), with confirmation that surfaces the unsynced outbox count.

`*Failed.v1` events carry an `errorMessage` field. While these events stay local today, they will sync to the server once the sync engine flips them to pushed. Until then `sanitiseError()` (`app/services/events/sanitiseError.ts`) strips stack frames, paths, and email-shaped tokens — but a regex denylist is structurally weak. **Before the engine flips events to actually pushed, replace the free-text `errorMessage` with a structured `{ code, kind }` allow-list.** Tracked in roadmap.md under "Sync engine prerequisites".

---

## 8. Security review checklist

When reviewing code that touches the sync path, authorization, or client-side data:

- [ ] Is the new entity type registered in `entity.DefaultRegistry()` (`services/internal/syncengine/entity/registry.go`), resolved to an entitlement root, with explicit payload limits?
- [ ] Does the server re-check entitlements (not trust the client)?
- [ ] Are new `window.*` globals guarded by `testHelpersEnabled` (and acceptable to expose on previews)?
- [ ] Is sensitive data (tokens, passwords) kept out of localStorage and out of `runtimeConfig.public`?
- [ ] If a public rollout value mirrors a private gate, do both derive from one source and fail closed on drift?
- [ ] If authored state is local-only, does destructive local-data UX state clearly that unpublished work has no server or outbox copy?
- [ ] Do new API endpoints validate request payloads with explicit schemas/struct validation?
- [ ] Is `v-html` used? If so, is the content sanitized?
- [ ] Does a new SSE subscription respect entitlement boundaries (no channel without CanView), and does the frame stay content-free (`{ cursor, family }` only)?
- [ ] Does `pg_notify` payload contain only cursor metadata, not domain data?
- [ ] If the change touches an invariant a FizzBee spec models, did you re-run `make verify` locally (CI won't — issue #29)?
- [ ] Is the new write route on the sync path? If it is a Nitro `server/api/` handler, does it resolve its actor via `getLifecycleActor()` (never from the request body) and enforce per-resource authorization?
- [ ] If the change touches HLC parsing or conflict resolution, does it still accept a non-numeric or far-future `wallclock`? Today it does — see the HIGH row under [Known gaps](#6-known-gaps).
- [ ] Does `tests/guards/threat-model-drift.test.ts` still pass? If it fails, either the code or this document is now wrong — decide which before changing either.

For comprehensive reviews, use the `rtf-security-reviewer` droid — materialized by `agent-marketplace` per `.agents/config.yaml`; the droid definitions are no longer checked into this repo — with `.factory/review-context/security.md` as the standing review context.

---

## 9. Posture summary

```text
The browser is untrusted — everything there can be read and modified.
The sync push endpoint is the real API surface for synced data — validate there.
It is not the only write surface: 19 Nitro routes still write, 8 with no auth at all; four Template mutation-shaped routes are fail-closed 503 boundaries.
UI permission gates are UX, not security.
Server re-validates entitlements on every sync event — via a JSON registry today, Cedar later.
Nuxt identity is a verified OIDC claim that fails closed; Go-service identity is still a deployment contract until Phase 3's JWT lands.
The per-field HLC is not validated at all — a stuffed wallclock wins conflicts permanently.
State and audit are not written atomically server-side; a partial failure loses the audit row, not the data.
Formal specs prove the scoping invariants — but only on machines that run them, and only against an honest client.
Test-helper globals are preview-visible by design; previews are not a trust boundary — but the gate is Vercel-specific.
```
