<template>
  <div class="app-details ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="app-details__main w-full px-8 py-6">
      <div class="app-details__container max-w-8xl mx-auto">
        <div v-if="appPending" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading application...</span>
        </div>

        <UAlert
          v-else-if="appError"
          color="error"
          variant="subtle"
          title="Failed to load application"
          description="Please try again."
        />

        <template v-else-if="application">
          <div class="mb-6">
            <h2 class="text-default text-2xl font-bold">
              {{ application.name }}
            </h2>
            <p class="text-muted mt-1 text-sm">
              {{ application.orgName }} &middot; {{ application.owner }}
            </p>
          </div>

          <div v-if="reviewsPending" class="text-muted text-sm">
            Loading reviews...
          </div>

          <div v-else-if="reviews && reviews.length > 0" class="space-y-4">
            <h3 class="text-default text-lg font-semibold">Reviews</h3>
            <div
              v-for="review in reviews"
              :key="review.id"
              class="bg-elevated border-default cursor-pointer rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              @click="handleReviewClick(review.id)"
            >
              <div class="flex items-center justify-between">
                <span class="text-default font-medium">{{ review.name }}</span>
                <UBadge
                  :color="
                    review.status === 'in-progress' ? 'primary' : 'neutral'
                  "
                  variant="subtle"
                >
                  {{ review.status }}
                </UBadge>
              </div>
            </div>
          </div>

          <div
            v-else
            class="bg-elevated border-default rounded-lg border p-8 text-center"
          >
            <p class="text-muted text-sm">
              No reviews linked to this application.
            </p>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { ApplicationRecord } from "~/../../server/data/applications";
import type { Review } from "~/models";
import type { Command } from "~/composables/nav/useCommandPalette";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";

definePageMeta({
  name: "app-details",
  breadcrumb: {
    label: "Application",
  },
  pageHeader: {
    title: "Application Details",
    showSurveyMode: false,
  },
});

const route = useRoute();
const appId = computed(() => String(route.params.appId));

const { setPageHeader } = usePageHeader();
const { registerCommands } = useCommandPalette();

const {
  data: application,
  pending: appPending,
  error: appError,
} = useFetch<ApplicationRecord>(() => `/api/applications/${appId.value}`);

const { data: reviews, pending: reviewsPending } = useFetch<Review[]>(
  () => `/api/applications/${appId.value}/reviews`
);

watchEffect(() => {
  if (application.value) {
    setPageHeader({
      title: application.value.name,
      showSurveyMode: false,
    });
  }
});

const handleStartNewReview = () => {
  navigateTo(`/teams/${application.value?.teamId}/reviews/new`);
};

const handleReviewClick = (reviewId: string) => {
  navigateTo(`/applications/${appId.value}/reviews/${reviewId}`);
};

const appCommands = computed<Command[]>(() => {
  const commands: Command[] = [
    {
      id: "app-new-review",
      title: "Start new review",
      group: "Actions",
      icon: "lucide:plus",
      keywords: ["create", "new", "review", "start"],
      run: () => handleStartNewReview(),
    },
  ];

  if (reviews.value) {
    const seenNames = new Set<string>();
    reviews.value.forEach((review) => {
      if (seenNames.has(review.name)) return;
      seenNames.add(review.name);
      commands.push({
        id: `review-${review.id}`,
        title: `Go to ${review.name}`,
        group: "Reviews",
        icon: "lucide:clipboard-check",
        keywords: ["review", "assessment", review.name.toLowerCase()],
        run: () => handleReviewClick(review.id),
      });
    });
  }

  return commands;
});

onMounted(() => {
  let unregister = registerCommands(appCommands.value, "lifecycle");

  watch(reviews, () => {
    unregister();
    unregister = registerCommands(appCommands.value, "lifecycle");
  });

  onUnmounted(() => unregister());
});
</script>
