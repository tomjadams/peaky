<template>
  <div class="review-details ml-20 flex min-w-0 flex-1 flex-col lg:mx-32">
    <div class="review-details__main w-full min-w-0 px-4 py-6 sm:px-8">
      <div class="review-details__container max-w-8xl mx-auto w-full min-w-0">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading review...</span>
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="subtle"
          title="Failed to load review"
          description="Please try again."
        />

        <template v-else-if="review">
          <ReviewHeader
            :name="review.name"
            :status="review.status"
            :template-names-label="templateNamesLabel"
            :created-at="review.createdAt"
            :is-editing-name="isEditingName"
            :edited-name="editedName"
            :is-saving-name="isSavingName"
            @update:edited-name="editedName = $event"
            @start-editing="startEditingName"
            @save-name="saveName"
            @cancel-editing="cancelEditingName"
            @name-keydown="handleNameKeydown"
            @view-plan="handleViewPlan"
            @continue-assessment="handleContinueAssessment"
          />

          <ReviewParticipants
            :assessors="review.assessors"
            :advisors="review.advisors ?? review.reviewers ?? []"
          />

          <ReviewMetrics
            :overall-progress="overallProgress"
            :actions-needed="actionsNeeded"
            :attention-loading="planLoading"
            :answered-questions="answeredQuestions"
            :total-questions="totalQuestions"
            :updated-at="lastActivityAt"
            :plan-route="planRoute"
          />

          <section class="review-breakdown mt-20">
            <SectionHeader
              title="Breakdown"
              description="Select a template, then choose a pillar to see how its questions contribute."
              class="mb-5"
            />

            <div
              class="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:items-start lg:gap-6"
            >
              <ReviewBreakdownTemplateSelector
                v-model="selectedTemplateId"
                :templates="review.templates"
              />
              <ReviewMaturitySummary
                v-if="workspace && selectedTemplate"
                :workspace="workspace"
                :template-revision-id="selectedTemplate.templateRevisionId"
                @changed="refreshWorkspace"
              />
            </div>

            <div
              tabindex="0"
              class="max-w-full overflow-x-auto"
              aria-label="Pillars breakdown table, scroll horizontally"
            >
              <DataTable
                :key="selectedTemplateId"
                :columns="pillarColumns"
                :data="pillarTableData"
                :clickable-rows="true"
                row-key="slug"
                aria-label="Pillars breakdown"
                @row-click="handlePillarClick"
              >
                <template #cell-maturity="{ row }">
                  <ReviewPillarMaturity
                    v-if="workspace && selectedTemplate"
                    :workspace="workspace"
                    :template-revision-id="selectedTemplate.templateRevisionId"
                    :pillar-slug="String(row.slug)"
                  />
                  <span v-else class="text-muted text-sm">Unavailable</span>
                </template>
                <template #cell-questions="{ value }">
                  <span class="text-default text-base tabular-nums">
                    {{ value }}
                  </span>
                </template>
                <template #cell-actionsNeeded="{ value }">
                  <span
                    v-if="Number(value) > 0"
                    class="dark:text-warning inline-flex items-center gap-2 text-base font-medium text-[#92400E]"
                  >
                    <span
                      class="bg-warning h-1.5 w-1.5 rounded-full"
                      aria-hidden="true"
                    />
                    <span class="tabular-nums">{{ value }}</span>
                  </span>
                  <span v-else class="text-muted text-base">—</span>
                </template>
                <template #empty>
                  <div class="flex flex-col items-center gap-2 py-8">
                    <Icon name="lucide:layers" class="text-dimmed h-10 w-10" />
                    <p class="text-muted text-sm">
                      No pillars defined for this template
                    </p>
                  </div>
                </template>
              </DataTable>
            </div>
            <ReviewPillarQuestionsSlideover
              v-if="
                workspace && selectedMaturityEntry && selectedPillarBreakdown
              "
              v-model:open="pillarBreakdownOpen"
              :workspace="workspace"
              :entry="selectedMaturityEntry"
              :pillar-id="selectedPillarBreakdown.id"
              :pillar-name="selectedPillarBreakdown.name"
              :subject-id="teamId"
              :questions="pillarQuestionIndex"
            />
          </section>

          <section class="mt-14">
            <SectionHeader title="Milestones" class="mb-6" />

            <div
              v-if="sessionsLoading"
              class="flex items-center justify-center py-8"
            >
              <span class="text-muted text-sm">Loading milestones...</span>
            </div>

            <div
              v-else-if="sessions.length === 0"
              class="bg-elevated border-default rounded-lg border p-8 text-center"
            >
              <Icon
                name="lucide:history"
                class="text-dimmed mx-auto h-10 w-10"
              />
              <p class="text-muted mt-2 text-sm">No milestones yet</p>
            </div>

            <template v-else>
              <div class="mb-6 px-4 pt-12">
                <SessionTimeline
                  :sessions="sessions"
                  :selected-id="selectedSessionId ?? undefined"
                  @select="handleSessionSelect"
                />
              </div>

              <div class="space-y-3">
                <SessionCard
                  v-for="(session, index) in reversedSessions"
                  :key="session.id"
                  :session="session"
                  :previous-session="getPreviousSession(session)"
                  :expanded="expandedSessionId === session.id"
                  :is-selected="selectedSessionId === session.id"
                  :is-comparing="false"
                  :is-first="index === reversedSessions.length - 1"
                  @toggle="toggleSession(session.id)"
                />
              </div>
            </template>
          </section>

          <section class="mt-14">
            <SyncRecentChanges
              :review-id="reviewId"
              :pillars="allPillars"
              :workspace="workspace"
            />
          </section>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TableColumn } from "~/components/DataTable.vue";
import type { AssessmentSession } from "~/models";
import type { Command } from "~/composables/nav/useCommandPalette";
import { useReviewSessions } from "~/composables/reviews/useReviewSessions";
import { useReviewData } from "~/composables/reviews/useReviewData";
import { useReviewPlanData } from "~/composables/reviews/useReviewPlanData";
import { useReviewPillarBreakdown } from "~/composables/reviews/useReviewPillarBreakdown";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import { getLatestSyncActivityAt } from "~/composables/sync/useFieldVersions";

definePageMeta({
  name: "team-review-details",
  breadcrumb: {
    label: "Overview",
  },
  pageHeader: {
    title: "Review Details",
    showSurveyMode: false,
  },
});

const route = useRoute();
const teamId = computed(() => String(route.params.teamId));
const reviewId = computed(() => String(route.params.reviewId));

const { setPageHeader } = usePageHeader();

const { review, loading, error, updateName } = useReviewData(reviewId);
const {
  plan,
  workspace,
  loading: planLoading,
  refresh: refreshWorkspace,
} = useReviewPlanData(reviewId, "team", teamId);
const { registerCommands } = useCommandPalette();

// Use the most recent field_versions.updatedAt for the Last Activity card,
// falling back to review.updatedAt when no sync activity exists yet.
const latestSyncActivityAt = ref<string | null>(null);
onMounted(async () => {
  latestSyncActivityAt.value = await getLatestSyncActivityAt(reviewId.value);
});
const lastActivityAt = computed(() => {
  const sync = latestSyncActivityAt.value;
  const remote = review.value?.updatedAt ?? null;
  if (!sync) return remote ?? "";
  if (!remote) return sync;
  return sync > remote ? sync : remote;
});

// Inline name editing
const isEditingName = ref(false);
const editedName = ref("");
const isSavingName = ref(false);

const startEditingName = () => {
  if (!review.value) return;
  editedName.value = review.value.name;
  isEditingName.value = true;
};

const cancelEditingName = () => {
  isEditingName.value = false;
  editedName.value = "";
};

const saveName = async () => {
  if (!editedName.value.trim()) return;

  isSavingName.value = true;
  try {
    await updateName(editedName.value.trim());
    isEditingName.value = false;
  } catch (e) {
    console.error("Failed to update review name:", e);
  } finally {
    isSavingName.value = false;
  }
};

const handleNameKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveName();
  } else if (event.key === "Escape") {
    cancelEditingName();
  }
};
const { sessions, loading: sessionsLoading } = useReviewSessions(reviewId);

watchEffect(() => {
  if (!review.value) return;

  setPageHeader({
    title: review.value.name,
    showSurveyMode: false,
  });
});

const selectedTemplateId = ref<string>("");

watch(
  () => review.value,
  (value) => {
    if (!value) return;
    if (!selectedTemplateId.value) {
      selectedTemplateId.value = value.templates[0]?.templateId ?? "";
    }
  },
  { immediate: true }
);

const selectedTemplate = computed(() => {
  if (!review.value) return null;

  return (
    review.value.templates.find(
      (template) => template.templateId === selectedTemplateId.value
    ) ??
    review.value.templates[0] ??
    null
  );
});

const selectedTemplateRevisionId = computed(
  () => selectedTemplate.value?.templateRevisionId
);
const {
  selectedMaturityEntry,
  selectedWorkspacePillars,
  pillarQuestionIndex,
  pillarProgressBySlug,
  selectedPillarBreakdown,
  pillarBreakdownOpen,
  handlePillarClick,
} = useReviewPillarBreakdown(workspace, selectedTemplateRevisionId);

const templateNamesLabel = computed(() => {
  return review.value?.templateNames.join(", ") ?? "";
});

const allPillars = computed(() => {
  return review.value?.templates.flatMap((template) => template.pillars) ?? [];
});

const totalQuestions = computed(() => {
  return allPillars.value.reduce(
    (sum, pillar) => sum + pillar.totalQuestions,
    0
  );
});

const answeredQuestions = computed(() => {
  return allPillars.value.reduce(
    (sum, pillar) => sum + pillar.answeredQuestions,
    0
  );
});

const overallProgress = computed(() => {
  if (totalQuestions.value === 0) return 0;
  return Math.round((answeredQuestions.value / totalQuestions.value) * 100);
});

const actionsNeeded = computed(() => plan.value?.summary.total ?? null);

const planRoute = computed(() => ({
  name: "team-review-plan",
  params: { teamId: teamId.value, reviewId: reviewId.value },
}));

const pillarColumns: TableColumn[] = [
  {
    key: "name",
    label: "Pillar",
    sortable: false,
    headerClass: "dark:text-muted",
  },
  {
    key: "progress",
    label: "Progress",
    type: "progress",
    headerClass: "dark:text-muted",
  },
  {
    key: "maturity",
    label: "Maturity",
    type: "text",
    width: "w-44",
    headerClass: "dark:text-muted",
  },
  {
    key: "questions",
    label: "Answered",
    type: "text",
    width: "w-32",
    align: "right",
    headerClass: "dark:text-muted",
  },
  {
    key: "actionsNeeded",
    label: "Needs attention",
    type: "text",
    headerClass: "dark:text-muted",
  },
];

const planItemsByPillar = computed(() => {
  const counts = new Map<string, number>();
  for (const item of plan.value?.items ?? []) {
    const key = `${item.identity.templateRevisionId}::${item.identity.pillarSlug}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
});

const pillarTableData = computed(() => {
  const template = selectedTemplate.value;
  return (template?.pillars ?? []).map((pillar) => ({
    id:
      selectedWorkspacePillars.value.find(
        (workspacePillar) => workspacePillar.slug === pillar.slug
      )?.id ?? pillar.slug,
    slug: pillar.slug,
    name: pillar.name,
    progress: pillarProgressBySlug.value.get(pillar.slug) ?? 0,
    questions: `${pillar.answeredQuestions} / ${pillar.totalQuestions}`,
    actionsNeeded:
      plan.value === null
        ? "—"
        : (planItemsByPillar.value.get(
            `${template?.templateRevisionId}::${pillar.slug}`
          ) ?? 0),
  }));
});

const handleContinueAssessment = () => {
  navigateTo({
    name: "team-review-assessment",
    params: { teamId: teamId.value, reviewId: reviewId.value },
  });
};

const handleViewPlan = () => {
  navigateTo({
    name: "team-review-plan",
    params: { teamId: teamId.value, reviewId: reviewId.value },
  });
};

const reviewCommands = computed<Command[]>(() => [
  {
    id: "review-view-plan",
    title: "View follow-ups",
    group: "Review",
    icon: "lucide:clipboard-list",
    keywords: ["improvement", "plan", "actions", "items", "attention"],
    run: handleViewPlan,
  },
  {
    id: "review-continue-assessment",
    title: "Go to Assessment",
    group: "Review",
    icon: "lucide:clipboard-check",
    keywords: ["assessment", "continue", "start"],
    run: handleContinueAssessment,
  },
]);

onMounted(() => {
  let unregister = registerCommands(reviewCommands.value, "lifecycle");
  watch(reviewCommands, () => {
    unregister();
    unregister = registerCommands(reviewCommands.value, "lifecycle");
  });
  onUnmounted(() => unregister());
});

const selectedSessionId = ref<string | null>(null);
const expandedSessionId = ref<string | null>(null);

const reversedSessions = computed(() => [...sessions.value].toReversed());

const getPreviousSession = (session: AssessmentSession) => {
  const index = sessions.value.findIndex((entry) => entry.id === session.id);
  if (index <= 0) return undefined;
  return sessions.value[index - 1];
};

const handleSessionSelect = (session: AssessmentSession) => {
  selectedSessionId.value = session.id;
  expandedSessionId.value = session.id;
};

const toggleSession = (sessionId: string) => {
  expandedSessionId.value =
    expandedSessionId.value === sessionId ? null : sessionId;
};
</script>
