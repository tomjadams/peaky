import {
  getReviewMetrics,
  getReviewsByApplicationId,
} from "../../../data/reviews";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const includeArchived = query.includeArchived === "true";

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Application ID is required",
    });
  }

  const applicationReviews = getReviewsByApplicationId(id, includeArchived);

  return applicationReviews
    .map((review) => {
      const metrics = getReviewMetrics(review);
      const primaryTemplate = review.templates[0];

      return Object.assign({}, review, {
        templateId: primaryTemplate?.templateId ?? "",
        templateName: primaryTemplate?.templateName ?? "",
        pillars: primaryTemplate?.pillars ?? [],
        metrics,
      });
    })
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
});
