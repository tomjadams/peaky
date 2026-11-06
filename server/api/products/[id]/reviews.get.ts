import { getProductReviewsByProductId } from "../../../data/product-reviews";
import { getProductById } from "../../../data/products";

export default defineEventHandler((event) => {
  const productId = getRouterParam(event, "id");
  const query = getQuery(event);
  const includeArchived = query.includeArchived === "true";

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Product ID is required",
    });
  }

  const product = getProductById(productId);

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: "Product not found",
    });
  }

  return getProductReviewsByProductId(productId, includeArchived).map(
    (review) => ({
      id: review.id,
      name: review.name,
      templateIds: review.templateIds,
      templateNames: review.templateNames,
      status: review.status,
      progress: 0,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      assessors: review.assessors,
      advisors: review.advisors ?? review.reviewers ?? [],
      reviewers: review.reviewers,
    })
  );
});
