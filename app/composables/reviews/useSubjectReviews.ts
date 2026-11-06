import { computed, ref, toValue, watch, type MaybeRef } from "vue";
import type { ReviewStatus, ReviewSummary } from "~/models";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import { reviewRepository } from "~/services/review/ReviewRepository";
import type { ReviewActor } from "~/services/review/ReviewGovernance";
import { readPersistedReviewActor } from "~/composables/auth/useCurrentActor";
import { resolveLocalSubjectId } from "~/services/entity/resolveLocalSubjectId";
import { waitForLocalDbReady } from "~/local-db";

type ReviewSurface = "product" | "team";

interface ReviewMutationHandlers {
  local: () => Promise<void>;
  remote: () => Promise<void>;
}

function sortReviews(reviews: ReviewSummary[]): ReviewSummary[] {
  return reviews.toSorted(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

async function mutateRemoteReview(
  reviewId: string,
  action: "archive" | "restore",
  actor: ReviewActor
): Promise<void> {
  await $fetch(`/api/reviews/${reviewId}`, {
    method: "PATCH",
    body: {
      action,
      actor,
    },
  });
}

// Hoisted to module scope — pure pass-through, does not close over any
// composable-local state.
async function resolveLocalReview(reviewId: string) {
  return reviewRepository.fetchReview(reviewId);
}

/**
 * Reactive review list for a team or product subject.
 *
 * Loads reviews from local SQLite first and only falls back to the remote API
 * when no local reviews exist. Watches `subjectId` for changes and reloads
 * automatically.
 *
 * Reads delegate to `reviewRepository` (local SQLite).
 * Mutations (archive, restore, delete) delegate to `reviewMutations` service,
 * routing to the local path if the review exists locally, or the remote API
 * otherwise.
 *
 * @param surface   - `"product"` or `"team"` — determines the API path prefix.
 * @param subjectId - The entity ID of the subject; reactive (`MaybeRef`).
 *
 * @returns Reactive state:
 *   - `reviews`         — raw review list (includes archived)
 *   - `sortedReviews`   — sorted by `updatedAt` descending
 *   - `activeReviews`   — non-archived subset
 *   - `archivedReviews` — archived subset
 *   - `pending` / `error` — loading state
 *   - `refresh`, `archiveReview`, `restoreReview`, `deleteReview` — actions
 */
export function useSubjectReviews(
  surface: ReviewSurface,
  subjectId: MaybeRef<string>
) {
  const reviews = ref<ReviewSummary[] | null>(null);
  const pending = ref(false);
  const error = ref<Error | null>(null);
  const archivedStatusMemory = new Map<
    string,
    Exclude<ReviewStatus, "archived">
  >();

  const loadReviews = async (id: string): Promise<void> => {
    pending.value = true;
    error.value = null;

    try {
      await waitForLocalDbReady();
      const localSubjectId = await resolveLocalSubjectId(id).catch(() => null);
      const localResult = await reviewRepository.fetchSubjectReviews(
        localSubjectId ?? id
      );

      if (localResult.length > 0) {
        reviews.value = sortReviews(localResult);
        return;
      }

      const remoteResult = await $fetch<ReviewSummary[]>(
        `/api/${surface}s/${id}/reviews`,
        {
          query: { includeArchived: true },
        }
      ).catch((err) => {
        const is404 =
          err instanceof Error &&
          (err.message.includes("404") || err.message.includes("not found"));

        if (is404) {
          return null;
        }

        throw err;
      });

      reviews.value = sortReviews(remoteResult ?? []);
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      console.error("[local-first] Subject reviews load failed", {
        surface,
        subjectReference: id,
        diagnostic: "SUBJECT_REVIEWS_LOAD_FAILED",
        errorName: error.value.name,
        errorMessage: error.value.message,
      });
    } finally {
      pending.value = false;
    }
  };

  async function refreshCurrentSubject(): Promise<void> {
    const id = toValue(subjectId);

    if (!id) {
      return;
    }

    await loadReviews(id);
  }

  async function runReviewMutation(
    reviewId: string,
    handlers: ReviewMutationHandlers
  ): Promise<void> {
    const localReview = await resolveLocalReview(reviewId);

    if (localReview) {
      await handlers.local();
    } else {
      await handlers.remote();
    }

    await refreshCurrentSubject();
  }

  async function archiveReview(
    reviewId: string,
    actor: ReviewActor = readPersistedReviewActor()
  ): Promise<void> {
    await runReviewMutation(reviewId, {
      local: async () => {
        const localReview = await resolveLocalReview(reviewId);

        if (localReview?.status && localReview.status !== "archived") {
          archivedStatusMemory.set(reviewId, localReview.status);
        }

        await reviewMutations.archive(reviewId);
      },
      remote: async () => {
        await mutateRemoteReview(reviewId, "archive", actor);
      },
    });
  }

  async function restoreReview(
    reviewId: string,
    actor: ReviewActor = readPersistedReviewActor()
  ): Promise<void> {
    await runReviewMutation(reviewId, {
      local: async () => {
        const restoredStatus = archivedStatusMemory.get(reviewId) ?? "draft";
        archivedStatusMemory.delete(reviewId);
        await reviewMutations.restore(reviewId, restoredStatus);
      },
      remote: async () => {
        await mutateRemoteReview(reviewId, "restore", actor);
      },
    });
  }

  async function deleteReview(
    reviewId: string,
    actor: ReviewActor = readPersistedReviewActor()
  ): Promise<void> {
    await runReviewMutation(reviewId, {
      local: async () => {
        const localReview = await resolveLocalReview(reviewId);

        if (localReview?.status !== "archived") {
          throw new Error("Only archived reviews can be permanently deleted");
        }

        archivedStatusMemory.delete(reviewId);
        await reviewMutations.delete(reviewId);
      },
      remote: async () => {
        await $fetch(`/api/reviews/${reviewId}`, {
          method: "DELETE",
          body: {
            actor,
          },
        });
      },
    });
  }

  if (import.meta.client) {
    watch(
      () => toValue(subjectId),
      async (id) => {
        if (!id) return;
        await loadReviews(id);
      },
      { immediate: true }
    );
  }

  const sortedReviews = computed(() => sortReviews(reviews.value ?? []));
  const activeReviews = computed(() =>
    sortedReviews.value.filter((review) => review.status !== "archived")
  );
  const archivedReviews = computed(() =>
    sortedReviews.value.filter((review) => review.status === "archived")
  );

  return {
    reviews,
    sortedReviews,
    activeReviews,
    archivedReviews,
    pending,
    error,
    refresh: refreshCurrentSubject,
    archiveReview,
    restoreReview,
    deleteReview,
  };
}
