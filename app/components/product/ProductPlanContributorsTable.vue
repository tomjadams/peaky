<script setup lang="ts">
import type {
  PlanContributor,
  ContributorType,
} from "~/models/improvement-plan";

interface Props {
  contributors: PlanContributor[];
  productId: string;
}

defineProps<Props>();

const typeConfig: Record<ContributorType, { label: string; icon: string }> = {
  "product-review": { label: "Product review", icon: "lucide:package" },
  application: { label: "Application", icon: "lucide:app-window" },
  team: { label: "Team", icon: "lucide:users" },
};

/**
 * Resolves the named route for a contributor's review-level plan page.
 * Routes differ by contributor type: team → `team-review-plan`,
 * application → `app-review-plan`, otherwise `product-review-plan`.
 */
const planRoute = (c: PlanContributor): object => {
  if (c.contributorType === "team") {
    return {
      name: "team-review-plan",
      params: { teamId: c.sourceId, reviewId: c.reviewId },
    };
  }
  if (c.contributorType === "application") {
    return {
      name: "app-review-plan",
      params: { appId: c.sourceId, reviewId: c.reviewId },
    };
  }
  return {
    name: "product-review-plan",
    params: { productId: c.sourceId, reviewId: c.reviewId },
  };
};
</script>

<template>
  <div
    class="product-plan-contributors plan-section-card border-default bg-default overflow-hidden rounded-lg border"
  >
    <div
      class="product-plan-contributors__header bg-elevated/95 border-default/80 hidden grid-cols-[minmax(16rem,1fr)_9rem_8rem_9rem] items-center gap-6 border-b px-4 py-3 lg:grid"
    >
      <span class="text-muted text-[13px] font-semibold"> Contributor </span>
      <span class="text-muted text-[13px] font-semibold"> Type </span>
      <span class="text-muted text-right text-[13px] font-semibold">
        Follow-up
      </span>
      <span class="text-muted text-right text-[13px] font-semibold">
        Not assessed
      </span>
    </div>

    <div class="product-plan-contributors__body">
      <div
        v-for="contributor in contributors"
        :key="contributor.reviewId"
        class="product-plan-contributors__row border-default grid grid-cols-2 items-start gap-x-4 gap-y-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-black/[0.03] lg:grid-cols-[minmax(16rem,1fr)_9rem_8rem_9rem] lg:items-center lg:gap-6 dark:border-white/10 dark:hover:bg-white/[0.04]"
      >
        <div
          class="product-plan-contributors__identity col-span-2 min-w-0 lg:col-span-1"
        >
          <NuxtLink
            :to="planRoute(contributor)"
            class="text-primary focus-visible:ring-primary inline-flex min-h-8 max-w-full items-center rounded-[7px] text-sm font-semibold transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {{ contributor.reviewName }}
          </NuxtLink>
          <p class="text-muted mt-0.5 text-[13px]">
            {{ contributor.sourceName }}
          </p>
          <p v-if="contributor.topArea" class="text-muted mt-0.5 text-[13px]">
            Main gap: <span class="font-medium">{{ contributor.topArea }}</span>
          </p>
          <MaturityCompactContext
            v-if="contributor.maturity?.length"
            :entries="contributor.maturity"
            :to="planRoute(contributor)"
            :review-name="contributor.reviewName"
            class="border-default mt-2 border-t pt-1"
          />
        </div>

        <div
          class="product-plan-contributors__type col-span-2 flex items-center gap-1.5 lg:col-span-1"
        >
          <Icon
            :name="
              typeConfig[contributor.contributorType]?.icon ?? 'lucide:file'
            "
            class="text-muted h-3.5 w-3.5"
          />
          <span class="text-muted text-[13px]">
            {{ typeConfig[contributor.contributorType]?.label }}
          </span>
        </div>

        <div class="product-plan-contributors__follow-up lg:text-right">
          <span class="text-muted block text-[13px] font-semibold lg:hidden">
            Follow-up
          </span>
          <span class="text-default text-sm font-medium tabular-nums">
            {{
              contributor.summary.followUp + contributor.summary.checklistGaps
            }}
          </span>
        </div>

        <div class="product-plan-contributors__not-assessed lg:text-right">
          <span class="text-muted block text-[13px] font-semibold lg:hidden">
            Not assessed
          </span>
          <span class="text-default text-sm font-medium tabular-nums">
            {{ contributor.summary.notAssessed }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
