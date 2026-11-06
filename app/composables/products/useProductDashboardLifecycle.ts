import type { Ref } from "vue";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import {
  canManageProductLifecycle,
  matchesLifecycleConfirmation,
} from "~/lifecycle/management";
import type { ProductWithStatus } from "./useProducts";

interface UseProductDashboardLifecycleOptions {
  products: Ref<ProductWithStatus[]>;
  archiveProduct: (productId: string) => Promise<void>;
  restoreProduct: (productId: string) => Promise<void>;
  deleteProduct: (productId: string, confirmationName: string) => Promise<void>;
}

function getProductById(
  products: ProductWithStatus[],
  productId: string | null
): ProductWithStatus | null {
  if (!productId) {
    return null;
  }

  return products.find((product) => product.id === productId) ?? null;
}

export function useProductDashboardLifecycle(
  options: UseProductDashboardLifecycleOptions
) {
  const toast = useToast();
  const { actor: lifecycleActor } = useCurrentActor();

  const isArchiveConfirmOpen = ref(false);
  const archiveProductId = ref<string | null>(null);
  const isArchivingProduct = ref(false);
  const isDeleteConfirmOpen = ref(false);
  const deleteProductId = ref<string | null>(null);
  const isDeletingProduct = ref(false);
  const deleteConfirmationName = ref("");

  const archiveCandidate = computed(() => {
    return getProductById(options.products.value, archiveProductId.value);
  });

  const archiveDialogProductName = computed(() => {
    return archiveCandidate.value?.name ?? "This product";
  });

  const archiveDialogTitle = computed(() => {
    if (!archiveCandidate.value) {
      return "Archive this product?";
    }

    return `Archive ${archiveCandidate.value.name}?`;
  });

  const deleteCandidate = computed(() => {
    return getProductById(options.products.value, deleteProductId.value);
  });

  const deleteDialogProductName = computed(() => {
    return deleteCandidate.value?.name ?? "This product";
  });

  const deleteDialogTitle = computed(() => {
    if (!deleteCandidate.value) {
      return "Delete this product permanently?";
    }

    return `Delete ${deleteCandidate.value.name} permanently?`;
  });

  const deleteReviewCountLabel = computed(() => {
    const reviewCount = deleteCandidate.value?.totalReviewCount ?? 0;
    return `${reviewCount} product review${reviewCount === 1 ? "" : "s"}`;
  });

  const deleteActiveReviewCount = computed(() => {
    return deleteCandidate.value?.activeReviewCount ?? 0;
  });

  const deleteConfirmationMatches = computed(() => {
    return matchesLifecycleConfirmation(
      deleteDialogProductName.value,
      deleteConfirmationName.value
    );
  });

  const manageableProductIds = computed(() => {
    return options.products.value
      .filter((product) =>
        canManageProductLifecycle(lifecycleActor.value, product)
      )
      .map((product) => product.id);
  });

  const resetArchiveDialog = () => {
    isArchiveConfirmOpen.value = false;
    archiveProductId.value = null;
  };

  const resetDeleteDialog = () => {
    isDeleteConfirmOpen.value = false;
    deleteProductId.value = null;
    deleteConfirmationName.value = "";
  };

  const handleArchiveProduct = (productId: string) => {
    archiveProductId.value = productId;
    isArchiveConfirmOpen.value = true;
  };

  const handleDeleteProduct = (productId: string) => {
    deleteProductId.value = productId;
    isDeleteConfirmOpen.value = true;
  };

  const handleRestoreProduct = async (productId: string) => {
    const productName =
      getProductById(options.products.value, productId)?.name ?? "This product";

    try {
      await options.restoreProduct(productId);
      toast.add({
        title: "Product restored",
        description: `${productName} moved back to Active products.`,
        color: "success",
      });
    } catch {
      toast.add({
        title: "Could not restore product",
        description: "Please try again.",
        color: "error",
      });
    }
  };

  const handleArchiveDialogOpen = (open: boolean) => {
    if (open) {
      isArchiveConfirmOpen.value = true;
      return;
    }

    if (isArchivingProduct.value) {
      return;
    }

    resetArchiveDialog();
  };

  const handleDeleteDialogOpen = (open: boolean) => {
    if (open) {
      isDeleteConfirmOpen.value = true;
      return;
    }

    if (isDeletingProduct.value) {
      return;
    }

    resetDeleteDialog();
  };

  const handleArchiveConfirm = async () => {
    if (!archiveProductId.value) {
      return;
    }

    const productId = archiveProductId.value;
    const productName = archiveDialogProductName.value;
    isArchivingProduct.value = true;

    try {
      await options.archiveProduct(productId);
      toast.add({
        title: "Product archived",
        description: `${productName} moved to Archived products and can be restored later.`,
        color: "success",
      });
      resetArchiveDialog();
    } catch {
      toast.add({
        title: "Could not archive product",
        description: "Please try again.",
        color: "error",
      });
    } finally {
      isArchivingProduct.value = false;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProductId.value || !deleteConfirmationMatches.value) {
      return;
    }

    const productId = deleteProductId.value;
    const productName = deleteDialogProductName.value;
    isDeletingProduct.value = true;

    try {
      await options.deleteProduct(productId, deleteConfirmationName.value);
      toast.add({
        title: "Product deleted permanently",
        description: `${productName} was permanently removed from Archived products.`,
        color: "success",
      });
      resetDeleteDialog();
    } catch (error) {
      toast.add({
        title: "Could not delete product",
        description:
          error instanceof Error
            ? error.message
            : "Only archived products can be permanently removed. Please try again.",
        color: "error",
      });
    } finally {
      isDeletingProduct.value = false;
    }
  };

  return {
    manageableProductIds,
    isArchiveConfirmOpen,
    archiveDialogTitle,
    archiveDialogProductName,
    isArchivingProduct,
    isDeleteConfirmOpen,
    deleteDialogTitle,
    deleteDialogProductName,
    deleteReviewCountLabel,
    deleteActiveReviewCount,
    deleteConfirmationName,
    deleteConfirmationMatches,
    isDeletingProduct,
    handleRestoreProduct,
    handleArchiveProduct,
    handleDeleteProduct,
    handleArchiveDialogOpen,
    handleDeleteDialogOpen,
    handleArchiveConfirm,
    handleDeleteConfirm,
  };
}
