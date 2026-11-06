<template>
  <ReviewPlanPage
    :review-id="reviewId"
    subject-type="application"
    assessment-route-name="app-review-assessment"
    :assessment-params="{ appId, reviewId }"
    review-route-name="app-review-details"
    css-prefix="app-review-plan"
  />
</template>

<script setup lang="ts">
definePageMeta({
  name: "app-review-plan",
  breadcrumb: { label: "Follow-ups" },
  pageHeader: { title: "Follow-ups", showSurveyMode: false },
});

const route = useRoute();
const appId = computed(() => String(route.params.appId));
const reviewId = computed(() => String(route.params.reviewId));
</script>
