<template>
  <div class="flex flex-1 flex-col">
    <!-- Main Content -->
    <!-- Kiosk canvas: this route mounts on the kiosk layout (no sidebar, no
         header), so the page owns its own horizontal gutters directly. -->
    <main class="mx-auto w-full max-w-5xl px-8 py-6 xl:max-w-none xl:px-24">
      <!-- Top Bar + Route Progress -->
      <!-- Sticky at top-0: nothing above it on the kiosk layout, so the
           header's natural and stuck positions coincide — mb-16 below is
           just breathing room before the question, not an offset fudge. -->
      <header
        class="bg-default/90 sticky top-0 z-10 mb-12 pb-4 backdrop-blur-sm xl:mb-16 xl:pb-2"
        aria-label="Survey Progress"
      >
        <div
          class="border-default flex items-center justify-between gap-6 border-b py-3"
        >
          <div class="flex min-w-0 items-baseline gap-2.5">
            <span class="text-highlighted truncate text-base font-semibold">
              {{ review?.name ?? "Survey" }}
            </span>
            <template v-if="currentPillarName">
              <span class="text-dimmed" aria-hidden="true">·</span>
              <span class="text-muted truncate text-[15px]">
                {{ currentPillarName }}
              </span>
            </template>
          </div>
          <div class="flex shrink-0 items-baseline gap-6">
            <p
              v-if="totalQuestions > 0"
              class="tabular-nums"
              aria-hidden="true"
            >
              <span class="text-highlighted text-2xl font-extrabold">{{
                currentQuestionIndex + 1
              }}</span>
              <span class="text-muted text-[15px] font-semibold">
                / {{ totalQuestions }}</span
              >
            </p>
            <NuxtLink
              :to="assessmentPath"
              class="text-muted hover:text-highlighted text-[15px] font-semibold transition-colors"
              @click="flushPendingDrafts"
            >
              Exit survey
            </NuxtLink>
          </div>
        </div>

        <!-- Flat route track: done line, waypoint at the current question, destination ring -->
        <div
          class="relative mt-4 h-3"
          role="progressbar"
          aria-valuemin="1"
          :aria-valuemax="Math.max(totalQuestions, 1)"
          :aria-valuenow="currentQuestionIndex + 1"
          :aria-valuetext="`Question ${currentQuestionIndex + 1} of ${totalQuestions}`"
          aria-label="Survey completion progress"
        >
          <span
            class="bg-accented absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full dark:bg-slate-700/50"
            aria-hidden="true"
          />
          <span
            class="bg-primary-600 dark:bg-primary-400 absolute top-1/2 left-0 h-[2.5px] -translate-y-1/2 rounded-full transition-all duration-300"
            :style="{ width: `${routeProgress}%` }"
            aria-hidden="true"
          />
          <span
            class="border-success/40 dark:border-success/50 absolute top-1/2 -right-[5.5px] h-[11px] w-[11px] -translate-y-1/2 rounded-full border-2"
            aria-hidden="true"
          />
          <span
            class="border-primary-600 dark:border-primary-400 bg-default absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] transition-all duration-300"
            :style="{ left: `${routeProgress}%` }"
            aria-hidden="true"
          />
        </div>
      </header>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center p-16">
        <span class="text-dimmed text-sm">Loading survey...</span>
      </div>

      <!-- Survey Question Content -->
      <!-- Fixed width (~880px) below xl to prevent layout shift when question
           length varies. At xl+ this becomes the kiosk grid: question column
           plus a fixed 400px info rail (or a wide centered column when the
           question has no teaching content to show in a rail). -->
      <div
        v-else-if="currentQuestion"
        class="mx-auto w-full max-w-[880px]"
        :class="
          hasQuestionInfo
            ? 'xl:mx-0 xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start xl:gap-16'
            : 'xl:max-w-[1100px]'
        "
      >
        <article class="flex w-full flex-col gap-8">
          <!-- Question -->
          <div class="question">
            <span
              v-if="currentQuestionReference"
              class="bg-primary/10 text-primary inline-block max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[13px] font-semibold dark:bg-slate-700"
            >
              {{ currentQuestionReference }}
            </span>
            <h2
              class="text-highlighted mt-4 text-[34px] leading-[1.3] font-bold xl:text-[44px] xl:leading-[1.25] 2xl:text-[48px]"
            >
              <InlineMarkdown :text="currentQuestion.text" />
            </h2>
            <button
              type="button"
              class="text-primary mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold hover:underline xl:hidden"
              @click="showQuestionInfo"
            >
              <Icon name="lucide:info" class="h-4 w-4" aria-hidden="true" />
              Why this matters
            </button>
          </div>

          <!-- Answer Options: Checklist -->
          <SurveyChecklistQuestion
            v-if="currentQuestion.type === 'checklist'"
            :checklist-items="currentQuestion.checklistItems ?? []"
            :checked-items="checkedItems"
            :na-items="naItems"
            :is-n-a="currentChecklistAnswer === 'na'"
            :has-answer="currentChecklistAnswer !== null"
            @update:checked-items="handleChecklistUpdate"
            @clear-answer="clearCurrentAnswer"
            @na-click="handleNAClick"
            @item-na-click="handleItemNAClick"
          />

          <!-- Answer Options: Yes/No -->
          <fieldset v-else>
            <legend class="sr-only">
              Answer options for {{ currentQuestion.text }}
            </legend>
            <!-- Main Answer Buttons -->
            <div
              class="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:gap-6"
              role="group"
              aria-label="Primary answer options"
            >
              <button
                v-for="option in answerOptions"
                :key="option.value"
                type="button"
                :class="[
                  'flex h-16 items-center justify-center rounded-lg border-2 text-[19px] font-semibold transition-all xl:h-20 xl:text-[22px]',
                  currentQuestion.answer === option.value
                    ? 'border-inverted bg-inverted text-inverted'
                    : 'border-accented bg-default text-default hover:bg-muted dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700/50',
                ]"
                :aria-pressed="currentQuestion.answer === option.value"
                @click="
                  option.value === 'na'
                    ? handleNAClick()
                    : handleAnswer(option.value)
                "
              >
                {{ option.label }}
              </button>
            </div>
          </fieldset>

          <!-- Kindness caption -->
          <p
            v-if="currentQuestion.type !== 'checklist'"
            class="text-muted text-[15px] xl:text-base"
          >
            A “No” isn’t a failure — it’s a signal. Honest answers beat green
            dashboards.
          </p>

          <!-- Navigation Footer -->
          <nav
            class="border-default mt-8 flex items-center justify-between gap-4 border-t pt-6"
            aria-label="Survey navigation"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="xl"
              icon="i-lucide-arrow-left"
              class="text-muted font-semibold xl:h-14 xl:px-6 xl:text-[18px]"
              :disabled="currentQuestionIndex === 0"
              @click="previousQuestion"
            >
              Previous
            </UButton>

            <p
              class="text-muted flex items-center gap-1.5 text-[15px] xl:text-base"
            >
              <Icon
                v-if="answeredCount > 0"
                name="lucide:check"
                class="text-success h-4 w-4"
                aria-hidden="true"
              />
              Saved on this device · {{ answeredCount }} of
              {{ totalQuestions }} answered
            </p>

            <UButton
              v-if="currentQuestionIndex < totalQuestions - 1"
              color="primary"
              size="xl"
              trailing-icon="i-lucide-arrow-right"
              class="font-bold xl:h-14 xl:px-6 xl:text-[18px]"
              @click="nextQuestion"
            >
              Next
            </UButton>

            <UButton
              v-else
              color="primary"
              size="xl"
              trailing-icon="i-lucide-check"
              class="font-bold xl:h-14 xl:px-6 xl:text-[18px]"
              @click="completeSurvey"
            >
              Complete
            </UButton>
          </nav>
        </article>

        <!-- Info Rail: teaching content floats beside the question at xl+
             instead of hiding behind the "Why this matters" click trigger.
             Only rendered when the question actually has content to show. -->
        <SurveyInfoRail
          v-if="hasQuestionInfo"
          class="hidden xl:block"
          :question-id="currentQuestion.id"
          :importance="currentQuestion.importance"
          :leading-practices="currentQuestion.leadingPractices"
          :helpful-links="currentQuestion.helpfulLinks"
        />
      </div>
    </main>
    <NAReasonModal @confirm="onNAConfirm" @clear="onNAClear" />
  </div>
</template>

<script setup lang="ts">
import type { QuestionAnswer, NotApplicableReason } from "~/models/question";
import { isChecklistWithNAAnswer } from "~/models/question";
import type { Command } from "~/composables/nav/useCommandPalette";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import { useAssessment } from "~/composables/assessment/useAssessment";
import { useNAHandlers } from "~/composables/assessment/useNAHandlers";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";
import { onKeyStroke } from "@vueuse/core";
import { useNAModal } from "~/ui/useNAModal";
import { formatQuestionReference } from "~/utils/questionReference";

const props = defineProps<{ assessmentPath: string }>();

const route = useRoute();
const reviewId = computed(() => String(route.params.reviewId));

const { setPageHeader } = usePageHeader();
const { openMoreInfoPanel } = useMoreInfoPanel();
const { registerCommands } = useCommandPalette();

const {
  review,
  questions: allQuestions,
  pending: loading,
  handleAnswer: orchestratorHandleAnswer,
  handleItemNAConfirm,
  handleItemNAClear,
  getAnswer,
  saveAnswer,
} = useAssessment(reviewId);

const currentQuestionIndex = ref(0);

// Resume a half-done kiosk survey at the first unanswered question once the
// review has hydrated from local SQLite (see AssessmentOrchestrator.loadFull).
// Cheap: a single pass over already-loaded questions, done once.
let initialIndexSet = false;
watch(
  allQuestions,
  (qs) => {
    if (!initialIndexSet && qs.length > 0) {
      initialIndexSet = true;
      const firstUnanswered = qs.findIndex((q) => q.answer == null);
      currentQuestionIndex.value = firstUnanswered === -1 ? 0 : firstUnanswered;
    }
  },
  { immediate: true }
);

// Per-question debounce queue, mirroring AssessmentPage.vue's draft mechanism
// exactly: same saveAnswer() → answerMutations.save() → local SQLite write.
// This is the survey's only persistence path — kiosk answers must survive a
// reload or crash, so every answer type (yes/no, checklist toggle, N/A with
// reason) is routed through here rather than only updating in-memory state.
interface PendingDraft {
  timer: ReturnType<typeof setTimeout>;
  value: QuestionAnswer | null;
  naReason?: NotApplicableReason;
  templateRevisionId: string;
}
const pendingDrafts = new Map<string, PendingDraft>();
const DRAFT_DEBOUNCE_MS = 300;

const scheduleAnswerDraft = (
  questionId: string,
  value: QuestionAnswer | null,
  naReason?: NotApplicableReason
) => {
  const question = allQuestions.value.find((item) => item.id === questionId);
  const templateRevisionId = question?.templateRevisionId;
  if (!templateRevisionId) return;
  const existing = pendingDrafts.get(questionId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingDrafts.delete(questionId);
    void saveAnswer(questionId, value ?? null, {
      naReason,
      templateRevisionId,
    });
  }, DRAFT_DEBOUNCE_MS);

  pendingDrafts.set(questionId, {
    timer,
    value,
    naReason,
    templateRevisionId,
  });
};

/** Flush all pending debounce timers immediately (called before question navigation/exit). */
const flushPendingDrafts = () => {
  for (const [questionId, pending] of pendingDrafts) {
    clearTimeout(pending.timer);
    pendingDrafts.delete(questionId);
    void saveAnswer(questionId, pending.value ?? null, {
      naReason: pending.naReason,
      templateRevisionId: pending.templateRevisionId,
    });
  }
};

onUnmounted(() => flushPendingDrafts());

// Single write path for all answer types (Yes/No/N/A) — same shape as
// AssessmentPage.vue's handleAnswerWithTracking, minus the milestone diff
// tracking (the kiosk survey has no "Save milestone" step of its own).
const handleAnswerWithTracking = (
  questionId: string,
  value: QuestionAnswer | null,
  naReason?: NotApplicableReason
) => {
  orchestratorHandleAnswer(questionId, value, naReason);
  scheduleAnswerDraft(questionId, value, naReason);
};

// Checklist item NA confirm/clear update answer state via their own
// orchestrator methods, then read the new answer back and schedule a draft —
// identical pattern to AssessmentPage.vue.
const handleItemNAConfirmWithTracking = (
  questionId: string,
  itemId: string,
  reason: NotApplicableReason
) => {
  handleItemNAConfirm(questionId, itemId, reason);
  const updated = allQuestions.value.find((q) => q.id === questionId);
  if (updated) scheduleAnswerDraft(questionId, updated.answer ?? null);
};

const handleItemNAClearWithTracking = (questionId: string, itemId: string) => {
  handleItemNAClear(questionId, itemId);
  const updated = allQuestions.value.find((q) => q.id === questionId);
  if (updated) scheduleAnswerDraft(questionId, updated.answer ?? null);
};

// Same N/A modal orchestration AssessmentPage.vue uses, wired to the
// persisting handlers above instead of the raw in-memory ones.
const {
  handleNAClick: naHandleNAClick,
  handleItemNAClick: naHandleItemNAClick,
  onNAConfirm,
  onNAClear,
} = useNAHandlers({
  handleAnswer: handleAnswerWithTracking,
  handleItemNAConfirm: handleItemNAConfirmWithTracking,
  handleItemNAClear: handleItemNAClearWithTracking,
});

watchEffect(() => {
  if (review.value) {
    setPageHeader({
      title: review.value.name,
      showSurveyMode: true,
    });
  }
});

const totalQuestions = computed(() => allQuestions.value.length);

const currentQuestion = computed(
  () => allQuestions.value[currentQuestionIndex.value] ?? null
);

const currentPillarName = computed(() => {
  const question = currentQuestion.value;
  if (!question) return "";
  const template = review.value?.templates.find(
    (item) => item.templateRevisionId === question.templateRevisionId
  );
  return (
    template?.pillars.find((pillar) => pillar.slug === question.pillar)?.name ??
    ""
  );
});

// The badge shows the derived slug (REL-1), never the question's storage id —
// that is an opaque composite key, useless to a reader and far too long for a
// mono chip. Position is 1-based within the question's own pillar, matching
// AssessmentPage.vue. Null (no pillar, no position) means: render no badge.
const currentQuestionReference = computed(() => {
  const question = currentQuestion.value;
  if (!question) return null;
  const position =
    allQuestions.value
      .filter(
        (q) =>
          q.pillar === question.pillar &&
          q.templateRevisionId === question.templateRevisionId
      )
      .findIndex((q) => q.id === question.id) + 1;
  return formatQuestionReference(question.pillar, position);
});

const answeredCount = computed(
  () => allQuestions.value.filter((q) => q.answer != null).length
);

// Whether the current question has any teaching content to show. Drives the
// kiosk info rail at xl+ (SurveyInfoRail) and the grid layout around it —
// no fallback text here, unlike showQuestionInfo() below, so a question with
// nothing to teach cleanly hides the rail instead of showing an empty well.
const hasQuestionInfo = computed(() => {
  if (!currentQuestion.value) return false;
  const hasImportance = Boolean(currentQuestion.value.importance?.trim());
  const hasLeadingPractices =
    (currentQuestion.value.leadingPractices?.length ?? 0) > 0;
  const hasHelpfulLinks = (currentQuestion.value.helpfulLinks?.length ?? 0) > 0;
  return hasImportance || hasLeadingPractices || hasHelpfulLinks;
});

// Position along the route: current question mapped onto the full track,
// so the waypoint circle reaches the destination ring on the last question.
const routeProgress = computed(() => {
  if (totalQuestions.value <= 1) return 0;
  return (currentQuestionIndex.value / (totalQuestions.value - 1)) * 100;
});

const showQuestionInfo = () => {
  if (!currentQuestion.value) return;
  openMoreInfoPanel({
    title: currentQuestion.value.text,
    whyImportant:
      currentQuestion.value.importance ??
      "No additional information available.",
    leadingPractices: currentQuestion.value.leadingPractices ?? [],
    helpfulLinks: currentQuestion.value.helpfulLinks ?? [],
  });
};

const answerOptions = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
  { value: "na" as const, label: "Not applicable" },
];

const handleAnswer = (value: QuestionAnswer) => {
  if (!currentQuestion.value) return;
  const current = getAnswer(currentQuestion.value.id) ?? null;
  if (current === value) {
    handleAnswerWithTracking(currentQuestion.value.id, null);
  } else {
    handleAnswerWithTracking(currentQuestion.value.id, value);
  }
};

const handleNAClick = () => {
  if (!currentQuestion.value) return;
  naHandleNAClick(currentQuestion.value);
};

const handleItemNAClick = (itemId: string) => {
  if (!currentQuestion.value) return;
  naHandleItemNAClick(currentQuestion.value, itemId);
};

const currentChecklistAnswer = computed(() => {
  const question = currentQuestion.value;
  if (!question || question.type !== "checklist") return null;
  return normalizeQuestionAnswer(question, question.answer ?? null);
});

const checkedItems = computed(() =>
  isChecklistWithNAAnswer(currentChecklistAnswer.value)
    ? currentChecklistAnswer.value.checked
    : []
);

const naItems = computed(() =>
  isChecklistWithNAAnswer(currentChecklistAnswer.value)
    ? currentChecklistAnswer.value.na
    : []
);

const handleChecklistUpdate = (items: string[]) => {
  if (!currentQuestion.value) return;
  handleAnswerWithTracking(currentQuestion.value.id, {
    checked: items,
    na: naItems.value,
  });
};

const clearCurrentAnswer = () => {
  if (!currentQuestion.value) return;
  handleAnswerWithTracking(currentQuestion.value.id, null);
};

// Flush pending drafts before leaving the current question, same as
// AssessmentPage.vue flushing before pillar navigation — a kiosk reload or
// crash right after Previous/Next must never lose the answer just given.
const previousQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    flushPendingDrafts();
    currentQuestionIndex.value--;
  }
};

const nextQuestion = () => {
  if (currentQuestionIndex.value < totalQuestions.value - 1) {
    flushPendingDrafts();
    currentQuestionIndex.value++;
  }
};

const exitSurvey = () => {
  flushPendingDrafts();
  navigateTo(props.assessmentPath);
};

const completeSurvey = () => {
  flushPendingDrafts();
  navigateTo(props.assessmentPath);
};

const surveyCommands = computed<Command[]>(() => {
  return [
    {
      id: "survey-exit-mode",
      title: "Exit survey mode",
      group: "Actions",
      icon: "lucide:layout-dashboard",
      keywords: ["survey", "mode", "exit", "normal", "assessment"],
      run: () => {
        navigateTo(props.assessmentPath);
      },
    },
  ];
});

onMounted(() => {
  const unregister = registerCommands(surveyCommands.value, "lifecycle");
  onUnmounted(() => {
    unregister();
  });
});

const { isOpen: naModalOpen } = useNAModal();
const { isOpen: moreInfoOpen } = useMoreInfoPanel();

// Exit survey mode with Escape unless a modal or info panel is open.
onKeyStroke("Escape", () => {
  if (naModalOpen.value || moreInfoOpen.value) return;
  exitSurvey();
});
</script>
