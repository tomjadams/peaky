import { beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import {
  PendingQueueService,
  type PendingReviewItem,
} from "~/services/sync/PendingQueueService";

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
    createUuidV7: vi.fn(() => "00000000-0000-7000-8000-000000000001"),
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
    eq: actual.eq,
    isNull: actual.isNull,
    desc: actual.desc,
    sql: actual.sql,
  };
});

function makePendingItem(
  overrides: Partial<PendingReviewItem> = {}
): PendingReviewItem {
  return {
    id: "prq_test",
    actorId: "user-001",
    entityType: "review",
    entityId: "review-1",
    reason: "access_revoked",
    localPayload: JSON.stringify({ id: "review-1" }),
    remotePayload: null,
    createdAt: "2026-03-26T10:00:00.000Z",
    resolution: null,
    resolvedAt: null,
    ...overrides,
  };
}

let service: PendingQueueService;
let withDatabase: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  service = new PendingQueueService();
  const localDb = await import("~/local-db");
  withDatabase = vi.mocked(localDb.withDatabase);
});

it("addItem inserts a row and returns a generated id", async () => {
  let insertedValues: unknown = null;

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        insert: () => ({
          values: (values: unknown) => {
            insertedValues = values;
            return Promise.resolve();
          },
        }),
      };
      return fn(fakeDb);
    }
  );

  const id = await service.addItem({
    entityType: "review",
    entityId: "review-1",
    reason: "access_revoked",
    localPayload: { id: "review-1" },
    actorId: "user-001",
  });

  expect(id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/
  );
  expect(insertedValues).toMatchObject({
    entityType: "review",
    entityId: "review-1",
    reason: "access_revoked",
    actorId: "user-001",
  });
});

it("getItem returns null for empty id", async () => {
  const result = await service.getItem("");
  expect(result).toBeNull();
});

it("getItem returns null when not found", async () => {
  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  const result = await service.getItem("nonexistent");
  expect(result).toBeNull();
});

it("getItem returns item when found", async () => {
  const item = makePendingItem();
  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([item]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  const result = await service.getItem("prq_test");
  expect(result).toEqual(item);
});

it("getUnresolvedItems returns items with no resolvedAt", async () => {
  const items = [
    makePendingItem({ id: "prq_1" }),
    makePendingItem({ id: "prq_2" }),
  ];

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(items),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  const result = await service.getUnresolvedItems();
  expect(result).toHaveLength(2);
});

it("resolveItem throws if id is empty", async () => {
  await expect(service.resolveItem("", "resolved_manually")).rejects.toThrow(
    "id is required"
  );
});

it("resolveItem updates the item with resolution and resolvedAt", async () => {
  let setData: unknown = null;

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        update: () => ({
          set: (data: unknown) => {
            setData = data;
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
      };
      return fn(fakeDb);
    }
  );

  await service.resolveItem("prq_test", "resolved_manually");

  expect(setData).toMatchObject({
    resolution: "resolved_manually",
    resolvedAt: "2026-03-26T10:00:00.000Z",
  });
});

it("resolveMultiple calls resolveItem for each id", async () => {
  const resolveItemSpy = vi
    .spyOn(service, "resolveItem")
    .mockResolvedValue(undefined);

  await service.resolveMultiple(["id-1", "id-2", "id-3"], "resolved_manually");

  expect(resolveItemSpy).toHaveBeenCalledTimes(3);
  expect(resolveItemSpy).toHaveBeenCalledWith("id-1", "resolved_manually");
  expect(resolveItemSpy).toHaveBeenCalledWith("id-2", "resolved_manually");
  expect(resolveItemSpy).toHaveBeenCalledWith("id-3", "resolved_manually");
});

it("discardItem throws if id is empty", async () => {
  await expect(service.discardItem("")).rejects.toThrow("id is required");
});

it("discardItem deletes the item by id", async () => {
  let deleteCalled = false;

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        delete: () => ({
          where: () => {
            deleteCalled = true;
            return Promise.resolve();
          },
        }),
      };
      return fn(fakeDb);
    }
  );

  await service.discardItem("prq_test");
  expect(deleteCalled).toBe(true);
});

it("getLocalPayload returns null for empty id", async () => {
  const result = await service.getLocalPayload("");
  expect(result).toBeNull();
});

it("getLocalPayload parses and returns the stored payload", async () => {
  const payload = { id: "review-1", status: "archived" };

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([{ localPayload: JSON.stringify(payload) }]),
            }),
          }),
        }),
      };
      return fn(fakeDb);
    }
  );

  const result = await service.getLocalPayload("prq_test");
  expect(result).toEqual(payload);
});

it("clearOldResolved deletes items older than the cutoff and returns count", async () => {
  const oldItems = [{ id: "prq_old1" }, { id: "prq_old2" }];
  let deleteCallCount = 0;

  withDatabase.mockImplementation(
    async (fn: (db: unknown) => Promise<unknown>) => {
      const fakeDb = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve(oldItems),
          }),
        }),
        delete: () => ({
          where: () => {
            deleteCallCount++;
            return Promise.resolve();
          },
        }),
      };
      return fn(fakeDb);
    }
  );

  const count = await service.clearOldResolved(30);
  expect(count).toBe(2);
  expect(deleteCallCount).toBe(2);
});
