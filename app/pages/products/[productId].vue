<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type { Breadcrumb } from "~/models/breadcrumb";
import { useProductDetails } from "~/composables/products/useProductDetails";
import { useBreadcrumbs } from "~/composables/nav/useBreadcrumbs";

// No breadcrumb in definePageMeta — the product name segment is resolved
// reactively once the product loads, replacing the old UUID-formatting approach.
definePageMeta({});

const route = useRoute();
const productId = computed(() => String(route.params.productId ?? ""));
const { product } = useProductDetails(productId);
const { setBreadcrumbs, resetBreadcrumbs } = useBreadcrumbs();

watchEffect(() => {
  const name = product.value?.name;
  if (!name) return;

  const crumbs: Breadcrumb[] = [
    { label: "Products", to: "/products" },
    { label: name, to: `/products/${productId.value}` },
  ];

  // Append every child route segment that declares a breadcrumb
  // (e.g. "Review" wrapper → "Assessment" leaf).
  // [productId].vue itself has no meta.breadcrumb, so it won't appear here.
  const childSegments = route.matched
    .filter((record) => record.meta?.breadcrumb)
    .map((record, index, arr) => {
      const meta = record.meta.breadcrumb as {
        label: string | ((r: RouteLocationNormalizedLoaded) => string);
      };
      const label =
        typeof meta.label === "function" ? meta.label(route) : meta.label;

      let path = record.path;
      Object.entries(route.params).forEach(([key, value]) => {
        path = path.replace(`:${key}()`, value as string);
        path = path.replace(`:${key}`, value as string);
      });

      const isLast = index === arr.length - 1;
      return { label, to: isLast ? undefined : path };
    });

  crumbs.push(...childSegments);
  setBreadcrumbs(crumbs);
});

onUnmounted(() => resetBreadcrumbs());
</script>
