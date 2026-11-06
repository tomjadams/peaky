<template>
  <SurveyPage :assessment-path="assessmentPath" />
</template>

<script setup lang="ts">
definePageMeta({
  name: "app-review-survey",
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
const appId = computed(() => String(route.params.appId));
const reviewId = computed(() => String(route.params.reviewId));
const assessmentPath = computed(
  () =>
    router.resolve({
      path: `/applications/${appId.value}/reviews/${reviewId.value}/assessment`,
      query: { ...route.query },
    }).fullPath
);
</script>
