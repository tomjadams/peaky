import { computed, type MaybeRef } from "vue";
import { useLocalProduct } from "~/composables/local/useLocalProduct";

/**
 * Product details from local SQLite only.
 *
 * Data is populated via the sync engine bootstrap + pull cycle.
 * Archived products are suppressed (consistent with pre-sync behaviour).
 */
export const useProductDetails = (productId: MaybeRef<string>) => {
  const { product: localProduct, isLoading: pending } =
    useLocalProduct(productId);

  const product = computed(() =>
    localProduct.value?.status === "archived"
      ? null
      : (localProduct.value ?? null)
  );

  const error = computed(() =>
    pending.value || product.value ? null : new Error("Product not found")
  );

  return { product, pending, error, refresh: async () => {} };
};
