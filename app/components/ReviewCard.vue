<template>
  <article
    class="review-card group cursor-pointer rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
    @click="handleClick"
  >
    <div class="mb-4 flex items-start justify-between">
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ review.name }}
        </h3>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {{ review.templateName }}
        </p>
      </div>
      <span
        :class="[
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          statusClasses,
        ]"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div class="mb-4">
      <div class="mb-2 flex items-center justify-between text-sm">
        <span class="text-slate-600 dark:text-slate-400">Overall Progress</span>
        <span class="font-medium text-slate-900 dark:text-white">
          {{ review.metrics.overallProgress }}%
        </span>
      </div>
      <div
        class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div
          class="bg-primary h-full transition-all"
          :style="{ width: `${review.metrics.overallProgress}%` }"
        />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 text-sm">
      <div>
        <div class="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <Icon name="lucide:check-circle" class="h-4 w-4" />
          <span>Pillars</span>
        </div>
        <div class="mt-1 font-medium text-slate-900 dark:text-white">
          {{ review.metrics.pillarsCompleted }}/{{
            review.metrics.totalPillars
          }}
        </div>
      </div>

      <div>
        <div class="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <Icon name="lucide:alert-circle" class="h-4 w-4" />
          <span>Actions</span>
        </div>
        <div class="mt-1 font-medium text-slate-900 dark:text-white">
          {{ review.metrics.actionsNeeded }}
        </div>
      </div>

      <div>
        <div class="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <Icon name="lucide:clock" class="h-4 w-4" />
          <span>Updated</span>
        </div>
        <div class="mt-1 font-medium text-slate-900 dark:text-white">
          {{ timeAgo }}
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Review } from "~/models";

interface ReviewWithMetrics extends Review {
  metrics: {
    overallProgress: number;
    pillarsCompleted: number;
    totalPillars: number;
    actionsNeeded: number;
    daysSinceUpdate: number;
  };
}

const props = defineProps<{
  review: ReviewWithMetrics;
}>();

const emit = defineEmits<{
  click: [reviewId: string];
}>();

const statusClasses = computed(() => {
  switch (props.review.status) {
    case "completed":
      return "bg-success/10 text-success";
    case "in-progress":
      return "bg-primary/10 text-primary";
    case "draft":
      return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    case "archived":
      return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
  }
});

const statusLabel = computed(() => {
  switch (props.review.status) {
    case "in-progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "draft":
      return "Draft";
    case "archived":
      return "Archived";
    default:
      return props.review.status;
  }
});

const timeAgo = computed(() => {
  const days = props.review.metrics.daysSinceUpdate;
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
});

const handleClick = () => {
  emit("click", props.review.id);
};
</script>
