import { beforeEach, expect, it, vi } from "vitest";

const fetchRecord = vi.hoisted(() => vi.fn());
const fetchSelectedRevisionSnapshots = vi.hoisted(() => vi.fn());
const remoteFetch = vi.hoisted(() => vi.fn());
const withDatabase = vi.hoisted(() => vi.fn());
const materializeReviewWorkspace = vi.hoisted(() => vi.fn());

vi.mock("~/services/review/ReviewRepository", () => ({
  reviewRepository: {
    fetchRecord,
    fetchSelectedRevisionSnapshots,
  },
}));

vi.mock("~/local-db", () => ({
  eq: vi.fn(),
  firstOrNull: vi.fn((rows: unknown[]) => rows[0] ?? null),
  reviewMaturityOverrides: { reviewId: "reviewId" },
  reviewParticipants: { reviewId: "reviewId" },
  subjects: { id: "id" },
  waitForLocalDbReady: vi.fn().mockResolvedValue(undefined),
  withDatabase,
}));

vi.mock("~/services/review/ReviewWorkspaceMaterializer", () => ({
  materializeReviewWorkspace,
}));

const remoteWorkspace = (reviewId = "review-1") =>
  ({
    review: { id: reviewId },
    templateRevisions: [],
    pillars: [],
    answers: [],
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  materializeReviewWorkspace.mockResolvedValue(undefined);
  vi.stubGlobal("$fetch", remoteFetch);
});

it("falls back to the remote workspace when local assembly fails", async () => {
  const localError = new Error("Incomplete local Review selections");
  const workspace = remoteWorkspace();
  fetchRecord.mockRejectedValue(localError);
  remoteFetch.mockResolvedValue(workspace);
  const { fetchReviewWorkspace } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspace("review-1")).resolves.toBe(workspace);
  expect(remoteFetch).toHaveBeenCalledWith("/api/reviews/review-1/workspace");
  expect(materializeReviewWorkspace).toHaveBeenCalledWith(workspace);
});

it("prefers a successfully assembled local workspace", async () => {
  fetchRecord.mockResolvedValue({
    review: {
      id: "review-1",
      subjectId: "team-1",
      name: "Local Review",
      status: "draft",
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-08-24T10:00:00.000Z",
    },
    selections: [
      {
        reviewId: "review-1",
        templateRevisionId: "revision-1",
        position: 0,
        createdAt: "2026-08-24T10:00:00.000Z",
      },
    ],
    answers: [],
  });
  withDatabase
    .mockResolvedValueOnce({
      id: "team-1",
      type: "team",
      name: "Platform",
      slug: "platform",
    })
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "participant-1",
        reviewId: "review-1",
        actorId: "advisor-1",
        role: "reviewer",
        name: "Advisor One",
        email: "advisor@example.com",
        avatarUrl: null,
        createdAt: "2026-08-24T10:00:00.000Z",
      },
    ]);
  fetchSelectedRevisionSnapshots.mockResolvedValue([
    {
      id: "revision-1",
      templateId: "template-1",
      name: "Published Revision",
      description: "",
      status: "published",
      revisionNumber: 1,
      revisionSummary: null,
      createdByActorId: "actor-system",
      updatedByActorId: "actor-system",
      publishedByActorId: "actor-system",
      createdAt: "2026-08-24T10:00:00.000Z",
      updatedAt: "2026-08-24T10:00:00.000Z",
      publishedAt: "2026-08-24T10:00:00.000Z",
      pillars: [],
    },
  ]);
  const { fetchReviewWorkspace } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspace("review-1")).resolves.toMatchObject({
    review: { id: "review-1", name: "Local Review" },
    advisors: [
      {
        id: "advisor-1",
        name: "Advisor One",
        email: "advisor@example.com",
      },
    ],
    capabilities: {
      canEdit: false,
      canPublish: false,
      canDelete: false,
      canAddParticipants: false,
      canExport: false,
    },
  });
  expect(remoteFetch).not.toHaveBeenCalled();
  expect(materializeReviewWorkspace).not.toHaveBeenCalled();
});

it("returns the remote workspace read-only when local materialization fails", async () => {
  const workspace = remoteWorkspace();
  const hydrationError = new Error("Local review could not be materialized");
  fetchRecord.mockResolvedValue(null);
  remoteFetch.mockResolvedValue(workspace);
  materializeReviewWorkspace.mockRejectedValue(hydrationError);
  const { fetchReviewWorkspaceState } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspaceState("review-1")).resolves.toEqual({
    workspace,
    localWritesReady: false,
    localWriteError: hydrationError,
  });
});

it("blocks assessment writes when remote workspace materialization fails", async () => {
  const workspace = remoteWorkspace();
  const hydrationError = new Error("Local review could not be materialized");
  fetchRecord.mockResolvedValue(null);
  remoteFetch.mockResolvedValue(workspace);
  materializeReviewWorkspace.mockRejectedValue(hydrationError);
  const { fetchReviewWorkspace } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspace("review-1")).rejects.toBe(hydrationError);
});

it("rejects a remote workspace for a different Review before materializing it", async () => {
  fetchRecord.mockResolvedValue(null);
  remoteFetch.mockResolvedValue(remoteWorkspace("review-2"));
  const { fetchReviewWorkspace } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspace("review-1")).rejects.toThrow(
    "Remote Review workspace did not match the request."
  );
  expect(materializeReviewWorkspace).not.toHaveBeenCalled();
});

it("propagates a remote workspace failure after local assembly fails", async () => {
  const remoteError = new Error("Remote workspace unavailable");
  fetchRecord.mockRejectedValue(
    new Error("Incomplete local Review selections")
  );
  remoteFetch.mockRejectedValue(remoteError);
  const { fetchReviewWorkspace } =
    await import("~/composables/reviews/useReviewWorkspace");

  await expect(fetchReviewWorkspace("review-1")).rejects.toBe(remoteError);
});
