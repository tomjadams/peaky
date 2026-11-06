<template>
  <ReviewPlanPage
    :review-id="reviewId"
    subject-type="team"
    assessment-route-name="team-review-assessment"
    :assessment-params="{ teamId, reviewId }"
    review-route-name="team-review-details"
    css-prefix="team-review-plan"
  />
</template>

<script setup lang="ts">
definePageMeta({
  name: "team-review-plan",
  breadcrumb: { label: "Follow-ups" },
  pageHeader: { title: "Follow-ups", showSurveyMode: false },
});

const route = useRoute();
const teamId = computed(() => String(route.params.teamId));
const reviewId = computed(() => String(route.params.reviewId));
</script>
