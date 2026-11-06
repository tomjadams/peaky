# SSE Fan-out — Gap Register

Status: IMPLEMENTED. The contract in §5 is agreed and now conformed across all four
code layers (commits `6025228`, `1aa77eb`, `2fc9663`, `eebd2a6`). §8 records the
per-gap resolution; §1–§3 are preserved as the original read-only audit snapshot.
Scope: the cursor-pointer SSE notification path only (push → pg_notify → hub →
browser → pull). Authorization, conflict resolution, and the pull payload
itself are out of scope except where they define the SSE contract boundary.

---

## 1. Why this document exists

### 1.1 How we got here

The SSE fan-out (the "doorbell" that tells a connected browser to pull instead
of waiting for the 30s poll) was built incrementally and never had a single,
agreed contract. Three things collided:

1. **The entitlement model moved to family keys.** Actors are now entitled by
   `review:*`, `review:review-001`, `product:*`, `template:*`
   (`services/seed/actors.json`). There is **no `team:` entitlement key**.
2. **The notification path still keys on the resolved subject.** A review change
   is fanned out on `sync:team:<id>` (the team that owns the review), because
   `notifySSE` uses the audience *subject*, not the event's entitlement family.
3. **PostgreSQL `LISTEN` is exact-match.** A subscription derived from a
   wildcard entitlement (`review:*`) becomes `LISTEN "sync:review:*"`, a channel
   literally named with an asterisk that no `NOTIFY` ever targets.

The net effect: the channel a browser subscribes to (LISTEN) and the channel the
backend notifies (NOTIFY) live in different namespaces and/or use literal
wildcards, so the doorbell rarely rings. Sync still "works" only because the 30s
poll is a silent safety net, which is exactly why this stayed hidden.

### 1.2 The MR #27 trigger

While extending sync to templates and products
(`feat/template-product-sync`, [MR #27](https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/27)), Heitor's agent hit these SSE problems
during rollout (the "Bugs / issues found during rollout" section of the MR).
MR #27 proposes a **family catalog channel** fix:

> Both LISTEN and NOTIFY collapse to a single per-family channel
> `sync:{family}:catalog`. Any entitlement in a family (wildcard or specific)
> subscribes to that one channel; every accepted change in the family notifies
> it. You are notified about the **whole family**, the SSE payload carries no
> domain data (just a cursor pointer + a display hint), and the subsequent
> entitlement-scoped `/pull` strips anything you are not allowed to see. Pull,
> not the channel, is the authorization boundary.

### 1.3 Why we are formalizing before coding

Two different fixes were discussed (a dual-channel "specific + type-level"
scheme, and MR #27's family-catalog scheme). Each reasoned about *mechanics*
rather than an agreed *invariant*, which produced repeated back-and-forth: every
proposal had to re-derive what "correct" means from the code. SSE is currently
half-baked; layering another fix without a single source of truth (spec +
FizzBee model + docs) would compound the inconsistency.

This register is the first step: pin down what every layer does **today**, name
every seam where they disagree, and use that to drive one coherent contract that
the spec, the model, the docs, and all four code layers conform to.

---

## 2. Current-state map (what each layer does today)

> NOTE (post-implementation): §2 is the original audit snapshot of `main` *before*
> this change — it intentionally describes the broken pre-fix state (subject-keyed
> NOTIFY, literal-`*` LISTEN, 4-way duplicated payload, per-subject client). The
> shipped state is the §5 contract; see §8 for what each layer looks like now.

### Layer A — Subscriptions (LISTEN)

- `services/internal/sse/handler.go` → `entitlementChannels(a)`: for every
  entitlement with `CanView`, emits `"sync:" + key`. With keys like `review:*`
  and `review:review-001`, this yields `sync:review:*`, `sync:review:review-001`,
  `sync:product:*`, `sync:template:*`.
- `services/internal/sse/hub.go` → `Register`/`drainCommands`: issues
  `LISTEN <channel>` on one dedicated pgx connection, sanitized as an
  identifier. `fan(channel, payload)` routes a notification to
  `h.channels[channel]` by **exact string key**.
- `services/cmd/peaky-sse/main.go` (header comment): documents
  `LISTEN sync:team:*` / `LISTEN sync:product:*` — a wildcard mental model PG
  does not support.

### Layer B — Notifications transport (NOTIFY → hub → stream)

- `services/internal/syncengine/repo/postgres.go` → `PostgresNotifier.Notify`:
  `SELECT pg_notify($1, $2)` with `(channel, payload)`.
- `hub.go` → `dispatch` waits on `WaitForNotification`, then `fan`s the raw
  payload to streams whose channel set contains the exact notified channel.
- `hub.go` → `ChannelName(subjectType, subjectID)` = `"sync:" + type + ":" + id`
  (subject-based naming helper).

### Layer C — Notification generation on push (backend)

- `services/internal/syncengine/push.go` → `notifySSE`: after a batch, finds the
  **first** accepted event whose audience resolves to a subject and calls
  `Notify` **once** on `"sync:" + subject.Type + ":" + subject.ID`, then returns.
- `services/internal/syncengine/audience.go` → `Resolve`: only the review family
  resolves (review + children → `ReviewSubject` SQL → `subjects.type/id`, i.e.
  `team` or `product`). Every other entity type returns `(nil, nil)` → no notify.

### Layer D — Parsing on the client (Vue)

- `app/composables/sync/useSseClient.ts`: opens the stream via
  `fetchEventSource("/api/sse/events")`; on each frame parses
  `{ cursor, subjectType, subjectId }`, sets
  `incomingSubject = { subjectType, subjectId }`, and calls `runSyncCycle()`.
- `app/composables/sync/useSubjectUpdate.ts`: shows a per-subject indicator while
  `incomingSubject.subjectId === pageSubjectId`. **So the client consumes the
  subject hint, not just the cursor.**
- Payload struct is defined **three times**: `sse.CursorNotification`
  (handler.go), `sse.CursorEvent` (hub.go), and an anonymous struct in
  `push.go` — plus the TS `CursorEvent` interface in `useSseClient.ts`.

---

## 3. Gap register

| ID    | Layer(s)        | Severity     | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence                                                                                                             |
|-------|-----------------|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| GAP-1 | A vs C          | **Critical** | **Namespace mismatch.** LISTEN keys on the entitlement *family* (`sync:review:…`); NOTIFY keys on the resolved *subject* (`sync:team:<id>`). For reviews these never align, so SSE never wakes review-entitled clients; they silently fall back to 30s polling.                                                                                                                                                                                                                                                | `handler.go entitlementChannels` vs `push.go notifySSE` + `audience.go`                                              |
| GAP-2 | A               | **Critical** | **Literal wildcard subscription.** A wildcard entitlement (`review:*`, `product:*`) becomes `LISTEN "sync:review:*"`; PG treats `*` literally, so the subscription matches nothing. Even if GAP-1 were fixed, wildcard actors stay dead.                                                                                                                                                                                                                                                                       | `handler.go` + `hub.go drainCommands` (exact-match `fan`)                                                            |
| GAP-3 | C               | High         | **One notify per batch.** `notifySSE` returns after the first subject, so a batch spanning multiple subjects/families wakes only one channel. A family-catalog or multi-subject design needs per-channel dedup across the whole batch.                                                                                                                                                                                                                                                                         | `push.go notifySSE` (`return` after first)                                                                           |
| GAP-4 | C               | High         | **NOTIFY only fires for reviews.** `audience.Resolve` returns `nil` for non-review entities, so product/team/template changes emit no notification at all, even though `product:*` entitlements exist today.                                                                                                                                                                                                                                                                                                   | `audience.go Resolve` default branch                                                                                 |
| GAP-5 | B/C/D           | Medium       | **Payload contract duplicated 4×** with no single source of truth (`CursorNotification`, `CursorEvent`, push.go anon struct, TS `CursorEvent`). Any field change risks silent drift between server and client.                                                                                                                                                                                                                                                                                                 | `handler.go`, `hub.go`, `push.go`, `useSseClient.ts`                                                                 |
| GAP-6 | C vs D          | Medium       | **Payload collapses to a family/catalog marker (DECIDED).** The backend drives the taxonomy and the client follows: the payload carries the family/catalog marker, not the resolved owning subject. Consequence: the current per-subject indicator (`useSubjectUpdate` matching a concrete `subjectId`) can no longer fire for a specific team/review and must be reworked to family scope or removed (see GAP-8).                                                                                             | `useSubjectUpdate.ts` + MR #27 `notifySSE` payload                                                                   |
| GAP-7 | docs/spec/model | High         | **Artifacts disagree with code and with each other.** `peaky-sse/main.go` shows unsupported `LISTEN sync:*` wildcards; the OpenSpec `sync-engine` SSE text describes per-subject channels (MR #27 already flagged its own code/spec mismatch); the FizzBee model (`sse_channel_alignment.fizz`) now encodes the agreed contract (I1–I7) but is pending validation (no local runner).                                                                                                                           | `cmd/peaky-sse/main.go`, `openspec/specs/sync-engine/spec.md`, `formal_verification/sync/sse_channel_alignment.fizz` |
| GAP-8 | D               | Medium       | **Client per-subject indicator must be reworked.** Because the payload becomes family-level (decision on GAP-6), `incomingSubject.subjectId === pageSubjectId` will never match a concrete subject. The indicator either becomes family-scoped ("a review in this family changed") or is dropped. Contract + UX decision needed; tracked as an explicit downstream task.                                                                                                                                       | `useSubjectUpdate.ts`, `useSseClient.ts`, `SubjectUpdateIndicator.vue`                                               |
| GAP-9 | C               | High         | **Partial accepts ring no doorbell.** A push event with mixed field outcomes (some HLC win, some lose) is persisted — the winning fields land in the event log and are pullable — but reported in the `rejected` bucket as `partial_hlc_conflict`, so `notifySSE` (which iterates only the top-level `accepted` set) emits no NOTIFY. Connected clients then wait up to 30s to see a change that is already on the server. Contract: any persisted change must notify its family channel (model invariant I7). | `push.go` switch (partial → `rejected`) + `notifySSE` (`accepted` set only)                                          |

### Severity key

- **Critical** — SSE doorbell does not ring for the affected actors (correctness/UX regression masked by polling).
- **High** — significant coverage gap or guaranteed future drift.
- **Medium** — maintainability / contract-clarity risk.

---

## 4. Decisions (resolved)

1. **Payload taxonomy — family/catalog marker (GAP-6, GAP-8).** The backend owns
   the taxonomy; the Vue layer follows. The SSE payload collapses to the family/
   catalog marker rather than the resolved owning subject. The client per-subject
   indicator must be reworked to family scope or dropped (GAP-8).
2. **NOTIFY coverage — all families now (GAP-4).** This effort makes review,
   product, and template changes all notify (the full family set `F`); non-review
   families are not deferred. `team` is not a family (see section 5).
3. **Contract authority — formalize first.** The FizzBee model and the OpenSpec
   contract are written and agreed *before* code is changed; the four code
   layers then conform to them.
4. **Document home.** This register stays at
   `formal_verification/sync/sse_gap_register.md`.

---

## 5. Target contract (agreed)

The contract every layer and artifact must conform to. This is the single source
of truth; OpenSpec and the FizzBee model encode it, the four code layers follow.

- **Families.** `F = {review, product, template}` — the entitlement key families,
  which are also the synced entity families. `team` is **not** a family: on `main`
  it is neither an entitlement key nor a synced entity type, only a review's
  owning subject, and it is dropped as a routing/notification concept.
  **Seed residue:** `services/internal/dbmigrate/seed/001_demo_data.sql` still
  inserts `entity_type='team'` rows into `events`, `field_versions`, and
  `field_version_events`. They have no family channel, so no SSE doorbell ever
  fires for them — but a wildcard actor's `/pull` (no `entity_type` filter) still
  returns them and the client `TeamHandler` replays them. **Their deletion is
  deferred** (the original tasks.md 3.4 premise — that they were unreachable
  orphans — was false): a follow-up re-encodes teams within the sync taxonomy.
  See §8 for the authoritative status.
  **Seed HLC format (separate defect, tasks.md 3.5):** the same seed file writes
  RFC3339-wallclock HLCs (`2025-…Z:0:seed`) into `field_versions`/`field_version_events`.
  Since `CompareWire` is lexicographic, those sort *above* real epoch-ms client
  HLCs (`17…`), so seed rows would win conflicts against genuine edits once
  product/template client-sync ships — the inverse of the intended "seed is old."
  Fix: epoch-ms HLCs (storage `1735689600000:0000`, wire `…:seed`).
- **Channels.** Exactly one per family: `sync:{family}:catalog`. No other SSE
  channel names exist. **No literal `*` is ever passed to `LISTEN`.**
- **Subscription (LISTEN, Layer A).** For each `canView` entitlement, take
  `family = segment before the first ":"`; if `family ∈ F`, subscribe to
  `sync:{family}:catalog`. Dedup. Wildcard (`review:*`) and specific
  (`review:review-001`) keys collapse to the same single channel.
- **Notify (Layer C).** For each accepted event, `family = ChannelFamily(type)`
  (review + children → review; product → product; template family → template);
  notify `sync:{family}:catalog`. Dedup per channel across the batch (one notify
  per distinct family per batch). All families covered. A **partially accepted**
  event (some fields win on HLC, some lose) still persists a change and is
  pullable, so it notifies too; only a **wholly rejected** event is silent
  (GAP-9, I7).
- **Payload (Layers B/C/D).** New shape `{ cursor, family }` — the per-subject
  hint is removed. One Go struct, one matching TS type; the three duplicated Go
  structs and the anonymous struct are unified.
- **Client (Layer D).** Parse `{ cursor, family }`, run the sync cycle. The
  per-subject indicator is reworked to family scope or dropped (GAP-8).
- **Authorization.** Over-notification is intentional and safe: SSE carries no
  domain data, and the subsequent entitlement-scoped `/pull` is the authorization
  boundary.

### Invariants to prove (FizzBee)

- **I1 NoLiteralWildcardListen** — no channel passed to `LISTEN` contains `*`.
- **I2 NotifyListenAlignment** — for any accepted event in family `f`, an actor
  entitled to view `f` listens on the exact channel notified (`sync:f:catalog`).
- **I3 PullRemainsAuthoritative** — over-notified actors receive only entitled
  data via pull; the SSE payload carries no domain data.
- **I4 RejectedEventsDoNotNotify** — rejected pushes produce no notification.
- **I5 PerFamilyScope** — an entitlement in family `f` never subscribes to
  another family's channel.
- **I6 NotifyDedup** — at most one notify per `(batch, family)`.
- **I7 PersistedChangeNotifies** — any change persisted to the event log,
  including a partial accept, notifies its family channel; only a wholly
  rejected batch is silent.
  *Note (resolved, tasks.md 1.7 → option b):* I7 governs *that* a partial accept
  notifies, not *what cursor* the frame carries. `newCursor` now advances for any
  *persisted* event (full or partial), tracked via a `persisted` map in `push.go`,
  so a partial accept moves the high-water mark like a full accept; only a wholly
  rejected event leaves it unchanged. This is safe because the cursor gates
  neither re-push (outbox drained by per-item status) nor pull (`remoteCursor`),
  so advancing past a partial cannot drop rejected fields; it keeps the marker
  truthful and monotonic instead of stalling/resetting to `""` on a partial-only
  batch. The frame `cursor` remains the *pusher's* advisory cursor for other
  listeners; whether the frame should instead carry the server's family position
  (or no cursor) is deferred to Phase 3 payload unification (GAP-5/GAP-6).
- **Self-notification is intentional.** The doorbell carries no author identity
  and `pg_notify` is broadcast, so the pushing actor (and all their tabs/devices)
  also receive the frame. This is correct, not a leak: filtering "the author"
  would wrongly silence that actor's other tabs (which must converge), and the
  self-echo is an idempotent no-op (the client already applied the change locally;
  the re-pulled event has the same id/HLC and is discarded by conflict resolution).

---

## 6. Traceability matrix

How to read this: every **correctness** gap maps to an invariant, every
invariant has a **negative control** (the mutation that should turn the model
red, proving the invariant has teeth), and every gap names the **code + test**
that will prove the implementation conforms (Step 5, not yet written). A blank
or `n/a` in the invariant column means the gap is structural or cross-artifact
and is not model-provable, its conformance owner is named instead. Six of the
seven invariants map to a gap below (I1→GAP-2, I2→GAP-1/4, I3→GAP-6, I5→GAP-1,
I6→GAP-3, I7→GAP-9). I4 (RejectedEventsDoNotNotify) has no row because it guards
behavior that is already correct (fully rejected batches are silent in the code
today) rather than closing a gap.

| Gap                           | Closed by (contract §5)                                                 | Model invariant                                   | Negative control (proves teeth)                                        | Conforming code + test (Step 5, planned)                                                                                                                              |
|-------------------------------|-------------------------------------------------------------------------|---------------------------------------------------|------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| GAP-1 Namespace mismatch      | Both sides derive `sync:{family}:catalog`                               | I2, I5                                            | `alice_woken=False` in `PushReviewAccepted` → I2 FAIL                  | `handler.go entitlementChannels` + `push.go notifySSE`; test: review push notifies `sync:review:catalog` **and** a `review:*` actor listens on the same channel       |
| GAP-2 Literal wildcard        | Family collapse, never the raw key                                      | I1                                                | `any_wildcard_listen=True` → I1 FAIL                                   | `handler.go entitlementChannels`; test (`channels_test`): `review:*` → `sync:review:catalog`, no `*`                                                                  |
| GAP-3 One notify per batch    | Dedup per family across the batch                                       | I6                                                | `notify_count_review=2` in `PushReviewBatchAccepted` → I6 FAIL         | `push.go notifySSE` per-channel dedup; test: two review events → one notify                                                                                           |
| GAP-4 NOTIFY reviews-only     | All families notify                                                     | I2 (+ `PushProduct/Template` actions)             | `bob_woken=False` in `PushProductAccepted` → I2 FAIL                   | `push.go notifySSE` via `ChannelFamily` (audience no longer gates notify); test: product/template push → its catalog notify                                           |
| GAP-5 Payload duplicated 4×   | One Go struct + one TS type                                             | n/a (structural)                                  | n/a                                                                    | unify `CursorNotification`/`CursorEvent`/anon struct + TS `CursorEvent`; guard: single shared type                                                                    |
| GAP-6 Payload → family marker | Payload `{ cursor, family }`                                            | I3                                                | `alice_received_data=True` → I3 FAIL                                   | payload `{ cursor, family }`; test: frame carries no subject/domain data                                                                                              |
| GAP-7 Artifacts disagree      | Spec/model/docs encode the contract                                     | n/a (this model + OpenSpec **are** the artifacts) | n/a                                                                    | OpenSpec SSE section, `peaky-sse/main.go` comment, DESIGN.md sync section (Step 4)                                                                                    |
| GAP-8 Client indicator rework | Client follows the family taxonomy                                      | n/a (Layer D abstracted out of the model)         | n/a                                                                    | `useSubjectUpdate`/`useSseClient` family-scope rework; test: client unit test                                                                                         |
| GAP-9 Partial accepts silent  | Any persisted change (incl. partial accept) notifies its family channel | I7                                                | set `notified_review=False` in `PushReviewPartiallyAccepted` → I7 FAIL | `push.go`: notify on partial accepts (persisted events are notify-worthy, not just the `accepted` set); test: partial-only push → one NOTIFY on `sync:review:catalog` |

---

## 7. Next steps

1. ~~Resolve the open questions.~~ **Done** (section 4).
2. ~~Define the target contract.~~ **Done** (section 5).
3. ~~Encode the contract as the FizzBee model (I1–I7).~~ **Done**
   (`sse_channel_alignment.fizz`); reported Correct by the runner, including
   I7/partial-accept.
4. **Encode the contract in OpenSpec** (`sync-engine` SSE fan-out) and fix the
   stale docs. ~~`cmd/peaky-sse/main.go` wildcard comment~~ **done** (now shows the
   three `sync:{family}:catalog` channels). OpenSpec spec delta + DESIGN.md sync
   section: in progress (Phase 5 docs pass).
5. ~~Conform the four code layers (LISTEN, NOTIFY, generation, Vue parse), layer by
   layer, with tests. Includes notifying on **partial** accepts (GAP-9, I7) and
   reworking the client indicator (GAP-8).~~ **Done** — see §8.

---

## 8. Resolution (implementation)

Each gap mapped to how it was closed and where. Commits on
`feat/sse-family-catalog-channels`.

| Gap | Status | Resolution |
|-----|--------|------------|
| GAP-1 Namespace mismatch | **Closed** | Both sides derive `sync:{family}:catalog`: `push.go notifySSE` notifies per accepted family (`entity.Family`); `handler.go entitlementChannels` subscribes per viewable family. (`6025228` + `1aa77eb`) |
| GAP-2 Literal wildcard LISTEN | **Closed** | `entitlementChannels` takes the family segment before `:` and emits the catalog channel; `review:*` and `review:review-001` both collapse to `sync:review:catalog`. No `*` reaches LISTEN. Guarded by `handler_internals_test.go`. (`1aa77eb`) |
| GAP-3 One notify per batch | **Closed** | `notifySSE` dedups per family across the whole batch (`notifyFamilies` set). Tests: `TestPush_DeduplicatesNotifyPerFamily`. (`6025228`) |
| GAP-4 NOTIFY reviews-only | **Closed** | Notify is driven by `entity.Family(type)`, not audience resolution; review/product/template all notify. (`6025228`) |
| GAP-5 Payload duplicated | **Closed** | Unified to the single `ssecontract.CursorNotification{cursor,family}`. Removed `sse.CursorEvent`/`MakePayload`/`ChannelName` (`2fc9663`), the TS `CursorEvent` (`eebd2a6`), and a **5th** duplicate found late — `sse.CursorNotification`, the OpenAPI response schema in `handler.go` — now points at the shared type (`eebd2a6`). The hub forwards raw NOTIFY bytes, so it needs no payload type. |
| GAP-6 Payload → family marker | **Closed** | Wire payload is `{cursor,family}`; carries no domain data (I3). (`6025228` server, `eebd2a6` client) |
| GAP-7 Artifacts disagree | **Mostly closed** | FizzBee model encodes I1–I7 (Correct). `cmd/peaky-sse/main.go` comment fixed (Phase 5). Remaining: OpenSpec `sync-engine` spec delta + DESIGN.md sync section (Phase 5 docs pass). |
| GAP-8 Client indicator rework | **Closed (family-scoped)** | `incomingSubject` → `incomingFamily: string\|null`; `useSubjectUpdate` matches family; `SubjectUpdateIndicator` takes a `family` prop with a `TODO(GAP-8)` since its final UX/placement is still an open product decision (it is mounted nowhere today). (`eebd2a6`) |
| GAP-9 Partial accepts silent | **Closed** | `push.go` notifies on any persisted event (full or partial) — its family is added to `notifyFamilies`; the cursor likewise advances on a partial accept (decision 1.7→b). Tests: `TestPush_NotifiesOnPartialAccept`. (`6025228` + `1aa77eb`) |

Decision 1.7 (partial-accept cursor) resolved to **(b)**: advance on any persisted
event (see the I7 note in §5). Team seed rows were **not** deleted (the original
3.4 premise was false — wildcard actors do pull `team` rows); a follow-up will
re-encode teams within the sync taxonomy. Phases 1–4 were verified end-to-end
manually (NOTIFY/LISTEN/payload/partial-cursor/wildcard-wake/team-pull and a live
client `review_answer` apply through Recent Changes).
