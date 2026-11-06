import {
  deleteAttachment,
  getAttachmentById,
} from "../../../../../../data/pillar-notes";
import { addEvent, EVENT_TYPES } from "../../../../../../data/review-events";
import { requireReviewContentActor } from "../../../../../../utils/reviewContentAccess";

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");
  const pillarId = getRouterParam(event, "pillarId");
  const attachmentId = getRouterParam(event, "attachmentId");

  if (!reviewId || !pillarId || !attachmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID, Pillar ID, and Attachment ID are required",
    });
  }

  const actor = await requireReviewContentActor(event, reviewId);

  // Capture metadata before deletion for forensic audit trail
  const attachmentSnapshot = getAttachmentById(attachmentId);

  // In production, delete from S3 here:
  // if (attachmentSnapshot) await deleteFile(attachmentSnapshot.objectKey);

  const deleted = deleteAttachment(reviewId, pillarId, attachmentId);

  if (!deleted) {
    throw createError({
      statusCode: 404,
      statusMessage: "Attachment not found",
    });
  }

  addEvent({
    reviewId,
    eventType: EVENT_TYPES.ATTACHMENT_DELETED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: {
      scopeType: "pillar",
      scopeId: pillarId,
      attachmentId,
      filename: attachmentSnapshot?.filename,
      contentType: attachmentSnapshot?.contentType,
      sizeBytes: attachmentSnapshot?.sizeBytes,
      objectKey: attachmentSnapshot?.objectKey,
    },
  });

  return { success: true };
});
