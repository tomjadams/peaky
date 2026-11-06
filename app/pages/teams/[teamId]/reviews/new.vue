<template>
  <div class="team-review-wizard ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="team-review-wizard__main w-full px-8 py-6">
      <div class="mx-auto max-w-4xl">
        <div class="mb-6">
          <h2 class="text-default text-2xl font-bold">Start New Review</h2>
          <p class="text-muted mt-2 text-sm">
            {{ teamName }} • Create a multi-template readiness review.
          </p>
        </div>

        <div class="bg-default border-default mb-8 rounded-lg border px-5 py-6">
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
            :team-context="teamContext"
            @update:template-search="templateSearch = $event"
            @toggle-template="toggleTemplate"
          />

          <section
            v-else-if="currentStep === 2"
            data-testid="wizard-step-2"
            class="space-y-4"
          >
            <p class="text-muted text-sm">
              Most team reviews cover the team as a whole. You can scope to
              specific applications instead.
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                :aria-pressed="reviewScope === 'subject-only'"
                :class="[
                  'rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
                  reviewScope === 'subject-only'
                    ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
                    : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
                ]"
                @click="reviewScope = 'subject-only'"
              >
                <p class="text-default text-sm font-semibold">Team only</p>
                <p class="text-muted mt-1 text-[13px]">
                  Review the team as a whole — no application list needed.
                </p>
              </button>

              <button
                type="button"
                :aria-pressed="reviewScope === 'targeted'"
                :class="[
                  'rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
                  reviewScope === 'targeted'
                    ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
                    : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
                ]"
                @click="reviewScope = 'targeted'"
              >
                <p class="text-default text-sm font-semibold">Selected apps</p>
                <p class="text-muted mt-1 text-[13px]">
                  Pick specific applications to include.
                </p>
              </button>
            </div>

            <SearchInput
              v-if="reviewScope === 'targeted'"
              v-model="applicationSearch"
              placeholder="Search applications..."
              class="sm:max-w-md"
            />

            <div
              v-if="
                reviewScope === 'targeted' &&
                selectedApplicationSummaries.length > 0
              "
              class="bg-elevated border-default rounded-lg border p-3"
            >
              <div class="mb-2 flex items-center justify-between">
                <span class="text-default text-[13px] font-semibold">
                  Linked applications
                </span>
                <span
                  class="bg-default text-muted ring-default rounded-full px-2 py-0.5 text-[13px] font-medium ring-1"
                >
                  {{ selectedApplicationSummaries.length }}
                </span>
              </div>

              <div class="flex flex-wrap gap-2">
                <span
                  v-for="application in selectedApplicationSummaries"
                  :key="application.id"
                  class="bg-default border-default text-muted rounded-full border px-2.5 py-1 text-[13px]"
                >
                  {{ application.name }}
                </span>
              </div>
            </div>

            <div v-if="reviewScope === 'targeted'" class="space-y-3">
              <p
                v-if="ownedApplicationsCount === 0"
                class="text-dimmed text-[13px]"
              >
                This team doesn't own any applications yet — showing the full
                catalog.
              </p>

              <div class="grid gap-4">
                <template
                  v-for="(application, index) in paginatedApplications"
                  :key="application.id"
                >
                  <p
                    v-if="
                      isFirstOwnedApplicationIndex(
                        applicationPageStartIndex + index
                      )
                    "
                    class="text-dimmed text-[13px] font-semibold"
                  >
                    {{ teamName }} applications ({{ ownedApplicationsCount }})
                  </p>
                  <p
                    v-if="
                      isFirstOtherApplicationIndex(
                        applicationPageStartIndex + index
                      )
                    "
                    class="text-dimmed text-[13px] font-semibold"
                  >
                    Other applications
                  </p>

                  <button
                    type="button"
                    :aria-pressed="
                      selectedApplicationIds.includes(application.id)
                    "
                    :class="[
                      'cursor-pointer rounded-lg border p-5 text-left transition-all duration-150 active:scale-[0.99]',
                      selectedApplicationIds.includes(application.id)
                        ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
                        : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
                    ]"
                    @click="toggleApplication(application.id)"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h3 class="text-default text-base font-semibold">
                          {{ application.name }}
                        </h3>
                        <p class="text-muted mt-2 text-sm">
                          Link this application to track readiness outcomes.
                        </p>
                      </div>

                      <span
                        :class="[
                          'mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border',
                          selectedApplicationIds.includes(application.id)
                            ? 'border-primary bg-primary text-white'
                            : 'border-default text-dimmed bg-elevated',
                        ]"
                      >
                        <Icon
                          :name="
                            selectedApplicationIds.includes(application.id)
                              ? 'lucide:check'
                              : 'lucide:plus'
                          "
                          class="h-4 w-4"
                        />
                      </span>
                    </div>
                  </button>
                </template>

                <div
                  v-if="filteredApplications.length === 0"
                  class="bg-elevated border-default text-muted rounded-lg border px-4 py-6 text-sm"
                >
                  No applications match your search.
                </div>
              </div>
            </div>

            <div
              v-if="reviewScope === 'targeted' && totalApplicationPages > 1"
              class="flex items-center justify-between px-1"
            >
              <span class="text-muted text-[13px] font-medium">
                Applications · Page {{ applicationPage }} of
                {{ totalApplicationPages }}
              </span>

              <div
                class="bg-elevated/70 border-default flex items-center gap-1 rounded-full border p-1"
              >
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-chevron-left"
                  :disabled="applicationPage === 1"
                  @click="applicationPage -= 1"
                >
                  Previous
                </UButton>

                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  trailing-icon="i-lucide-chevron-right"
                  :disabled="applicationPage === totalApplicationPages"
                  @click="applicationPage += 1"
                >
                  Next page
                </UButton>
              </div>
            </div>

            <p
              v-if="reviewScope === 'subject-only'"
              class="text-muted text-[13px]"
            >
              This review will cover team readiness as a whole.
            </p>
          </section>

          <section v-else data-testid="wizard-step-3" class="space-y-5">
            <p class="text-muted text-sm">
              Finalize the review details before creation.
            </p>

            <div class="space-y-2">
              <label
                for="review-name"
                class="text-default flex items-center gap-2 text-sm font-semibold"
              >
                <Icon name="lucide:pencil-line" class="h-4 w-4" />
                Review Name
              </label>
              <UInput
                id="review-name"
                v-model="reviewName"
                size="lg"
                icon="i-lucide-type"
                placeholder="e.g., Topic Q1 2026 Review"
              />
              <p class="text-dimmed text-[13px]">
                This title appears in dashboard lists and review details.
              </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="bg-default border-default rounded-lg border p-4">
                <div class="mb-3 flex items-center justify-between">
                  <h3
                    class="text-default flex items-center gap-2 text-sm font-semibold"
                  >
                    <Icon name="lucide:layout-template" class="h-4 w-4" />
                    Revisions
                  </h3>
                  <span
                    class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[13px] font-medium"
                  >
                    {{ selectedTemplateSummaries.length }} selected
                  </span>
                </div>

                <ul class="space-y-2 text-sm">
                  <li
                    v-for="template in selectedTemplateSummaries"
                    :key="template.id"
                    class="bg-default border-default text-muted flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span class="text-default font-medium">{{
                      template.name
                    }}</span>
                    <span class="text-dimmed text-[13px]">{{
                      template.revisionNumber !== null
                        ? `v${template.revisionNumber}`
                        : "Published"
                    }}</span>
                  </li>

                  <li
                    v-for="index in templatePlaceholderRows"
                    :key="`template-placeholder-${index}`"
                    class="border-default bg-default/40 rounded-lg border border-dashed px-3 py-2 text-transparent"
                    aria-hidden="true"
                  >
                    placeholder
                  </li>
                </ul>
              </div>

              <div class="bg-default border-default rounded-lg border p-4">
                <div class="mb-3 flex items-center justify-between">
                  <h3
                    class="text-default flex items-center gap-2 text-sm font-semibold"
                  >
                    <Icon name="lucide:app-window" class="h-4 w-4" />
                    Applications
                  </h3>
                  <span
                    class="bg-default text-muted ring-default rounded-full px-2 py-0.5 text-[13px] font-medium ring-1"
                  >
                    {{ selectedApplicationSummaries.length }} linked
                  </span>
                </div>

                <ul
                  v-if="selectedApplicationSummaries.length > 0"
                  class="space-y-2 text-sm"
                >
                  <li
                    v-for="application in selectedApplicationSummaries"
                    :key="application.id"
                    class="bg-default border-default text-muted flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span class="text-default font-medium">{{
                      application.name
                    }}</span>
                    <Icon
                      name="lucide:link-2"
                      class="text-dimmed h-3.5 w-3.5"
                    />
                  </li>

                  <li
                    v-for="index in applicationPlaceholderRows"
                    :key="`application-placeholder-${index}`"
                    class="border-default bg-default/40 rounded-lg border border-dashed px-3 py-2 text-transparent"
                    aria-hidden="true"
                  >
                    placeholder
                  </li>
                </ul>
                <p
                  v-else-if="reviewScope === 'subject-only'"
                  class="text-muted text-sm"
                >
                  Team-scoped — covers the team as a whole.
                </p>
                <div
                  v-else
                  class="border-default bg-default text-muted rounded-lg border border-dashed px-3 py-4 text-sm"
                >
                  No applications linked.
                </div>
              </div>
            </div>
          </section>

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
                v-if="currentStep === 2"
                data-testid="wizard-skip"
                size="lg"
                color="neutral"
                variant="ghost"
                @click="handleSkipStep"
              >
                Skip
              </UButton>

              <UButton
                v-if="currentStep < 3"
                data-testid="wizard-next"
                size="lg"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                class="transition-colors"
                :disabled="!canGoNext"
                @click="handleNextStep"
              >
                Continue
              </UButton>

              <UButton
                v-else
                data-testid="wizard-create"
                :loading="submitting"
                :disabled="!canGoNext"
                size="lg"
                color="primary"
                icon="i-lucide-check"
                class="transition-colors"
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
import ReviewWizardTemplateStep from "~/components/reviews/ReviewWizardTemplateStep.vue";
import { useCatalogComponentSearch } from "~/composables/catalog/useCatalogComponentSearch";
import { useTemplateCatalog } from "~/composables/templates/domain/useTemplateCatalog";
import { useTeamDetails } from "~/composables/teams/useTeamDetails";
import { useReviewWizard } from "~/composables/reviews/useReviewWizard";
import { useBreadcrumbs } from "~/composables/nav/useBreadcrumbs";
import { teamReviewService } from "~/services/review/TeamReviewService";

definePageMeta({
  name: "team-reviews-new",
  breadcrumb: {
    label: "New Review",
  },
  pageHeader: {
    title: "New Review",
    showSurveyMode: false,
  },
});

const route = useRoute();
const teamId = computed(() => String(route.params.teamId));
const toast = useToast();

const { team } = useTeamDetails(teamId);
const { setBreadcrumbs, resetBreadcrumbs } = useBreadcrumbs();
watch(
  team,
  (currentTeam) => {
    if (!currentTeam) return;
    setBreadcrumbs([
      { label: "Teams", to: "/teams" },
      { label: currentTeam.name, to: `/teams/${teamId.value}` },
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
const { allComponents } = useCatalogComponentSearch();

const {
  currentStep,
  selectedTemplateIds,
  selectedApplicationIds,
  reviewName,
  templateSearch,
  applicationSearch,
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

const APPLICATIONS_PER_PAGE = 3;
const applicationPage = ref(1);
type TeamReviewScope = "subject-only" | "targeted";
const reviewScope = ref<TeamReviewScope>("subject-only");
const steps = [
  { value: 1, title: "Revisions", description: "Step 1 of 3" },
  { value: 2, title: "Applications", description: "Step 2 of 3" },
  { value: 3, title: "Review", description: "Step 3 of 3" },
];

const teamName = computed(() => team.value?.name ?? "Team");
const applicationsPending = computed(() => false);
const applicationsError = computed<Error | null>(() => null);

const teamContext = computed(() => {
  const teamCatalogId = team.value?.id ?? teamId.value;
  return { id: teamCatalogId, name: teamName.value };
});

const applicationOptions = computed(() => {
  return allComponents.value.map((component) => ({
    id: component.id,
    name: component.displayName,
    ownerGroupId: component.ownerGroupId,
  }));
});

const preferredApplicationOptions = computed(() => {
  const teamCatalogId = team.value?.id ?? teamId.value;
  const ownedApplications = applicationOptions.value.filter(
    (application) => application.ownerGroupId === teamCatalogId
  );
  const otherApplications = applicationOptions.value.filter(
    (application) => application.ownerGroupId !== teamCatalogId
  );

  return [...ownedApplications, ...otherApplications];
});

// Section labels for the (still org-wide, still preferred-sorted) app
// picker below — make the existing "team-owned first" ordering accurate by
// naming the two groups instead of silently re-sorting. filteredApplications
// preserves that same owned-first ordering, so the owned group is always a
// contiguous run starting at index 0.
const ownedApplicationsCount = computed(() => {
  const teamCatalogId = team.value?.id ?? teamId.value;
  return filteredApplications.value.filter(
    (application) => application.ownerGroupId === teamCatalogId
  ).length;
});
const applicationPageStartIndex = computed(
  () => (applicationPage.value - 1) * APPLICATIONS_PER_PAGE
);
function isFirstOwnedApplicationIndex(globalIndex: number): boolean {
  return globalIndex === 0 && ownedApplicationsCount.value > 0;
}
function isFirstOtherApplicationIndex(globalIndex: number): boolean {
  return (
    globalIndex === ownedApplicationsCount.value &&
    globalIndex < filteredApplications.value.length
  );
}

const stepperIndex = computed({
  get: () => currentStep.value - 1,
  set: (value) => {
    const targetStep = Number(value) + 1;
    if (targetStep >= 1 && targetStep <= 3) {
      currentStep.value = targetStep as 1 | 2 | 3;
    }
  },
});

// Question/pillar-count enrichment, search, and template grouping for the
// template step now all live in ReviewWizardTemplateStep.vue (shared with
// the product wizard) — this page only needs catalog fetch state and a
// light id -> {name, revisionNumber} lookup for the step 1 chips tray and
// the step 3 summary card, below.
const templatesPending = catalogPending;
const templatesError = catalogError;

const filteredApplications = computed(() => {
  const query = applicationSearch.value.trim().toLowerCase();
  const list = preferredApplicationOptions.value;
  if (!query) return list;

  return list.filter((application) => {
    return (
      application.name.toLowerCase().includes(query) ||
      application.id.toLowerCase().includes(query)
    );
  });
});

const totalApplicationPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(filteredApplications.value.length / APPLICATIONS_PER_PAGE)
  );
});

const paginatedApplications = computed(() => {
  const start = (applicationPage.value - 1) * APPLICATIONS_PER_PAGE;
  return filteredApplications.value.slice(start, start + APPLICATIONS_PER_PAGE);
});

watch([applicationSearch, applicationOptions], () => {
  applicationPage.value = 1;
});

watch(totalApplicationPages, (value) => {
  if (applicationPage.value > value) {
    applicationPage.value = value;
  }
});

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

const selectedApplicationSummaries = computed(() => {
  return applicationOptions.value.filter((application) =>
    selectedApplicationIds.value.includes(application.id)
  );
});

watch(reviewScope, (scope) => {
  clearValidationError();
  if (scope === "subject-only") {
    selectedApplicationIds.value = [];
    applicationSearch.value = "";
  }
});

const summaryRowCount = computed(() => {
  return Math.max(
    selectedTemplateSummaries.value.length,
    selectedApplicationSummaries.value.length,
    1
  );
});

const templatePlaceholderRows = computed(() => {
  return Math.max(
    0,
    summaryRowCount.value - selectedTemplateSummaries.value.length
  );
});

const applicationPlaceholderRows = computed(() => {
  return Math.max(
    0,
    summaryRowCount.value - selectedApplicationSummaries.value.length
  );
});

const handleCancel = () => {
  navigateTo(`/teams/${teamId.value}`);
};

const handleNextStep = () => {
  if (
    currentStep.value === 2 &&
    reviewScope.value === "targeted" &&
    selectedApplicationIds.value.length === 0
  ) {
    validationError.value =
      "Select at least one application for selected-app scope.";
    return;
  }
  nextStep();
};

const handleSkipStep = () => {
  reviewScope.value = "subject-only";
  nextStep();
};

const handleCreateReview = async () => {
  if (!canGoNext.value) {
    validationError.value = "Review name is required.";
    return;
  }
  submitting.value = true;

  try {
    // Catalog teams exist only in the external source and have no local DB rows yet.
    // TeamReviewService guarantees subjects + team_profiles exist before the
    // review is created, so no review can become detached from its team page.
    const selectedTeam = team.value;
    if (!selectedTeam) {
      throw new Error("This team is unavailable or you do not have access");
    }

    const localReviewId = await teamReviewService.create({
      team: {
        id: selectedTeam.id,
        slug: teamId.value,
        name: selectedTeam.name,
        orgId: selectedTeam.orgId,
        orgName: selectedTeam.orgName,
        memberCount: selectedTeam.memberCount,
      },
      name: reviewName.value.trim(),
      templateRevisionIds: selectedTemplateIds.value,
      scope: reviewScope.value === "subject-only" ? "team" : "application",
      applicationIds:
        reviewScope.value === "subject-only"
          ? []
          : selectedApplicationIds.value,
    });

    toast.add({
      title: "Review created",
      description: `${reviewName.value} was created locally and will sync automatically.`,
      color: "success",
    });
    await navigateTo(
      `/teams/${teamId.value}/reviews/${localReviewId}/assessment`
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
