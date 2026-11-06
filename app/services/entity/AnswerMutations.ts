import { and, createUuidV7, eq, inArray, nowISO } from "~/local-db";
import {
  reviewAnswerState,
  reviewTemplateSelections,
  templatePillars,
  templateQuestions,
} from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import { applyFieldVersionWrite } from "~/services/sync/inbound/helpers";
import { notifyLocalWrite } from "~/services/sync/pushTrigger";
import type { QuestionAnswer, NotApplicableReason } from "~/models";

/**
 * Mutation service for review answer state.
 *
 * Uses draft() (auto-save, no audit event) for every field change.
 * Each field carries an HLC timestamp for server-side conflict resolution.
 * The "Save milestone" button on the assessment page calls ReviewMutations.saveMilestone()
 * which writes the milestone audit event.
 */
export class AnswerMutations {
  async save(input: {
    reviewId: string;
    templateRevisionId: string;
    questionId: string;
    answer: QuestionAnswer;
    naReason?: NotApplicableReason;
    itemNaReasons?: Record<string, NotApplicableReason>;
  }): Promise<void> {
    const {
      reviewId,
      templateRevisionId,
      questionId,
      answer,
      naReason,
      itemNaReasons,
    } = input;

    if (!reviewId) throw new Error("reviewId is required");
    if (!templateRevisionId) throw new Error("templateRevisionId is required");
    if (!questionId) throw new Error("questionId is required");

    const id = `${reviewId}:${questionId}`;
    const clock = getHLCClock();
    const actorId = readPersistedActor().id;

    const answerJson = answer !== null ? JSON.stringify(answer) : null;
    const naReasonJson = naReason ? JSON.stringify(naReason) : null;
    const itemNaReasonsJson = itemNaReasons
      ? JSON.stringify(itemNaReasons)
      : null;

    // Capture HLCs upfront so field_versions and outbox use the same values.
    const answerHlc = clock.now();
    const naReasonHlc = clock.now();
    const itemNaReasonsHlc = clock.now();

    await localMutation.draft({
      stateWrite: async (tx, draft) => {
        const now = draft.now || nowISO();
        const selectionRows = await tx
          .select({
            templateRevisionId: reviewTemplateSelections.templateRevisionId,
          })
          .from(reviewTemplateSelections)
          .where(
            and(
              eq(reviewTemplateSelections.reviewId, reviewId),
              eq(
                reviewTemplateSelections.templateRevisionId,
                templateRevisionId
              )
            )
          )
          .limit(1);
        if (!selectionRows[0])
          throw new Error("Template Revision is not selected by this Review");
        const pillarRows = await tx
          .select({ id: templatePillars.id })
          .from(templatePillars)
          .where(eq(templatePillars.templateRevisionId, templateRevisionId));
        const questionRows = pillarRows.length
          ? await tx
              .select({ id: templateQuestions.id })
              .from(templateQuestions)
              .where(
                and(
                  eq(templateQuestions.id, questionId),
                  inArray(
                    templateQuestions.pillarId,
                    pillarRows.map((pillar) => pillar.id)
                  )
                )
              )
              .limit(1)
          : [];
        if (!questionRows[0])
          throw new Error(
            "Question does not belong to the selected Template Revision"
          );

        await tx
          .insert(reviewAnswerState)
          .values({
            id,
            reviewId,
            questionId,
            answer: answerJson,
            naReason: naReasonJson,
            itemNaReasons: itemNaReasonsJson,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: reviewAnswerState.id,
            set: {
              answer: answerJson,
              naReason: naReasonJson,
              itemNaReasons: itemNaReasonsJson,
              updatedAt: now,
            },
          });

        // Mirror the answer field into field_versions so Recent Changes
        // reflects local saves immediately — even without a sync backend.
        // The history row uses the outbox id as eventId, so the server echo
        // dedupes instead of creating a second Recent Changes row.
        await applyFieldVersionWrite(tx, {
          eventId: draft.outboxId,
          entityType: "review_answer",
          entityId: id,
          fieldName: "answer",
          value: answerJson,
          hlc: answerHlc,
          actorId,
          updatedAt: now,
        });
      },
      outbox: {
        entityType: "review_answer",
        entityId: id,
        operation: "upsert",
        fields: [
          { name: "answer", value: answer, hlc: answerHlc },
          { name: "naReason", value: naReason ?? null, hlc: naReasonHlc },
          {
            name: "itemNaReasons",
            value: itemNaReasons ?? null,
            hlc: itemNaReasonsHlc,
          },
        ],
      },
    });
  }

  async recordRemoteHistory(input: {
    reviewId: string;
    questionId: string;
    answer: QuestionAnswer;
  }): Promise<void> {
    const { reviewId, questionId, answer } = input;
    if (!reviewId) throw new Error("reviewId is required");
    if (!questionId) throw new Error("questionId is required");

    const actorId = readPersistedActor().id;
    const eventId = createUuidV7();
    const hlc = getHLCClock().now();
    await localMutation.localOnly({
      stateWrite: (tx, { now }) =>
        applyFieldVersionWrite(tx, {
          eventId,
          entityType: "review_answer",
          entityId: `${reviewId}:${questionId}`,
          fieldName: "answer",
          value: answer === null ? null : JSON.stringify(answer),
          hlc,
          actorId,
          updatedAt: now,
        }),
    });
    notifyLocalWrite();
  }
}

export const answerMutations = new AnswerMutations();
