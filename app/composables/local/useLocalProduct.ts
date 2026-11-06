/**
 * Local-first product state composable.
 *
 * Provides reactive access to products stored in the local database.
 * Products commit locally first for instant UI, then queue for sync.
 *
 * Mutation operations (create, update, archive, restore, delete) and fetch
 * helpers are in ~/services/entity/ProductMutations.ts.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import {
  productMutations,
  type ParsedLocalProduct,
} from "~/services/entity/ProductMutations";

// Re-export for callers that import the type from this file.
export type { ParsedLocalProduct };

/**
 * Get a single product by subject ID.
 * Accepts reactive MaybeRef for reactivity with route params.
 */
export function useLocalProduct(subjectId: MaybeRef<string>): {
  product: ComputedRef<ParsedLocalProduct | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const id = computed(() => toValue(subjectId));
  const data = ref<ParsedLocalProduct | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!id.value) {
      data.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      data.value = await productMutations.fetchById(id.value);
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Watch for id changes and refresh
  watch(id, (newId) => {
    if (newId) {
      refresh();
    }
  });

  // Initial fetch
  refresh();

  const product = computed(() => {
    if (!data.value) return null;
    return data.value;
  });

  return { product, error, isLoading, refresh };
}
