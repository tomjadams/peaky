/**
 * Local-first note state composable.
 *
 * Provides reactive access to review notes stored in the local database.
 * Notes are scoped to review, pillar, or question level.
 *
 * Mutation operations (save, delete, seed, fetchByScope) are in
 * ~/services/entity/NoteMutations.ts.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { ref, type Ref } from "vue";
import type { reviewNoteState, NoteScope } from "#shared/db/schema";
import { noteMutations } from "~/services/entity/NoteMutations";

type NoteRow = typeof reviewNoteState.$inferSelect;

/**
 * Get a single note by scope.
 */
export function useLocalNote(
  reviewId: string,
  scopeType: NoteScope,
  scopeId: string
): {
  note: Ref<NoteRow | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const data = ref<NoteRow | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      data.value = await noteMutations.fetchByScope(
        reviewId,
        scopeType,
        scopeId
      );
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Initial fetch
  refresh();

  return { note: data, error, isLoading, refresh };
}
