import { nowISO } from "~/local-db";
import { reviewAnswerState } from "#shared/db/schema";
import { eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

/**
 * Handles pulled `review_answer` events.
 *
 * entityId format: "<reviewId>:<questionId>"
 */
export const ReviewAnswerHandler: InboundHandler = {
  entityTypes: ["review_answer"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      const [reviewId] = event.entityId.split(":");
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx
            .delete(reviewAnswerState)
            .where(eq(reviewAnswerState.id, event.entityId));
        },
        event: toReplayEvent(event, "ReviewAnswerDeletedSynced.v1", {
          reviewId,
        }),
      });
      return;
    }

    const [reviewId, questionId] = event.entityId.split(":");
    if (!reviewId || !questionId) return;

    const fields = toFieldMap(event.fields);
    const now = nowISO();

    // review_answer_state stores all JSON columns as JSON.stringify() output,
    // matching what AnswerMutations.save() writes via localMutation.draft().
    // toFieldMap() already JSON-parses the wire values, so we re-encode them
    // here to keep the storage format consistent.  Failing to do so causes
    // safeParse() in ReviewHydration.applyAnswersToQuestions() to silently
    // return null, making answered questions appear unanswered in Assessment.
    const row = {
      id: event.entityId,
      reviewId,
      questionId,
      answer: fields.answer != null ? JSON.stringify(fields.answer) : null,
      naReason:
        fields.naReason != null ? JSON.stringify(fields.naReason) : null,
      itemNaReasons:
        fields.itemNaReasons != null
          ? JSON.stringify(fields.itemNaReasons)
          : null,
      updatedAt: now,
    };

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewAnswerState)
          .values(row)
          .onConflictDoUpdate({
            target: reviewAnswerState.id,
            set: {
              answer: row.answer,
              naReason: row.naReason,
              itemNaReasons: row.itemNaReasons,
              updatedAt: row.updatedAt,
            },
          });
        // Best-effort: field_versions enriches Recent Changes but must not
        // prevent the reviewAnswerState write from being committed.
        // If upsertFieldVersions throws (e.g. schema mismatch during migration),
        // we catch it here so the answer is still persisted.
        try {
          await upsertFieldVersions(tx, event);
        } catch (err) {
          if (import.meta.dev) {
            console.warn(
              "[ReviewAnswerHandler] upsertFieldVersions failed:",
              err
            );
          }
        }
      },
      event: toReplayEvent(event, "ReviewAnswerSynced.v1", { reviewId }),
    });
  },
};
