/**
 * Standalone DB helpers and utilities for SyncEngine.
 *
 * Extracted to keep SyncEngine.ts under the max-lines threshold while
 * preserving full test-ability of each helper in isolation.
 */

import {
  withDatabase,
  safeParse,
  firstOrNull,
  nowISO,
  createUuidV7,
  eq,
  asc,
  sql,
} from "~/local-db";
import type { outboxStatus } from "#shared/db/schema";
import {
  localOutbox,
  entitlementSnapshots,
  syncCursors,
  pendingReviewQueue,
} from "#shared/db/schema";

type OutboxStatus = (typeof outboxStatus)[number];

export type OutboxItem = typeof localOutbox.$inferSelect;
export type SyncCursor = typeof syncCursors.$inferSelect;
export type LocalEntitlementSnapshot = typeof entitlementSnapshots.$inferSelect;

// ---------------------------------------------------------------------------
// ConcurrencyController — adaptive batch sizing based on push success/failure
// ---------------------------------------------------------------------------

// Lives in its own dependency-free module so the model-based test harness can
// import it outside the Nuxt runtime; re-exported here for existing callers.
export { ConcurrencyController } from "./ConcurrencyController";

// ---------------------------------------------------------------------------
// Outbox helpers
// ---------------------------------------------------------------------------

export async function fetchPendingOutboxItems(
  limit = 100
): Promise<OutboxItem[]> {
  return withDatabase((db) =>
    db
      .select()
      .from(localOutbox)
      .where(eq(localOutbox.status, "pending"))
      .orderBy(asc(localOutbox.createdAt))
      .limit(limit)
  );
}

export async function updateOutboxItemStatus(
  id: string,
  status: OutboxStatus,
  error?: string
): Promise<void> {
  return withDatabase(async (db) => {
    const now = nowISO();
    if (status === "synced") {
      await db
        .update(localOutbox)
        .set({ status, syncedAt: now, updatedAt: now })
        .where(eq(localOutbox.id, id));
    } else if (status === "failed" && error) {
      await db
        .update(localOutbox)
        .set({
          status,
          lastError: error,
          retryCount: sql`${localOutbox.retryCount} + 1`,
          updatedAt: now,
        })
        .where(eq(localOutbox.id, id));
    } else {
      await db
        .update(localOutbox)
        .set({
          status,
          retryCount: sql`${localOutbox.retryCount} + 1`,
          updatedAt: now,
        })
        .where(eq(localOutbox.id, id));
    }
  });
}

export async function insertPendingReviewEntry(
  actorId: string,
  item: OutboxItem,
  reason: "access_revoked" | "conflict" | "rejected"
): Promise<void> {
  return withDatabase(async (db) => {
    await db.insert(pendingReviewQueue).values({
      id: createUuidV7(),
      actorId,
      entityType: item.entityType,
      entityId: item.entityId,
      reason,
      localPayload: item.fields ?? undefined,
      createdAt: nowISO(),
    });
  });
}

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export async function fetchSyncCursor(
  actorId: string
): Promise<SyncCursor | null> {
  return withDatabase(async (db) => {
    const result = await db
      .select()
      .from(syncCursors)
      .where(eq(syncCursors.actorId, actorId))
      .limit(1);
    return firstOrNull(result);
  });
}

export async function upsertSyncCursor(
  actorId: string,
  localCursor: string | null,
  remoteCursor: string | null
): Promise<void> {
  return withDatabase(async (db) => {
    const existing = await fetchSyncCursor(actorId);
    const now = nowISO();
    if (existing) {
      await db
        .update(syncCursors)
        .set({ localCursor, remoteCursor, updatedAt: now })
        .where(eq(syncCursors.actorId, actorId));
    } else {
      await db.insert(syncCursors).values({
        id: createUuidV7(),
        actorId,
        localCursor,
        remoteCursor,
        updatedAt: now,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Entitlement snapshot helpers
// ---------------------------------------------------------------------------

export async function fetchEntitlementSnapshot(
  actorId: string
): Promise<LocalEntitlementSnapshot | null> {
  return withDatabase(async (db) => {
    const result = await db
      .select()
      .from(entitlementSnapshots)
      .where(eq(entitlementSnapshots.actorId, actorId))
      .limit(1);
    return firstOrNull(result);
  });
}

export async function upsertEntitlementSnapshot(
  actorId: string,
  entitlements: Record<string, { canEdit: boolean; canView: boolean }>,
  validUntil?: string
): Promise<void> {
  return withDatabase(async (db) => {
    const existing = await fetchEntitlementSnapshot(actorId);
    const now = nowISO();
    if (existing) {
      await db
        .update(entitlementSnapshots)
        .set({
          entitlements: JSON.stringify(entitlements),
          snapshotVersion: sql`${entitlementSnapshots.snapshotVersion} + 1`,
          validUntil: validUntil ?? null,
          refreshAt: now,
        })
        .where(eq(entitlementSnapshots.actorId, actorId));
    } else {
      await db.insert(entitlementSnapshots).values({
        id: createUuidV7(),
        actorId,
        entitlements: JSON.stringify(entitlements),
        snapshotVersion: 1,
        validUntil: validUntil ?? null,
        createdAt: now,
      });
    }
  });
}

export function checkEntitlement(
  snapshot: LocalEntitlementSnapshot | null,
  entityType: string,
  entityId: string,
  permission: "canEdit" | "canView"
): boolean {
  if (!snapshot) return false;
  const entitlements = safeParse<
    Record<string, { canEdit: boolean; canView: boolean }>
  >(snapshot.entitlements, {});
  const wildcardKey = `${entityType}:*`;
  const specificKey = `${entityType}:${entityId}`;
  return (
    (entitlements[wildcardKey]?.[permission] ?? false) ||
    (entitlements[specificKey]?.[permission] ?? false)
  );
}
