import { getReviewMetrics, getReviewsByTeamId } from "../../../data/reviews";
import { getTeamById } from "../../../data/teams";

export default defineEventHandler((event) => {
  const teamId = getRouterParam(event, "id");
  const query = getQuery(event);
  const includeArchived = query.includeArchived === "true";

  if (!teamId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Team ID is required",
    });
  }

  const team = getTeamById(teamId);

  if (!team) {
    throw createError({
      statusCode: 404,
      statusMessage: "Team not found",
    });
  }

  const seenNames = new Map<string, number>();

  return getReviewsByTeamId(teamId, includeArchived).map((review) => {
    const metrics = getReviewMetrics(review);
    const normalizedName = review.name.trim().toLowerCase();
    const duplicateCount = (seenNames.get(normalizedName) ?? 0) + 1;

    seenNames.set(normalizedName, duplicateCount);

    const displayName =
      duplicateCount > 1 ? `${review.name} (${duplicateCount})` : review.name;

    return {
      id: review.id,
      name: displayName,
      templateIds: review.templateIds,
      templateNames: review.templateNames,
      status: review.status,
      progress: metrics.overallProgress,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      assessors: review.assessors,
      advisors: review.advisors ?? review.reviewers ?? [],
      reviewers: review.reviewers,
    };
  });
});
