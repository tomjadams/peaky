/**
 * Core sync orchestration service.
 *
 * Owns all DB and HTTP logic for the outbox push/pull cycle:
 * - Outbox item status management
 * - Cursor tracking (local + remote positions)
 * - Bootstrap, push, pull protocol
 * - Entitlement snapshot refresh
 *
 * No Vue imports. Called by useSyncClient composable (30 s interval).
 *
 * Formal models: formal_verification/sync/outbox_item_lifecycle.fizz (status
 * transitions) and formal_verification/sync/sync_engine_push_pull.fizz (the
 * client half of the push/pull protocol and cursor handling). Changing either
 * requires updating the spec — `make verify` cannot detect that drift.
 *
 * Sync cycle:
 *
 *   runSyncCycle()
 *     ├─ getPendingItems(batchSize)     — up to N items from local_outbox
 *     ├─ pushChanges(items)             — POST /api/sync/push
 *     │   ├─ accepted → markItemSynced()
 *     │   ├─ rejected/access_revoked → PendingReviewQueue.addItem()
 *     │   └─ network error → markItemFailed() + AdaptiveRetryPolicy.getDelay()
 *     ├─ concurrencyController.onSuccess/onFailure()
 *     └─ pullChanges(cursor)            — GET /api/sync/pull?since=cursor
 *          └─ saveCursor()              — advances only on success
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import { buildLifecycleActorHeaders } from "~/lifecycle/management";
import { nowISO, createUuidV7, safeParse } from "~/local-db";
import { defaultRetryPolicy } from "./RetryPolicy";
import { dispatchInboundEvent, type PulledEvent } from "./inbound";
import { getHLCClock } from "./syncClock";
import { emitSystemEvent } from "~/services/events/emitSystemEvent";
import { sanitiseError } from "~/services/events/sanitiseError";
import type {
  EntitlementsRefreshed,
  SyncCycleStarted,
  SyncCycleSucceeded,
  SyncCycleFailed,
} from "~/services/events/DomainEvent";

import {
  ConcurrencyController,
  fetchPendingOutboxItems,
  updateOutboxItemStatus,
  insertPendingReviewEntry,
  fetchSyncCursor,
  upsertSyncCursor,
  fetchEntitlementSnapshot,
  upsertEntitlementSnapshot,
  checkEntitlement,
} from "./SyncEngine-helpers";

export { ConcurrencyController } from "./SyncEngine-helpers";
export type {
  OutboxItem,
  SyncCursor,
  LocalEntitlementSnapshot,
} from "./SyncEngine-helpers";

// Response types for the Go sync backend (no longer inferred from Nitro routes).
interface BootstrapResponse {
  entitlements: Record<string, { canEdit: boolean; canView: boolean }>;
  cursors: { local: string | null; remote: string | null };
}
interface PushResponse {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
  newClientCursor: string;
}
interface PullResponse {
  events: PulledEvent[];
  cursor: string | null;
}
interface EntitlementRefreshResponse {
  current: {
    entitlements: Record<string, { canEdit: boolean; canView: boolean }>;
  };
  hasDowngrades: boolean;
  changes: Array<{
    entityType: string;
    entityId: string;
    newStatus: "edit" | "view" | "none";
    reason: string;
  }>;
}

export interface SyncCycleResult {
  success: boolean;
  pullDegraded: boolean;
  pendingCount: number;
  lastSyncAt?: string;
  error?: string;
}

export interface PushResult {
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
}

export class SyncEngine {
  private readonly concurrencyController = new ConcurrencyController({
    initial: 5,
    max: 20,
    min: 1,
  });

  private getCurrentActor() {
    return readPersistedActor();
  }

  private getActorId(): string {
    return this.getCurrentActor().id;
  }

  private getActorHeaders(): Record<string, string> {
    return buildLifecycleActorHeaders(this.getCurrentActor());
  }

  async getPendingItems(limit = 100) {
    return fetchPendingOutboxItems(limit);
  }

  async markItemSyncing(id: string): Promise<void> {
    return updateOutboxItemStatus(id, "syncing");
  }

  async markItemSynced(id: string): Promise<void> {
    return updateOutboxItemStatus(id, "synced");
  }

  async markItemFailed(id: string, error?: string): Promise<void> {
    return updateOutboxItemStatus(id, "failed", error);
  }

  async resetItemForRetry(id: string, reason?: string): Promise<void> {
    return updateOutboxItemStatus(id, "pending", reason);
  }

  async getCursor(actorId: string) {
    return fetchSyncCursor(actorId);
  }

  async saveCursor(
    actorId: string,
    localCursor: string | null,
    remoteCursor: string | null
  ): Promise<void> {
    return upsertSyncCursor(actorId, localCursor, remoteCursor);
  }

  async getEntitlementSnapshot(actorId: string) {
    return fetchEntitlementSnapshot(actorId);
  }

  async saveEntitlementSnapshot(
    actorId: string,
    entitlements: Record<string, { canEdit: boolean; canView: boolean }>,
    validUntil?: string
  ): Promise<void> {
    return upsertEntitlementSnapshot(actorId, entitlements, validUntil);
  }

  async canEdit(entityType: string, entityId: string): Promise<boolean> {
    const snapshot = await fetchEntitlementSnapshot(this.getActorId());
    return checkEntitlement(snapshot, entityType, entityId, "canEdit");
  }

  async canView(entityType: string, entityId: string): Promise<boolean> {
    const snapshot = await fetchEntitlementSnapshot(this.getActorId());
    return checkEntitlement(snapshot, entityType, entityId, "canView");
  }

  private async addToPendingReviewQueue(
    item: Awaited<ReturnType<typeof fetchPendingOutboxItems>>[number],
    reason: "access_revoked" | "conflict" | "rejected"
  ): Promise<void> {
    return insertPendingReviewEntry(this.getActorId(), item, reason);
  }

  private async handleRejectedItem(
    item: Awaited<ReturnType<typeof fetchPendingOutboxItems>>[number],
    rejected: { id: string; reason: string }
  ): Promise<void> {
    if (
      rejected.reason === "access_revoked" ||
      !defaultRetryPolicy.isRetryable(rejected.reason)
    ) {
      if (rejected.reason === "access_revoked") {
        await this.addToPendingReviewQueue(item, "access_revoked");
      }
      await this.markItemFailed(rejected.id, rejected.reason);
    } else if (item.retryCount >= defaultRetryPolicy.maxAttempts) {
      await this.markItemFailed(rejected.id, rejected.reason);
    } else {
      await this.resetItemForRetry(rejected.id, rejected.reason);
    }
  }

  private async revokeAccessForDowngradedChange(
    change: { entityType: string; newStatus: "edit" | "view" | "none" },
    pendingItems: Awaited<ReturnType<typeof fetchPendingOutboxItems>>
  ): Promise<void> {
    if (change.newStatus !== "none" && change.newStatus !== "view") {
      return;
    }
    const affectedItems = pendingItems.filter(
      (item) => item.entityType === change.entityType
    );
    for (const item of affectedItems) {
      await this.addToPendingReviewQueue(item, "access_revoked");
      await this.markItemFailed(item.id, "access_revoked");
    }
  }

  async bootstrap(): Promise<boolean> {
    try {
      const actorId = this.getActorId();

      // Skip the network call if SQLite already has an entitlement snapshot.
      // Both entitlements (entitlement_snapshots) and the pull cursor
      // (sync_cursors) are persisted to SQLite on first boot, so subsequent
      // page loads have everything they need locally.
      //
      // Phase 1: entitlements are static (actor registry JSON — no runtime
      // changes). Phase 4 (Okta JWT) will add validUntil-based expiry.
      //
      // Cursor reset detection (make watch reseed) is a dev-only concern;
      // a hard-refresh or clearLocalData() drops the snapshot and re-bootstraps.
      const existing = await this.getEntitlementSnapshot(actorId);
      if (existing) return true;

      const response = await $fetch<BootstrapResponse>("/api/sync/bootstrap", {
        method: "GET",
        headers: this.getActorHeaders(),
      });
      await this.saveEntitlementSnapshot(actorId, response.entitlements);
      // Only save the local cursor (push deduplication marker) from bootstrap.
      // The remote cursor tracks the pull window and must be established by
      // the first successful pullChanges(), not inherited from the server snapshot.
      // If we saved the server remoteCursor here, a client that recreated its
      // local DB would inherit the server's cursor (which is at the end of all
      // events) and receive zero events on the next pull — appearing empty.
      await this.saveCursor(actorId, response.cursors.local, null);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Drain the local_outbox queue to /api/sync/push.
   *
   * **Deliberately decoupled from the events table.** This method reads
   * `local_outbox`, updates row status (`pending → syncing → synced/failed`),
   * and never writes to or advances status on the `events` table. Event
   * status will be advanced by a separate event push pipeline owned by the
   * future Rust sync engine — see roadmap.md, Stage 2.
   *
   * The local variable `events` below is the outgoing HTTP payload mapped
   * from outbox rows, NOT a reference to the events SQLite table.
   */
  async pushChanges(): Promise<PushResult> {
    const actorId = this.getActorId();
    const cursor = await this.getCursor(actorId);
    const pendingItems = await this.getPendingItems(
      this.concurrencyController.batchSize
    );

    if (pendingItems.length === 0) {
      return { accepted: [], rejected: [] };
    }

    // Discard legacy-format items (pre-HLC: fields stored as a plain object,
    // not an array of {name, value, hlc}). These can never be accepted by the
    // current server and would block the queue forever if left as "pending".
    const legacyItems = pendingItems.filter((item) => {
      const fields = safeParse<unknown>(item.fields, null);
      return !Array.isArray(fields);
    });
    for (const item of legacyItems) {
      await this.markItemFailed(item.id, "legacy_fields_format");
    }
    const validItems = pendingItems.filter(
      (item) => !legacyItems.includes(item)
    );
    if (validItems.length === 0) {
      return { accepted: [], rejected: [] };
    }

    for (const item of validItems) {
      await this.markItemSyncing(item.id);
    }

    const events = validItems.map((item) => ({
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      actorId: actorId,
      fields:
        safeParse<Array<{ name: string; value: unknown; hlc: string }> | null>(
          item.fields,
          null
        ) ?? [],
      pushedAt: item.createdAt,
    }));

    try {
      const response = await $fetch<PushResponse>("/api/sync/push", {
        method: "POST",
        headers: this.getActorHeaders(),
        body: { clientCursor: cursor?.localCursor, events },
      });

      for (const acceptedId of response.accepted) {
        await this.markItemSynced(acceptedId);
      }

      let hadRejections = false;
      for (const rejected of response.rejected) {
        hadRejections = true;
        const item = validItems.find((i) => i.id === rejected.id);
        if (item) {
          await this.handleRejectedItem(item, rejected);
        }
      }

      if (hadRejections) {
        this.concurrencyController.onFailure();
      } else {
        this.concurrencyController.onSuccess();
      }

      // Only advance localCursor from push (deduplication marker).
      // remoteCursor must NOT be updated here — it tracks the pull window.
      // Setting remoteCursor = pushedAt would cause the next pull to use
      // WHERE time > pushedAt, missing the event just accepted (time = pushedAt).
      // remoteCursor is advanced exclusively by pullChanges().
      await this.saveCursor(
        actorId,
        response.newClientCursor,
        cursor?.remoteCursor ?? null
      );
      return { accepted: response.accepted, rejected: response.rejected };
    } catch (error) {
      this.concurrencyController.onFailure();
      const errorMsg = error instanceof Error ? error.message : "Push failed";
      for (const item of validItems) {
        if (
          !defaultRetryPolicy.isRetryable(error) ||
          item.retryCount >= defaultRetryPolicy.maxAttempts
        ) {
          await this.markItemFailed(item.id, errorMsg);
        } else {
          await this.resetItemForRetry(item.id, errorMsg);
        }
      }
      throw error;
    }
  }

  async pullChanges(): Promise<void> {
    const actorId = this.getActorId();
    const cursor = await this.getCursor(actorId);
    const response = await $fetch<PullResponse>("/api/sync/pull", {
      method: "GET",
      headers: this.getActorHeaders(),
      query: { after: cursor?.remoteCursor },
    });
    // Guard: when no backend proxy is configured the Nuxt dev server's SPA
    // catch-all returns 200 HTML. typeof check catches that before the
    // response.events ?? [] fallback silently treats it as an empty pull.
    if (typeof response !== "object" || response === null) {
      throw new Error(
        "Sync backend unreachable or returned unexpected response"
      );
    }
    const clock = getHLCClock();
    for (const event of response.events ?? []) {
      await dispatchInboundEvent(event);
      // Advance local clock to track remote timestamps — ensures next
      // now() is causally after observed events. Jump clock guard in
      // receive() rejects timestamps >60s ahead of local time.
      for (const field of event.fields ?? []) {
        clock.receive(field.hlc);
      }
    }
    await this.saveCursor(
      actorId,
      cursor?.localCursor ?? null,
      response.cursor
    );
  }

  async refreshEntitlements(): Promise<{
    hasDowngrades: boolean;
    changes: Array<{
      entityType: string;
      entityId: string;
      newStatus: "edit" | "view" | "none";
      reason: string;
    }>;
  }> {
    const actorId = this.getActorId();
    try {
      const response = await $fetch<EntitlementRefreshResponse>(
        "/api/sync/entitlements",
        {
          method: "GET",
          headers: this.getActorHeaders(),
        }
      );
      await this.saveEntitlementSnapshot(
        actorId,
        response.current.entitlements
      );
      if (response.hasDowngrades) {
        const pendingItems = await this.getPendingItems();
        for (const change of response.changes) {
          await this.revokeAccessForDowngradedChange(change, pendingItems);
        }
      }
      await emitSystemEvent<EntitlementsRefreshed>({
        type: "EntitlementsRefreshed.v1",
        entityId: actorId,
        data: {
          hasDowngrades: response.hasDowngrades,
          changeCount: response.changes.length,
        },
      });
      return {
        hasDowngrades: response.hasDowngrades,
        changes: response.changes,
      };
    } catch (error) {
      console.error("[sync] Entitlement refresh failed:", error);
      return { hasDowngrades: false, changes: [] };
    }
  }

  /**
   * Run a complete push→pull sync cycle.
   *
   * Called every 30 seconds by `useSyncClient` and immediately on tab focus.
   * If no cursor exists (first run or cleared state), `bootstrap()` is called
   * first to initialise cursors and entitlement snapshot from the server.
   *
   * Push uses the current `ConcurrencyController.batchSize`; the controller
   * is updated via `onSuccess()` / `onFailure()` after each push attempt.
   * Pull advances the remote cursor only when the server responds successfully.
   *
   * @returns `SyncCycleResult` with `success`, `pendingCount`, and
   *   `lastSyncAt` on success, or `error` message on failure. Never throws.
   */
  async runSyncCycle(opts?: {
    /** Skip bootstrap — use for triggered cycles (draft writes). Bootstrap
     * runs on startup and the 30 s scheduled interval; not on every push. */
    skipBootstrap?: boolean;
  }): Promise<SyncCycleResult> {
    const cycleId = createUuidV7();
    const startedAt = performance.now();
    await emitSystemEvent<SyncCycleStarted>({
      type: "SyncCycleStarted.v1",
      entityId: cycleId,
      data: { cycleId },
    });
    try {
      // Bootstrap on startup only (skipBootstrap=true on all other cycles).
      // Entitlement refresh is handled by refreshEntitlements() on tab focus.
      // Cursor reset detection (make watch reseed) is a dev-only concern;
      // a page reload triggers startup bootstrap which handles it.
      if (!opts?.skipBootstrap) {
        await this.bootstrap();
      }
      const pushResult = await this.pushChanges();
      let pullDegraded = false;
      try {
        await this.pullChanges();
      } catch {
        pullDegraded = true;
      }
      const pending = await this.getPendingItems();
      const durationMs = Math.round(performance.now() - startedAt);
      await emitSystemEvent<SyncCycleSucceeded>({
        type: "SyncCycleSucceeded.v1",
        entityId: cycleId,
        data: {
          cycleId,
          eventsPushed: pushResult.accepted.length,
          // No events pulled today; the Rust engine will populate this
          // count when remote → local replication lands.
          eventsPulled: 0,
          durationMs,
        },
      });
      return {
        success: true,
        pullDegraded,
        pendingCount: pending.length,
        lastSyncAt: nowISO(),
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      await emitSystemEvent<SyncCycleFailed>({
        type: "SyncCycleFailed.v1",
        entityId: cycleId,
        data: {
          cycleId,
          errorMessage: sanitiseError(error),
          durationMs,
        },
      });
      return {
        success: false,
        pullDegraded: false,
        pendingCount: 0,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }
}

export const syncEngine = new SyncEngine();
