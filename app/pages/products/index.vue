<template>
  <div class="products-dashboard flex flex-1 flex-col">
    <main
      class="products-dashboard__main w-full py-6 pr-12 pl-32 min-[1920px]:pr-16 min-[1920px]:pl-36"
    >
      <div
        class="products-dashboard__container max-w-8xl mx-auto min-[1920px]:max-w-[1920px]"
      >
        <SectionHeader
          title="Products dashboard"
          description="Track operational readiness for internal products and services."
          class="mb-10"
        >
          <UButton
            size="lg"
            color="primary"
            icon="i-lucide-plus"
            @click="handleNewProduct"
          >
            New product
          </UButton>
        </SectionHeader>

        <StatStrip layout="triple" class="mb-16">
          <StatBlock
            :label="visibleProductCountLabel"
            :value="filteredProducts.length"
            :reveal-index="0"
          />
          <StatBlock
            label="Active reviews"
            :value="activeReviewsCount"
            :reveal-index="1"
          />
          <StatBlock
            label="External"
            :value="externalCount"
            :reveal-index="2"
          />
        </StatStrip>

        <ClientOnly>
          <DashboardLoadingState
            v-if="pending"
            :column-count="6"
            :filter-count="1"
            :row-count="6"
            :show-primary-action="true"
          />

          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            title="Failed to load products"
            description="Please try again."
          />

          <ProductTable
            v-else
            :products="filteredProducts"
            :manageable-product-ids="manageableProductIds"
            :surface="productSurface"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            :total-count="visibleProducts.length"
            :filtered-count="filteredProducts.length"
            @sort="handleSort"
            @row-click="handleProductClick"
            @archive="handleArchiveProduct"
            @restore="handleRestoreProduct"
            @delete="handleDeleteProduct"
            @start-review="handleStartReview"
          >
            <template #console>
              <SearchInput
                v-model="searchQuery"
                placeholder="Search products..."
                class="w-72"
              />
              <FilterChips
                :model-value="productSurface"
                :options="[
                  {
                    label: 'Active',
                    value: 'active',
                    count: activeProducts.length,
                  },
                  {
                    label: 'Archived',
                    value: 'archived',
                    count: archivedProducts.length,
                  },
                ]"
                @update:model-value="
                  (value) => (productSurface = value as 'active' | 'archived')
                "
              />
              <USelect
                v-model="originFilter"
                :items="originOptions"
                size="md"
                icon="i-lucide-box"
                class="w-56"
              />
            </template>
          </ProductTable>

          <template #fallback>
            <DashboardLoadingState
              :column-count="6"
              :filter-count="1"
              :row-count="6"
              :show-primary-action="true"
            />
          </template>
        </ClientOnly>

        <ArchiveConfirmDialog
          :open="isArchiveConfirmOpen"
          :title="archiveDialogTitle"
          description="Archiving moves this product out of the active products list."
          details-title="Archive is not permanent delete"
          :details-description="`${archiveDialogProductName} moves to Archived products, where you can restore it later.`"
          confirm-label="Archive product"
          :loading="isArchivingProduct"
          :close-disabled="isArchivingProduct"
          tone="primary"
          @update:open="handleArchiveDialogOpen"
          @confirm="handleArchiveConfirm"
        />

        <DeleteConfirmDialog
          :open="isDeleteConfirmOpen"
          :title="deleteDialogTitle"
          description="This permanently removes the archived product from local and remote storage."
          warning-title="Permanent removal"
          :warning-description="`${deleteDialogProductName} will be deleted permanently. This cannot be undone or restored later.`"
          resource-title="Associated resources"
          :resource-description="`${deleteDialogProductName} has ${deleteReviewCountLabel}.`"
          :resource-secondary-description="
            deleteActiveReviewCount > 0
              ? `${deleteActiveReviewCount} of those reviews are still active.`
              : undefined
          "
          confirmation-input-id="product-delete-confirmation"
          :confirmation-target="deleteDialogProductName"
          :confirmation-value="deleteConfirmationName"
          confirmation-help="The delete action stays disabled until the product name matches exactly."
          confirm-label="Delete permanently"
          :confirm-disabled="!deleteConfirmationMatches"
          :loading="isDeletingProduct"
          :close-disabled="isDeletingProduct"
          @update:open="handleDeleteDialogOpen"
          @update:confirmation-value="deleteConfirmationName = $event"
          @confirm="handleDeleteConfirm"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import ArchiveConfirmDialog from "~/components/lifecycle/ArchiveConfirmDialog.vue";
import DeleteConfirmDialog from "~/components/lifecycle/DeleteConfirmDialog.vue";
import { useProductDashboardLifecycle } from "~/composables/products/useProductDashboardLifecycle";
import { useProducts } from "~/composables/products/useProducts";
import {
  useProductFilters,
  PRODUCT_ORIGIN_OPTIONS,
} from "~/composables/products/useProductFilters";

definePageMeta({
  breadcrumb: {
    label: "Products",
  },
  pageHeader: {
    title: "Products",
    showSurveyMode: false,
  },
});

const {
  products,
  activeProducts,
  archivedProducts,
  pending,
  error,
  archiveProduct,
  restoreProduct,
  deleteProduct,
} = useProducts();
const { searchQuery, originFilter, filterProducts } = useProductFilters();
const sortBy = ref("name");
const sortDirection = ref<"asc" | "desc">("asc");
const productSurface = ref<"active" | "archived">("active");

const visibleProducts = computed(() => {
  return productSurface.value === "archived"
    ? archivedProducts.value
    : activeProducts.value;
});

const visibleProductCountLabel = computed(() => {
  return productSurface.value === "archived"
    ? "Archived products"
    : "Active products";
});

const filteredProducts = computed(() => {
  const filtered = filterProducts(visibleProducts.value);
  return filtered.toSorted((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (sortBy.value) {
      case "origin":
        compareA = a.origin;
        compareB = b.origin;
        break;
      case "totalReviewCount":
        compareA = a.totalReviewCount;
        compareB = b.totalReviewCount;
        break;
      case "createdAt":
        compareA = new Date(a.createdAt).getTime();
        compareB = new Date(b.createdAt).getTime();
        break;
      case "name":
      default:
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
        break;
    }

    if (compareA < compareB) return sortDirection.value === "asc" ? -1 : 1;
    if (compareA > compareB) return sortDirection.value === "asc" ? 1 : -1;
    return 0;
  });
});

const activeReviewsCount = computed(() => {
  return filteredProducts.value.reduce(
    (sum, product) => sum + product.activeReviewCount,
    0
  );
});

const externalCount = computed(() => {
  return filteredProducts.value.filter((p) => p.isExternal).length;
});

const originOptions = PRODUCT_ORIGIN_OPTIONS;

const {
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
} = useProductDashboardLifecycle({
  products,
  archiveProduct,
  restoreProduct,
  deleteProduct,
});

const handleNewProduct = () => {
  navigateTo("/products/new");
};

const handleSort = (column: string) => {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }

  sortBy.value = column;
  sortDirection.value = "asc";
};

const handleProductClick = (product: { id: string }) => {
  navigateTo(`/products/${product.id}`);
};

const handleStartReview = (productId: string) => {
  navigateTo(`/products/${productId}/reviews/new`);
};
</script>
