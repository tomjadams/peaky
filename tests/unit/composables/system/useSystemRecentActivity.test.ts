/**
 * Unit tests for useSystemRecentActivity — pinning the session-scoping
 * contract that powers the /system page's Recent Activity table.
 *
 * The fix in commit 287c024 makes the table show only events emitted on or
 * after the latest LocalDbInitializing.v1 timestamp (current browser
 * session). On a fresh install with no Initializing event yet, the table
 * falls back to source-only filtering. These tests pin both branches
 * because the fix is a regression-prone behaviour: anyone removing the
 * gte() filter would silently re-introduce the cross-session bleed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { withDatabase } from "~/local-db";

import {
  buildDetail,
  resolveSessionStart,
  useSystemRecentActivity,
} from "~/composables/system/useSystemRecentActivity";

// ─── Mock harness ──────────────────────────────────────────────
//
// The composable issues two distinct queries:
//   1. resolveSessionStart() — projects {time} from events filtered by
//      eventType = LocalDbInitializing.v1
//   2. loadRows() — selects events filtered by source = peaky.system,
//      optionally AND'd with gte(events.time, sessionStart)
//
// We mock `withDatabase` with a fake db that records the where clause it
// receives so each test can assert on it. The select() return shape
// branches on whether a projection (`{time}`) was passed (path 1) or the
// full row select was used (path 2).

interface CapturedQuery {
  whereClause: unknown;
  limit: number;
  hasProjection: boolean;
}

const capturedQueries: CapturedQuery[] = [];
let initializingRows: Array<{ time: string }> = [];
let systemEventRows: Array<{
  id: string;
  time: string;
  eventType: string;
  data: string | null;
}> = [];
let throwOnQuery = false;

vi.mock("~/local-db", () => ({
  events: { eventType: "eventType", source: "source", time: "time" },
  desc: vi.fn((column: unknown) => column),
  eq: vi.fn((column: unknown, value: unknown) => ({
    op: "eq",
    column,
    value,
  })),
  gte: vi.fn((column: unknown, value: unknown) => ({
    op: "gte",
    column,
    value,
  })),
  and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
  withDatabase: vi.fn(),
}));

vi.mock("~/admin/events", () => ({
  formatAdminEventLabel: (eventType: string) => `LABEL:${eventType}`,
}));

const smartWithDatabase = vi.mocked(withDatabase);

smartWithDatabase.mockImplementation(async (cb: unknown) => {
  if (throwOnQuery) {
    throw new Error("db unavailable");
  }
  const fakeDb = {
    select: (projection?: unknown) => ({
      from: () => ({
        where: (whereClause: unknown) => ({
          orderBy: () => ({
            limit: (limit: number) => {
              capturedQueries.push({
                whereClause,
                limit,
                hasProjection: projection !== undefined,
              });
              if (projection !== undefined) {
                return Promise.resolve(initializingRows);
              }
              return Promise.resolve(systemEventRows);
            },
          }),
        }),
      }),
    }),
  };
  return (cb as (db: unknown) => Promise<unknown>)(fakeDb);
});

beforeEach(() => {
  capturedQueries.length = 0;
  initializingRows = [];
  systemEventRows = [];
  throwOnQuery = false;
});

// ─── Tests ──────────────────────────────────────────────────────

describe("resolveSessionStart", () => {
  it("returns the latest LocalDbInitializing.v1 time when one exists", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    const result = await resolveSessionStart();
    expect(result).toBe("2026-04-30T10:00:00.000Z");
  });

  it("returns null when no Initializing event has been recorded yet", async () => {
    initializingRows = [];
    const result = await resolveSessionStart();
    expect(result).toBeNull();
  });

  it("returns null when the database call throws (graceful fallback)", async () => {
    throwOnQuery = true;
    const result = await resolveSessionStart();
    expect(result).toBeNull();
  });

  it("filters on eventType = LocalDbInitializing.v1 and limits to 1 row", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    await resolveSessionStart();
    expect(capturedQueries).toHaveLength(1);
    const q = capturedQueries[0]!;
    expect(q.hasProjection).toBe(true);
    expect(q.limit).toBe(1);
    expect(q.whereClause).toEqual({
      op: "eq",
      column: "eventType",
      value: "LocalDbInitializing.v1",
    });
  });
});

describe("useSystemRecentActivity — session scoping", () => {
  it("uses gte(events.time, sessionStart) when an Initializing event exists", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    systemEventRows = [];

    const activity = useSystemRecentActivity();
    await activity.init();

    expect(activity.sessionStartTime.value).toBe("2026-04-30T10:00:00.000Z");

    // capturedQueries[0] is the resolveSessionStart call; [1] is loadRows.
    expect(capturedQueries).toHaveLength(2);
    const loadRowsWhere = capturedQueries[1]!.whereClause as {
      op: string;
      conditions: unknown[];
    };

    // The where clause is and(source = peaky.system, gte(time, session)).
    expect(loadRowsWhere.op).toBe("and");
    expect(loadRowsWhere.conditions).toEqual([
      { op: "eq", column: "source", value: "peaky.system" },
      { op: "gte", column: "time", value: "2026-04-30T10:00:00.000Z" },
    ]);
  });

  it("falls back to source-only filter when no Initializing event exists", async () => {
    initializingRows = [];
    systemEventRows = [];

    const activity = useSystemRecentActivity();
    await activity.init();

    expect(activity.sessionStartTime.value).toBeNull();

    // No gte() — just the source filter directly.
    const loadRowsWhere = capturedQueries[1]!.whereClause;
    expect(loadRowsWhere).toEqual({
      op: "eq",
      column: "source",
      value: "peaky.system",
    });
  });

  it("excludes pre-session rows when loading (the gte filter is what does this in production)", async () => {
    // We can't actually filter in the mock db, but we can prove the gte
    // predicate is being passed with the right value — production SQLite
    // will then enforce it. This test documents that intent and pairs
    // with the where-clause structural test above.
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    systemEventRows = [
      {
        id: "evt-1",
        time: "2026-04-30T10:05:00.000Z",
        eventType: "LocalDbReady.v1",
        data: JSON.stringify({ coldStartMs: 412 }),
      },
    ];

    const activity = useSystemRecentActivity();
    await activity.init();

    expect(activity.rows.value).toHaveLength(1);
    expect(activity.rows.value[0]?.id).toBe("evt-1");
    // Guard against accidentally dropping the gte condition.
    const loadRowsWhere = capturedQueries[1]!.whereClause as {
      conditions: Array<{ op: string }>;
    };
    expect(loadRowsWhere.conditions.some((c) => c.op === "gte")).toBe(true);
  });

  it("reports rows.length as the rendered count and trims the +1 limit probe", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    // Seed 11 rows when PAGE_SIZE is 10 so the limit+1 probe sees 11 →
    // hasMore=true, but rows.value should only contain the first 10.
    systemEventRows = Array.from({ length: 11 }, (_, i) => ({
      id: `evt-${i}`,
      time: `2026-04-30T10:0${i}:00.000Z`,
      eventType: "LocalDbReady.v1",
      data: null,
    }));

    const activity = useSystemRecentActivity();
    await activity.init();

    expect(activity.rows.value).toHaveLength(10);
    expect(activity.hasMore.value).toBe(true);
    expect(capturedQueries[1]!.limit).toBe(11); // PAGE_SIZE + 1
  });

  it("surfaces errors as the `error` ref instead of throwing", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    // resolveSessionStart should succeed; loadRows should fail. We
    // simulate this by flipping the flag after init starts. Easier:
    // throw on every query for this test and assert error propagates
    // through the loadRows path (resolveSessionStart catches its own).
    throwOnQuery = true;

    const activity = useSystemRecentActivity();
    await activity.init();

    expect(activity.error.value).toBeInstanceOf(Error);
    expect(activity.error.value?.message).toBe("db unavailable");
    expect(activity.rows.value).toEqual([]);
    expect(activity.isLoading.value).toBe(false);
  });
});

describe("useSystemRecentActivity — pagination", () => {
  it("loadMore extends the limit by PAGE_SIZE and re-queries", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    systemEventRows = [];

    const activity = useSystemRecentActivity();
    await activity.init();
    expect(capturedQueries[1]!.limit).toBe(11); // initial: PAGE_SIZE+1

    await activity.loadMore();
    // After init (2 queries) + loadMore (1 query), index 2 is loadMore.
    expect(capturedQueries[2]!.limit).toBe(21); // 20 + 1
  });

  it("refresh resets currentLimit back to PAGE_SIZE", async () => {
    initializingRows = [{ time: "2026-04-30T10:00:00.000Z" }];
    systemEventRows = [];

    const activity = useSystemRecentActivity();
    await activity.init();
    await activity.loadMore(); // bumps to 21
    await activity.refresh();
    // After refresh, the most recent loadRows call should query at PAGE_SIZE+1.
    const last = capturedQueries[capturedQueries.length - 1]!;
    expect(last.limit).toBe(11);
  });
});

describe("buildDetail (extracted pure helper)", () => {
  it("returns empty string when data is null", () => {
    expect(buildDetail({ eventType: "LocalDbReady.v1", data: null })).toBe("");
  });

  it("returns empty string when data is malformed JSON", () => {
    expect(
      buildDetail({ eventType: "LocalDbReady.v1", data: "not-json" })
    ).toBe("");
  });

  it("formats LocalDbReady.v1 with cold-start ms", () => {
    const detail = buildDetail({
      eventType: "LocalDbReady.v1",
      data: JSON.stringify({ coldStartMs: 412 }),
    });
    expect(detail).toBe("cold start · 412 ms");
  });

  it("formats SyncCycleSucceeded.v1 with push/pull counts", () => {
    const detail = buildDetail({
      eventType: "SyncCycleSucceeded.v1",
      data: JSON.stringify({ eventsPushed: 3, eventsPulled: 7, durationMs: 1 }),
    });
    expect(detail).toBe("3 pushed · 7 pulled");
  });

  it("formats ClientSchemaMigrated.v1 with applied count (singular)", () => {
    expect(
      buildDetail({
        eventType: "ClientSchemaMigrated.v1",
        data: JSON.stringify({ migrationsApplied: ["0001"], schemaVersion: 1 }),
      })
    ).toBe("1 migration applied");
  });

  it("formats ClientSchemaMigrated.v1 with applied count (plural)", () => {
    expect(
      buildDetail({
        eventType: "ClientSchemaMigrated.v1",
        data: JSON.stringify({
          migrationsApplied: ["0001", "0002"],
          schemaVersion: 2,
        }),
      })
    ).toBe("2 migrations applied");
  });

  it("returns empty string for unknown event types", () => {
    expect(
      buildDetail({
        eventType: "SomethingNew.v1",
        data: JSON.stringify({ foo: "bar" }),
      })
    ).toBe("");
  });
});
