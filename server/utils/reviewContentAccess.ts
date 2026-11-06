import { getProductByIdWithOptions } from "../data/products";
import { findProductReviewById } from "../data/product-reviews";
import { findReviewById } from "../data/reviews";
import { getLifecycleActor } from "./lifecycleActor";
import {
  isReviewAdmin,
  isReviewParticipantOwner,
  type ReviewActor,
} from "~/services/review/ReviewGovernance";

function createForbiddenError(message: string): never {
  throw createError({
    statusCode: 403,
    statusMessage: message,
  });
}

function createNotFoundError(): never {
  throw createError({
    statusCode: 404,
    statusMessage: "Review not found",
  });
}

export function canEditReviewContent(
  actor: Pick<ReviewActor, "id" | "roles">,
  reviewId: string
): boolean {
  if (isReviewAdmin(actor)) {
    return true;
  }

  const teamReview = findReviewById(reviewId);
  if (teamReview) {
    const participants = [
      ...teamReview.assessors,
      ...(teamReview.advisors ?? teamReview.reviewers ?? []),
    ];

    return isReviewParticipantOwner(actor.id, participants);
  }

  const productReview = findProductReviewById(reviewId);
  if (productReview) {
    const product = getProductByIdWithOptions(productReview.productId, {
      includeArchived: true,
    });
    const ownerIds = [
      product?.productManagerId,
      product?.engineeringLeadId,
    ].filter((ownerId): ownerId is string => Boolean(ownerId));
    const participants = [
      ...productReview.assessors,
      ...(productReview.reviewers ?? []),
    ];

    return (
      ownerIds.includes(actor.id) ||
      isReviewParticipantOwner(actor.id, participants)
    );
  }

  return false;
}

export async function requireReviewContentActor(
  event: Parameters<typeof getLifecycleActor>[0],
  reviewId: string
) {
  if (!findReviewById(reviewId) && !findProductReviewById(reviewId)) {
    createNotFoundError();
  }

  const actor = await getLifecycleActor(event);
  if (!canEditReviewContent(actor, reviewId)) {
    createForbiddenError(
      "Only authorized review participants or admins can modify notes and attachments"
    );
  }
  return actor;
}
