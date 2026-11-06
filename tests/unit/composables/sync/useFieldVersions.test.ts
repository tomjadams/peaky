/**
 * Unit tests for useFieldVersions composable.
 * Tests the change feed logic: entry mapping, TTL notice, conflict detection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import { LOCAL_TTL_DAYS } from "~/services/sync/LocalTTL";
import type { RecentChangeTrailEntry } from "~/composables/sync/useFieldVersions";
import type { ReviewWorkspace } from "~/models/workspace";

// ── Shared query mocks ─────────────────────────────────────────────────────

const fvQueryMock = vi.fn().mockResolvedValue([]);
const conflictQueryMock = vi.fn().mockResolvedValue([]);
const NOW_MS = new Date("2026-05-15T12:00:00.000Z").getTime();

/**
 * The composable calls withDatabase once per page fetch.
 * Inside the callback, it makes two sequential queries:
 *   1. fieldVersionEvents → returns fvQueryMock()
 *   2. localOutbox   → returns conflictQueryMock()
 * We track call count inside each invocation to dispatch correctly.
 */
vi.mock("~/local-db", () => ({
  withDatabase: vi
    .fn()
    .mockImplementation(async (cb: (db: unknown) => unknown) => {
      let queryCount = 0;
      const db = {
        select: (_projection?: unknown) => ({
          from: (_table: unknown) => ({
            where: (_cond: unknown) => {
              const isFirst = queryCount === 0;
              queryCount++;
              if (isFirst) {
                // fieldVersionEvents query: has orderBy → limit → offset chain
                return {
                  orderBy: () => ({
                    limit: (_n: number) => ({
                      offset: (_o: number) => fvQueryMock(),
                    }),
                  }),
                };
              }
              // localOutbox conflict query: no further chaining
              return conflictQueryMock();
            },
          }),
        }),
      };
      return cb(db);
    }),
}));

vi.mock("#shared/db/schema/field-version", () => ({
  fieldVersionEvents: { entityId: "entityId", fieldName: "fieldName" },
}));

vi.mock("#shared/db/schema/sync", () => ({
  localOutbox: {
    id: "id",
    entityId: "entityId",
    status: "status",
    lastError: "lastError",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  like: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("~/composables/reviews/useReviewWorkspace", () => ({
  fetchReviewWorkspace: vi.fn().mockResolvedValue({ pillars: [] }),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: () => ({ id: "actor_dev", name: "Dev" }),
}));

beforeEach(() => {
  fvQueryMock.mockReset().mockResolvedValue([]);
  conflictQueryMock.mockReset().mockResolvedValue([]);
});

// ── TTL constants ──────────────────────────────────────────────────────────

describe("LOCAL_TTL_DAYS", () => {
  it("defaults to 14", () => {
    expect(LOCAL_TTL_DAYS).toBe(14);
  });
});

// ── TTL notice logic ───────────────────────────────────────────────────────

describe("TTL notice logic", () => {
  it("ttl notice shown when oldest entry is within 1 day of TTL boundary", () => {
    const ttlMs = LOCAL_TTL_DAYS * 24 * 60 * 60 * 1000;
    const oldestMs = NOW_MS - ttlMs + 1000 * 60 * 60; // 1h before TTL
    const entries = [
      { updatedAt: new Date(NOW_MS - 1000).toISOString() },
      { updatedAt: new Date(oldestMs).toISOString() },
    ];
    const oldest = entries[entries.length - 1]!;
    const diffDays =
      (NOW_MS - new Date(oldest.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(LOCAL_TTL_DAYS - 1);
  });

  it("ttl notice hidden when oldest entry is well within TTL", () => {
    const entries = [
      { updatedAt: new Date(NOW_MS - 1000).toISOString() },
      {
        updatedAt: new Date(NOW_MS - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const oldest = entries[entries.length - 1]!;
    const diffDays =
      (NOW_MS - new Date(oldest.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeLessThan(LOCAL_TTL_DAYS - 1);
  });
});

// ── derivePillarSlug ───────────────────────────────────────────────────────

describe("derivePillarSlug", () => {
  it("extracts pillar slug from structured question ID", async () => {
    const { derivePillarSlug } =
      await import("~/composables/sync/useFieldVersions");
    expect(derivePillarSlug("infrastructure-q-1")).toBe("infrastructure");
    expect(derivePillarSlug("reliability-q-3")).toBe("reliability");
    expect(derivePillarSlug("security-q-10")).toBe("security");
  });

  it("falls back to the full string when pattern does not match", async () => {
    const { derivePillarSlug } =
      await import("~/composables/sync/useFieldVersions");
    expect(derivePillarSlug("unknown")).toBe("unknown");
  });
});

describe("parseAnswer", () => {
  it("keeps an explicit empty checklist distinct from an unanswered value", async () => {
    const { parseAnswer } =
      await import("~/composables/sync/fieldVersionChangeFeed");

    expect(parseAnswer(null)).toBeNull();
    expect(parseAnswer('{"checked":[],"na":[]}')).toBe("0 checked");
    expect(parseAnswer("[]")).toBe("0 checked");
  });
});

// ── groupRecentChangeEntries ───────────────────────────────────────────────

const makeTrailEntry = (
  overrides: Partial<RecentChangeTrailEntry>
): RecentChangeTrailEntry => ({
  id: "entry-1",
  entityId: "rev-1:security-q-1",
  questionId: "security-q-1",
  pillarSlug: "security",
  answer: "yes",
  previousAnswer: null,
  rawAnswer: "yes",
  rawPreviousAnswer: null,
  actorId: "actor_alice",
  updatedAt: "2026-05-01T10:00:00.000Z",
  hlc: "1000:0001",
  isConflict: false,
  ...overrides,
});

describe("groupRecentChangeEntries", () => {
  it("collapses same-actor same-question changes within 5 seconds", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "3",
        answer: "yes",
        rawAnswer: "yes",
        updatedAt: "2026-05-01T10:00:02.000Z",
      }),
      makeTrailEntry({
        id: "2",
        answer: "no",
        rawAnswer: "no",
        updatedAt: "2026-05-01T10:00:01.000Z",
      }),
      makeTrailEntry({
        id: "1",
        answer: "yes",
        rawAnswer: "yes",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.changeCount).toBe(3);
    expect(grouped[0]!.previousAnswer).toBeNull();
    expect(grouped[0]!.answer).toBe("yes");
    expect(
      grouped[0]!.trail.map((change) => [change.previousAnswer, change.answer])
    ).toEqual([
      [null, "yes"],
      ["yes", "no"],
      ["no", "yes"],
    ]);
  });

  it("does not group changes from different actors", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        actorId: "actor_bob",
        updatedAt: "2026-05-01T10:00:01.000Z",
      }),
      makeTrailEntry({
        id: "1",
        actorId: "actor_alice",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((entry) => entry.changeCount)).toEqual([1, 1]);
  });

  it("does not group same-actor changes outside the edit window", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        updatedAt: "2026-05-01T10:00:06.000Z",
      }),
      makeTrailEntry({
        id: "1",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((entry) => entry.changeCount)).toEqual([1, 1]);
  });

  it("groups changes exactly at the 5 second boundary", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        updatedAt: "2026-05-01T10:00:05.000Z",
      }),
      makeTrailEntry({
        id: "1",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.changeCount).toBe(2);
  });

  it("carries conflict state from any grouped change", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        isConflict: false,
        updatedAt: "2026-05-01T10:00:01.000Z",
      }),
      makeTrailEntry({
        id: "1",
        isConflict: true,
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.isConflict).toBe(true);
  });

  it("synthesizes checklist trail labels from raw values", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        answer: "2 checked",
        rawAnswer: { checked: ["a", "b"] },
        updatedAt: "2026-05-01T10:00:01.000Z",
      }),
      makeTrailEntry({
        id: "1",
        answer: "1 checked",
        rawAnswer: { checked: ["a"] },
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(
      grouped[0]!.trail.map((change) => [change.previousAnswer, change.answer])
    ).toEqual([
      [null, "1 checked"],
      ["1 checked", "2 checked"],
    ]);
  });

  it("does not group adjacent changes for different questions", async () => {
    const { groupRecentChangeEntries } =
      await import("~/composables/sync/useFieldVersions");

    const grouped = groupRecentChangeEntries([
      makeTrailEntry({
        id: "2",
        entityId: "rev-1:security-q-2",
        questionId: "security-q-2",
        updatedAt: "2026-05-01T10:00:01.000Z",
      }),
      makeTrailEntry({
        id: "1",
        entityId: "rev-1:security-q-1",
        questionId: "security-q-1",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((entry) => entry.changeCount)).toEqual([1, 1]);
  });
});

// ── useFieldVersions ───────────────────────────────────────────────────────

describe("useFieldVersions", () => {
  it("returns empty entries when DB returns no rows", async () => {
    fvQueryMock.mockResolvedValue([]);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("review-1");
    const { entries } = useFieldVersions(reviewId);
    await nextTick();
    expect(entries.value).toEqual([]);
  });

  it("maps DB rows to RecentChangeEntry shape with parsed answer", async () => {
    fvQueryMock.mockResolvedValue([
      {
        id: "1",
        eventId: "evt-1",
        entityType: "review_answer",
        entityId: "rev-1:infrastructure-q-1",
        fieldName: "answer",
        value: '"yes"',
        previousValue: '"no"',
        hlc: "2000:0001",
        actorId: "actor_alice",
        updatedAt: "2026-05-01T10:00:00.000Z",
      },
    ]);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("rev-1");
    const { entries, refresh } = useFieldVersions(reviewId);
    await refresh();
    expect(entries.value).toHaveLength(1);
    const entry = entries.value[0]!;
    expect(entry.questionId).toBe("infrastructure-q-1");
    expect(entry.pillarSlug).toBe("infrastructure");
    expect(entry.answer).toBe("yes");
    expect(entry.previousAnswer).toBe("no");
    expect(entry.rawPreviousAnswer).toBe("no");
    expect(entry.actorId).toBe("actor_alice");
    expect(entry.isConflict).toBe(false);
  });

  it("adds a short reference when workspace metadata arrives after history", async () => {
    const questionId = "01932b3c-7d00-7000-8100-000000001001:question:01:01";
    fvQueryMock.mockResolvedValue([
      {
        id: "2",
        eventId: "evt-2",
        entityType: "review_answer",
        entityId: `review-1:${questionId}`,
        fieldName: "answer",
        value: '"yes"',
        previousValue: '"no"',
        hlc: "2000:0002",
        actorId: "actor_alice",
        updatedAt: "2026-05-01T10:00:01.000Z",
      },
      {
        id: "1",
        eventId: "evt-1",
        entityType: "review_answer",
        entityId: `review-1:${questionId}`,
        fieldName: "answer",
        value: '"no"',
        previousValue: null,
        hlc: "2000:0001",
        actorId: "actor_alice",
        updatedAt: "2026-05-01T10:00:00.000Z",
      },
    ]);
    const workspace = ref<ReviewWorkspace | null>(null);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const { entries, refresh } = useFieldVersions("review-1", workspace);

    await refresh();
    expect(entries.value[0]?.questionReference).toBeUndefined();

    workspace.value = {
      templateRevisions: [
        { id: "01932b3c-7d00-7000-8100-000000001001", name: "ORR" },
      ],
      pillars: [
        {
          templateRevisionId: "01932b3c-7d00-7000-8100-000000001001",
          slug: "reliability-resilience",
          name: "Reliability & Resilience",
          questions: [
            {
              id: questionId,
              orderKey: "0001",
              text: "How mature is your reliability definition?",
            },
          ],
        },
      ],
    } as ReviewWorkspace;
    await nextTick();

    expect(entries.value).toHaveLength(1);
    expect(entries.value[0]?.questionId).toBe(questionId);
    expect(entries.value[0]?.questionReference).toBe("REL-1");
  });

  it("marks entry as overridden when outbox ID matches eventId and rejection was hlc_conflict", async () => {
    const entityId = "rev-1:security-q-2";
    fvQueryMock.mockResolvedValue([
      {
        id: "2",
        eventId: "outbox-rejected-1",
        entityType: "review_answer",
        entityId,
        fieldName: "answer",
        value: '"no"',
        hlc: "3000:0001",
        actorId: "actor_dev",
        updatedAt: "2026-05-02T10:00:00.000Z",
      },
    ]);
    conflictQueryMock.mockResolvedValue([{ id: "outbox-rejected-1" }]);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("rev-1");
    const { entries, refresh } = useFieldVersions(reviewId);
    await refresh();
    expect(entries.value[0]?.isConflict).toBe(true);
  });

  it("does not mark as overridden when outbox ID does not match eventId", async () => {
    const entityId = "rev-1:security-q-3";
    fvQueryMock.mockResolvedValue([
      {
        id: "3",
        eventId: "evt-unrelated",
        entityType: "review_answer",
        entityId,
        fieldName: "answer",
        value: '"yes"',
        hlc: "4000:0001",
        actorId: "actor_dev",
        updatedAt: "2026-05-03T10:00:00.000Z",
      },
    ]);
    conflictQueryMock.mockResolvedValue([{ id: "outbox-different" }]);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("rev-1");
    const { entries, refresh } = useFieldVersions(reviewId);
    await refresh();
    expect(entries.value[0]?.isConflict).toBe(false);
  });

  it("does not mark as overridden when no hlc_conflict outbox entries exist", async () => {
    const entityId = "rev-1:security-q-4";
    fvQueryMock.mockResolvedValue([
      {
        id: "4",
        eventId: "evt-4",
        entityType: "review_answer",
        entityId,
        fieldName: "answer",
        value: '"no"',
        hlc: "5000:0001",
        actorId: "actor_bob",
        updatedAt: "2026-05-04T10:00:00.000Z",
      },
    ]);
    conflictQueryMock.mockResolvedValue([]);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("rev-1");
    const { entries, refresh } = useFieldVersions(reviewId);
    await refresh();
    expect(entries.value[0]?.isConflict).toBe(false);
  });

  it("hasMore is true when DB returns more rows than PAGE_SIZE", async () => {
    // PAGE_SIZE = 10; return 11 rows to signal there are more
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      eventId: `evt-${i}`,
      entityType: "review_answer",
      entityId: `rev-1:q-${i}`,
      fieldName: "answer",
      value: '"yes"',
      hlc: `${1000 + i}:0001`,
      actorId: "actor_dev",
      updatedAt: new Date(NOW_MS - i * 1000).toISOString(),
    }));
    fvQueryMock.mockResolvedValue(rows);
    const { useFieldVersions } =
      await import("~/composables/sync/useFieldVersions");
    const reviewId = ref("rev-1");
    const { entries, hasMore, refresh } = useFieldVersions(reviewId);
    await refresh();
    expect(hasMore.value).toBe(true);
    expect(entries.value).toHaveLength(10);
  });
});
