<template>
  <ReviewPlanPage
    :review-id="reviewId"
    subject-type="product"
    assessment-route-name="product-review-assessment"
    :assessment-params="{ productId, reviewId }"
    review-route-name="product-review-details"
    css-prefix="product-review-plan"
  />
</template>

<script setup lang="ts">
definePageMeta({
  name: "product-review-plan",
  breadcrumb: { label: "Follow-ups" },
  pageHeader: { title: "Follow-ups", showSurveyMode: false },
});

const route = useRoute();
const productId = computed(() => String(route.params.productId));
const reviewId = computed(() => String(route.params.reviewId));
</script>
