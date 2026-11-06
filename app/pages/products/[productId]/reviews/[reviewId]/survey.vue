<template>
  <SurveyPage :assessment-path="assessmentPath" />
</template>

<script setup lang="ts">
definePageMeta({
  name: "product-review-survey",
  layout: "kiosk",
  breadcrumb: {
    label: "Survey",
  },
  pageHeader: {
    title: "Survey",
    showSurveyMode: true,
  },
});

const route = useRoute();
const router = useRouter();
const productId = computed(() => String(route.params.productId));
const reviewId = computed(() => String(route.params.reviewId));
const assessmentPath = computed(
  () =>
    router.resolve({
      path: `/products/${productId.value}/reviews/${reviewId.value}/assessment`,
      query: { ...route.query },
    }).fullPath
);
</script>
