import {
  deleteProduct,
  getProductByIdWithOptions,
  isProductArchived,
} from "../../data/products";
import { recordLifecycleAuditEvent } from "../../data/lifecycle-audit";
import {
  assertLifecycleConfirmation,
  canManageProductLifecycle,
} from "../../../app/lifecycle/management";
import { getLifecycleActor } from "../../utils/lifecycleActor";

export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Product ID is required",
    });
  }

  const existing = getProductByIdWithOptions(productId, {
    includeArchived: true,
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Product not found",
    });
  }

  const actor = await getLifecycleActor(event);

  if (!canManageProductLifecycle(actor, existing)) {
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only product owners and admins can manage product lifecycle",
    });
  }

  if (!isProductArchived(productId)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Only archived products can be deleted",
    });
  }

  const body = await readBody<{ confirmationName?: string }>(event);

  try {
    assertLifecycleConfirmation(
      existing.name,
      body?.confirmationName,
      "product"
    );
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error
          ? error.message
          : "Type the product name exactly to confirm permanent delete",
    });
  }

  recordLifecycleAuditEvent({
    action: "delete",
    subjectType: "product",
    subjectId: existing.id,
    subjectName: existing.name,
    actor,
    associatedResources: {
      reviewsCount: existing.totalReviewCount,
      activeReviewCount: existing.activeReviewCount,
    },
  });

  return deleteProduct(productId);
});
