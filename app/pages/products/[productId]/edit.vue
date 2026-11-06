<template>
  <div class="ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="w-full px-8 py-6">
      <div class="mx-auto max-w-4xl">
        <SectionHeader
          title="Edit product"
          :description="productName"
          class="mb-6"
        />

        <div v-if="pending" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading product...</span>
        </div>

        <template v-else-if="product">
          <ProductForm :form="form" />

          <div
            class="bg-default border-default mt-8 flex items-center justify-between rounded-lg border p-4"
          >
            <UButton
              size="lg"
              color="neutral"
              variant="ghost"
              @click="handleCancel"
            >
              Cancel
            </UButton>

            <UButton
              size="lg"
              color="primary"
              icon="i-lucide-check"
              :disabled="!isValid"
              :loading="submitting"
              @click="handleSave"
            >
              Save changes
            </UButton>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useProductDetails } from "~/composables/products/useProductDetails";
import { useProductCreation } from "~/composables/products/useProductCreation";

definePageMeta({
  breadcrumb: {
    label: "Edit",
  },
  pageHeader: {
    title: "Edit product",
    showSurveyMode: false,
  },
});

const route = useRoute();
const router = useRouter();
const toast = useToast();
const productId = computed(() => String(route.params.productId));

const { setPageHeader } = usePageHeader();

const { product, pending } = useProductDetails(productId);
const { form, submitting, isValid, populateFrom, submitUpdateLocal } =
  useProductCreation();

const productName = computed(() => product.value?.name ?? "Product");

watch(
  product,
  (p) => {
    if (p) {
      populateFrom(p);
      setPageHeader({
        title: `Edit: ${p.name}`,
        showSurveyMode: false,
      });
    }
  },
  { immediate: true }
);

const handleCancel = () => {
  router.push(`/products/${productId.value}`);
};

const handleSave = async () => {
  try {
    await submitUpdateLocal(productId.value);
    toast.add({
      title: "Product updated",
      description: `${form.name} was updated locally and will sync automatically.`,
      color: "success",
    });
    await router.push(`/products/${productId.value}`);
  } catch {
    toast.add({
      title: "Could not update product",
      description: "Please check the form and try again.",
      color: "error",
    });
  }
};
</script>
