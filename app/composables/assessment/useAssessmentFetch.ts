import type { Review, QuestionsResponse } from "~/models";
import { assessmentOrchestrator } from "~/services/assessment/AssessmentOrchestrator";

/** Fetches review data and questions for assessment. Wraps useFetch with reactive reviewId support. */
export function useAssessmentFetch(reviewId: MaybeRef<string>) {
  const id = computed(() => toValue(reviewId));
  const remoteReview = ref<Review | null>(null);
  const remoteQuestions = ref<QuestionsResponse | null>(null);
  const reviewOverlay = ref<Review | null>(null);
  const questionsOverlay = ref<QuestionsResponse | null>(null);
  const pending = ref(true);
  const error = ref<Error | null>(null);

  const loadAssessment = async () => {
    const currentId = id.value;

    if (!currentId) {
      remoteReview.value = null;
      remoteQuestions.value = null;
      reviewOverlay.value = null;
      questionsOverlay.value = null;
      pending.value = false;
      error.value = null;
      return;
    }

    if (import.meta.server) {
      pending.value = true;
      return;
    }

    pending.value = true;
    error.value = null;

    const result = await assessmentOrchestrator.loadFull(currentId);

    remoteReview.value = result.remoteReview;
    remoteQuestions.value = result.remoteQuestions;
    reviewOverlay.value = result.reviewOverlay;
    questionsOverlay.value = result.questionsOverlay;
    error.value = result.error;

    pending.value = false;
  };

  const refresh = async () => {
    await loadAssessment();
  };

  watch(id, () => void loadAssessment(), { immediate: true });

  const resolvedReview = computed(
    () => reviewOverlay.value ?? remoteReview.value
  );
  const resolvedQuestions = computed(() => {
    return questionsOverlay.value ?? remoteQuestions.value;
  });
  const resolvedPending = computed(() => {
    return pending.value && (!resolvedReview.value || !resolvedQuestions.value);
  });
  const resolvedError = computed(() => {
    if (resolvedReview.value && resolvedQuestions.value) {
      return null;
    }

    return error.value;
  });

  return {
    review: resolvedReview,
    questionsData: resolvedQuestions,
    pending: resolvedPending,
    error: resolvedError,
    refresh,
  };
}
