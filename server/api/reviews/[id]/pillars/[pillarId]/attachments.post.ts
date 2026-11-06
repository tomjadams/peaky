import { addAttachment } from "../../../../../data/pillar-notes";
import { addEvent, EVENT_TYPES } from "../../../../../data/review-events";
import { requireReviewContentActor } from "../../../../../utils/reviewContentAccess";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");
  const pillarId = getRouterParam(event, "pillarId");

  if (!reviewId || !pillarId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID and Pillar ID are required",
    });
  }

  const actor = await requireReviewContentActor(event, reviewId);

  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No file uploaded",
    });
  }

  const fileField = formData.find((field) => field.name === "file");

  if (!fileField || !fileField.data || !fileField.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: "File is required",
    });
  }

  const contentType = fileField.type || "application/octet-stream";
  const sizeBytes = fileField.data.length;

  if (!ALLOWED_TYPES.has(contentType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Only PDF, XLSX, XLS, PNG, and JPEG files are supported",
    });
  }

  if (sizeBytes > MAX_SIZE) {
    throw createError({
      statusCode: 400,
      statusMessage: "File exceeds 10MB limit",
    });
  }

  // In production, upload to S3 here:
  // const ext = path.extname(fileField.filename);
  // const objectKey = buildObjectKey(reviewId, pillarId, attachmentId, ext);
  // await uploadFile(objectKey, fileField.data, contentType);

  const attachment = addAttachment(reviewId, pillarId, {
    filename: fileField.filename,
    contentType,
    sizeBytes,
    objectKey: `reviews/${reviewId}/pillars/${pillarId}/${Date.now()}.file`,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: new Date().toISOString(),
  });

  addEvent({
    reviewId,
    eventType: EVENT_TYPES.ATTACHMENT_UPLOADED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: {
      scopeType: "pillar",
      scopeId: pillarId,
      attachmentId: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      objectKey: attachment.objectKey,
    },
  });

  return attachment;
});
