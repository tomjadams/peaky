import type { Review } from "../../app/models";
import { reviews } from "./reviews";
import { productReviews } from "./product-reviews";

/**
 * Find any review by ID, regardless of whether it's a team review or product review.
 * Product reviews are cast to Review since the assessment only needs the shared fields
 * (id, name, templates, pillars, status, assessors, advisors).
 */
export const findReviewById = (reviewId: string): Review | undefined => {
  const teamReview = reviews.find((r) => r.id === reviewId);
  if (teamReview) return teamReview;

  const productReview = productReviews.find((r) => r.id === reviewId);
  if (productReview) {
    return {
      ...productReview,
      teamId: "",
      orgId: "",
    } as Review;
  }

  return undefined;
};
