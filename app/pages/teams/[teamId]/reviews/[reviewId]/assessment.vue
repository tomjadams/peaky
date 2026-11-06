<template>
  <AssessmentPage :review-id="reviewId" />
</template>

<script setup lang="ts">
definePageMeta({
  name: "team-review-assessment",
  breadcrumb: {
    label: "Assessment",
  },
});

const route = useRoute();
const reviewId = computed(() => String(route.params.reviewId));
</script>
