import { z } from "zod";
import {
  archiveProductReview,
  findProductReviewById,
  renameProductReview,
  restoreProductReview,
} from "../../data/product-reviews";
import {
  addEvent,
  EVENT_TYPES,
  type ReviewEventType,
} from "../../data/review-events";
import {
  archiveReview,
  findReviewById,
  renameReview,
  restoreReview,
  reviews,
} from "../../data/reviews";
import { getProductByIdWithOptions } from "../../data/products";
import {
  isReviewAdmin,
  normalizeReviewActor,
} from "~/services/review/ReviewGovernance";

const actorSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).optional(),
    roles: z.array(z.enum(["admin", "member"])).optional(),
  })
  .optional();

const renameReviewSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const lifecycleReviewSchema = z.object({
  action: z.enum(["archive", "restore"]),
  actor: actorSchema,
});

const updateReviewSchema = z.union([renameReviewSchema, lifecycleReviewSchema]);

function createForbiddenError(message: string) {
  throw createError({
    statusCode: 403,
    statusMessage: message,
  });
}

function recordLifecycleEvent(input: {
  reviewId: string;
  eventType: ReviewEventType;
  actorId: string;
  actorName: string;
  data: Record<string, unknown>;
}) {
  addEvent({
    reviewId: input.reviewId,
    eventType: input.eventType,
    actorType: "user",
    actorId: input.actorId,
    actorName: input.actorName,
    data: input.data,
  });
}

type NormalizedActor = ReturnType<typeof normalizeReviewActor>;

function handleReviewRename(reviewId: string, name: string) {
  const teamReview = findReviewById(reviewId);
  if (teamReview) {
    const duplicateExists = reviews.some(
      (r) =>
        r.id !== reviewId && r.teamId === teamReview.teamId && r.name === name
    );

    if (duplicateExists) {
      throw createError({
        statusCode: 409,
        statusMessage: "A review with this name already exists in this team",
      });
    }

    const renamedReview = renameReview(reviewId, name);

    if (!renamedReview) {
      throw createError({
        statusCode: 404,
        statusMessage: "Review not found",
      });
    }

    return renamedReview;
  }

  const productReview = renameProductReview(reviewId, name);
  if (productReview) {
    return productReview;
  }

  throw createError({
    statusCode: 404,
    statusMessage: "Review not found",
  });
}

function handleTeamReviewLifecycle(
  reviewId: string,
  action: "archive" | "restore",
  actor: NormalizedActor,
  teamReview: NonNullable<ReturnType<typeof findReviewById>>
) {
  const isAdmin = isReviewAdmin(actor);
  const advisors = teamReview.advisors ?? teamReview.reviewers ?? [];
  const canManageReview =
    isAdmin || advisors.some((advisor) => advisor.id === actor.id);

  if (!canManageReview) {
    createForbiddenError(
      "Only review advisors or admins can archive or restore this review"
    );
  }

  const previousStatus = teamReview.status;
  const updatedReview =
    action === "archive" ? archiveReview(reviewId) : restoreReview(reviewId);

  if (!updatedReview) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  recordLifecycleEvent({
    reviewId,
    eventType:
      action === "archive"
        ? EVENT_TYPES.REVIEW_ARCHIVED
        : EVENT_TYPES.REVIEW_RESTORED,
    actorId: actor.id,
    actorName: actor.name,
    data:
      action === "archive"
        ? {
            reviewName: teamReview.name,
            previousStatus,
            teamId: teamReview.teamId,
            templateCount: teamReview.templateIds.length,
            templateNames: teamReview.templateNames ?? [],
            applicationCount: teamReview.applicationIds?.length ?? 0,
          }
        : {
            reviewName: updatedReview.name,
            restoredStatus: updatedReview.status,
            teamId: teamReview.teamId,
          },
  });

  return updatedReview;
}

function handleProductReviewLifecycle(
  reviewId: string,
  action: "archive" | "restore",
  actor: NormalizedActor,
  productReview: NonNullable<ReturnType<typeof findProductReviewById>>
) {
  const isAdmin = isReviewAdmin(actor);
  const product = getProductByIdWithOptions(productReview.productId, {
    includeArchived: true,
  });
  const ownerIds = [
    product?.productManagerId,
    product?.engineeringLeadId,
  ].filter((ownerId): ownerId is string => Boolean(ownerId));
  const canManageReview = isAdmin || ownerIds.includes(actor.id);

  if (!canManageReview) {
    createForbiddenError(
      "Only product owners or admins can archive or restore this review"
    );
  }

  const previousStatus = productReview.status;
  const updatedReview =
    action === "archive"
      ? archiveProductReview(reviewId)
      : restoreProductReview(reviewId);

  if (!updatedReview) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  recordLifecycleEvent({
    reviewId,
    eventType:
      action === "archive"
        ? EVENT_TYPES.REVIEW_ARCHIVED
        : EVENT_TYPES.REVIEW_RESTORED,
    actorId: actor.id,
    actorName: actor.name,
    data:
      action === "archive"
        ? {
            reviewName: productReview.name,
            previousStatus,
            productId: productReview.productId,
            productName: product?.name,
            templateCount: productReview.templateIds.length,
            templateNames: productReview.templateNames,
            applicationCount: productReview.applicationIds?.length ?? 0,
          }
        : {
            reviewName: updatedReview.name,
            restoredStatus: updatedReview.status,
            productId: productReview.productId,
            productName: product?.name,
          },
  });

  return updatedReview;
}

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const body = await readBody(event);
  const parsed = updateReviewSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage:
        parsed.error.issues[0]?.message ?? "Invalid update payload",
    });
  }

  if ("name" in parsed.data) {
    return handleReviewRename(reviewId, parsed.data.name);
  }

  const actor = normalizeReviewActor(parsed.data.actor);

  const teamReview = findReviewById(reviewId);
  if (teamReview) {
    return handleTeamReviewLifecycle(
      reviewId,
      parsed.data.action,
      actor,
      teamReview
    );
  }

  const productReview = findProductReviewById(reviewId);
  if (productReview) {
    return handleProductReviewLifecycle(
      reviewId,
      parsed.data.action,
      actor,
      productReview
    );
  }

  throw createError({
    statusCode: 404,
    statusMessage: "Review not found",
  });
});
