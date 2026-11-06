/**
 * Save assessment checkpoint as an append-only event.
 *
 * Creates an immutable checkpoint event instead of a mutable session snapshot.
 * Sessions are derived from events on read.
 *
 * @see site/docs/development/walkthroughs/local-first-auditing.md
 */
import type { SessionSnapshot, SessionDelta } from "../../../../../app/models";
import { findReviewById } from "../../../../data/review-lookup";
import { addEvent, EVENT_TYPES } from "../../../../data/review-events";
import type { AssessmentSession } from "~/models/session";

interface CheckpointBody {
  templateId?: string;
  comment?: string;
  snapshot: SessionSnapshot;
  delta: SessionDelta;
  createdBy?: { id: string; name: string };
}

function resolveActor(createdBy?: { id: string; name: string }) {
  return {
    id: createdBy?.id ?? "current-user",
    name: createdBy?.name ?? "You",
  };
}

function buildCheckpointEventData(
  review: { name: string; teamId?: string; templateId?: string },
  body: CheckpointBody
) {
  return {
    reviewName: review.name,
    teamId: review.teamId || undefined,
    templateId: body.templateId ?? review.templateId ?? "",
    note: body.comment?.trim() || undefined,
    questionsAnswered: body.delta.questionsAnswered,
    questionsChanged: body.delta.questionsChanged,
    progressDelta: body.delta.progressDelta,
    overallProgress: body.snapshot.overallProgress,
    pillarSnapshots: body.snapshot.pillars.map((p) => ({
      slug: p.slug,
      progress: p.progress,
      answeredQuestions: p.answeredQuestions,
      totalQuestions: p.totalQuestions,
    })),
  };
}

export default defineEventHandler(async (event) => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const review = findReviewById(reviewId);
  if (!review) {
    throw createError({ statusCode: 404, statusMessage: "Review not found" });
  }

  const body = (await readBody(event)) as CheckpointBody;

  if (!body?.snapshot || !body?.delta) {
    throw createError({
      statusCode: 400,
      statusMessage: "snapshot and delta are required",
    });
  }

  const actor = resolveActor(body.createdBy);

  // Create checkpoint event (append-only, immutable)
  const checkpointEvent = addEvent({
    reviewId,
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: actor.id,
    actorName: actor.name,
    data: buildCheckpointEventData(review, body),
  });

  // Return session-like object for backward compatibility
  const session: AssessmentSession = {
    id: checkpointEvent.id,
    reviewId,
    templateId: body.templateId ?? review.templateId ?? "",
    createdAt: checkpointEvent.time,
    createdBy: body.createdBy ?? { id: "current-user", name: "You" },
    snapshot: body.snapshot,
    delta: body.delta,
    note: body.comment?.trim() || undefined,
  };

  return session;
});
