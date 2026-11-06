<template>
  <div class="product-plan ml-20 flex min-w-0 flex-1 flex-col">
    <div class="product-plan__main page-gutters-spacious w-full min-w-0 py-6">
      <div class="product-plan__container max-w-8xl mx-auto">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading product plan...</span>
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="subtle"
          title="Failed to load product plan"
          description="Please try again."
        />

        <template v-else-if="productPlan">
          <!-- Header -->
          <div class="mb-6">
            <h2
              class="text-highlighted text-[30px] font-extrabold tracking-[-0.015em]"
            >
              Follow-ups
            </h2>
            <p class="text-muted mt-1 text-[15px]">
              What is contributing to readiness for this product.
            </p>
          </div>

          <!-- Summary stats -->
          <StatStrip layout="quad-stacked" class="mb-14">
            <StatBlock
              label="Contributors"
              :value="productPlan.contributors.length"
              sub-label="Contributing reviews"
              :reveal-index="0"
            />

            <StatBlock
              label="Follow-up"
              :value="
                productPlan.summary.followUp + productPlan.summary.checklistGaps
              "
              sub-label="Across all contributors"
              :reveal-index="1"
            />

            <StatBlock
              label="Not assessed"
              :value="productPlan.summary.notAssessed"
              sub-label="Unanswered questions"
              :reveal-index="2"
            />

            <StatBlock
              label="Repeated items"
              :value="productPlan.rollups.length"
              tone="attention"
              sub-label="Shared across reviews"
              :reveal-index="3"
            />
          </StatStrip>

          <!-- Empty state: no contributors -->
          <div
            v-if="productPlan.contributors.length === 0"
            class="flex flex-col items-center gap-4 py-16 text-center"
          >
            <Icon name="lucide:package" class="text-dimmed h-12 w-12" />
            <div>
              <h3 class="text-default text-lg font-semibold">
                No contributing reviews found
              </h3>
              <p class="text-muted mt-1 text-sm">
                Start reviews for this product, its applications, or related
                teams.
              </p>
            </div>
          </div>

          <!-- Rollups first, Contributors second -->
          <template v-else>
            <!-- Repeated items rollup -->
            <ProductPlanRollups
              v-if="productPlan.rollups.length > 0"
              :rollups="productPlan.rollups"
              :contributors="productPlan.contributors"
            />
            <div v-else class="py-10 text-center">
              <p class="text-dimmed text-sm">
                No items appear in more than one contributing review yet.
              </p>
            </div>

            <!-- Contributor table -->
            <section class="mt-8">
              <div
                class="mb-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <h3 class="text-default text-lg font-semibold">
                    Contributor factors
                  </h3>
                  <p class="text-muted mt-1 text-sm">
                    Reviews and subjects driving these follow-ups.
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <div
                    class="text-muted flex items-center gap-1.5 text-[13px] font-medium"
                  >
                    <Icon name="lucide:filter" class="h-3.5 w-3.5" />
                    <span>Filter</span>
                  </div>
                  <UDropdownMenu
                    :items="contributorTypeMenuItems"
                    :modal="false"
                    :portal="false"
                    :content="{ align: 'end', sideOffset: 4 }"
                  >
                    <UButton
                      color="neutral"
                      variant="outline"
                      trailing-icon="i-lucide-chevron-down"
                      aria-label="Filter contributors by type"
                      class="w-40 justify-between"
                    >
                      {{ contributorTypeLabel }}
                    </UButton>
                  </UDropdownMenu>
                </div>
              </div>
              <ProductPlanContributorsTable
                :contributors="filteredContributors"
                :product-id="productId"
              />
            </section>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProductPlanData } from "~/composables/products/useProductPlanData";
import type { ContributorType } from "~/models/improvement-plan";

definePageMeta({
  name: "product-plan",
  breadcrumb: {
    label: "Follow-ups",
  },
  pageHeader: {
    title: "Follow-ups",
    showSurveyMode: false,
  },
});

const route = useRoute();
const productId = computed(() => String(route.params.productId));

const { productPlan, loading, error } = useProductPlanData(productId);

const contributorTypeOptions: {
  label: string;
  value: ContributorType | "all";
}[] = [
  { label: "All types", value: "all" },
  { label: "Product reviews", value: "product-review" },
  { label: "Applications", value: "application" },
  { label: "Teams", value: "team" },
];

const contributorTypeFilter = ref<ContributorType | "all">("all");

const contributorTypeLabel = computed(
  () =>
    contributorTypeOptions.find(
      (option) => option.value === contributorTypeFilter.value
    )?.label ?? contributorTypeOptions[0]!.label
);

const contributorTypeMenuItems = computed(() =>
  contributorTypeOptions.map((option) => ({
    label: option.label,
    icon:
      option.value === contributorTypeFilter.value
        ? "i-lucide-check"
        : undefined,
    onSelect: () => {
      contributorTypeFilter.value = option.value;
    },
  }))
);

const filteredContributors = computed(() => {
  if (!productPlan.value) return [];
  if (contributorTypeFilter.value === "all")
    return productPlan.value.contributors;
  return productPlan.value.contributors.filter(
    (c) => c.contributorType === contributorTypeFilter.value
  );
});
</script>
