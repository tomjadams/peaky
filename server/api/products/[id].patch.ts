import { z } from "zod";
import {
  getProductByIdWithOptions,
  isProductArchived,
  updateProduct,
} from "../../data/products";
import { recordLifecycleAuditEvent } from "../../data/lifecycle-audit";
import { canManageProductLifecycle } from "../../../app/lifecycle/management";
import { getLifecycleActor } from "../../utils/lifecycleActor";

const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    origin: z.enum(["bespoke", "open-source", "vendor"]),
    status: z.enum(["active", "inactive", "archived"]),
    isExternal: z.boolean(),
    productManagerId: z.string().trim().min(1),
    engineeringLeadId: z.string().trim().min(1).optional(),
    teamIds: z.array(z.string().trim().min(1)).min(1),
    componentIds: z.array(z.string().trim().min(1)),
    roadmapUrl: z.string().url().optional().or(z.literal("")),
    documentationUrl: z.string().url().optional().or(z.literal("")),
    supportChannel: z.string().trim().optional().or(z.literal("")),
  })
  .partial();

export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, "id");

  if (!productId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Product ID is required",
    });
  }

  const actor = await getLifecycleActor(event);
  const existing = getProductByIdWithOptions(productId, {
    includeArchived: true,
  });
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Product not found",
    });
  }

  const body = await readBody(event);
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid product payload",
    });
  }

  const updates = parsed.data;

  if (
    updates.status !== undefined &&
    !canManageProductLifecycle(actor, existing)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage:
        "Only product owners and admins can manage product lifecycle",
    });
  }

  const cleanUpdates = {
    ...updates,
    roadmapUrl: updates.roadmapUrl === "" ? undefined : updates.roadmapUrl,
    documentationUrl:
      updates.documentationUrl === "" ? undefined : updates.documentationUrl,
    supportChannel:
      updates.supportChannel === "" ? undefined : updates.supportChannel,
  };

  const wasArchived = isProductArchived(productId);
  const updated = updateProduct(productId, cleanUpdates);
  const changedLifecycleState =
    updates.status === "archived"
      ? !wasArchived
      : updates.status === "active" || updates.status === "inactive"
        ? wasArchived
        : false;

  if (updated && updates.status !== undefined && changedLifecycleState) {
    recordLifecycleAuditEvent({
      action: updates.status === "archived" ? "archive" : "restore",
      subjectType: "product",
      subjectId: updated.id,
      subjectName: updated.name,
      actor,
      associatedResources: {
        reviewsCount: updated.totalReviewCount,
        activeReviewCount: updated.activeReviewCount,
      },
    });
  }

  return updated;
});
