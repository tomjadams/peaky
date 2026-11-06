import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamReviewService } from "~/services/review/TeamReviewService";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import { teamMutations } from "~/services/entity/TeamMutations";
import { cachePublishedTemplateRevisions } from "~/services/template/TemplateRevisionSnapshotCache";

vi.mock("~/services/entity/ReviewMutations", () => ({
  reviewMutations: { create: vi.fn() },
}));

vi.mock("~/services/entity/TeamMutations", () => ({
  teamMutations: { upsert: vi.fn() },
}));

vi.mock("~/services/template/TemplateRevisionSnapshotCache", () => ({
  cachePublishedTemplateRevisions: vi.fn(),
}));

const team = {
  id: "resilience-taskforce",
  slug: "resilience-taskforce",
  name: "resilience-taskforce",
  orgId: "unknown",
  orgName: "Unknown",
  memberCount: 9,
};

describe("TeamReviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cachePublishedTemplateRevisions).mockResolvedValue([]);
    vi.mocked(teamMutations.upsert).mockResolvedValue(undefined);
    vi.mocked(reviewMutations.create).mockResolvedValue("review-1");
  });

  it("materializes the team profile before creating its review", async () => {
    const service = new TeamReviewService();

    const reviewId = await service.create({
      team,
      name: "Readiness review",
      templateRevisionIds: ["revision-1"],
      scope: "team",
      applicationIds: [],
    });

    expect(reviewId).toBe("review-1");
    expect(cachePublishedTemplateRevisions).toHaveBeenCalledWith([
      "revision-1",
    ]);
    expect(teamMutations.upsert).toHaveBeenCalledWith(team);
    expect(reviewMutations.create).toHaveBeenCalledWith({
      subjectId: team.id,
      subjectType: "team",
      name: "Readiness review",
      templateRevisionIds: ["revision-1"],
      scope: "team",
      applicationIds: [],
      teamIds: [team.id],
    });
    expect(
      vi.mocked(teamMutations.upsert).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(reviewMutations.create).mock.invocationCallOrder[0]!
    );
  });

  it("does not materialize a team or Review when the published snapshot is unavailable", async () => {
    const service = new TeamReviewService();
    vi.mocked(cachePublishedTemplateRevisions).mockRejectedValue(
      new Error("snapshot unavailable")
    );

    await expect(
      service.create({
        team,
        name: "Readiness review",
        templateRevisionIds: ["revision-1"],
        scope: "team",
        applicationIds: [],
      })
    ).rejects.toThrow("snapshot unavailable");
    expect(teamMutations.upsert).not.toHaveBeenCalled();
    expect(reviewMutations.create).not.toHaveBeenCalled();
  });

  it("does not create a review when profile materialization fails", async () => {
    const service = new TeamReviewService();
    vi.mocked(teamMutations.upsert).mockRejectedValue(
      new Error("profile failed")
    );

    await expect(
      service.create({
        team,
        name: "Readiness review",
        templateRevisionIds: ["revision-1"],
        scope: "team",
        applicationIds: [],
      })
    ).rejects.toThrow("profile failed");
    expect(reviewMutations.create).not.toHaveBeenCalled();
  });
});
