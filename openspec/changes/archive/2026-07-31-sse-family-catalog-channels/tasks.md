# Implementation Tasks

## Prerequisites

> Issue: #62
> MR: !38

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in RFC style using `glab` CLI describing the SSE channel misalignment and the family-catalog approach from `design.md` (#62)
- [x] 0.3 Create branch `docs/sse-family-catalog-contract` (contract MR; implementation may continue here or on a fresh `feature/...` branch — see Open Question below)
- [x] 0.4 Create MR using conventional commit + `.gitlab/merge_request_templates/default.md` (!38, Closes #62)

> Open Question: !38 currently lands the contract only (formal model + OpenSpec). Decide whether the Step-5 code conformance rides this same branch/MR or a fresh `feat(sync): ...` MR.

## 1. NOTIFY layer (peaky-api push)

> dependencies: none (start here)

- [x] 1.1 RED: notify tests (in `services/internal/syncengine/handler_test.go`, discrete tests not one table) cover full accept → 1 notify on `sync:{family}:catalog` (`TestPush_NotifiesSSEOnAcceptedEvent`); full reject → 0 notify both via `access_revoked` (`TestPush_DoesNotNotifyOnRejectedEvent`) and via full HLC conflict (`TestPush_DoesNotNotifyOnFullHLCConflict`); two events same family → 1 dedup (`TestPush_DeduplicatesNotifyPerFamily`); two families → 1 each (`TestPush_NotifiesOncePerDistinctFamily`)
- [x] 1.2 RED: partial-accept case → 1 notify on its family channel — `TestPush_NotifiesOnPartialAccept` (GAP-9, invariant I7)
- [x] 1.3 GREEN: `services/internal/syncengine/push.go` collects `notifyFamilies` (via `entity.Family`) for every PERSISTED event (full or partial), dedups, and emits one `pg_notify` per `ssecontract.CatalogChannel(family)` in `notifySSE`; the early per-subject `return` is gone (GAP-1, GAP-3, GAP-4, GAP-9)
- [x] 1.4 GREEN (implemented as `entity.Family`, not `audience.go ChannelFamily` which never existed): all synced families (review, product, template) classify to a channel via `entity.Family`/`entity.IsFamily` in `entity/channel.go`. The dead `audience.go` (`AudienceResolver`, `repo.SubjectOwner`/`ReviewSubject`) push path is removed in Phase 3 (task 3.4)
- [x] 1.5 REFACTOR: partial events are added to `notifyFamilies` (and to `persisted` for cursor advancement) but NOT to `accepted` — they are reported as `partial_hlc_conflict` so the client learns which fields lost, while still ringing the doorbell and advancing the cursor (see 1.7(b)) — see `push.go`
- [x] 1.6 DEFERRED to follow-up issue #121 — INTEGRATION (`-tags integration`, local Postgres via `make test:go:integration`, reuse `testhelper.StartPostgres`): assert a real `pg_notify` round-trip — an accepted review push emits exactly one frame to a connection LISTENing on `sync:review:catalog`. Cases: (a) full accept → 1 frame; (b) partial accept → 1 frame (GAP-9, I7); (c) HLC full-reject → 0 frames; (d) `access_revoked` reject (unentitled actor) → 0 frames; (e) FAMILY ISOLATION — a product push (entitled actor) wakes a `sync:product:catalog` listener and leaves a concurrent `sync:review:catalog` listener silent (invariant I5). Co-locate with `services/internal/syncengine/repo/postgres_integration_test.go`. (Per-family dedup stays a unit test, 1.1.) Out of scope for archiving this change — decision (user, 2026-07-31): drop from this change, track separately since the feature has been live since 2026-06-24 with unit + manual e2e coverage.
- [x] 1.7 RESOLVED → **(b)**: `newCursor` now advances for any *persisted* event (full or partial), tracked via a `persisted` map in `push.go` so a partial accept moves the high-water mark exactly like a full accept; only a wholly rejected event leaves the cursor unchanged. Rationale (confirmed against the client): this cursor gates *neither* re-push (the outbox is drained by per-item status — accepted → `markItemSynced`, rejected fields → `PendingReviewQueue`) *nor* pull (`remoteCursor`, advanced only by `pullChanges`), so advancing past a partial cannot drop the rejected fields, and it keeps the marker truthful and monotonic instead of stalling/resetting to `""` on a partial-only batch (observed live in manual e2e step E3). Tests: `TestPush_PartialHLCConflict` asserts the cursor advances to the partial event's `pushedAt`; `TestPush_FullHLCConflict` locks it empty on full reject. The frame `cursor` remains the *pusher's* advisory cursor for other listeners (whether the frame should carry the server's family position, or no cursor at all, is deferred to Phase 3 payload unification — see 3.1).

## 2. LISTEN layer (peaky-sse subscription)

> can run in parallel with group 1
> dependencies: none

- [x] 2.1 RED: add a channel-derivation test asserting `review:*` and `review:review-001` both yield `sync:review:catalog`, and that no derived channel contains a literal `*` (invariants I1, I5; GAP-2) — `services/internal/sse/handler_internals_test.go`
- [x] 2.2 GREEN: in the entitlement-to-channel derivation (`services/internal/sse/handler.go` `entitlementChannels`), take `family = segment before first ":"` (via `strings.Cut`), keep only `family ∈ {review, product, template}` (`entity.IsFamily`), subscribe to `ssecontract.CatalogChannel(family)`, and dedup
- [x] 2.3 GREEN: confirmed `services/internal/sse/hub.go` registers exact-match family channels only — `fan` does an exact `h.channels[channel]` lookup and Register/Deregister key on the literal channel string (no wildcard fan)
- [x] 2.4 Add an alignment test: the LISTEN set derived for a `review:*` actor contains the exact channel a review push notifies (invariant I2) — `TestEntitlementChannels_AlignsWithPushNotifyChannel`, both sides resolve through `entity.Family` + `ssecontract.CatalogChannel`
- [x] 2.5 DEFERRED to follow-up issue #121 — INTEGRATION (`-tags integration`): over a real PG connection, LISTEN as a `review:*` actor and assert it receives the frame a review push emits (cross-service alignment over real pg_notify). Same decision as 1.6.

## 3. Payload unification

> dependencies: groups 1 and 2 (channel shape settled)

- [x] 3.1 GREEN: unified the Go payload to a single `{ cursor, family }` type. The canonical home is `ssecontract.CursorNotification` (the shared package created precisely to be one source of truth), NOT `models.go` as originally written — re-homing into `models.go` would re-fragment the contract. `push.go` already marshals it; the subject-shaped `sse.CursorEvent` + `sse.MakePayload` + `sse.ChannelName` were deleted (the hub is payload-agnostic — it forwards raw NOTIFY bytes, so it needs no payload type). Server side of GAP-5/GAP-6 closed; the 4th duplicate (TS `CursorEvent`) is the client task 3.2. `go build`/`vet`/`test` green. (Follow-up found during Phase 4 grep sweep: a **5th** duplicate — `sse.CursorNotification` in `services/internal/sse/handler.go`, the OpenAPI response schema for `/api/sse/events` — still advertised the old `{cursor,subjectType,subjectId}` shape. Deleted it and pointed `sse/routes.go` at the canonical `ssecontract.CursorNotification`, so the published spec now matches the wire. Stale example payload in `hub_test.go` also corrected.)
- [x] 3.2 DONE: `useSseClient.ts` now parses `{ cursor, family }` (TS interface renamed `CursorNotification`, killing the 4th GAP-5 duplicate). The frame stays a content-free doorbell (invariant I3) — it sets `incomingFamily` (family-level signal) and fires `runSyncCycle()`, which already performs the pull off the cursor (no separate `pullChanges()` needed; the cursor/entitlements are the data path, not the frame body).
- [x] 3.3 DONE: `useSseClient.test.ts` frames + `incomingFamily` mock updated to `{ cursor, family }`; 16 tests green.
- [x] 3.4a DONE — dead subject/audience routing removed: deleted `audience.go` (+ `audience_test.go`), `AudienceResolver`/`Ref`/`Subject`, `repo.SubjectOwner`/`ReviewSubject`/`FakeSubjectOwner`, the sqlc `ReviewSubject` query (both `queries.sql` and generated `queries.sql.go`); simplified `WithNotifier(n)` (dropped the `SubjectOwner` arg) and updated all 6 test callers + stale comments. `go build`/`vet`/`test` green.
- [x] 3.4b DEFERRED — do NOT delete the `team` seed rows. The task premise ("team rows ring no doorbell and are never pullable") is FALSE: confirmed empirically that a wildcard actor's pull sets `entitled=nil`, whose query filters only on `entity_type IS NOT NULL` (no type filter), so it returns ALL events incl. `team` (`actor_dev` pull returned `seed-team-payments-scalability`), and the client `TeamHandler` (`entityTypes:["team"]`) replays them. Deleting now regresses local-dev team display for wildcard actors. Decision (user): keep team rows for now; a follow-up will stop syncing teams as a `team` entity and re-encode the same data within the sync/SSE taxonomy (review/template/product) + a different team-sync path. A `TODO(sse-family-catalog)` note marks this in the seed file.
- [x] 3.5 SEED CORRECTNESS (independent of SSE, found during manual verification): the seed HLCs in `services/internal/dbmigrate/seed/001_demo_data.sql` use an RFC3339 wallclock and wire format in places they should not. The canonical HLC (`conflict.go`) is `wallclock:counter` (storage) / `wallclock:counter:actorId` (wire), where wallclock is Unix epoch **milliseconds**. Because `CompareWire` is purely lexicographic, an RFC3339 wallclock (`2025-…`, leading `'2'`) sorts **above** real client epoch-ms HLCs (`17…`/`18…`, leading `'1'`), so seed rows would WIN conflicts against genuine edits — inverting the intended "seed is old, always loses." Latent: surfaces once product/template client-sync ships and a client edits a seeded entity (rejected as `hlc_conflict`). Fix: rewrite seed HLCs as epoch-ms — `field_versions.hlc` → storage `1735689600000:0000` (no actor), `field_version_events.hlc` → wire `1735689600000:0000:seed`.
  - [x] DONE — applied to ALL seed rows (team `1735689600000` + product `1735689601000`): `field_versions.hlc` → storage (actor dropped, lives in the `actor_id` column per `schema.sql`), `field_version_events.hlc` → wire (`:seed`). Verified against `schema.sql` (`field_versions.hlc='wallclock:counter'`, `field_version_events.hlc='wallclock:counter:actorId'`), no CHECK constraint on `hlc`, and the string-compare upsert (`EXCLUDED.hlc > field_versions.hlc`) now orders seed (`1735…`) below real client edits (`1748…`/`18…`).

## 4. Client consumption

> dependencies: group 3

- [x] 4.1 DONE: `useSubjectUpdate.ts` is now family-scoped — it reads `incomingFamily` and returns true when the in-flight SSE frame's family matches the requested family. The dead per-subject `subjectId` match was removed (the doorbell no longer carries a subject id). Signal renamed `incomingSubject` → `incomingFamily` (`string | null`) in `useSyncClient.ts`. Decision (user): family-scope the signal rather than drop it. NOTE: no functional regression existed to fix — the frame body fed only this cosmetic cue; data sync is cursor-driven. (Composable name kept per the chosen option.)
- [x] 4.2 DONE: `useSubjectUpdate.test.ts` rewritten to family matching (review/product); 6 tests green.
- [x] 4.3 DONE (TODO left): `SubjectUpdateIndicator.vue` prop `subjectId` → `family` (minimal edit to keep typecheck green; the component is mounted nowhere today) with a `TODO(GAP-8)` marking that its final UX/placement/name is a separate decision tracked in the gap register. The rework/removal itself stays OUT OF SCOPE.

## 5. Stale docs

> dependencies: groups 1 and 2

- [x] 5.1 DONE: `services/cmd/peaky-sse/main.go` package comment now shows the three `sync:{family}:catalog` channels (review/product/template) + a note that no literal `*` reaches LISTEN, replacing the unsupported `sync:team:*` / `sync:product:*` wildcard example (GAP-7). Also reconciled `formal_verification/sync/sse_gap_register.md` (status → IMPLEMENTED, §2 marked as pre-change audit, added §8 per-gap resolution incl. the 5th payload duplicate).

## 6. Adversarial Reviews

> Run after all implementation tasks are complete. One pass over the full change.

- [x] 6.1 DONE: `go-reviewer` run over the ACTUAL changed Go (push.go, sse/handler.go, sse/hub.go, sse/routes.go, entity/channel.go+registry.go, ssecontract.go, peaky-{api,sse}/main.go, repo/{ports,postgres}.go, seed SQL). audience.go/models.go in the original list are deleted/unmodified, so adjusted. Verdict: no blockers; 1 should-fix (log on dead marshal error) — fixed in fc94262.
- [x] 6.2 DONE: `security-reviewer` on push.go, syncengine/handler.go, sse/handler.go + over-notification trust boundary. Verdict: APPROVE, 0 findings (frame leaks nothing beyond {cursor,family}; channels entitlement-derived + family-whitelisted + PG-escaped; pull stays the authz boundary; deleting audience.go lost nothing security-relevant).
- [x] 6.3 DONE: `go-test-reviewer` on handler_test.go, entity/channel_test.go, sse/handler_internals_test.go, hub_test.go, ssecontract_test.go (`push_test.go` does not exist — push tests live in handler_test.go). Fixed: multi-family dedup now asserts total CallCount()==2; payload decoded into CursorNotification + key-whitelisted (not substring). Deferred (pre-existing/untouched): TestPush_RejectsFuturePushedAt time.Now(), fake.go SaveEvent idempotency drift, 1562-line handler_test.go split.
- [x] 6.4 DONE: `ts-reviewer` on useSseClient.ts, useSubjectUpdate.ts (+useSyncClient.ts, SubjectUpdateIndicator.vue). Fixed: untrusted-frame shape guard + race-safe incomingFamily clear; indicator imports computed. Deferred to GAP-8: useSubjectUpdate→useFamilyUpdate rename (settles with the indicator's UX).
- [x] 6.5 DONE: `test-reviewer` on the two TS test files. Fixed: added legacy-frame-missing-family + doorbell-fires-for-any-family guards and assert runSyncCycle on the reject path. useSubjectUpdate.test.ts: APPROVE.
- [x] 6.6 DONE: review findings addressed in commit fc94262; deferrals recorded above with justification.

## Housekeeping

- [x] DONE: `make mr` — all quality gates pass (TS lint, docs, typecheck, audit, 1335 unit + 20 integration, Go fmt/lint/tests). gofmt -w left no stray changes.
- [x] DONE: decision log `site/docs/development/decisions.md` — added the `sse-family-catalog-channels` row (the existing FV-process entry was a different decision).
- [x] DONE: CHANGELOG — root CHANGELOG.md is a pointer; the dev changelog is auto-generated (git-cliff) from conventional commits, which all carry `(#62)`. Nothing to hand-edit.
- [x] Update GitLab issue #62 with task completions — DONE via MR !38's `Closes #62`; issue is `state: closed`.
- [x] DONE: verified against `sse_channel_alignment.fizz` (I1–I7) and the §6 traceability matrix — all seven invariants hold in the shipped code (model's PushReviewPartiallyAccepted matches the 1.7→b cursor-advance decision). No discrepancies.

## Manual tasks

- [x] DONE: Manual end-to-end verification against local Postgres — all sub-checks passed (user-run):
  - [x] seed HLC epoch-ms format correct; client edit accepted over seed
  - [x] push an accepted review event → exactly one frame arrives
  - [x] wildcard-entitlement actor (`review:*`) woken end to end (review + product)
  - [x] product push wakes `sync:product:catalog`; partial-accept push (E3) delivers a non-empty frame (GAP-9 live)
  - [x] persisted `events`/`field_versions` match the frame; frame body is `{ cursor, family }` with no subject/domain data
  - [x] (Phase 4) live `review_answer` cross-actor edit lands in Recent Changes via SSE → runSyncCycle → pull

## Known Gaps

- [x] **Spec-text drift**: `specs/sync-engine/spec.md`'s "Push accepted triggers SSE notification" scenario said the handler computes `family = ChannelFamily(entityType)`. The shipped code never named it `ChannelFamily` — it's `entity.Family(entity.Type(...))` in `services/internal/syncengine/entity/channel.go` (task 1.4 already noted `ChannelFamily` "never existed" as a symbol, but the spec text wasn't corrected to match). Fixed in `specs/sync-engine/spec.md` (2026-07-31).
- [x] Integration test coverage for the NOTIFY/LISTEN round-trip (tasks 1.6, 2.5) — tracked in follow-up issue #121, deliberately dropped from this change (decision, 2026-07-31).
