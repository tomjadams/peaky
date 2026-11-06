import type { Product } from "~/models";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { canManageProductLifecycle } from "~/lifecycle/management";
import { productMutations } from "~/services/entity/ProductMutations";
import { lastSyncAt } from "~/composables/sync/useSyncClient";

type ProductStatus = "active" | "inactive" | "archived";
export type ProductWithStatus = Product & { status: ProductStatus };

function isArchivedProduct(product: ProductWithStatus): boolean {
  return product.status === "archived";
}

// Module-level singletons — state survives navigation.
const products = ref<ProductWithStatus[]>([]);
const pending = ref(true);
const error = ref<Error | null>(null);
let loaded = false;

async function refresh(): Promise<void> {
  if (!import.meta.client) return;
  if (!loaded) pending.value = true;
  error.value = null;
  try {
    products.value = await productMutations.fetchAll();
    loaded = true;
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
  } finally {
    pending.value = false;
  }
}

if (import.meta.client) {
  void refresh();
  watch(lastSyncAt, () => void refresh());
}

export const useProducts = () => {
  const { actor: lifecycleActor } = useCurrentActor();

  const activeProducts = computed(() =>
    products.value.filter((p) => !isArchivedProduct(p))
  );
  const archivedProducts = computed(() =>
    products.value.filter((p) => isArchivedProduct(p))
  );

  const archiveProduct = async (productId: string): Promise<void> => {
    const existingProduct = products.value.find((p) => p.id === productId);
    if (!existingProduct) throw new Error("Product not found");
    if (!canManageProductLifecycle(lifecycleActor.value, existingProduct)) {
      throw new Error(
        "Only product owners and admins can manage product lifecycle"
      );
    }
    await productMutations.archive(productId, { actor: lifecycleActor.value });
    await refresh();
  };

  const restoreProduct = async (productId: string): Promise<void> => {
    const existingProduct = products.value.find((p) => p.id === productId);
    if (!existingProduct) throw new Error("Product not found");
    if (!canManageProductLifecycle(lifecycleActor.value, existingProduct)) {
      throw new Error(
        "Only product owners and admins can manage product lifecycle"
      );
    }
    await productMutations.restore(productId, { actor: lifecycleActor.value });
    await refresh();
  };

  const deleteProduct = async (
    productId: string,
    confirmationName: string
  ): Promise<void> => {
    const existingProduct = products.value.find((p) => p.id === productId);
    if (!existingProduct) throw new Error("Product not found");
    if (!canManageProductLifecycle(lifecycleActor.value, existingProduct)) {
      throw new Error(
        "Only product owners and admins can manage product lifecycle"
      );
    }
    const localProduct = await productMutations.fetchById(productId);
    if (localProduct && !isArchivedProduct(localProduct)) {
      throw new Error("Only archived products can be deleted");
    }
    await productMutations.delete(productId, {
      actor: lifecycleActor.value,
      confirmationName,
    });
    await refresh();
  };

  return {
    products,
    activeProducts,
    archivedProducts,
    pending,
    error,
    refresh,
    archiveProduct,
    restoreProduct,
    deleteProduct,
  };
};
