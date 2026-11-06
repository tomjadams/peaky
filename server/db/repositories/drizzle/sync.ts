/**
 * Sync repository - outbox, entitlements, cursors, and pending review queue.
 *
 * Supports offline editing, sync, and reconnect handling:
 * - Outbox: queued changes waiting to sync
 * - Entitlements: cached permissions for offline editing
 * - Cursors: track sync positions for incremental push/pull
 * - Pending queue: conflicts and revoked access items needing resolution
 */
import type { InferSelectModel } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  localOutbox,
  entitlementSnapshots,
  syncCursors,
  pendingReviewQueue,
} from "../../schema";

// === Types ===

export type LocalOutboxItem = InferSelectModel<typeof localOutbox>;
export type EntitlementSnapshot = InferSelectModel<typeof entitlementSnapshots>;
export type SyncCursor = InferSelectModel<typeof syncCursors>;
export type PendingReviewItem = InferSelectModel<typeof pendingReviewQueue>;

export type OutboxItemInput = Pick<
  LocalOutboxItem,
  "id" | "actorId" | "entityType" | "entityId" | "operation"
> & {
  fields?: LocalOutboxItem["fields"];
  status?: LocalOutboxItem["status"];
};

export type EntitlementSnapshotInput = Pick<
  EntitlementSnapshot,
  "id" | "actorId" | "entitlements"
> & {
  snapshotVersion?: EntitlementSnapshot["snapshotVersion"];
  validUntil?: EntitlementSnapshot["validUntil"];
};

export type SyncCursorInput = Pick<SyncCursor, "id" | "actorId"> & {
  localCursor?: SyncCursor["localCursor"];
  remoteCursor?: SyncCursor["remoteCursor"];
};

export type PendingReviewItemInput = Pick<
  PendingReviewItem,
  "id" | "actorId" | "entityType" | "entityId" | "reason"
> & {
  localPayload?: PendingReviewItem["localPayload"];
  remotePayload?: PendingReviewItem["remotePayload"];
};

export type OutboxStatus = LocalOutboxItem["status"];

// === Repository ===

export class SyncRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  // === Outbox ===

  async getPendingOutboxItems(limit = 100): Promise<LocalOutboxItem[]> {
    return this.db
      .select()
      .from(localOutbox)
      .where(eq(localOutbox.status, "pending"))
      .orderBy(desc(localOutbox.createdAt))
      .limit(limit);
  }

  async addToOutbox(item: OutboxItemInput): Promise<LocalOutboxItem> {
    const now = new Date().toISOString();
    await this.db.insert(localOutbox).values({
      ...item,
      status: item.status ?? "pending",
      createdAt: now,
      retryCount: 0,
    });
    const result = await this.db
      .select()
      .from(localOutbox)
      .where(eq(localOutbox.id, item.id))
      .limit(1);
    const saved = result[0];
    if (!saved) throw new Error(`Failed to create outbox item ${item.id}`);
    return saved;
  }

  async updateOutboxStatus(id: string, status: OutboxStatus): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(localOutbox)
      .set({ status, updatedAt: now })
      .where(eq(localOutbox.id, id));
  }

  // === Entitlements ===

  async getEntitlementSnapshot(
    actorId: string
  ): Promise<EntitlementSnapshot | null> {
    const result = await this.db
      .select()
      .from(entitlementSnapshots)
      .where(eq(entitlementSnapshots.actorId, actorId))
      .limit(1);
    return result[0] ?? null;
  }

  async saveEntitlementSnapshot(
    data: EntitlementSnapshotInput
  ): Promise<EntitlementSnapshot | null> {
    const now = new Date().toISOString();
    // Upsert: delete existing, then insert
    await this.db
      .delete(entitlementSnapshots)
      .where(eq(entitlementSnapshots.actorId, data.actorId));
    await this.db.insert(entitlementSnapshots).values({
      ...data,
      snapshotVersion: data.snapshotVersion ?? 1,
      validUntil: data.validUntil ?? null,
      createdAt: now,
      refreshAt: now,
    });
    return this.getEntitlementSnapshot(data.actorId);
  }

  // === Cursors ===

  async getCursor(actorId: string): Promise<SyncCursor | null> {
    const result = await this.db
      .select()
      .from(syncCursors)
      .where(eq(syncCursors.actorId, actorId))
      .limit(1);
    return result[0] ?? null;
  }

  async saveCursor(data: SyncCursorInput): Promise<SyncCursor | null> {
    const now = new Date().toISOString();
    // Upsert
    await this.db
      .delete(syncCursors)
      .where(eq(syncCursors.actorId, data.actorId));
    await this.db.insert(syncCursors).values({
      ...data,
      updatedAt: now,
    });
    return this.getCursor(data.actorId);
  }

  // === Pending Review Queue ===

  async getPendingReviewItems(actorId: string): Promise<PendingReviewItem[]> {
    return this.db
      .select()
      .from(pendingReviewQueue)
      .where(
        and(
          eq(pendingReviewQueue.actorId, actorId),
          isNull(pendingReviewQueue.resolution)
        )
      );
  }

  async addToPendingReviewQueue(
    item: PendingReviewItemInput
  ): Promise<PendingReviewItem> {
    const now = new Date().toISOString();
    await this.db.insert(pendingReviewQueue).values({
      ...item,
      createdAt: now,
    });
    const result = await this.db
      .select()
      .from(pendingReviewQueue)
      .where(eq(pendingReviewQueue.id, item.id))
      .limit(1);
    const saved = result[0];
    if (!saved)
      throw new Error(`Failed to create pending review item ${item.id}`);
    return saved;
  }
}
