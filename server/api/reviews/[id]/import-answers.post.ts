/**
 * Import draft answers from integrations.
 *
 * Records provenance for each imported answer and creates audit events.
 * This enables "why is this answer here?" traceability.
 */

import { findReviewById } from "../../../data/review-lookup";
import { addEvent, EVENT_TYPES } from "../../../data/review-events";
import {
  recordImportProvenance,
  createDraftImportRecord,
} from "../../../data/provenance";
import type { AnswerProvenance } from "~/models/workspace";

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
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  const body = await readBody(event);

  // Validate required fields
  if (!body?.source || typeof body.source !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "source is required",
    });
  }

  if (!body?.answers || !Array.isArray(body.answers)) {
    throw createError({
      statusCode: 400,
      statusMessage: "answers array is required",
    });
  }

  // Validate each answer has required fields
  for (const answer of body.answers) {
    if (!answer.questionId || typeof answer.questionId !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Each answer must have a questionId",
      });
    }
    if (answer.answer === undefined || answer.answer === null) {
      throw createError({
        statusCode: 400,
        statusMessage: "Each answer must have an answer value",
      });
    }
  }

  const source = body.source;
  const runId = body.runId;
  const mode = body.mode ?? "draft-fill";
  const confidence = body.confidence;
  const evidence = body.evidence ?? [];

  // Build provenance for each answer
  const timestamp = new Date().toISOString();
  const answersWithProvenance = body.answers.map(
    (answer: { questionId: string; answer: unknown }) => ({
      questionId: answer.questionId,
      provenance: {
        source,
        runId,
        timestamp,
        confidence,
        evidence,
      } as AnswerProvenance,
    })
  );

  // Record provenance
  recordImportProvenance(reviewId, answersWithProvenance);

  // Create import record
  const importRecord = createDraftImportRecord({
    reviewId,
    source,
    runId,
    importedCount: body.answers.length,
    mode,
  });

  // Create audit event
  const auditEvent = addEvent({
    reviewId,
    eventType: EVENT_TYPES.ANSWER_IMPORTED,
    actorType: "integration",
    actorId: source,
    actorName: source,
    data: {
      reviewName: review.name,
      teamId: review.teamId || undefined,
      source,
      runId,
      importedCount: body.answers.length,
      mode,
      questionIds: body.answers.map(
        (a: { questionId: string }) => a.questionId
      ),
    },
    metadata: {
      confidence,
      evidence,
      importId: importRecord.id,
    },
  });

  return {
    success: true,
    importId: importRecord.id,
    eventId: auditEvent.id,
    importedCount: body.answers.length,
  };
});
