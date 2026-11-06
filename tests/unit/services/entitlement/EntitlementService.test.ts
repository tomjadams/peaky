import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import {
  EntitlementService,
  type EntitlementSnapshot,
} from "~/services/entitlement/EntitlementService";

// The service's isOfflineWindowValid and getRemainingOfflineDays are pure
// (no DB calls), so we test them directly.
// DB-backed methods are tested with withDatabase mocked.

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    withDatabase: vi.fn(),
    generateId: vi.fn((prefix: string) => `${prefix}_test`),
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
  };
});

const FIXED_NOW = new Date("2026-03-26T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeSnapshot(createdAtDaysAgo: number): EntitlementSnapshot {
  const createdAt = new Date(FIXED_NOW);
  createdAt.setDate(createdAt.getDate() - createdAtDaysAgo);
  return {
    id: "ent_test",
    actorId: "user-001",
    entitlements: JSON.stringify({}),
    snapshotVersion: 1,
    validUntil: null,
    createdAt: createdAt.toISOString(),
    refreshAt: null,
  };
}

const service = new EntitlementService();

it("isOfflineWindowValid returns true within 7 days of snapshot creation", () => {
  const snapshot = makeSnapshot(3); // 3 days ago
  expect(service.isOfflineWindowValid(snapshot)).toBe(true);
});

it("isOfflineWindowValid returns false after 7 days", () => {
  const snapshot = makeSnapshot(8); // 8 days ago
  expect(service.isOfflineWindowValid(snapshot)).toBe(false);
});

it("isOfflineWindowValid returns false exactly at boundary (7 days ago)", () => {
  const snapshot = makeSnapshot(7); // exactly 7 days ago
  expect(service.isOfflineWindowValid(snapshot)).toBe(false);
});

it("getRemainingOfflineDays returns correct value at 0 days used", () => {
  const snapshot = makeSnapshot(0); // just created
  const remaining = service.getRemainingOfflineDays(snapshot);
  expect(remaining).toBe(7);
});

it("getRemainingOfflineDays returns correct value at 1 day used", () => {
  const snapshot = makeSnapshot(1);
  const remaining = service.getRemainingOfflineDays(snapshot);
  expect(remaining).toBe(6);
});

it("getRemainingOfflineDays returns correct value at 3 days used", () => {
  const snapshot = makeSnapshot(3);
  const remaining = service.getRemainingOfflineDays(snapshot);
  expect(remaining).toBe(4);
});

it("getRemainingOfflineDays returns 0 when window expired", () => {
  const snapshot = makeSnapshot(10);
  const remaining = service.getRemainingOfflineDays(snapshot);
  expect(remaining).toBe(0);
});

it("wildcard entitlement takes precedence over specific entries", () => {
  const entitlements = {
    "review:*": { canEdit: true, canView: true },
    "review:review-1": { canEdit: false, canView: false },
  };

  expect(service.canEdit(entitlements, "review", "review-1")).toBe(true);
  expect(service.canView(entitlements, "review", "review-1")).toBe(true);
});

it("canEdit returns false when only canView is true", () => {
  const entitlements = {
    "review:review-1": { canEdit: false, canView: true },
  };

  expect(service.canEdit(entitlements, "review", "review-1")).toBe(false);
  expect(service.canView(entitlements, "review", "review-1")).toBe(true);
});

it("canEdit and canView return false for unknown entity", () => {
  const entitlements = {
    "review:review-1": { canEdit: true, canView: true },
  };

  expect(service.canEdit(entitlements, "review", "review-999")).toBe(false);
  expect(service.canView(entitlements, "review", "review-999")).toBe(false);
});

it("revokeEditAccess sets canEdit to false and canView to true", async () => {
  const { withDatabase } = await import("~/local-db");
  const currentEntitlements = {
    "review:review-1": { canEdit: true, canView: true },
  };

  let updatedEntitlements: Record<string, unknown> | null = null;

  vi.mocked(withDatabase).mockImplementation(async (fn) => {
    // First call: select existing
    // Return a fake db that records updates
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "ent_test",
                  actorId: "user-001",
                  entitlements: JSON.stringify(currentEntitlements),
                  snapshotVersion: 1,
                },
              ]),
          }),
        }),
      }),
      update: () => ({
        set: (data: { entitlements: string }) => {
          updatedEntitlements = JSON.parse(data.entitlements) as Record<
            string,
            unknown
          >;
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
    };
    return fn(fakeDb as never);
  });

  await service.revokeEditAccess("user-001", "review", "review-1");

  expect(updatedEntitlements).not.toBeNull();
  const key = "review:review-1";
  expect(
    (
      updatedEntitlements as Record<
        string,
        { canEdit: boolean; canView: boolean }
      >
    )[key]
  ).toEqual({
    canEdit: false,
    canView: true,
  });
});

it("revokeAllAccess sets both canEdit and canView to false", async () => {
  const { withDatabase } = await import("~/local-db");
  const currentEntitlements = {
    "review:review-1": { canEdit: true, canView: true },
  };

  let updatedEntitlements: Record<string, unknown> | null = null;

  vi.mocked(withDatabase).mockImplementation(async (fn) => {
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: "ent_test",
                  actorId: "user-001",
                  entitlements: JSON.stringify(currentEntitlements),
                  snapshotVersion: 1,
                },
              ]),
          }),
        }),
      }),
      update: () => ({
        set: (data: { entitlements: string }) => {
          updatedEntitlements = JSON.parse(data.entitlements) as Record<
            string,
            unknown
          >;
          return {
            where: () => Promise.resolve(),
          };
        },
      }),
    };
    return fn(fakeDb as never);
  });

  await service.revokeAllAccess("user-001", "review", "review-1");

  expect(updatedEntitlements).not.toBeNull();
  const key = "review:review-1";
  expect(
    (
      updatedEntitlements as Record<
        string,
        { canEdit: boolean; canView: boolean }
      >
    )[key]
  ).toEqual({
    canEdit: false,
    canView: false,
  });
});
