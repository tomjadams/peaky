<template>
  <div class="product-review-wizard ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="product-review-wizard__main w-full px-8 py-6">
      <div class="mx-auto max-w-4xl">
        <div class="mb-6">
          <h2 class="text-default text-2xl font-bold">Start New Review</h2>
          <p class="text-muted mt-2 text-sm">
            {{ productName }} · Choose Revisions, then define the scope.
          </p>
        </div>

        <div
          ref="stepperEl"
          class="bg-default border-default mb-8 rounded-lg border px-5 py-6 shadow-sm"
        >
          <UStepper
            v-model="stepperIndex"
            :items="steps"
            :ui="{
              separator:
                'bg-default ring-1 ring-default group-data-[state=completed]:bg-primary/40',
              trigger:
                'bg-muted ring-1 ring-default group-data-[state=active]:ring-primary/50 group-data-[state=completed]:ring-primary/30',
            }"
          />
        </div>

        <UAlert
          v-if="validationError"
          class="mb-4"
          color="warning"
          variant="subtle"
          title="Review needs attention"
          :description="validationError"
          close
          @update:open="clearValidationError"
        />

        <div
          v-if="templatesPending || applicationsPending"
          class="flex items-center justify-center py-16"
        >
          <span class="text-muted text-sm">Loading wizard data...</span>
        </div>

        <UAlert
          v-else-if="templatesError || applicationsError"
          color="error"
          variant="subtle"
          title="Failed to load templates or applications"
          description="Please try again."
        />

        <template v-else>
          <ReviewWizardTemplateStep
            v-if="currentStep === 1"
            :template-search="templateSearch"
            :selected-template-ids="selectedTemplateIds"
            :selected-template-summaries="selectedTemplateSummaries"
            :templates="templates"
            @update:template-search="templateSearch = $event"
            @toggle-template="toggleTemplate"
          />

          <ReviewWizardScopeStep
            v-else
            :review-name="reviewName"
            :review-scope="reviewScope"
            :product-application-count="productApplicationCount"
            :product-applications="productApplications"
            :selected-application-ids="selectedApplicationIds"
            :selected-template-summaries="selectedTemplateSummaries"
            @update:review-name="reviewName = $event"
            @update:review-scope="reviewScope = $event"
            @toggle-application="toggleApplication"
          />

          <!-- Action Bar -->
          <div
            class="bg-default border-default mt-8 flex items-center justify-between rounded-lg border p-4"
          >
            <UButton
              size="lg"
              color="neutral"
              variant="ghost"
              @click="handleCancel"
            >
              Cancel
            </UButton>

            <div class="flex items-center gap-2">
              <UButton
                v-if="canGoBack"
                size="lg"
                color="neutral"
                variant="outline"
                icon="i-lucide-arrow-left"
                @click="previousStep"
              >
                Back
              </UButton>

              <UButton
                v-if="currentStep === 1"
                data-testid="wizard-next"
                size="lg"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                class="transition-all hover:shadow-md hover:brightness-110 disabled:hover:brightness-100"
                :disabled="!canGoNext"
                @click="handleNextStep"
              >
                Continue
              </UButton>

              <UButton
                v-else
                data-testid="wizard-create"
                :loading="submitting"
                size="lg"
                color="primary"
                icon="i-lucide-check"
                class="transition-all hover:shadow-md hover:brightness-110 disabled:hover:brightness-100"
                :disabled="!canCreate"
                @click="handleCreateReview"
              >
                Create Review
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import ReviewWizardScopeStep from "~/components/reviews/ReviewWizardScopeStep.vue";
import ReviewWizardTemplateStep from "~/components/reviews/ReviewWizardTemplateStep.vue";
import { useBreadcrumbs } from "~/composables/nav/useBreadcrumbs";
import { useCatalogComponentSearch } from "~/composables/catalog/useCatalogComponentSearch";
import { reviewMutations } from "~/services/entity/ReviewMutations";
import { useProductDetails } from "~/composables/products/useProductDetails";
import { useTemplateCatalog } from "~/composables/templates/domain/useTemplateCatalog";
import { useReviewWizard } from "~/composables/reviews/useReviewWizard";
import { cachePublishedTemplateRevisions } from "~/services/template/TemplateRevisionSnapshotCache";

definePageMeta({
  breadcrumb: {
    label: "New Review",
  },
  pageHeader: {
    title: "New Review",
    showSurveyMode: false,
  },
});

const route = useRoute();
const toast = useToast();
const productId = computed(() => String(route.params.productId));
const { allComponents } = useCatalogComponentSearch();

const { product } = useProductDetails(productId);
const { setBreadcrumbs, resetBreadcrumbs } = useBreadcrumbs();
watch(
  product,
  (currentProduct) => {
    if (!currentProduct) return;
    setBreadcrumbs([
      { label: "Products", to: "/products" },
      { label: currentProduct.name, to: `/products/${productId.value}` },
      { label: "New Review" },
    ]);
  },
  { immediate: true }
);
onUnmounted(resetBreadcrumbs);
const {
  templates,
  pending: catalogPending,
  error: catalogError,
} = useTemplateCatalog();
const applicationsPending = ref(false);
const applicationsError = ref(null);

const {
  currentStep,
  selectedTemplateIds,
  selectedApplicationIds,
  reviewName,
  templateSearch,
  validationError,
  submitting,
  canGoNext,
  canGoBack,
  toggleTemplate,
  toggleApplication,
  clearValidationError,
  nextStep,
  previousStep,
} = useReviewWizard();

const stepperEl = ref<HTMLElement | null>(null);

type ReviewScope = "full" | "targeted";
const reviewScope = ref<ReviewScope>("full");

const steps = [
  { value: 1, title: "Revisions", description: "Step 1 of 2" },
  { value: 2, title: "Scope & Confirm", description: "Step 2 of 2" },
];

const productName = computed(() => product.value?.name ?? "Product");

const productApplicationCount = computed(
  () => product.value?.componentIds.length ?? 0
);

const productApplications = computed(() => {
  if (!product.value) return [];

  const componentNameById = new Map(
    allComponents.value.map((component) => [
      component.id,
      component.displayName,
    ])
  );

  return product.value.componentIds.map((id) => ({
    id,
    name: componentNameById.get(id) ?? id,
  }));
});

const stepperIndex = computed({
  get: () => currentStep.value - 1,
  set: (value) => {
    const next = Number(value) + 1;
    if (next >= 1 && next <= 2) {
      currentStep.value = next as 1 | 2;
    }
  },
});

const canCreate = computed(() => {
  if (reviewName.value.trim().length === 0) return false;
  if (
    reviewScope.value === "targeted" &&
    selectedApplicationIds.value.length === 0
  )
    return false;
  return true;
});

// When switching to "full", select all product apps; when "targeted", clear for manual pick
watch(reviewScope, (scope) => {
  if (scope === "full") {
    selectedApplicationIds.value = productApplications.value.map((a) => a.id);
  } else {
    selectedApplicationIds.value = [];
  }
});

// Pre-populate all applications on load (default is "full" scope)
watch(
  product,
  (p) => {
    if (p?.componentIds && reviewScope.value === "full") {
      selectedApplicationIds.value = [...p.componentIds];
    }
  },
  { immediate: true }
);

// Question/pillar-count enrichment, search, and template grouping for the
// template step now all live in ReviewWizardTemplateStep.vue (shared with
// the team wizard) — this page only needs catalog fetch state and a light
// id -> {name, revisionNumber} lookup for the scope step's summary card.
const templatesPending = catalogPending;
const templatesError = catalogError;

const templateSummaryById = computed(() => {
  const map = new Map<
    string,
    { id: string; name: string; revisionNumber: number | null }
  >();
  for (const entry of templates.value) {
    for (const revision of entry.publishedRevisions) {
      if (revision.status === "published") {
        map.set(revision.id, {
          id: revision.id,
          name: revision.name,
          revisionNumber: revision.revisionNumber,
        });
      }
    }
  }
  return map;
});

const selectedTemplateSummaries = computed(() =>
  selectedTemplateIds.value.flatMap((revisionId) => {
    const summary = templateSummaryById.value.get(revisionId);
    return summary ? [summary] : [];
  })
);

const scrollToStepper = () => {
  stepperEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const handleCancel = () => {
  navigateTo(`/products/${productId.value}`);
};

const handleNextStep = () => {
  nextStep();
  scrollToStepper();
};

const handleCreateReview = async () => {
  if (!canCreate.value) return;

  submitting.value = true;

  try {
    await cachePublishedTemplateRevisions(selectedTemplateIds.value);
    const localReviewId = await reviewMutations.create({
      subjectId: productId.value,
      subjectType: "product",
      name: reviewName.value.trim(),
      templateRevisionIds: selectedTemplateIds.value,
      scope: reviewScope.value === "full" ? "product" : "application",
      applicationIds:
        reviewScope.value === "full"
          ? productApplications.value.map((application) => application.id)
          : selectedApplicationIds.value,
      teamIds: [],
    });

    toast.add({
      title: "Review created",
      description: `${reviewName.value} was created locally and will sync automatically.`,
      color: "success",
    });

    await navigateTo(
      `/products/${productId.value}/reviews/${localReviewId}/assessment`
    );
  } catch (error) {
    toast.add({
      title: "Could not create review",
      description: error instanceof Error ? error.message : "Unknown error",
      color: "error",
    });
  } finally {
    submitting.value = false;
  }
};
</script>
