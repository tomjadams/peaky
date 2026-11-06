import { findReviewById } from "../../../data/review-lookup";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const templateId = query.templateId as string | undefined;

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const review = findReviewById(id);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  const activeTemplate =
    review.templates.find((template) => template.templateId === templateId) ??
    review.templates[0];

  return {
    reviewId: id,
    pillars: activeTemplate?.pillars ?? [],
  };
});
