/**
 * Local-first answer state composable.
 *
 * Provides reactive access to review answer states stored in the local database.
 * This is the current state layer for fast reads.
 *
 * Mutation operations (save) are in ~/services/entity/AnswerMutations.ts.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { withDatabase, safeParse, firstOrNull, eq, and } from "~/local-db";
import { reviewAnswerState } from "#shared/db/schema";
import type { QuestionAnswer, NotApplicableReason } from "~/models";

// Parsed answer state type (camelCase for app)
export interface ParsedAnswerState {
  id: string;
  reviewId: string;
  questionId: string;
  answer: QuestionAnswer | null;
  naReason: NotApplicableReason | null;
  itemNaReasons: Record<string, NotApplicableReason> | null;
  updatedAt: string;
}

/**
 * Parse JSON fields in answer state.
 */
function parseAnswerState(
  row: typeof reviewAnswerState.$inferSelect
): ParsedAnswerState {
  return {
    id: row.id,
    reviewId: row.reviewId,
    questionId: row.questionId,
    answer: safeParse<QuestionAnswer | null>(row.answer, null),
    naReason: safeParse<NotApplicableReason | null>(row.naReason, null),
    itemNaReasons: safeParse<Record<string, NotApplicableReason> | null>(
      row.itemNaReasons,
      null
    ),
    updatedAt: row.updatedAt,
  };
}

/**
 * Get a single answer state.
 */
export function useLocalAnswer(
  reviewId: string,
  questionId: string
): {
  answer: ComputedRef<ParsedAnswerState | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const data = ref<typeof reviewAnswerState.$inferSelect | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!reviewId || !questionId) {
      data.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      const result = await withDatabase(async (db) => {
        return db
          .select()
          .from(reviewAnswerState)
          .where(
            and(
              eq(reviewAnswerState.reviewId, reviewId),
              eq(reviewAnswerState.questionId, questionId)
            )
          )
          .limit(1);
      });

      data.value = firstOrNull(result);
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Initial fetch
  refresh();

  const answer = computed(() =>
    data.value ? parseAnswerState(data.value) : null
  );

  return { answer, error, isLoading, refresh };
}
