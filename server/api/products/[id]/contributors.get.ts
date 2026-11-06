/**
 * Product contributors endpoint — discovers all reviews that contribute to
 * a product's readiness across three paths:
 *
 *   1. Product-owned reviews (product review table)
 *   2. Application/component reviews (via product.componentIds)
 *   3. Team reviews (via product.teamIds)
 *
 * Reviews discovered via multiple paths are de-duplicated by reviewId.
 * The first-discovered occurrence keeps its contributorType.
 */

import { getProductById } from "../../../data/products";
import { getProductReviewsByProductId } from "../../../data/product-reviews";
import {
  getReviewsByApplicationId,
  getReviewsByTeamId,
} from "../../../data/reviews";
import { getTeamById } from "../../../data/teams";
import { applications } from "../../../data/applications";
// Note: type declarations live in app/models/improvement-plan.ts to be
// importable from both server handlers and app composables.
import type {
  ProductContributorSummary,
  ProductContributorsResponse,
} from "~/models/improvement-plan";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

export default defineEventHandler((event): ProductContributorsResponse => {
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Product ID is required",
    });
  }

  const product = getProductById(productId);
  const query = getQuery(event);

  // Allow the client to pass product metadata as query parameters when the
  // server does not yet know about the product (e.g., local-first data that
  // has not been synced to the ephemeral server store).
  const componentIds =
    product?.componentIds ?? toStringArray(query.componentIds);
  const teamIds = product?.teamIds ?? toStringArray(query.teamIds);

  const seen = new Set<string>();
  const contributors: ProductContributorSummary[] = [];

  const add = (entry: ProductContributorSummary) => {
    if (seen.has(entry.reviewId)) return;
    seen.add(entry.reviewId);
    contributors.push(entry);
  };

  // 1. Product-owned reviews
  const productReviews = getProductReviewsByProductId(productId);
  for (const review of productReviews) {
    add({
      reviewId: review.id,
      reviewName: review.name,
      contributorType: "product-review",
      sourceName: product?.name ?? productId,
      sourceId: productId,
    });
  }

  // 2. Application/component reviews
  for (const componentId of componentIds) {
    const appRecord = applications.find((a) => a.id === componentId);
    const appName = appRecord?.name ?? componentId;
    const appReviews = getReviewsByApplicationId(componentId);
    for (const review of appReviews) {
      add({
        reviewId: review.id,
        reviewName: review.name,
        contributorType: "application",
        sourceName: appName,
        sourceId: componentId,
      });
    }
  }

  // 3. Team reviews
  for (const teamId of teamIds) {
    const team = getTeamById(teamId);
    const teamName = team?.name ?? teamId;
    const teamReviews = getReviewsByTeamId(teamId);
    for (const review of teamReviews) {
      add({
        reviewId: review.id,
        reviewName: review.name,
        contributorType: "team",
        sourceName: teamName,
        sourceId: teamId,
      });
    }
  }

  return {
    productId,
    productName: product?.name ?? "",
    contributors,
  };
});
