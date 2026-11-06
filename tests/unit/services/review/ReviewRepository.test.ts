import { beforeEach, expect, it, vi } from "vitest";
import { ReviewRepository } from "~/services/review/ReviewRepository";

const fetchLocalTemplateRevisionById = vi.hoisted(() => vi.fn());
const fetchTemplateRevisionDetail = vi.hoisted(() => vi.fn());

vi.mock("~/composables/local/useLocalTemplateDraft", () => ({
  fetchLocalTemplateRevisionById,
}));

vi.mock("~/composables/templates/domain/useTemplateCatalog", () => ({
  fetchTemplateRevisionDetail,
}));

const selectedSnapshot = {
  id: "revision-published-a",
  templateId: "template-a",
  name: "Published snapshot",
  description: "Immutable description",
  status: "published",
  revisionNumber: 1,
  revisionSummary: null,
  createdByActorId: "actor-system",
  updatedByActorId: "actor-system",
  publishedByActorId: "actor-system",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
  publishedAt: "2026-08-20T10:00:00Z",
  pillars: [],
} as never;

const selectedSnapshotB = {
  ...selectedSnapshot,
  id: "revision-published-b",
  templateId: "template-b",
  name: "Published snapshot B",
} as never;

const reviewRecord = {
  review: {
    id: "review-1",
    subjectId: "product-1",
    name: "Readiness Review",
    status: "draft",
    createdAt: "2026-08-21T10:00:00Z",
    updatedAt: "2026-08-21T10:00:00Z",
  },
  selections: [
    {
      reviewId: "review-1",
      templateRevisionId: "revision-published-b",
      position: 0,
      createdAt: "2026-08-21T10:00:00Z",
    },
    {
      reviewId: "review-1",
      templateRevisionId: "revision-published-a",
      position: 1,
      createdAt: "2026-08-21T10:00:00Z",
    },
  ],
  answers: [],
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

it("loads the exact selected local Revision without consulting current Template state", async () => {
  fetchLocalTemplateRevisionById.mockResolvedValue(selectedSnapshot);

  await expect(
    new ReviewRepository().fetchRevisionSnapshotSafe("revision-published-a")
  ).resolves.toEqual(selectedSnapshot);
  expect(fetchLocalTemplateRevisionById).toHaveBeenCalledWith(
    "revision-published-a"
  );
  expect(fetchTemplateRevisionDetail).not.toHaveBeenCalled();
});

it("uses the exact Revision identity for the remote fallback", async () => {
  fetchLocalTemplateRevisionById.mockResolvedValue(null);
  fetchTemplateRevisionDetail.mockResolvedValue(selectedSnapshot);

  await expect(
    new ReviewRepository().fetchRevisionSnapshotSafe("revision-published-a")
  ).resolves.toEqual(selectedSnapshot);
  expect(fetchTemplateRevisionDetail).toHaveBeenCalledWith(
    "revision-published-a"
  );
});

it("hydrates exact selected Revision snapshots in immutable position order", async () => {
  const repository = new ReviewRepository();
  vi.spyOn(repository, "fetchRecord").mockResolvedValue(reviewRecord);
  vi.spyOn(repository, "fetchRevisionSnapshotSafe").mockImplementation(
    async (revisionId) =>
      revisionId === "revision-published-b"
        ? selectedSnapshotB
        : selectedSnapshot
  );

  const review = await repository.fetchReview("review-1");

  expect(
    (review as unknown as { templateRevisionIds: string[] }).templateRevisionIds
  ).toEqual(["revision-published-b", "revision-published-a"]);
  expect(
    review?.templates.map((template) => template.templateRevisionId)
  ).toEqual(["revision-published-b", "revision-published-a"]);
});

it.each([
  ["non-contiguous", [0, 2]],
  ["out-of-range", [0, 3]],
])("rejects %s persisted selection positions", async (_label, positions) => {
  const repository = new ReviewRepository();
  vi.spyOn(repository, "fetchRecord").mockResolvedValue({
    ...reviewRecord,
    selections: reviewRecord.selections.map((selection, index) => ({
      ...selection,
      position: positions[index]!,
    })),
  });
  vi.spyOn(repository, "fetchRevisionSnapshotSafe").mockImplementation(
    async (revisionId) =>
      revisionId === "revision-published-b"
        ? selectedSnapshotB
        : selectedSnapshot
  );

  await expect(repository.fetchReview("review-1")).rejects.toThrow(
    /selection position/i
  );
});

it("fails closed when an exact selected Revision snapshot is unavailable", async () => {
  const repository = new ReviewRepository();
  vi.spyOn(repository, "fetchRecord").mockResolvedValue(reviewRecord);
  vi.spyOn(repository, "fetchRevisionSnapshotSafe").mockImplementation(
    async (revisionId) =>
      revisionId === "revision-published-b" ? selectedSnapshotB : null
  );

  await expect(repository.fetchReview("review-1")).rejects.toThrow(
    /selected Template Revision/i
  );
});

it("keeps valid subject Reviews when another local Review is incomplete", async () => {
  const repository = new ReviewRepository();
  vi.spyOn(repository, "fetchRecordsBySubject").mockResolvedValue([
    {
      ...reviewRecord,
      review: { ...reviewRecord.review, id: "review-incomplete" },
      selections: [],
    },
    { ...reviewRecord, selections: [reviewRecord.selections[0]!] },
  ]);
  vi.spyOn(repository, "fetchSelectedRevisionSnapshots").mockImplementation(
    async (selections) => {
      if (selections.length === 0)
        throw new Error("No Template Revisions selected");
      return [selectedSnapshotB];
    }
  );

  await expect(repository.fetchSubjectReviews("product-1")).resolves.toEqual([
    expect.objectContaining({ id: "review-1" }),
  ]);
});

it("loads Questions only from the requested exact selected Revision", async () => {
  const repository = new ReviewRepository();
  vi.spyOn(repository, "fetchRecord").mockResolvedValue(reviewRecord);
  vi.spyOn(repository, "fetchRevisionSnapshotSafe").mockImplementation(
    async (revisionId) =>
      ({
        ...(revisionId === "revision-published-b"
          ? selectedSnapshotB
          : selectedSnapshot),
        pillars: [
          {
            id: `pillar-${revisionId}`,
            templateRevisionId: revisionId,
            slug: "security",
            name: "Security",
            order: 1,
            questions: [
              {
                id: `question-${revisionId}`,
                order: 1,
                text: revisionId,
                type: "yes-no",
                riskLevel: "medium",
                importance: "",
                leadingPractices: [],
                helpfulLinks: [],
              },
            ],
          },
        ],
      }) as never
  );

  const result = await repository.fetchQuestions("review-1", {
    templateRevisionId: "revision-published-b",
  });

  expect(result?.questions).toEqual([
    expect.objectContaining({
      id: "question-revision-published-b",
      templateRevisionId: "revision-published-b",
      pillarKey: "revision-published-b::security",
    }),
  ]);
});

it("keeps retired selected Revisions readable", async () => {
  fetchLocalTemplateRevisionById.mockResolvedValue({
    ...selectedSnapshot,
    status: "retired",
  });

  await expect(
    new ReviewRepository().fetchRevisionSnapshotSafe("revision-published-a")
  ).resolves.toMatchObject({
    id: "revision-published-a",
    status: "retired",
  });
});
