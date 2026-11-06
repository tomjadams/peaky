/**
 * Pending review queue service.
 *
 * Manages items requiring human attention after sync failures:
 * access revocation, conflicts, or server rejections.
 *
 * No Vue imports — all operations are pure async.
 */

import {
  withDatabase,
  safeParse,
  firstOrNull,
  nowISO,
  createUuidV7,
  eq,
  isNull,
  desc,
  sql,
} from "~/local-db";
import type {
  pendingReviewReason,
  pendingReviewResolution,
} from "#shared/db/schema";
import { pendingReviewQueue } from "#shared/db/schema";

type PendingReviewReason = (typeof pendingReviewReason)[number];
type PendingReviewResolution = (typeof pendingReviewResolution)[number];

export type PendingReviewItem = typeof pendingReviewQueue.$inferSelect;
export type Resolution = PendingReviewResolution;

export interface AddPendingItemInput {
  entityType: string;
  entityId: string;
  reason: PendingReviewReason;
  localPayload: Record<string, unknown>;
  remotePayload?: Record<string, unknown>;
  actorId: string;
}

export class PendingQueueService {
  async getUnresolvedItems(): Promise<PendingReviewItem[]> {
    return withDatabase(async (db) => {
      return db
        .select()
        .from(pendingReviewQueue)
        .where(isNull(pendingReviewQueue.resolvedAt))
        .orderBy(desc(pendingReviewQueue.createdAt));
    });
  }

  async getItem(id: string): Promise<PendingReviewItem | null> {
    if (!id) return null;

    return withDatabase(async (db) => {
      const result = await db
        .select()
        .from(pendingReviewQueue)
        .where(eq(pendingReviewQueue.id, id))
        .limit(1);

      return firstOrNull(result);
    });
  }

  async addItem(input: AddPendingItemInput): Promise<string> {
    return withDatabase(async (db) => {
      const id = createUuidV7();
      const now = nowISO();

      await db.insert(pendingReviewQueue).values({
        id,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        localPayload: JSON.stringify(input.localPayload),
        remotePayload: input.remotePayload
          ? JSON.stringify(input.remotePayload)
          : null,
        createdAt: now,
      });

      return id;
    });
  }

  async resolveItem(id: string, resolution: Resolution): Promise<void> {
    if (!id) throw new Error("id is required");

    return withDatabase(async (db) => {
      await db
        .update(pendingReviewQueue)
        .set({ resolution, resolvedAt: nowISO() })
        .where(eq(pendingReviewQueue.id, id));
    });
  }

  async resolveMultiple(ids: string[], resolution: Resolution): Promise<void> {
    for (const id of ids) {
      await this.resolveItem(id, resolution);
    }
  }

  async discardItem(id: string): Promise<void> {
    if (!id) throw new Error("id is required");

    return withDatabase(async (db) => {
      await db.delete(pendingReviewQueue).where(eq(pendingReviewQueue.id, id));
    });
  }

  async getLocalPayload(id: string): Promise<Record<string, unknown> | null> {
    if (!id) return null;

    return withDatabase(async (db) => {
      const result = await db
        .select({ localPayload: pendingReviewQueue.localPayload })
        .from(pendingReviewQueue)
        .where(eq(pendingReviewQueue.id, id))
        .limit(1);

      const item = firstOrNull(result);
      if (!item?.localPayload) return null;
      return safeParse<Record<string, unknown> | null>(item.localPayload, null);
    });
  }

  /** Remove unresolved items older than N days to prevent unbounded growth */
  async clearStaleUnresolved(olderThanDays = 90): Promise<number> {
    return withDatabase(async (db) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffStr = cutoff.toISOString();

      const items = await db
        .select({ id: pendingReviewQueue.id })
        .from(pendingReviewQueue)
        .where(
          sql`${pendingReviewQueue.resolvedAt} IS NULL AND ${pendingReviewQueue.createdAt} < ${cutoffStr}`
        );

      for (const item of items) {
        await db
          .delete(pendingReviewQueue)
          .where(eq(pendingReviewQueue.id, item.id));
      }

      return items.length;
    });
  }

  async clearOldResolved(olderThanDays = 30): Promise<number> {
    return withDatabase(async (db) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - olderThanDays);
      const cutoffStr = cutoff.toISOString();

      const items = await db
        .select({ id: pendingReviewQueue.id })
        .from(pendingReviewQueue)
        .where(
          sql`${pendingReviewQueue.resolvedAt} IS NOT NULL AND ${pendingReviewQueue.resolvedAt} < ${cutoffStr}`
        );

      for (const item of items) {
        await db
          .delete(pendingReviewQueue)
          .where(eq(pendingReviewQueue.id, item.id));
      }

      return items.length;
    });
  }
}

export const pendingQueueService = new PendingQueueService();
