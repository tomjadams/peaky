# Local-First Failure Domains — Walkthrough

This page is for fast scanning during debugging and on-call support.

If you need the system model first, read [Architecture](./architecture). If you already know the model and need to find the broken layer quickly, stay here.

## 1. Scan map

| Symptom | Most likely domain | First check |
| --- | --- | --- |
| search shows too few people or teams | catalog-directory mirror bootstrap | `/api/catalog-directory-mirror/bootstrap` |
| page data loads slowly but API is fast | blocking local hydration | client composable waiting on local SQLite |
| enabled local edits show but disappear after refresh | local write path or migration mismatch | local SQLite tables + outbox rows + `events` |
| Template draft disappeared after local-data reset or device loss | expected local-only boundary | draft Revision rows; no event/outbox/server recovery exists yet |
| enabled local edits never reach server state | sync push handling | `/api/sync/push` + outbox entity type |
| action is attributed to the wrong person | actor propagation | `x-actor-*` headers / persisted actor |
| attachment exists but cannot really download offline | metadata vs blob storage split | attachment sync status and remote object path |
| local DB fails to bootstrap on this device | migration runner or OPFS | `/system` page (Database tile + emergency banner); also `_migration_log` and the latest `LocalDbMigrationFailed.v1` event |
| sync seems stuck or last-sync time is old | sync cycle | `/system` Sync tile shows in-sync / stale / paused / failed; latest `SyncCycle{Started,Succeeded,Failed}.v1` events for context |
| OPFS quota concerns | storage | `/system` Storage tile shows usage % vs quota; latest `OpfsStorageMeasured.v1` and any `OpfsQuotaWarning.v1` |

> **Recovery surface for end-users**: `/system` is available to every authenticated member. The Maintenance section's single "Recreate local DB" button is the supported recovery path — it sets `peaky-clear-db-on-reload` and reloads. Server data is unaffected, but local-only unpublished Template work is permanently removed because it has no event, outbox, or server copy. See [Upgrades — The /system page is the recovery surface](./upgrades#the-system-page-is-the-recovery-surface).

## 2. Failure domain: deployment packaging

The most common deployment-specific failure is a runtime that cannot see checked-in files on disk even though the build succeeded. Peaky avoids that for migrations and the full catalog snapshot by bundling generated migration content and the snapshot into the deployment artifact, so if this breaks the first question is whether the generated transport file or bundled snapshot drifted from source.

### Fast checks

- inspect `shared/db/migrations/sqlite-content.ts`
- inspect `server/data/catalog-directory-mirror.snapshot.json`
- hit `/api/catalog-directory-mirror/bootstrap`

## 3. Failure domain: browser bootstrap race

Mirror-backed lookups can fail if a page asks for local users/groups/components before the startup seed has finished populating SQLite. The protection is a shared bootstrap promise in the mirror layer, so if search is empty but remote pages still load, suspect a bootstrap race or a failed seed before suspecting the search UI itself.

### Fast checks

- browser console for local DB/bootstrap errors
- local mirror tables in SQLite
- `app/catalog-directory-mirror/local.ts`

## 4. Failure domain: progressive hydration confusion

Some screens intentionally mix remote-first reads with later local overlays so the UI paints faster. That means a bug can live in the first paint, the later local merge, or the interaction between them, so on-call debugging should ask "was the row missing from the remote API, or only from the post-hydration local overlay?" before treating it as one generic loading issue.

### Fast checks

- network timing for `/api/*` route
- whether the page waits on `Promise.all(remote, local)`
- whether local-only entities appear after a second render pass

## 5. Failure domain: sync contract mismatch

An enabled local-first write is durable across systems only if its outbox entity type and fields are implemented by the sync plane. If such a mutation appears locally but never lands remotely, `/api/sync/push` may not apply that entity/field yet, or authorization may reject it.

Do not apply that diagnosis to Template draft authoring: it intentionally creates no outbox row or event, even though the Go registry still recognizes legacy Template type strings. Exact local Review Revision selections are also absent from Review outbox fields, Go validation, inbound replay, and PostgreSQL Review projection. Those are documented deferred boundaries, not a stuck queue.

### Fast checks

- local outbox rows and `entityType`
- `/api/sync/push` handling for that entity type
- pending vs failed outbox status

## 6. Failure domain: actor and authorization drift

The browser-local actor is explicit UI state, while server enforcement still happens on request boundaries. If uploads, notes, or lifecycle events show the wrong person or unexpectedly reject, the first suspicion should be actor propagation drift: the current browser actor, request headers, SSE query params, and server-side authorization helper may not all be using the same identity snapshot.

### Fast checks

- current actor in local storage
- `x-actor-id`, `x-actor-name`, `x-actor-roles`
- `server/utils/lifecycleActor.ts`
- review/product/template authorization helpers

## 7. Failure domain: attachments are split between metadata and blobs

Attachments are intentionally not the same as text notes. The current design keeps attachment metadata local-first but does not assume every browser should durably store every binary file just so it can upload later, so a pending attachment can be visible in the UI while the real remote object is still missing. This is a deliberate trade-off, not automatically a bug.

### Fast checks

- does the attachment show a pending or `not synced` state?
- is the remote object key present yet?
- is the failure in metadata, background upload, or download URL generation?

## 8. Failure domain: mutation transaction integrity

Enabled mutations use `LocalMutation.commit()` to atomically write state, a domain event, and an outbox entry in one SQLite transaction. Template draft authoring uses `LocalMutation.localOnly()` for one atomic state-only transaction. A partial write indicates that the applicable mutation boundary was bypassed; missing Template event/outbox rows are expected.

| Symptom | Domain | First check |
| --- | --- | --- |
| Answer saved but missing from admin feed | Mutation transaction | Check `events` table — missing event means partial write before `LocalMutation.commit()` was in use |
| Item in outbox but no matching event | Mutation transaction | `LocalMutation.commit()` wraps both — if this occurs, investigate transaction support |

## 9. Failure domain: retry and backoff

Two layers of backoff protect the server from retry storms:

**Per-item retry** (`AdaptiveRetryPolicy`): exponential backoff with decorrelated jitter, capped at 60s. Classifies errors as retryable (network, 5xx) or terminal (403, access_revoked). Combined with `ConcurrencyController` (adaptive batch sizing starting at 5).

**Per-endpoint backoff gates** (`BackoffGate`): each server endpoint gets its own gate instance so independent failure domains don't interfere. `syncGate` (30s base, 5 min cap) gates sync polling and user-triggered pushes to peaky-api. `sseGate` (1s base, 2 min cap) gates SSE reconnect to peaky-sse. This avoids the shared circuit breaker anti-pattern — SSE being down does not throttle push.

Both composables accept the gate via dependency injection (`{ gate }` parameter), defaulting to the singleton. `SyncEngine.runSyncCycle()` returns error-as-value (`SyncCycleResult`), never throws.

| Symptom | Domain | First check |
| --- | --- | --- |
| Outbox items stuck in "pending" | Retry policy | Check `retryCount` — may have exhausted `maxAttempts` (5) |
| Server flooded after long offline period | Concurrency control | `ConcurrencyController` should ramp up gradually — check `batchSize` adaptation |
| Items stuck in "syncing" | Sync cycle crash | Items reset to pending on next boot |
| Sync interval stuck at 5 min | Backoff gate | Check `syncGate.consecutiveFailures` — server may be returning errors |
| SSE not reconnecting | SSE backoff gate | Check `sseGate.consecutiveFailures` — may be at 2 min cap |
| Push blocked despite API being up | Wrong gate | Ensure `syncGate` and `sseGate` are separate instances (not shared) |

## 10. Failure domain: storage quota

The `StorageMonitor` watches OPFS quota and prunes synced outbox items.

| Symptom | Domain | First check |
| --- | --- | --- |
| OPFS quota errors | Storage | `StorageMonitor.getStorageHealth()` — check synced outbox items that need pruning |

## 11. Suggested debugging order

1. Confirm whether the failure is remote API, local SQLite, or sync bridge.
2. Check actor propagation before changing authorization logic.
3. Check bundled artifacts before blaming serverless runtime behavior.
4. For attachments, separate metadata problems from binary-file problems.
5. For partial enabled writes, check `events`; for Template drafts, verify the atomic state-only rows instead.
6. Only after that, inspect the page component itself.
