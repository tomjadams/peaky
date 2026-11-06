import type { Review } from "~/models";
import {
  fetchRemoteResource,
  reviewHydration,
} from "~/services/review/ReviewHydration";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import { reviewRepository } from "~/services/review/ReviewRepository";
import { waitForLocalDbReady } from "~/local-db";

export const useReviewData = (reviewId: MaybeRef<string>) => {
  const id = computed(() => toValue(reviewId));
  const localReview = ref<Review | null>(null);
  const remoteReview = ref<Review | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  const loadReview = async () => {
    const currentId = id.value;

    if (!currentId) {
      localReview.value = null;
      remoteReview.value = null;
      error.value = null;
      loading.value = false;
      return;
    }

    if (import.meta.server) {
      loading.value = true;
      return;
    }

    loading.value = true;
    error.value = null;

    await waitForLocalDbReady();

    const localOnlyReview = await reviewHydration.hydrateReview(
      currentId,
      null
    );
    localReview.value = localOnlyReview;

    if (localOnlyReview) {
      remoteReview.value = null;
      loading.value = false;
      return;
    }

    const remoteResult = await fetchRemoteResource(
      () => $fetch<Review>(`/api/reviews/${currentId}`),
      "Failed to fetch review"
    );
    remoteReview.value = remoteResult.data;

    const hydratedReview = await reviewHydration.hydrateReview(
      currentId,
      remoteResult.data
    );

    if (hydratedReview) {
      localReview.value = hydratedReview;
    } else if (remoteResult.error) {
      error.value = remoteResult.error;
    }

    loading.value = false;
  };

  const refresh = async () => {
    await loadReview();
  };

  watch(id, () => void loadReview(), { immediate: true });

  const updateName = async (name: string): Promise<void> => {
    const currentId = id.value;

    if (!currentId) {
      throw new Error("reviewId is required");
    }

    const existingLocalReview = await reviewRepository.fetchReview(currentId);

    if (existingLocalReview) {
      await reviewMutations.update(currentId, { name });
      await loadReview();
      return;
    }

    try {
      await $fetch<Review>(`/api/reviews/${currentId}`, {
        method: "PATCH",
        body: { name },
      });
      await loadReview();
    } catch {
      await reviewMutations.update(currentId, { name });
      await loadReview();
    }
  };

  const resolvedReview = computed(
    () => localReview.value ?? remoteReview.value
  );
  const resolvedLoading = computed(() => {
    return loading.value && !resolvedReview.value;
  });
  const resolvedError = computed(() => {
    return resolvedReview.value ? null : error.value;
  });

  return {
    review: resolvedReview,
    error: resolvedError,
    loading: resolvedLoading,
    refresh,
    updateName,
  };
};
