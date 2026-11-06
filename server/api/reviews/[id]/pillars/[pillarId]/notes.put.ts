import { createHash } from "node:crypto";
import { savePillarNotes } from "../../../../../data/pillar-notes";
import { addEvent, EVENT_TYPES } from "../../../../../data/review-events";
import { savePillarNotesSchema } from "../../../../../utils/schemas";
import { requireReviewContentActor } from "../../../../../utils/reviewContentAccess";

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

  const body = await readBody(event);
  const parseResult = savePillarNotesSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.issues[0]?.message || "Invalid input",
    });
  }

  const notes = savePillarNotes(reviewId, pillarId, parseResult.data.content);

  // Store content metadata only — not the content itself.
  // Per GDPR Art. 5(1)(c) data minimization: the audit log needs to prove the
  // note was saved and detect tampering, not reproduce the content.
  // The content lives in the notes store and is erasable independently.
  const content = parseResult.data.content;
  addEvent({
    reviewId,
    eventType: EVENT_TYPES.NOTE_RECORDED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: {
      scopeType: "pillar",
      scopeId: pillarId,
      contentLength: content.length,
      contentHash: createHash("sha256")
        .update(content)
        .digest("hex")
        .slice(0, 16),
    },
  });

  return { notes };
});
