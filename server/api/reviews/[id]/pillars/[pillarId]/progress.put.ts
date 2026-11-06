import { findReviewById } from "../../../../../data/review-lookup";

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");
  const pillarId = getRouterParam(event, "pillarId");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  if (!pillarId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Pillar ID is required",
    });
  }

  const review = findReviewById(reviewId);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  const body = await readBody(event);

  const progress =
    typeof body?.progress === "number" ? body.progress : undefined;

  if (progress === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: "progress is required and must be a number",
    });
  }

  // Update the review's pillar progress in-memory
  for (const template of review.templates) {
    const pillar = template.pillars.find((p) => p.slug === pillarId);
    if (pillar) {
      pillar.progress = progress;
      if (typeof body.answeredQuestions === "number") {
        pillar.answeredQuestions = body.answeredQuestions;
      }
      if (typeof body.totalQuestions === "number") {
        pillar.totalQuestions = body.totalQuestions;
      }
    }
  }

  return { success: true };
});
