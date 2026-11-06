/**
 * Local-first review composable.
 *
 * Provides reactive access to reviews stored in the local database.
 * Falls back to server data when local data is not available.
 *
 * Mutation operations (create, update, archive, restore, delete, saveMilestone)
 * are in ~/services/entity/ReviewMutations.ts.
 *
 * @see site/docs/development/walkthroughs/local-first-api.md
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { withDatabase, firstOrNull, eq } from "~/local-db";
import { reviews, type ReviewStatus } from "#shared/db/schema";

// Parsed type with camelCase for app consumption
export interface LocalReview {
  id: string;
  /** Subject ID of the entity being reviewed, e.g. `product_abc123` or `team-customer-portal`. */
  subjectId: string;
  name: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a single review by ID from local database.
 */
export function useLocalReview(reviewId: string): {
  review: ComputedRef<LocalReview | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const data = ref<typeof reviews.$inferSelect | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!reviewId) {
      data.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      data.value = await withDatabase(async (db) =>
        firstOrNull(
          await db
            .select()
            .from(reviews)
            .where(eq(reviews.id, reviewId))
            .limit(1)
        )
      );
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Initial fetch
  refresh();

  const review = computed<LocalReview | null>(() => data.value);

  return {
    review,
    error,
    isLoading,
    refresh,
  };
}
