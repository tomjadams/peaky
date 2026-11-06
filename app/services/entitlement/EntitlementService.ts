/**
 * Entitlement snapshot service.
 *
 * An "entitlement snapshot" is a cached permission record fetched from the
 * server and stored locally in SQLite. It lets users continue editing without
 * connectivity for up to 7 days (the offline window) after the last successful
 * refresh. When the window expires, `isOfflineWindowValid()` returns false and
 * the UI should block further local edits.
 *
 * The offline window exists because users may work in areas with no network
 * access. The 7-day limit balances usability against stale-permission risk.
 *
 * Dependency direction:
 *   SyncEngine calls `refreshEntitlements()` on reconnect, which in turn
 *   calls `saveSnapshot()` here. EntitlementService does not import SyncEngine
 *   and has no knowledge of the sync transport.
 *
 * No Vue imports — all DB operations are pure async.
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

import {
  withDatabase,
  safeParse,
  firstOrNull,
  nowISO,
  createUuidV7,
  eq,
  sql,
} from "~/local-db";
import { entitlementSnapshots } from "#shared/db/schema";

export type EntitlementSnapshot = typeof entitlementSnapshots.$inferSelect;

export interface Entitlement {
  canEdit: boolean;
  canView: boolean;
}

const DEFAULT_OFFLINE_WINDOW_DAYS = 7;

export class EntitlementService {
  async getSnapshot(actorId: string): Promise<EntitlementSnapshot | null> {
    return withDatabase(async (db) => {
      const result = await db
        .select()
        .from(entitlementSnapshots)
        .where(eq(entitlementSnapshots.actorId, actorId))
        .limit(1);

      return firstOrNull(result);
    });
  }

  async saveSnapshot(
    actorId: string,
    entitlements: Record<string, Entitlement>,
    validUntil?: string
  ): Promise<void> {
    const now = nowISO();

    return withDatabase(async (db) => {
      await db
        .insert(entitlementSnapshots)
        .values({
          id: createUuidV7(),
          actorId,
          entitlements: JSON.stringify(entitlements),
          snapshotVersion: 1,
          validUntil: validUntil ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: entitlementSnapshots.actorId,
          set: {
            entitlements: JSON.stringify(entitlements),
            snapshotVersion: sql`${entitlementSnapshots.snapshotVersion} + 1`,
            validUntil: validUntil ?? null,
            refreshAt: now,
          },
        });
    });
  }

  async updateEntitlement(
    actorId: string,
    entityType: string,
    entityId: string,
    entitlement: Entitlement
  ): Promise<void> {
    return withDatabase(async (db) => {
      const existing = await db
        .select()
        .from(entitlementSnapshots)
        .where(eq(entitlementSnapshots.actorId, actorId))
        .limit(1);

      if (existing.length === 0) return;

      const snapshot = existing[0]!;
      const current = safeParse<Record<string, Entitlement>>(
        snapshot.entitlements,
        {}
      );
      const key = `${entityType}:${entityId}`;
      current[key] = entitlement;

      await db
        .update(entitlementSnapshots)
        .set({
          entitlements: JSON.stringify(current),
          snapshotVersion: sql`${entitlementSnapshots.snapshotVersion} + 1`,
          refreshAt: nowISO(),
        })
        .where(eq(entitlementSnapshots.actorId, actorId));
    });
  }

  async revokeEditAccess(
    actorId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    await this.updateEntitlement(actorId, entityType, entityId, {
      canEdit: false,
      canView: true,
    });
  }

  async revokeAllAccess(
    actorId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    await this.updateEntitlement(actorId, entityType, entityId, {
      canEdit: false,
      canView: false,
    });
  }

  /**
   * Return true if the actor has edit permission for the given entity.
   *
   * Checks both the wildcard key (`entityType:*`) and the specific key
   * (`entityType:entityId`). The wildcard grants access to all entities of
   * that type — for example, a `review:*` entry means the actor can edit
   * every review regardless of ID.
   */
  canEdit(
    entitlements: Record<string, Entitlement>,
    entityType: string,
    entityId: string
  ): boolean {
    const wildcardKey = `${entityType}:*`;
    const specificKey = `${entityType}:${entityId}`;
    return (
      (entitlements[wildcardKey]?.canEdit ?? false) ||
      (entitlements[specificKey]?.canEdit ?? false)
    );
  }

  /**
   * Return true if the actor has view permission for the given entity.
   *
   * Follows the same wildcard lookup as `canEdit`. A `review:*` wildcard
   * entry with `canView: true` grants visibility to all reviews.
   */
  canView(
    entitlements: Record<string, Entitlement>,
    entityType: string,
    entityId: string
  ): boolean {
    const wildcardKey = `${entityType}:*`;
    const specificKey = `${entityType}:${entityId}`;
    return (
      (entitlements[wildcardKey]?.canView ?? false) ||
      (entitlements[specificKey]?.canView ?? false)
    );
  }

  /**
   * Return true if the offline editing window has not yet expired.
   *
   * The window is calculated from `snapshot.createdAt` + 7 days.
   * Returns false if `snapshot.createdAt` is missing.
   * At exactly 7 days (expiry == now to the millisecond) this returns false —
   * the boundary is exclusive (strictly greater-than).
   */
  isOfflineWindowValid(snapshot: EntitlementSnapshot): boolean {
    if (!snapshot.createdAt) return false;
    const created = new Date(snapshot.createdAt);
    const expiry = new Date(created);
    expiry.setDate(expiry.getDate() + DEFAULT_OFFLINE_WINDOW_DAYS);
    return expiry > new Date();
  }

  /**
   * Return the number of full days remaining in the offline window.
   *
   * Returns 0 when the window has expired or when `snapshot.createdAt` is
   * missing. The value is always non-negative (floored at 0).
   * At exactly 0 remaining days the offline window should be treated as
   * expired — callers should use `isOfflineWindowValid()` as the gate.
   */
  getRemainingOfflineDays(snapshot: EntitlementSnapshot): number {
    if (!snapshot.createdAt) return 0;
    const created = new Date(snapshot.createdAt);
    const expiry = new Date(created);
    expiry.setDate(expiry.getDate() + DEFAULT_OFFLINE_WINDOW_DAYS);
    const diff = expiry.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
}

export const entitlementService = new EntitlementService();
