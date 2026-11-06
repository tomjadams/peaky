import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReviewSessions } from "~/composables/reviews/useReviewSessions";
import { withDatabase } from "~/local-db";

const localCheckpointRows: Array<Record<string, unknown>> = [];

vi.mock("~/local-db", async () => {
  // events is the table the composable queries for checkpoint sessions.
  // The column stubs here only need the fields accessed by the where/orderBy clauses.
  const events = {
    reviewId: "reviewId",
    eventType: "eventType",
    time: "time",
  };

  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => localCheckpointRows,
        }),
      }),
    }),
  };

  return {
    withDatabase: vi.fn(async (fn: (db: typeof fakeDb) => Promise<unknown>) =>
      fn(fakeDb)
    ),
    eq: vi.fn(),
    and: vi.fn(),
    asc: vi.fn(),
    safeParse: <T>(value: string | null | undefined, fallback: T): T => {
      if (!value) return fallback;
      try {
        return JSON.parse(value) as T;
      } catch {
        return fallback;
      }
    },
    events,
    waitForLocalDbReady: vi.fn().mockResolvedValue(undefined),
  };
});

describe("useReviewSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localCheckpointRows.splice(0, localCheckpointRows.length);
  });

  it("returns local checkpoint sessions when remote fails", async () => {
    localCheckpointRows.push({
      id: "evt_local_checkpoint",
      reviewId: "review_019d242b-a24a-77e1-a225-acbb964df121",
      actorId: "heitorl",
      time: "2026-03-25T09:10:00.000Z",
      data: JSON.stringify({
        templateId: "template-001",
        note: "Local checkpoint",
        questionsAnswered: 2,
        questionsChanged: 1,
        progressDelta: 50,
        overallProgress: 50,
        pillarSnapshots: [
          {
            slug: "security",
            name: "Security",
            progress: 50,
            totalQuestions: 4,
            answeredQuestions: 2,
          },
        ],
      }),
    });

    vi.stubGlobal("$fetch", vi.fn().mockRejectedValue(new Error("404")));

    const { sessions, refresh, error } = useReviewSessions(
      "review_019d242b-a24a-77e1-a225-acbb964df121"
    );
    await refresh();

    expect(error.value).toBeNull();
    expect(sessions.value).toHaveLength(1);
    expect(sessions.value[0]?.reviewId).toBe(
      "review_019d242b-a24a-77e1-a225-acbb964df121"
    );
    expect(sessions.value[0]?.note).toBe("Local checkpoint");
  });

  it("uses local checkpoint sessions as authoritative when present", async () => {
    localCheckpointRows.push({
      id: "evt_local_checkpoint",
      reviewId: "review_019d242b-a24a-77e1-a225-acbb964df121",
      actorId: "heitorl",
      time: "2026-03-25T09:10:00.000Z",
      data: JSON.stringify({
        templateId: "template-001",
        note: "Local checkpoint",
        questionsAnswered: 2,
        questionsChanged: 1,
        progressDelta: 50,
        overallProgress: 50,
        pillarSnapshots: [],
      }),
    });

    vi.stubGlobal(
      "$fetch",
      vi.fn().mockResolvedValue([
        {
          id: "evt_remote_001",
          reviewId: "review_019d242b-a24a-77e1-a225-acbb964df121",
          templateId: "template-001",
          createdAt: "2026-03-25T09:00:00.000Z",
          createdBy: { id: "remote", name: "Remote Actor" },
          snapshot: { overallProgress: 10, pillars: [] },
          delta: {
            questionsAnswered: 1,
            questionsChanged: 0,
            progressDelta: 10,
          },
          note: "Remote checkpoint",
        },
      ])
    );

    const { sessions, refresh } = useReviewSessions(
      "review_019d242b-a24a-77e1-a225-acbb964df121"
    );
    await refresh();

    expect(sessions.value).toHaveLength(1);
    expect(sessions.value[0]?.id).toBe("evt_local_checkpoint");
    expect(sessions.value[0]?.snapshot.overallProgress).toBe(50);
    expect(vi.mocked(withDatabase)).toHaveBeenCalled();
  });
});
