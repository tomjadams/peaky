<script setup lang="ts">
import {
  useReviewPlanData,
  workspaceToReviewContext,
} from "~/composables/reviews/useReviewPlanData";
import { useReviewData } from "~/composables/reviews/useReviewData";
import { useHandoffData } from "~/composables/handoff/useHandoffData";
import { useHandoffSelection } from "~/composables/handoff/useHandoffSelection";
import HandoffPanel from "~/components/handoff/HandoffPanel.vue";
import MaturityEntryStateCard from "~/components/maturity/MaturityEntryStateCard.vue";
import ReviewPlanTemplateTabs from "~/components/review/ReviewPlanTemplateTabs.vue";
import ReviewPlanTemplateView from "~/components/review/ReviewPlanTemplateView.vue";
import {
  practiceDeepLinkFromContext,
  type SelectablePractice,
} from "~/services/handoff/projection";
import { useRoute, useRouter } from "#imports";
import type { PracticeReference } from "~/services/handoff/practice";
import {
  previewHandoffMaturity,
  type HandoffMaturityPreview,
} from "~/services/maturity/handoffPreview";

interface Props {
  reviewId: string;
  subjectType: "team" | "product" | "application";
  assessmentRouteName: string;
  assessmentParams: Record<string, string>;
  reviewRouteName: string;
  cssPrefix: string;
}

const props = defineProps<Props>();

const { review } = useReviewData(computed(() => props.reviewId));
const subjectId = computed(
  () =>
    props.assessmentParams.teamId ??
    props.assessmentParams.productId ??
    props.assessmentParams.appId
);
const {
  plan,
  workspace,
  loading,
  error,
  localWritesReady,
  localWriteError,
  refresh,
} = useReviewPlanData(
  computed(() => props.reviewId),
  props.subjectType,
  subjectId
);

const reviewName = computed(
  () => review.value?.name ?? workspace.value?.review.name ?? ""
);

const handoffContext = computed(() => {
  if (!workspace.value) return null;
  const context = workspaceToReviewContext(workspace.value, props.subjectType);
  if (subjectId.value) context.subjectId = subjectId.value;
  return context;
});
const {
  rows: handoffRows,
  ownedPracticeIds,
  previouslyHandedOffIds,
  activeHandoff,
  analytics: handoffAnalytics,
  history: handoffHistory,
  loading: handoffLoading,
  refresh: refreshHandoff,
} = useHandoffData(computed(() => props.reviewId));

const {
  selectableByEntityId,
  selectedIds,
  limitReached,
  selectError,
  selectErrorEntityId,
  selectViolations,
  toggle: toggleHandoff,
} = useHandoffSelection({
  reviewContext: handoffContext,
  rows: handoffRows,
  history: handoffHistory,
  reviewName,
  ownedPracticeIds,
});

const route = useRoute();
const activeRevisionId = ref("");
const activeEntry = computed(() => {
  const entries = workspace.value?.maturity ?? [];
  return (
    entries.find(
      (entry) => entry.templateRevisionId === activeRevisionId.value
    ) ?? entries[0]
  );
});
const routeRevisionId = computed(() =>
  typeof route.query.templateRevisionId === "string"
    ? route.query.templateRevisionId
    : ""
);
const selectedPractices = computed(() =>
  [...selectableByEntityId.value.values()].filter((practice) =>
    selectedIds.value.has(practice.entityId)
  )
);
const maturityPreviewByRevision = computed(() => {
  const previews = new Map<string, HandoffMaturityPreview>();
  for (const entry of workspace.value?.maturity ?? []) {
    if (entry.kind !== "result") continue;
    const selections = selectedPractices.value
      .filter(
        (practice) =>
          practice.reference.templateRevisionId === entry.templateRevisionId
      )
      .map((practice) => practice.reference);
    const preview = previewHandoffMaturity({
      trace: entry.trace,
      selectedPractices: selections,
    });
    if (preview.kind === "available") {
      previews.set(entry.templateRevisionId, preview);
    }
  }
  return previews;
});
const activeMaturityPreview = computed(() =>
  activeEntry.value
    ? (maturityPreviewByRevision.value.get(
        activeEntry.value.templateRevisionId
      ) ?? null)
    : null
);
const practiceOpportunityByEntityId = computed(() => {
  const opportunities = new Map<string, number>();
  const entry = activeEntry.value;
  if (entry?.kind !== "result") return opportunities;
  for (const practice of selectableByEntityId.value.values()) {
    if (practice.reference.templateRevisionId !== entry.templateRevisionId) {
      continue;
    }
    const preview = previewHandoffMaturity({
      trace: entry.trace,
      selectedPractices: [practice.reference],
    });
    if (preview.kind !== "available") continue;
    const opportunity = preview.practiceOpportunities[0];
    if (opportunity) {
      opportunities.set(practice.entityId, opportunity.displayPercentagePoints);
    }
  }
  return opportunities;
});

watch(
  [
    () =>
      workspace.value?.maturity.map((entry) => entry.templateRevisionId) ?? [],
    routeRevisionId,
  ],
  ([revisionIds, requestedRevisionId]) => {
    if (revisionIds.includes(requestedRevisionId)) {
      activeRevisionId.value = requestedRevisionId;
    } else if (!revisionIds.includes(activeRevisionId.value)) {
      activeRevisionId.value = revisionIds[0] ?? "";
    }
  },
  { immediate: true }
);

const showFallbackSelection = computed(
  () => activeEntry.value?.kind !== "result"
);
const fallbackRevisionId = computed(() =>
  showFallbackSelection.value
    ? activeEntry.value?.templateRevisionId
    : undefined
);
const selectionUnavailableReason = computed(() =>
  localWriteError.value
    ? "This server-backed review is not local yet. Retry local setup before changing the handoff."
    : "Preparing this review for offline changes."
);

const router = useRouter();
const reviewLink = computed(() => ({
  name: props.reviewRouteName,
  params: props.assessmentParams,
}));
const reviewPath = computed(() => router.resolve(reviewLink.value).fullPath);

const practicePathFor = (reference: PracticeReference): string => {
  const target = handoffContext.value
    ? practiceDeepLinkFromContext(handoffContext.value, reference)
    : null;
  const fallback = {
    name: props.assessmentRouteName,
    params: props.assessmentParams,
    query: { templateRevisionId: reference.templateRevisionId },
    hash: `#question-${reference.questionId}`,
  };
  return router.resolve(target ?? fallback).fullPath;
};

const handoffPanelProps = computed(() =>
  handoffContext.value
    ? {
        reviewContext: handoffContext.value,
        reviewName: reviewName.value,
        rows: handoffRows.value,
        history: handoffHistory.value,
        activeHandoff: activeHandoff.value,
        handoffAnalytics: handoffAnalytics.value,
        ownedPracticeIds: ownedPracticeIds.value,
        maturityPreviews: [...maturityPreviewByRevision.value.values()],
        loading: handoffLoading.value,
        practicePathFor,
        reviewPath: reviewPath.value,
        showSelectionList: showFallbackSelection.value,
        selectionRevisionId: fallbackRevisionId.value,
        writeAvailable: localWritesReady.value,
        writeUnavailableReason: selectionUnavailableReason.value,
      }
    : null
);

const handleEvidenceToggle = async (
  practice: SelectablePractice,
  selected: boolean
) => {
  if (!localWritesReady.value) return;
  if (await toggleHandoff(practice, selected)) await refreshHandoff();
};

const handleRetryLocalSetup = async () => {
  await refresh();
};
</script>

<template>
  <div :class="`${cssPrefix} flex w-full min-w-0 flex-1 flex-col pl-20`">
    <div
      :class="`${cssPrefix}__main page-gutters-spacious w-full min-w-0 py-6`"
    >
      <div
        :class="`${cssPrefix}__container mx-auto w-full max-w-[1440px] min-w-0`"
      >
        <div v-if="loading" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading follow-ups...</span>
        </div>

        <UAlert
          v-else-if="error"
          role="alert"
          color="error"
          variant="subtle"
          title="Failed to load follow-ups"
          description="Please try again."
        />

        <template v-else-if="plan && workspace">
          <ReviewPlanHeader :review-name="reviewName" />

          <template v-if="workspace.maturity.length > 0 && activeEntry">
            <ReviewPlanTemplateTabs
              v-model="activeRevisionId"
              :workspace="workspace"
              :maturity-preview="activeMaturityPreview"
              class="mt-6"
            />

            <ReviewPlanTemplateView
              v-if="activeEntry.kind === 'result'"
              :key="activeEntry.templateRevisionId"
              :workspace="workspace"
              :entry="activeEntry"
              :assessment-route-name="assessmentRouteName"
              :assessment-params="assessmentParams"
              :selectable-practices="selectableByEntityId"
              :selected-ids="selectedIds"
              :previously-handed-off-ids="previouslyHandedOffIds"
              :practice-opportunities="practiceOpportunityByEntityId"
              :selection-limit-reached="limitReached"
              :selection-error="selectError"
              :selection-error-entity-id="selectErrorEntityId"
              :selection-violations="selectViolations"
              :selection-write-available="localWritesReady"
              :selection-unavailable-reason="selectionUnavailableReason"
              class="mt-8"
              @retry="handleRetryLocalSetup"
              @toggle="handleEvidenceToggle"
            >
              <template #handoff>
                <HandoffPanel
                  v-if="handoffPanelProps"
                  v-bind="handoffPanelProps"
                  @changed="refreshHandoff"
                  @retry="handleRetryLocalSetup"
                />
              </template>
            </ReviewPlanTemplateView>

            <div
              v-else
              class="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
            >
              <div class="min-w-0">
                <MaturityEntryStateCard
                  :key="activeEntry.templateRevisionId"
                  :workspace="workspace"
                  :entry="activeEntry"
                  :assessment-route-name="assessmentRouteName"
                  :assessment-params="assessmentParams"
                  :show-assessment-action="true"
                />
                <HandoffPanel
                  v-if="handoffPanelProps"
                  v-bind="handoffPanelProps"
                  :show-selection-list="true"
                  :show-composer="false"
                  class="mt-8"
                  @changed="refreshHandoff"
                  @retry="handleRetryLocalSetup"
                />
              </div>
              <aside class="min-w-0 lg:sticky lg:top-24">
                <HandoffPanel
                  v-if="handoffPanelProps"
                  v-bind="handoffPanelProps"
                  :show-selection-list="false"
                  :show-composer="true"
                  @changed="refreshHandoff"
                  @retry="handleRetryLocalSetup"
                />
              </aside>
            </div>
          </template>

          <div
            v-else
            class="mt-8 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start"
          >
            <HandoffPanel
              v-if="handoffPanelProps"
              v-bind="handoffPanelProps"
              :show-selection-list="true"
              :show-composer="false"
              @changed="refreshHandoff"
              @retry="handleRetryLocalSetup"
            />
            <aside class="min-w-0 lg:sticky lg:top-24">
              <HandoffPanel
                v-if="handoffPanelProps"
                v-bind="handoffPanelProps"
                :show-selection-list="false"
                :show-composer="true"
                @changed="refreshHandoff"
                @retry="handleRetryLocalSetup"
              />
            </aside>
          </div>
        </template>

        <UAlert
          v-else
          role="status"
          color="neutral"
          variant="subtle"
          title="Follow-ups are not available yet"
          description="Return to the review and try again after its workspace has loaded."
        />
      </div>
    </div>
  </div>
</template>
