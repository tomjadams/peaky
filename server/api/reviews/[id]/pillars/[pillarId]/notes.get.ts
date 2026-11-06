import { getPillarNotes } from "../../../../../data/pillar-notes";

export default defineEventHandler((event) => {
  const reviewId = getRouterParam(event, "id");
  const pillarId = getRouterParam(event, "pillarId");

  if (!reviewId || !pillarId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID and Pillar ID are required",
    });
  }

  const data = getPillarNotes(reviewId, pillarId);

  return data;
});
