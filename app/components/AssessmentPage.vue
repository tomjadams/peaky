<template>
  <div
    class="dashboard ml-20 grid flex-1"
    :class="
      templateSelectorCollapsed
        ? 'grid-cols-[96px_minmax(0,1fr)]'
        : 'grid-cols-[232px_minmax(0,1fr)] min-[1920px]:grid-cols-[264px_minmax(0,1fr)]'
    "
  >
    <TemplateSelectorSidebar
      :review="review"
      :pillar-stats="localPillarStats"
      @select-template-revision="handleTemplateSelect"
    />
    <div class="dashboard__main min-w-0 px-6 py-6 min-[1920px]:px-8">
      <div
        class="dashboard__container mr-auto w-full max-w-[1152px] min-[1920px]:grid min-[1920px]:max-w-[1600px] min-[1920px]:grid-cols-[minmax(0,1248px)_320px] min-[1920px]:gap-x-8"
      >
        <!-- Progress Section -->
        <section
          class="dashboard__progress bg-default/90 sticky top-20 z-10 -mx-6 mb-8 px-6 py-3 min-[1920px]:col-start-2 min-[1920px]:row-start-1 min-[1920px]:mx-0 min-[1920px]:mb-0 min-[1920px]:self-start min-[1920px]:p-0"
          aria-label="Overall Progress"
        >
          <div
            class="dashboard__progress-card border-default/50 bg-elevated/60 rounded-lg border p-3 backdrop-blur-sm"
          >
            <div
              class="dashboard__progress-header mb-2 flex items-center justify-between gap-6"
            >
              <p
                class="dashboard__progress-title text-muted text-sm font-semibold"
              >
                Progress
              </p>
              <p
                class="dashboard__progress-percentage text-dimmed text-[13px] font-medium tabular-nums"
              >
                {{ overallProgress }}%
              </p>
            </div>
            <div
              class="dashboard__progress-bar-container bg-muted/70 h-1.5 w-full rounded-full"
              role="progressbar"
              :aria-valuenow="overallProgress"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Overall completion progress"
            >
              <div
                class="dashboard__progress-bar bg-primary/80 h-1.5 rounded-full"
                :style="progressBarStyle"
              />
            </div>
            <div
              class="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 min-[1920px]:flex-col min-[1920px]:items-stretch min-[1920px]:gap-y-2"
            >
              <p class="text-muted flex items-center gap-1.5 text-sm">
                <Icon
                  v-if="answeredQuestions > 0"
                  name="lucide:check"
                  class="text-success h-4 w-4"
                  aria-hidden="true"
                />
                {{ answeredQuestions }} of {{ totalQuestions }} questions
                completed · saved on this device
              </p>
              <AssessmentMaturityLive :entry="liveMaturityEntry" />
            </div>
          </div>
        </section>

        <div
          class="dashboard__workspace min-w-0 min-[1920px]:col-start-1 min-[1920px]:row-start-1"
        >
          <!-- Loading State -->
          <div v-if="loading" class="flex items-center justify-center p-16">
            <span class="text-dimmed text-sm">Loading review...</span>
          </div>

          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            title="Failed to load assessment"
            :description="error.message"
          />

          <!-- Pillar Navigation Tabs -->
          <UTabs
            v-if="
              templateSelectorCollapsed &&
              !loading &&
              !error &&
              pillars.length > 1
            "
            :items="pillarTabItems"
            :model-value="currentPillar?.slug"
            :content="false"
            color="neutral"
            variant="link"
            :ui="{
              indicator: 'h-0.5',
              trigger:
                'text-[15px] font-semibold data-[state=active]:font-bold',
            }"
            class="mb-6"
            @update:model-value="handlePillarTabChange"
          >
            <template #trailing="{ item }">
              <Icon
                v-if="getPillarBySlug(String(item.value))?.progress === 100"
                name="lucide:circle-check"
                class="text-success h-4 w-4"
              />
              <span v-else class="text-muted text-[13px] tabular-nums">
                {{ getPillarBySlug(String(item.value))?.progress }}%
              </span>
            </template>
          </UTabs>

          <!-- Current Pillar Section -->
          <div
            v-if="!loading && !error && currentPillar"
            class="dashboard__pillars"
          >
            <AssessmentPillarSection
              :key="currentPillar.slug"
              :pillar-name="currentPillar.name"
              :pillar-slug="currentPillar.slug"
              :answered-count="
                getPillarBySlug(currentPillar.slug)?.answeredQuestions ?? 0
              "
              :total-count="
                getPillarBySlug(currentPillar.slug)?.totalQuestions ?? 0
              "
              :review-id="reviewId"
              :show-notes-section="true"
            >
              <AssessmentQuestionRow
                v-for="(question, index) in getQuestionsForPillar(
                  currentPillar.slug
                )"
                :key="question.id"
                :question-id="question.id"
                :question-label="
                  formatQuestionReference(currentPillar.slug, index + 1)
                "
                :question-text="question.text"
                :question-type="
                  question.type === 'checklist' ? 'checklist' : 'yes-no'
                "
                :checklist-items="question.checklistItems"
                :answer="question.answer ?? null"
                :highlighted="question.id === highlightedQuestionId"
                @update:answer="handleAnswerChange(question, $event)"
                @na-click="handleNAClick(question)"
                @item-na-click="handleItemNAClick(question, $event)"
                @info-click="showQuestionInfo(question)"
              />
            </AssessmentPillarSection>

            <!-- Pillar Navigation Footer -->
            <div
              class="border-default mt-8 flex items-center justify-between border-t pt-6"
            >
              <UButton
                v-if="currentPillarIndex > 0"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-left"
                @click="handleGoPrevPillar()"
              >
                {{ pillars[currentPillarIndex - 1]?.name }}
              </UButton>
              <div v-else />

              <UButton
                v-if="currentPillarIndex < pillars.length - 1"
                color="primary"
                trailing-icon="i-lucide-arrow-right"
                @click="handleGoNextPillar()"
              >
                {{ pillars[currentPillarIndex + 1]?.name }}
              </UButton>
              <div v-else />
            </div>
          </div>
        </div>
      </div>
    </div>
    <NAReasonModal @confirm="onNAConfirm" @clear="onNAClear" />
    <SaveProgressModal :saving="isSaving" />
  </div>
</template>

<script setup lang="ts">
import type {
  Question,
  QuestionAnswer,
  NotApplicableReason,
} from "~/models/question";
import type { SessionChange } from "~/models";
import type { Command } from "~/composables/nav/useCommandPalette";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import { useTemplateSelector } from "~/ui/useTemplateSelector";
import { useAssessment } from "~/composables/assessment/useAssessment";
import { useAssessmentRouteTarget } from "~/composables/assessment/useAssessmentRouteTarget";
import { useNAHandlers } from "~/composables/assessment/useNAHandlers";
import { useSaveModal } from "~/ui/useSaveModal";
import { isQuestionComplete } from "~/services/review/questionCompletion";
import { formatQuestionReference } from "~/utils/questionReference";
import SaveProgressModal from "~/components/SaveProgressModal.vue";
import AssessmentMaturityLive from "~/components/maturity/AssessmentMaturityLive.vue";
import { useReviewWorkspace } from "~/composables/reviews/useReviewWorkspace";
import { deriveWorkspaceMaturity } from "~/services/maturity/workspace";

const props = defineProps<{
  reviewId: string;
}>();

const { setPageHeader, setCTA } = usePageHeader();
const { openMoreInfoPanel } = useMoreInfoPanel();
const {
  isCollapsed: templateSelectorCollapsed,
  activeTemplateRevisionId,
  activePillarSlug,
  setActiveTemplateRevision,
  setActivePillar,
} = useTemplateSelector();
const { registerCommands } = useCommandPalette();

const reviewIdRef = toRef(props, "reviewId");
const {
  review,
  pending: loading,
  error,
  pillars,
  questions,
  currentPillar,
  currentPillarIndex,
  nextPillar: goNextPillar,
  prevPillar: goPrevPillar,
  goToPillarBySlug,
  getQuestionsForPillar,
  handleAnswer,
  handleItemNAConfirm,
  handleItemNAClear,
  overallProgress,
  answeredCount: answeredQuestions,
  totalQuestionCount: totalQuestions,
  saveAnswer,
  createMilestone,
} = useAssessment(reviewIdRef);
const { workspace: maturityWorkspace } = useReviewWorkspace(reviewIdRef);
const liveMaturityEntry = computed(() => {
  const workspace = maturityWorkspace.value;
  const revisionId = activeTemplateRevisionId.value;
  if (!workspace || !revisionId) return null;
  return (
    deriveWorkspaceMaturity({
      reviewId: props.reviewId,
      templateRevisions: workspace.templateRevisions,
      pillars: workspace.pillars,
      answers: questions.value.map((question) => ({
        questionId: question.id,
        answer: question.answer ?? null,
      })),
    }).find((entry) => entry.templateRevisionId === revisionId) ?? null
  );
});

// Snapshot of answers as loaded from SQLite at the start of this session.
// Used as the "before" side of the milestone diff.
const initialAnswers = ref<Record<string, QuestionAnswer | null>>({});
let initialSnapshotTaken = false;

watch(
  questions,
  (qs) => {
    if (!initialSnapshotTaken && qs.length > 0) {
      initialSnapshotTaken = true;
      const snapshot: Record<string, QuestionAnswer | null> = {};
      for (const q of qs) snapshot[q.id] = q.answer ?? null;
      initialAnswers.value = snapshot;
    }
  },
  { immediate: true }
);

// Per-question change tracking for the milestone modal before/after diff.
const sessionChanges = ref<Record<string, SessionChange>>({});

// Per-question debounce queue: each question has its own 300ms timer.
interface PendingDraft {
  timer: ReturnType<typeof setTimeout>;
  value: QuestionAnswer | null;
  naReason?: NotApplicableReason;
}
const pendingDrafts = new Map<string, PendingDraft>();
const DRAFT_DEBOUNCE_MS = 300;

const scheduleAnswerDraft = (
  questionId: string,
  value: QuestionAnswer | null,
  naReason?: NotApplicableReason
) => {
  const existing = pendingDrafts.get(questionId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingDrafts.delete(questionId);
    void saveAnswer(questionId, value ?? null, { naReason });
  }, DRAFT_DEBOUNCE_MS);

  pendingDrafts.set(questionId, { timer, value, naReason });
};

/** Flush all pending debounce timers immediately (called before pillar navigation). */
const flushPendingDrafts = () => {
  for (const [questionId, pending] of pendingDrafts) {
    clearTimeout(pending.timer);
    pendingDrafts.delete(questionId);
    void saveAnswer(questionId, pending.value ?? null, {
      naReason: pending.naReason,
    });
  }
};

// "Saved on this device" must survive an immediate tab close: without this,
// an answer ticked within the 300ms debounce window is silently lost on
// reload/navigation away. pagehide covers refresh, close, and bfcache.
onMounted(() => {
  window.addEventListener("pagehide", flushPendingDrafts);
});
onBeforeUnmount(() => {
  window.removeEventListener("pagehide", flushPendingDrafts);
  flushPendingDrafts();
});

const toast = useToast();

watchEffect(() => {
  if (review.value) {
    setPageHeader({
      title: review.value.name,
      showSurveyMode: true,
    });
  }
});

watch(
  currentPillar,
  (pillar) => {
    if (pillar && pillar.slug !== activePillarSlug.value) {
      setActivePillar(pillar.slug);
    }
  },
  { immediate: true }
);

watch(activePillarSlug, (slug) => {
  if (slug && currentPillar.value?.slug !== slug) {
    flushPendingDrafts();
    goToPillarBySlug(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

const pillarTabItems = computed(() => {
  return pillars.value.map((pillar) => ({
    label: pillar.name,
    value: pillar.slug,
  }));
});

const progressBarStyle = computed(() => ({
  width: `${overallProgress.value}%`,
}));

// Pre-group questions by pillar slug so localPillarStats avoids an O(pillars × questions) scan
const questionsByPillar = computed(() => {
  const map = new Map<string, Question[]>();
  for (const q of questions.value) {
    if (q.templateRevisionId !== activeTemplateRevisionId.value) continue;
    const group = map.get(q.pillar);
    if (group) group.push(q);
    else map.set(q.pillar, [q]);
  }
  return map;
});

// Pillar stats derived from local question state so progress updates immediately on answer
const localPillarStats = computed(() =>
  pillars.value.map((p) => {
    const qs = questionsByPillar.value.get(p.slug) ?? [];
    const answered = qs.filter((q) => isQuestionComplete(q, q.answer)).length;
    const total = qs.length || p.totalQuestions || 0;
    return {
      ...p,
      progress: total > 0 ? Math.round((answered / total) * 100) : 0,
      answeredQuestions: answered,
      totalQuestions: total,
    };
  })
);

const pillarStatBySlug = computed(
  () => new Map(localPillarStats.value.map((p) => [p.slug, p]))
);

const getPillarBySlug = (slug: string) => pillarStatBySlug.value.get(slug);

const route = useRoute();
const router = useRouter();
const { highlightedQuestionId, selectTemplateRevision } =
  useAssessmentRouteTarget({
    route,
    reviewId: computed(() => props.reviewId),
    review,
    questions,
    pillarProgress: localPillarStats,
    currentPillar,
    activeTemplateRevisionId,
    setActiveTemplateRevision,
    setActivePillar,
    goToPillarBySlug,
    replaceRoute: (replacement) => router.replace(replacement),
  });

const handleTemplateSelect = (revisionId: string) => {
  if (revisionId === activeTemplateRevisionId.value) return;
  flushPendingDrafts();
  void selectTemplateRevision(revisionId);
};

const handlePillarTabChange = (value: string | number) => {
  flushPendingDrafts();
  const slug = String(value);
  goToPillarBySlug(slug);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const showQuestionInfo = (question: Question) => {
  const questionType = question.type || "yes-no";
  const practices =
    questionType === "checklist"
      ? (question.checklistItems ?? []).map((item) => item.text)
      : (question.leadingPractices ?? []);

  openMoreInfoPanel({
    title: question.text,
    whyImportant: question.importance ?? "No additional information available.",
    leadingPractices: practices,
    helpfulLinks: question.helpfulLinks ?? [],
  });
};

// Single write path for all answer types (Yes/No/N/A).
// Updates reactive state, tracks the session diff, and schedules draft().
// naReason is forwarded when the answer is "na" (from the NA modal).
const handleAnswerWithTracking = (
  questionId: string,
  value: QuestionAnswer | null,
  naReason?: NotApplicableReason
) => {
  handleAnswer(questionId, value, naReason);

  const question = questions.value.find((q) => q.id === questionId);
  if (question) {
    const before = initialAnswers.value[questionId] ?? null;
    const pillarName =
      pillars.value.find((p) => p.slug === question.pillar)?.name ??
      question.pillar;
    sessionChanges.value = {
      ...sessionChanges.value,
      [questionId]: {
        questionId,
        questionText: question.text,
        pillarName,
        before,
        after: value,
      },
    };
  }

  scheduleAnswerDraft(questionId, value, naReason);
};

// Checklist item NA confirm/clear update answer state directly via their own
// orchestrator methods (checklist structure is more complex than a scalar answer).
// After they update the state, read the new answer and schedule a draft.
const handleItemNAConfirmWithTracking = (
  questionId: string,
  itemId: string,
  reason: NotApplicableReason
) => {
  handleItemNAConfirm(questionId, itemId, reason);
  const updated = questions.value.find(
    (question) => question.id === questionId
  );
  if (updated) scheduleAnswerDraft(questionId, updated.answer ?? null);
};

const handleItemNAClearWithTracking = (questionId: string, itemId: string) => {
  handleItemNAClear(questionId, itemId);
  const updated = questions.value.find(
    (question) => question.id === questionId
  );
  if (updated) scheduleAnswerDraft(questionId, updated.answer ?? null);
};

const {
  handleAnswerChange,
  handleNAClick,
  handleItemNAClick,
  onNAConfirm,
  onNAClear,
} = useNAHandlers({
  handleAnswer: handleAnswerWithTracking,
  handleItemNAConfirm: handleItemNAConfirmWithTracking,
  handleItemNAClear: handleItemNAClearWithTracking,
});

const { open: openSaveModal } = useSaveModal();
const isSaving = ref(false);

const saveProgress = async () => {
  if (isSaving.value) return;

  // Flush any debounced writes before opening the modal
  flushPendingDrafts();

  const netChanges = Object.values(sessionChanges.value).filter(
    (c) => JSON.stringify(c.before) !== JSON.stringify(c.after)
  );

  if (netChanges.length === 0) {
    toast.add({
      title: "Nothing new to save",
      description: "No changes since your last milestone.",
      color: "neutral",
    });
    return;
  }

  const snapshot = {
    overallProgress: overallProgress.value,
    pillars: localPillarStats.value.map((p) => ({
      slug: p.slug,
      name: p.name,
      progress: p.progress,
      totalQuestions: p.totalQuestions,
      answeredQuestions: p.answeredQuestions,
    })),
  };

  const templateId = review.value?.templates[0]?.templateId ?? "";

  const comment = await openSaveModal({
    reviewId: props.reviewId,
    templateId,
    sessionChanges: netChanges,
    snapshot,
  });

  if (comment === null) return; // cancelled

  isSaving.value = true;

  const milestoneSaved = await createMilestone({
    templateId,
    comment,
    snapshot,
    delta: {
      questionsAnswered: netChanges.filter((c) => c.after !== null).length,
      questionsChanged: netChanges.length,
      progressDelta: overallProgress.value,
    },
  });

  isSaving.value = false;

  if (!milestoneSaved) {
    toast.add({
      title: "Save failed",
      description: "Milestone history could not be recorded. Please try again.",
      color: "error",
    });
  } else {
    // Reset session tracking — next session starts from current state
    const newSnapshot: Record<string, QuestionAnswer | null> = {};
    for (const q of questions.value) newSnapshot[q.id] = q.answer ?? null;
    initialAnswers.value = newSnapshot;
    sessionChanges.value = {};

    toast.add({
      title: "Milestone saved!",
      description: `${answeredQuestions.value} of ${totalQuestions.value} questions answered.`,
      color: "success",
      actions: [
        {
          label: "View review",
          onClick: () => {
            navigateTo(reviewDetailsPath.value);
          },
        },
      ],
    });
  }
};

// Register Save CTA in header — reactive to isSaving for loading state
watchEffect(() => {
  setCTA({
    label: "Save milestone",
    icon: "i-lucide-save",
    onClick: () => saveProgress(),
    loading: isSaving.value,
  });
});
onUnmounted(() => setCTA(null));

const handleGoNextPillar = () => {
  flushPendingDrafts();
  goNextPillar();
};

const handleGoPrevPillar = () => {
  flushPendingDrafts();
  goPrevPillar();
};

const pillarCommands = computed<Command[]>(() => {
  return pillars.value.map((pillar) => ({
    id: `pillar-${pillar.slug}`,
    title: `Go to ${pillar.name}`,
    group: "Page",
    icon: "lucide:hash",
    keywords: ["section", "pillar", pillar.name.toLowerCase()],
    run: () => {
      flushPendingDrafts();
      goToPillarBySlug(pillar.slug);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  }));
});

const surveyPath = computed(() => {
  const path = route.path;
  return path.replace(/\/assessment$/, "/survey");
});
const reviewDetailsPath = computed(() =>
  route.path.replace(/\/assessment$/, "")
);

const assessmentCommands = computed<Command[]>(() => {
  return [
    {
      id: "assessment-save",
      title: "Save milestone",
      group: "Actions",
      icon: "lucide:save",
      keywords: ["save", "submit"],
      run: async () => {
        await saveProgress();
      },
    },
    {
      id: "assessment-survey-mode",
      title: "Enter survey mode",
      group: "Actions",
      icon: "lucide:list-ordered",
      keywords: ["survey", "mode", "enter", "focus"],
      run: async () => {
        await navigateTo(surveyPath.value);
      },
    },
    {
      id: "assessment-toggle-sidebar",
      title: templateSelectorCollapsed.value
        ? "Show template selector"
        : "Hide template selector",
      group: "Actions",
      icon: templateSelectorCollapsed.value
        ? "lucide:panel-left-open"
        : "lucide:panel-left-close",
      keywords: ["sidebar", "template", "selector", "toggle", "panel"],
      run: () => {
        templateSelectorCollapsed.value = !templateSelectorCollapsed.value;
      },
    },
  ];
});

onMounted(() => {
  let unregisterPillars = registerCommands(pillarCommands.value, "lifecycle");
  let unregisterActions = registerCommands(
    assessmentCommands.value,
    "lifecycle"
  );

  watch([pillars, templateSelectorCollapsed], () => {
    unregisterPillars();
    unregisterActions();
    unregisterPillars = registerCommands(pillarCommands.value, "lifecycle");
    unregisterActions = registerCommands(assessmentCommands.value, "lifecycle");
  });

  onUnmounted(() => {
    unregisterPillars();
    unregisterActions();
  });
});
</script>
