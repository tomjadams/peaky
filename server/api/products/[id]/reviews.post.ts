import { z } from "zod";
import { EVENT_TYPES, addEvent } from "../../../data/review-events";
import {
  createProductReview,
  productReviews,
} from "../../../data/product-reviews";
import { getProductById } from "../../../data/products";
import { findSelectablePublishedRevisionDetail } from "../../../data/templates";
import { getLifecycleActor } from "../../../utils/lifecycleActor";
import { getUniqueName } from "../../../utils/naming";

const createProductReviewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateRevisionIds: z.array(z.string().trim().min(1)).min(1).max(3),
  applicationIds: z.array(z.string().trim().min(1)).optional(),
});

export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, "id");

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

  const body = await readBody(event);
  const parsed = createProductReviewSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid review payload",
    });
  }

  const { name, templateRevisionIds, applicationIds } = parsed.data;
  const existingNames = productReviews
    .filter((review) => review.productId === productId)
    .map((review) => review.name);
  const uniqueName = getUniqueName(existingNames, name);

  if (new Set(templateRevisionIds).size !== templateRevisionIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template Revision IDs must be distinct",
    });
  }
  const revisionDetails = templateRevisionIds.map(
    findSelectablePublishedRevisionDetail
  );
  const ineligibleRevisionIds = templateRevisionIds.filter(
    (_revisionId, index) => !revisionDetails[index]
  );
  if (ineligibleRevisionIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown or ineligible Template Revision IDs: ${ineligibleRevisionIds.join(", ")}`,
    });
  }
  const parentTemplateIds = revisionDetails.map((detail) => detail!.templateId);
  if (new Set(parentTemplateIds).size !== parentTemplateIds.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selected Revisions must belong to distinct Templates",
    });
  }
  const templateNames = revisionDetails.map((detail) => detail!.name);
  const invalidApplicationIds = (applicationIds ?? []).filter(
    (applicationId) => !product.componentIds.includes(applicationId)
  );
  if (invalidApplicationIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Applications are outside the Product scope: ${invalidApplicationIds.join(", ")}`,
    });
  }

  const review = createProductReview({
    productId,
    name: uniqueName,
    templateRevisionIds,
    templateNames,
    applicationIds,
  });

  const actor = await getLifecycleActor(event);

  addEvent({
    reviewId: review.id,
    eventType: EVENT_TYPES.REVIEW_CREATED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: {
      reviewName: uniqueName,
      productId,
      productName: product.name,
      templateCount: templateRevisionIds.length,
      templateNames,
      applicationCount: applicationIds?.length ?? 0,
    },
  });

  setResponseStatus(event, 201);
  return review;
});
