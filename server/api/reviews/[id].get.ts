import { findReviewById } from "../../data/review-lookup";

export default defineEventHandler((event) => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const review = findReviewById(reviewId);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  return review;
});
