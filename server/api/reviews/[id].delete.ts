import { z } from "zod";
import {
  deleteProductReview,
  findProductReviewById,
} from "../../data/product-reviews";
import { addEvent, EVENT_TYPES } from "../../data/review-events";
import { deleteReview, findReviewById } from "../../data/reviews";
import { getProductByIdWithOptions } from "../../data/products";
import {
  isReviewAdmin,
  normalizeReviewActor,
} from "~/services/review/ReviewGovernance";

const deleteReviewSchema = z.object({
  actor: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1).optional(),
      roles: z.array(z.enum(["admin", "member"])).optional(),
    })
    .optional(),
});

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const body = await readBody(event);
  const parsed = deleteReviewSchema.safeParse(body ?? {});

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid delete payload",
    });
  }

  const actor = normalizeReviewActor(parsed.data.actor);

  if (!isReviewAdmin(actor)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can permanently delete reviews",
    });
  }

  const teamReview = findReviewById(reviewId);
  if (teamReview) {
    if (teamReview.status !== "archived") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only archived reviews can be permanently deleted",
      });
    }

    const deletedReview = deleteReview(reviewId);

    if (!deletedReview) {
      throw createError({
        statusCode: 404,
        statusMessage: "Review not found",
      });
    }

    addEvent({
      reviewId,
      eventType: EVENT_TYPES.REVIEW_DELETED,
      actorType: "user",
      actorId: actor.id,
      actorName: actor.name,
      data: {
        reviewName: deletedReview.name,
        teamId: deletedReview.teamId,
        templateCount: deletedReview.templateIds.length,
        templateNames: deletedReview.templateNames ?? [],
        applicationCount: deletedReview.applicationIds?.length ?? 0,
      },
    });

    return deletedReview;
  }

  const productReview = findProductReviewById(reviewId);
  if (productReview) {
    if (productReview.status !== "archived") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only archived reviews can be permanently deleted",
      });
    }

    const product = getProductByIdWithOptions(productReview.productId, {
      includeArchived: true,
    });
    const deletedReview = deleteProductReview(reviewId);

    if (!deletedReview) {
      throw createError({
        statusCode: 404,
        statusMessage: "Review not found",
      });
    }

    addEvent({
      reviewId,
      eventType: EVENT_TYPES.REVIEW_DELETED,
      actorType: "user",
      actorId: actor.id,
      actorName: actor.name,
      data: {
        reviewName: deletedReview.name,
        productId: deletedReview.productId,
        productName: product?.name,
        templateCount: deletedReview.templateIds.length,
        templateNames: deletedReview.templateNames,
        applicationCount: deletedReview.applicationIds?.length ?? 0,
      },
    });

    return deletedReview;
  }

  throw createError({
    statusCode: 404,
    statusMessage: "Review not found",
  });
});
