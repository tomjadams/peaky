import type { QuestionAnswer, NotApplicableReason } from "~/models/question";
import type { SessionSnapshot, SessionDelta } from "~/models";
import { answerMutations } from "~/services/entity/AnswerMutations";
import { noteMutations } from "~/services/entity/NoteMutations";
import { saveLocalProgress } from "~/composables/assessment/useLocalProgress";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import type { NoteScope } from "~/models/workspace";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { completeLocalHandoffAutomatically } from "~/services/handoff/localLifecycle";

/** Mutation operations for assessment: save answers and update pillar progress.
 *
 * Local-first: All mutations commit to local SQLite first, then queue for sync.
 * The UI updates immediately; remote sync happens in the background.
 */
export function useAssessmentMutate(
  reviewId: MaybeRef<string>,
  templateRevisionId: MaybeRef<string | null>
) {
  const { actor } = useCurrentActor();
  const saving = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Save an answer locally first, then queue for remote sync.
   */
  const saveAnswer = async (
    questionId: string,
    answer: QuestionAnswer,
    options: {
      naReason?: NotApplicableReason;
      itemNaReasons?: Record<string, NotApplicableReason>;
      templateRevisionId?: string;
    } = {}
  ): Promise<boolean> => {
    saving.value = true;
    error.value = null;
    const { naReason, itemNaReasons } = options;

    try {
      // Local-first: commit to local database immediately
      const revisionId =
        options.templateRevisionId ?? toValue(templateRevisionId);
      if (!revisionId) throw new Error("No active Template Revision");
      const currentReviewId = toValue(reviewId);
      await answerMutations.save({
        reviewId: currentReviewId,
        templateRevisionId: revisionId,
        questionId,
        answer,
        naReason,
        itemNaReasons,
      });
      await completeLocalHandoffAutomatically({
        reviewId: currentReviewId,
        completedBy: actor.value.id,
      }).catch((completionError) => {
        console.error(
          "[useAssessmentMutate] Failed to update local handoff completion:",
          completionError
        );
      });
      return true;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === "Template Revision is not selected by this Review"
      ) {
        try {
          await $fetch(`/api/reviews/${toValue(reviewId)}/answers`, {
            method: "POST",
            body: {
              templateRevisionId:
                options.templateRevisionId ?? toValue(templateRevisionId),
              questionId,
              answer,
              naReason,
              itemNAReasons: itemNaReasons,
            },
          });
          await answerMutations
            .recordRemoteHistory({
              reviewId: toValue(reviewId),
              questionId,
              answer,
            })
            .catch((historyError) => {
              console.error(
                "[useAssessmentMutate] Failed to record remote answer history:",
                historyError
              );
            });
          return true;
        } catch (remoteError) {
          error.value =
            remoteError instanceof Error
              ? remoteError
              : new Error("Failed to save answer");
        }
      } else {
        error.value =
          err instanceof Error ? err : new Error("Failed to save answer");
      }
      console.error("[useAssessmentMutate] saveAnswer failed:", {
        questionId,
        answer,
        error: error.value,
      });
      return false;
    } finally {
      saving.value = false;
    }
  };

  /**
   * Save a note locally first, then queue for remote sync.
   */
  const saveNote = async (
    scopeType: NoteScope,
    scopeId: string,
    content: string
  ): Promise<boolean> => {
    saving.value = true;
    error.value = null;

    try {
      await noteMutations.save(toValue(reviewId), scopeType, scopeId, content);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err : new Error("Failed to save note");
      return false;
    } finally {
      saving.value = false;
    }
  };

  /**
   * Save pillar progress locally first, then queue for remote sync.
   */
  const saveProgress = async (
    pillarSlug: string,
    progress: number
  ): Promise<boolean> => {
    try {
      await saveLocalProgress(toValue(reviewId), pillarSlug, progress);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err : new Error("Failed to save progress");
      return false;
    }
  };

  /**
   * Create a milestone snapshot locally and queue for background sync.
   */
  const createMilestone = async (opts: {
    templateId: string;
    comment: string;
    snapshot: SessionSnapshot;
    delta: SessionDelta;
  }): Promise<boolean> => {
    try {
      await reviewMutations.saveMilestone({
        reviewId: toValue(reviewId),
        templateId: opts.templateId,
        comment: opts.comment,
        snapshot: opts.snapshot,
        delta: opts.delta,
      });
      return true;
    } catch (err) {
      error.value =
        err instanceof Error
          ? err
          : new Error("Failed to save local milestone");
      return false;
    }
  };

  return {
    saving: readonly(saving),
    error: readonly(error),
    saveAnswer,
    saveNote,
    saveProgress,
    createMilestone,
  };
}
