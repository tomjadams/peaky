/**
 * Tests for sync simulator - repository layer.
 *
 * Tests the sync plane contracts directly at the repository level:
 * - Entitlement snapshots for offline editing windows
 * - Sync cursors for incremental push/pull
 * - Outbox items for pending sync
 * - Pending review queue for reconnect handling
 *
 * @see site/docs/development/walkthroughs/local-first-api.md
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createRepositories,
  resetDatabase,
  getDatabase,
} from "../../../server/db";
import type { PendingReviewItem } from "../../../server/db/repositories/drizzle/sync";

describe("Sync Simulator - Repository Layer", () => {
  let repos: ReturnType<typeof createRepositories>;

  beforeEach(() => {
    resetDatabase();
    repos = createRepositories(getDatabase());
  });

  describe("Entitlement Snapshots", () => {
    it("creates and retrieves entitlement snapshots", async () => {
      const snapshot = await repos.sync.saveEntitlementSnapshot({
        id: "ent_test",
        actorId: "test_actor",
        entitlements: JSON.stringify({
          "review:*": { canEdit: true, canView: true },
        }),
        snapshotVersion: 1,
      });

      expect(snapshot!.actorId).toBe("test_actor");
      const entitlements = JSON.parse(snapshot!.entitlements);
      expect(entitlements["review:*"]).toBeDefined();
      expect(entitlements["review:*"].canEdit).toBe(true);

      const retrieved = await repos.sync.getEntitlementSnapshot("test_actor");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.actorId).toBe("test_actor");
    });

    it("updates existing snapshots", async () => {
      await repos.sync.saveEntitlementSnapshot({
        id: "ent_test",
        actorId: "test_actor",
        entitlements: JSON.stringify({
          "review:*": { canEdit: true, canView: true },
        }),
        snapshotVersion: 1,
      });

      // Update with new entitlements (upsert by actorId)
      const updated = await repos.sync.saveEntitlementSnapshot({
        id: "ent_test",
        actorId: "test_actor",
        entitlements: JSON.stringify({
          "review:*": { canEdit: false, canView: true },
          "product:*": { canEdit: true, canView: true },
        }),
        snapshotVersion: 2,
      });

      expect(updated!.snapshotVersion).toBe(2);
      const entitlements = JSON.parse(updated!.entitlements);
      expect(entitlements["review:*"]).toBeDefined();
      expect(entitlements["review:*"].canEdit).toBe(false);
    });
  });

  describe("Sync Cursors", () => {
    it("manages sync cursors", async () => {
      await repos.sync.saveCursor({
        id: "cursor_test",
        actorId: "test_actor",
        localCursor: "local_123",
        remoteCursor: "remote_456",
      });

      const cursor = await repos.sync.getCursor("test_actor");
      expect(cursor).not.toBeNull();
      expect(cursor?.localCursor).toBe("local_123");
      expect(cursor?.remoteCursor).toBe("remote_456");
    });

    it("updates existing cursors", async () => {
      await repos.sync.saveCursor({
        id: "cursor_test",
        actorId: "test_actor",
        localCursor: "local_1",
        remoteCursor: "remote_1",
      });

      // Update (upsert)
      await repos.sync.saveCursor({
        id: "cursor_test",
        actorId: "test_actor",
        localCursor: "local_2",
        remoteCursor: "remote_2",
      });

      const cursor = await repos.sync.getCursor("test_actor");
      expect(cursor?.localCursor).toBe("local_2");
    });
  });

  describe("Outbox Items", () => {
    it("handles outbox items", async () => {
      const item = await repos.sync.addToOutbox({
        id: "outbox_1",
        actorId: "test_actor",
        entityType: "review",
        entityId: "review_1",
        operation: "create",
        payload: JSON.stringify({ name: "Test Review" }),
        status: "pending",
      });

      expect(item.id).toBe("outbox_1");

      const pending = await repos.sync.getPendingOutboxItems(10);
      expect(pending.length).toBe(1);
      expect(pending[0]).toBeDefined();
      expect(pending[0]!.entityType).toBe("review");
    });

    it("updates outbox status", async () => {
      await repos.sync.addToOutbox({
        id: "outbox_1",
        actorId: "test_actor",
        entityType: "review",
        entityId: "review_1",
        operation: "create",
        payload: JSON.stringify({}),
        status: "pending",
      });

      await repos.sync.updateOutboxStatus("outbox_1", "synced");

      const pending = await repos.sync.getPendingOutboxItems(10);
      expect(pending.length).toBe(0);
    });

    it("limits pending outbox items", async () => {
      // Add 15 items
      for (let i = 0; i < 15; i++) {
        await repos.sync.addToOutbox({
          id: `outbox_${i}`,
          actorId: "test_actor",
          entityType: "review",
          entityId: `review_${i}`,
          operation: "create",
          payload: JSON.stringify({}),
          status: "pending",
        });
      }

      const pending = await repos.sync.getPendingOutboxItems(10);
      expect(pending.length).toBe(10);
    });
  });

  describe("Pending Review Queue", () => {
    it("tracks pending review items", async () => {
      await repos.sync.addToPendingReviewQueue({
        id: "prq_1",
        actorId: "test_actor",
        entityType: "review",
        entityId: "review_1",
        reason: "access_revoked",
        localPayload: JSON.stringify({ name: "Local Review" }),
      });

      const items = await repos.sync.getPendingReviewItems("test_actor");
      expect(items.length).toBe(1);
      expect(items[0]).toBeDefined();
      expect(items[0]!.reason).toBe("access_revoked");
    });

    it("supports different conflict reasons", async () => {
      await repos.sync.addToPendingReviewQueue({
        id: "prq_access",
        actorId: "test_actor",
        entityType: "review",
        entityId: "review_1",
        reason: "access_revoked",
        localPayload: JSON.stringify({}),
      });

      await repos.sync.addToPendingReviewQueue({
        id: "prq_conflict",
        actorId: "test_actor",
        entityType: "product",
        entityId: "product_1",
        reason: "conflict",
        localPayload: JSON.stringify({}),
        remotePayload: JSON.stringify({ name: "Remote Product" }),
      });

      await repos.sync.addToPendingReviewQueue({
        id: "prq_rejected",
        actorId: "test_actor",
        entityType: "template",
        entityId: "template_1",
        reason: "rejected",
        localPayload: JSON.stringify({}),
      });

      const items = await repos.sync.getPendingReviewItems("test_actor");
      expect(items.length).toBe(3);

      const accessRevoked = items.find(
        (i: PendingReviewItem) => i.reason === "access_revoked"
      );
      expect(accessRevoked?.entityType).toBe("review");

      const conflict = items.find(
        (i: PendingReviewItem) => i.reason === "conflict"
      );
      expect(conflict?.remotePayload).toBeDefined();

      const rejected = items.find(
        (i: PendingReviewItem) => i.reason === "rejected"
      );
      expect(rejected?.entityType).toBe("template");
    });
  });
});

describe("Sync Simulator - Database Reset", () => {
  it("clears all state on database reset", async () => {
    const repos = createRepositories(getDatabase());

    // Add state
    await repos.sync.saveEntitlementSnapshot({
      id: "ent_test",
      actorId: "test_actor",
      entitlements: JSON.stringify({}),
      snapshotVersion: 1,
    });

    await repos.sync.saveCursor({
      id: "cursor_test",
      actorId: "test_actor",
    });

    // Verify state exists
    let snapshot = await repos.sync.getEntitlementSnapshot("test_actor");
    expect(snapshot).not.toBeNull();

    // Reset
    resetDatabase();

    // Create new repos with fresh database
    const newRepos = createRepositories(getDatabase());

    // State should be cleared
    snapshot = await newRepos.sync.getEntitlementSnapshot("test_actor");
    expect(snapshot).toBeNull();
  });
});
