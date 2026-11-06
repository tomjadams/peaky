<template>
  <SurveyPage :assessment-path="assessmentPath" />
</template>

<script setup lang="ts">
definePageMeta({
  name: "team-review-survey",
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
const teamId = computed(() => String(route.params.teamId));
const reviewId = computed(() => String(route.params.reviewId));
const assessmentPath = computed(
  () =>
    router.resolve({
      path: `/teams/${teamId.value}/reviews/${reviewId.value}/assessment`,
      query: { ...route.query },
    }).fullPath
);
</script>
