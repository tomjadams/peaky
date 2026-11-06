<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { useRoute, useRouter } from "#imports";
import type { ReviewWorkspace } from "~/models/workspace";
import type { RiskLevel } from "~/models/template";
import type { WorkspaceMaturityEntry } from "~/services/maturity/workspace";
import { decodeMaturityDefinition } from "~/services/maturity/persistence";
import {
  buildFollowUpBuckets,
  indexStagePathQuestions,
} from "~/services/maturity/stagePath";
import {
  buildFollowUpQueue,
  type FollowUpQueuePractice,
  type FollowUpQueueQuestion,
} from "~/services/review/followUpQueue";
import type { SelectablePractice } from "~/services/handoff/projection";
import {
  describeHandoffViolation,
  type HandoffLimitViolation,
} from "~/services/handoff/limits";
import { practiceEntityId } from "~/services/handoff/practice";
import { SEVERITY_DISPLAY } from "~/constants/planDisplay";
import { severityAccentClass } from "~/composables/review/usePlanItemSections";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";

type ResultEntry = Extract<WorkspaceMaturityEntry, { kind: "result" }>;
type MobileView = "attention" | "handoff";

interface Props {
  workspace: ReviewWorkspace;
  entry: ResultEntry;
  assessmentRouteName: string;
  assessmentParams: Record<string, string>;
  selectablePractices: ReadonlyMap<string, SelectablePractice>;
  selectedIds: ReadonlySet<string>;
  previouslyHandedOffIds?: ReadonlySet<string>;
  practiceOpportunities?: ReadonlyMap<string, number>;
  selectionLimitReached: boolean;
  selectionError: string;
  selectionErrorEntityId: string | null;
  selectionViolations: readonly HandoffLimitViolation[];
  selectionWriteAvailable: boolean;
  selectionUnavailableReason: string;
}

const props = withDefaults(defineProps<Props>(), {
  previouslyHandedOffIds: () => new Set<string>(),
  practiceOpportunities: () => new Map<string, number>(),
});
const emit = defineEmits<{
  retry: [];
  toggle: [practice: SelectablePractice, selected: boolean];
}>();

const { openMoreInfoPanel } = useMoreInfoPanel();
const route = useRoute();
const router = useRouter();
const mobileView = ref<MobileView>(
  route.query.followUpView === "handoff" ? "handoff" : "attention"
);
const expandedQuestionIds = ref<ReadonlySet<string>>(new Set());
const refineOpen = ref(false);
const handoffStatusFilter = ref<"available" | "handed-off">(
  route.query.followUpHandoffStatus === "handed-off"
    ? "handed-off"
    : "available"
);
const severityFilter = ref<"all" | RiskLevel>(
  route.query.followUpSeverity === "critical" ||
    route.query.followUpSeverity === "high" ||
    route.query.followUpSeverity === "medium"
    ? route.query.followUpSeverity
    : "all"
);
const pillarFilter = ref(
  typeof route.query.followUpPillar === "string"
    ? route.query.followUpPillar
    : "all"
);

const revision = computed(() =>
  props.workspace.templateRevisions.find(
    (candidate) => candidate.id === props.entry.templateRevisionId
  )
);
const definition = computed(() =>
  decodeMaturityDefinition(revision.value?.maturityDefinition)
);
const revisionPillars = computed(() =>
  props.workspace.pillars.filter(
    (pillar) => pillar.templateRevisionId === props.entry.templateRevisionId
  )
);
const questions = computed(() =>
  indexStagePathQuestions(revisionPillars.value)
);
const questionDetails = computed(
  () =>
    new Map(
      revisionPillars.value.flatMap((pillar) =>
        pillar.questions.map((question) => [question.id, question] as const)
      )
    )
);
const buckets = computed(() =>
  definition.value
    ? buildFollowUpBuckets({
        resultStage: props.entry.effectiveResult.stage.stage,
        definition: definition.value,
        trace: props.entry.trace,
        questions: questions.value,
      })
    : null
);
const queue = computed(() =>
  buckets.value ? buildFollowUpQueue(buckets.value, questions.value) : null
);
const handoffStatusOptions = [
  { label: "Available to add", value: "available" as const },
  { label: "Handed off previously", value: "handed-off" as const },
];
const pillarOptions = computed(() => [
  { label: "All pillars", value: "all" },
  ...revisionPillars.value.map((pillar) => ({
    label: pillar.name,
    value: pillar.id,
  })),
]);
const severityOptions = computed<{ label: string; value: "all" | RiskLevel }[]>(
  () => [
    { label: "All severities", value: "all" },
    ...(queue.value?.sections ?? []).map((section) => ({
      label: SEVERITY_DISPLAY[section.severity].label,
      value: section.severity,
    })),
  ]
);
watch(severityOptions, (options) => {
  if (!options.some((option) => option.value === severityFilter.value)) {
    severityFilter.value = "all";
  }
});
const visibleSections = computed(() =>
  (queue.value?.sections ?? [])
    .filter(
      (section) =>
        severityFilter.value === "all" ||
        section.severity === severityFilter.value
    )
    .map((section) => {
      const sectionQuestions = section.questions
        .filter(
          (question) =>
            pillarFilter.value === "all" ||
            question.pillarId === pillarFilter.value
        )
        .map((question) =>
          Object.assign({}, question, {
            practices: question.practices.filter(matchesHandoffStatus),
          })
        )
        .filter((question) => question.practices.length > 0);
      return {
        severity: section.severity,
        questions: sectionQuestions,
        practiceCount: sectionQuestions.reduce(
          (count, question) => count + question.practices.length,
          0
        ),
      };
    })
    .filter((section) => section.questions.length > 0)
);
const visibleUnanswered = computed(() =>
  handoffStatusFilter.value === "handed-off"
    ? []
    : (queue.value?.unanswered ?? []).filter(
        (question) =>
          (pillarFilter.value === "all" ||
            question.pillarId === pillarFilter.value) &&
          (severityFilter.value === "all" ||
            question.severity === severityFilter.value)
      )
);
const totalPracticeCount = computed(() =>
  (queue.value?.sections ?? []).reduce(
    (sectionCount, section) =>
      sectionCount +
      section.questions.reduce(
        (questionCount, question) =>
          questionCount +
          question.practices.filter(matchesHandoffStatus).length,
        0
      ),
    0
  )
);
const visiblePracticeCount = computed(() =>
  visibleSections.value.reduce(
    (count, section) => count + section.practiceCount,
    0
  )
);
const activeFilterCount = computed(
  () =>
    Number(handoffStatusFilter.value !== "available") +
    Number(pillarFilter.value !== "all") +
    Number(severityFilter.value !== "all")
);
const hasActiveFilters = computed(() => activeFilterCount.value > 0);
const isEarlyCoverage = computed(() => {
  const { answered, total } = props.entry.coverage;
  return total > 0 && (answered < 3 || answered / total < 0.25);
});
const entityIdFor = (practice: {
  questionId: string;
  practiceId: string;
}): string =>
  practiceEntityId({
    reviewId: props.workspace.review.id,
    templateRevisionId: props.entry.templateRevisionId,
    questionId: practice.questionId,
    practiceId: practice.practiceId,
  });
const selectableFor = (practice: {
  questionId: string;
  practiceId: string;
}): SelectablePractice | undefined =>
  props.selectablePractices.get(entityIdFor(practice));
const wasHandedOff = (practice: FollowUpQueuePractice): boolean =>
  props.previouslyHandedOffIds.has(entityIdFor(practice.practice));
const matchesHandoffStatus = (practice: FollowUpQueuePractice): boolean =>
  handoffStatusFilter.value === "handed-off"
    ? wasHandedOff(practice)
    : selectableFor(practice.practice) !== undefined;
const isSelected = (practice: FollowUpQueuePractice): boolean => {
  const selectable = selectableFor(practice.practice);
  return selectable ? props.selectedIds.has(selectable.entityId) : false;
};
const selectionBlockedFor = (practice: SelectablePractice): boolean =>
  !props.selectionWriteAvailable ||
  (props.selectionLimitReached && !props.selectedIds.has(practice.entityId));
const rowHasSelectionError = (practice: SelectablePractice): boolean =>
  props.selectionErrorEntityId === practice.entityId &&
  (props.selectionError.length > 0 || props.selectionViolations.length > 0);
const selectionLabel = (practice: FollowUpQueuePractice): string =>
  `${isSelected(practice) ? "Remove" : "Add"} "${practice.practice.practiceText}" ${isSelected(practice) ? "from" : "to"} handoff${wasHandedOff(practice) ? ". Handed off previously; still needs evidence in Assessment." : ""}`;
const isQuestionLevelFollowUp = (question: FollowUpQueueQuestion): boolean =>
  question.practices.length === 1 &&
  question.practices[0]!.practice.practiceId === question.questionId;
const practiceListTitle = (question: FollowUpQueueQuestion): string => {
  if (isQuestionLevelFollowUp(question)) return "Answer needing follow-up";
  return `${question.practices.length === 1 ? "Practice" : "Practices"} needing follow-up`;
};
const practiceListInstruction = (question: FollowUpQueueQuestion): string =>
  isQuestionLevelFollowUp(question)
    ? "Select the answer to add it to the Handoff sequence."
    : "Select practices to add them to the Handoff sequence.";
const selectedPracticeCount = (question: FollowUpQueueQuestion): number =>
  question.practices.filter(isSelected).length;
const visiblePractices = (
  question: FollowUpQueueQuestion
): readonly FollowUpQueuePractice[] =>
  expandedQuestionIds.value.has(question.questionId)
    ? question.practices
    : question.practices.slice(0, 5);
const hiddenPracticeCount = (question: FollowUpQueueQuestion): number =>
  Math.max(0, question.practices.length - 5);
const toggleQuestionPractices = (questionId: string) => {
  const next = new Set(expandedQuestionIds.value);
  if (next.has(questionId)) next.delete(questionId);
  else next.add(questionId);
  expandedQuestionIds.value = next;
};
const handleToggle = (practice: FollowUpQueuePractice) => {
  const selectable = selectableFor(practice.practice);
  if (!selectable || selectionBlockedFor(selectable)) return;
  emit("toggle", selectable, !props.selectedIds.has(selectable.entityId));
};

const openQuestionContext = async (questionId: string) => {
  const question = questionDetails.value.get(questionId);
  if (!question) return;
  const targetId = rowId(questionId);
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      templateRevisionId: props.entry.templateRevisionId,
      followUpPillar: pillarFilter.value,
      followUpSeverity: severityFilter.value,
      followUpHandoffStatus: handoffStatusFilter.value,
      followUpQuestionId: questionId,
    },
    hash: `#${targetId}`,
  });
  openMoreInfoPanel({
    title: question.text,
    whyImportant: question.importance ?? "",
    leadingPractices:
      question.leadingPractices?.map((practice) => practice.text) ?? [],
    helpfulLinks: question.helpfulLinks ?? [],
    action: {
      label: "Open question in assessment",
      to: router.resolve(linkFor(questionId)).fullPath,
    },
  });
};
const assessmentLink = computed<RouteLocationRaw>(() => ({
  name: props.assessmentRouteName,
  params: props.assessmentParams,
  query: { templateRevisionId: props.entry.templateRevisionId },
}));
function linkFor(questionId: string): RouteLocationRaw {
  return {
    name: props.assessmentRouteName,
    params: props.assessmentParams,
    query: { templateRevisionId: props.entry.templateRevisionId },
    hash: `#question-${questionId}`,
  };
}
function rowId(questionId: string, practiceId?: string): string {
  return `follow-up-${encodeURIComponent(questionId)}${practiceId ? `-${encodeURIComponent(practiceId)}` : ""}`;
}
const handleOpenQuestion = async (
  event: MouseEvent,
  questionId: string,
  practiceId?: string
) => {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  const targetId = rowId(questionId, practiceId);
  await router.replace({
    path: route.path,
    query: {
      ...route.query,
      templateRevisionId: props.entry.templateRevisionId,
      followUpPillar: pillarFilter.value,
      followUpSeverity: severityFilter.value,
      followUpHandoffStatus: handoffStatusFilter.value,
      followUpQuestionId: questionId,
      ...(practiceId ? { followUpPracticeId: practiceId } : {}),
    },
    hash: `#${targetId}`,
  });
  await router.push(linkFor(questionId));
};
const filterRadioTarget = (
  event: KeyboardEvent,
  index: number,
  length: number
): number | null =>
  event.key === "ArrowDown" || event.key === "ArrowRight"
    ? (index + 1) % length
    : event.key === "ArrowUp" || event.key === "ArrowLeft"
      ? (index - 1 + length) % length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? length - 1
          : null;
const focusFilterRadio = (event: KeyboardEvent, targetIndex: number) => {
  event.preventDefault();
  const group = (event.currentTarget as HTMLElement).closest(
    '[role="radiogroup"]'
  );
  group?.querySelectorAll<HTMLElement>('[role="radio"]')[targetIndex]?.focus();
};
const handleHandoffStatusFilterKey = (event: KeyboardEvent, index: number) => {
  const targetIndex = filterRadioTarget(
    event,
    index,
    handoffStatusOptions.length
  );
  if (targetIndex === null) return;
  const option = handoffStatusOptions[targetIndex];
  if (!option) return;
  handoffStatusFilter.value = option.value;
  focusFilterRadio(event, targetIndex);
};
const handlePillarFilterKey = (event: KeyboardEvent, index: number) => {
  const targetIndex = filterRadioTarget(
    event,
    index,
    pillarOptions.value.length
  );
  if (targetIndex === null) return;
  const option = pillarOptions.value[targetIndex];
  if (!option) return;
  pillarFilter.value = option.value;
  focusFilterRadio(event, targetIndex);
};
const handleSeverityFilterKey = (event: KeyboardEvent, index: number) => {
  const targetIndex = filterRadioTarget(
    event,
    index,
    severityOptions.value.length
  );
  if (targetIndex === null) return;
  const option = severityOptions.value[targetIndex];
  if (!option) return;
  severityFilter.value = option.value;
  focusFilterRadio(event, targetIndex);
};
const resetFilters = () => {
  handoffStatusFilter.value = "available";
  pillarFilter.value = "all";
  severityFilter.value = "all";
};
const clearFilters = () => {
  resetFilters();
  refineOpen.value = false;
};

onMounted(async () => {
  const questionId =
    typeof route.query.followUpQuestionId === "string"
      ? route.query.followUpQuestionId
      : null;
  const practiceId =
    typeof route.query.followUpPracticeId === "string"
      ? route.query.followUpPracticeId
      : undefined;
  if (!questionId) return;
  await nextTick();
  const target = document.getElementById(rowId(questionId, practiceId));
  target?.scrollIntoView?.({ block: "center" });
  target?.focus({ preventScroll: true });
});
</script>

<template>
  <div v-if="queue" class="min-w-0">
    <div
      class="mt-10 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8"
    >
      <div
        class="bg-muted mb-6 grid grid-cols-2 gap-1 rounded-lg p-1 lg:hidden"
        role="tablist"
        aria-label="Follow-ups view"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="mobileView === 'attention'"
          class="focus-visible:ring-primary min-h-11 rounded-[7px] px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          :class="
            mobileView === 'attention'
              ? 'bg-default text-highlighted'
              : 'text-muted'
          "
          @click="mobileView = 'attention'"
        >
          Needs attention
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mobileView === 'handoff'"
          class="focus-visible:ring-primary min-h-11 rounded-[7px] px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          :class="
            mobileView === 'handoff'
              ? 'bg-default text-highlighted'
              : 'text-muted'
          "
          @click="mobileView = 'handoff'"
        >
          Handoff {{ selectedIds.size }}
        </button>
      </div>

      <section
        class="min-w-0"
        :class="mobileView === 'attention' ? 'block' : 'hidden lg:block'"
        aria-labelledby="needs-attention-heading"
      >
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h3
              id="needs-attention-heading"
              class="text-highlighted text-2xl font-extrabold"
            >
              Needs attention
            </h3>
            <p class="text-muted mt-1 text-sm">
              Recorded follow-ups, ordered by severity.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-list-filter"
            class="self-start sm:self-auto"
            @click="refineOpen = true"
          >
            Refine
            <span
              v-if="activeFilterCount > 0"
              class="bg-primary/10 text-primary rounded-md px-1.5 py-0.5 text-[13px] tabular-nums"
            >
              {{ activeFilterCount }}
            </span>
          </UButton>

          <Teleport to="body">
            <USlideover
              v-model:open="refineOpen"
              title="Refine follow-ups"
              description="Narrow the queue without changing its severity order."
              side="right"
              :ui="{ content: 'max-w-sm' }"
            >
              <template #body>
                <div class="space-y-6">
                  <fieldset>
                    <legend
                      class="text-default inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      <Icon
                        name="lucide:filter"
                        class="text-primary size-3.5"
                        aria-hidden="true"
                      />
                      Filter by handoff status
                    </legend>
                    <div
                      class="mt-2 grid gap-2"
                      role="radiogroup"
                      aria-label="Filter by handoff status"
                    >
                      <button
                        v-for="(option, index) in handoffStatusOptions"
                        :key="option.value"
                        type="button"
                        role="radio"
                        :aria-checked="handoffStatusFilter === option.value"
                        :tabindex="
                          handoffStatusFilter === option.value ? 0 : -1
                        "
                        class="border-default focus-visible:ring-primary flex min-h-10 items-center justify-between gap-3 rounded-[7px] border px-3 text-left text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        :class="
                          handoffStatusFilter === option.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted hover:bg-muted hover:text-default'
                        "
                        @click="handoffStatusFilter = option.value"
                        @keydown="handleHandoffStatusFilterKey($event, index)"
                      >
                        <span>{{ option.label }}</span>
                        <Icon
                          v-if="handoffStatusFilter === option.value"
                          name="lucide:check"
                          class="size-4 shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend
                      class="text-default inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      <Icon
                        name="lucide:filter"
                        class="text-primary size-3.5"
                        aria-hidden="true"
                      />
                      Filter by pillar
                    </legend>
                    <div
                      class="mt-2 space-y-1"
                      role="radiogroup"
                      aria-label="Filter by pillar"
                    >
                      <button
                        v-for="(option, index) in pillarOptions"
                        :key="option.value"
                        type="button"
                        role="radio"
                        :aria-checked="pillarFilter === option.value"
                        :tabindex="pillarFilter === option.value ? 0 : -1"
                        class="focus-visible:ring-primary flex min-h-10 w-full items-center justify-between gap-3 rounded-[7px] px-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        :class="
                          pillarFilter === option.value
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-muted hover:bg-muted hover:text-default'
                        "
                        @click="pillarFilter = option.value"
                        @keydown="handlePillarFilterKey($event, index)"
                      >
                        <span class="min-w-0 truncate">{{ option.label }}</span>
                        <Icon
                          v-if="pillarFilter === option.value"
                          name="lucide:check"
                          class="size-4 shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend
                      class="text-default inline-flex items-center gap-2 text-sm font-semibold"
                    >
                      <Icon
                        name="lucide:filter"
                        class="text-primary size-3.5"
                        aria-hidden="true"
                      />
                      Filter by question severity
                    </legend>
                    <div
                      class="mt-2 grid grid-cols-2 gap-2"
                      role="radiogroup"
                      aria-label="Filter by question severity"
                    >
                      <button
                        v-for="(option, index) in severityOptions"
                        :key="option.value"
                        type="button"
                        role="radio"
                        :aria-checked="severityFilter === option.value"
                        :tabindex="severityFilter === option.value ? 0 : -1"
                        class="border-default focus-visible:ring-primary flex min-h-10 items-center gap-2 rounded-[7px] border px-3 text-left text-[13px] font-semibold transition-[background-color,border-color,color] focus-visible:ring-2 focus-visible:outline-none"
                        :class="
                          severityFilter === option.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'text-muted hover:bg-muted hover:text-default'
                        "
                        @click="severityFilter = option.value"
                        @keydown="handleSeverityFilterKey($event, index)"
                      >
                        <span
                          v-if="option.value !== 'all'"
                          class="h-[3px] w-4 shrink-0 rounded-[2px]"
                          :class="severityAccentClass(option.value)"
                          aria-hidden="true"
                        />
                        <span>{{ option.label }}</span>
                      </button>
                    </div>
                  </fieldset>
                </div>
              </template>

              <template #footer>
                <div class="flex w-full items-center justify-between gap-3">
                  <span class="text-muted text-[13px] tabular-nums">
                    {{ visiblePracticeCount }} practice{{
                      visiblePracticeCount === 1 ? "" : "s"
                    }}
                    shown
                  </span>
                  <div class="flex items-center gap-2">
                    <UButton
                      v-if="hasActiveFilters"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="resetFilters"
                    >
                      Reset
                    </UButton>
                    <UButton size="sm" @click="refineOpen = false">
                      Done
                    </UButton>
                  </div>
                </div>
              </template>
            </USlideover>
          </Teleport>
        </div>

        <p
          v-if="hasActiveFilters"
          class="text-muted mt-3 text-[13px]"
          aria-live="polite"
        >
          Showing {{ visiblePracticeCount }} of
          {{ totalPracticeCount }} practices needing follow-up
        </p>

        <UAlert
          v-if="!selectionWriteAvailable"
          role="alert"
          color="warning"
          variant="subtle"
          class="mt-5"
          title="Handoff changes are not ready on this device"
          :description="selectionUnavailableReason"
        >
          <template #actions>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="emit('retry')"
            >
              Retry local setup
            </UButton>
          </template>
        </UAlert>

        <div
          v-if="visibleSections.length === 0 && visibleUnanswered.length === 0"
          class="py-12 text-center"
          role="status"
        >
          <h4 class="text-highlighted text-base font-semibold">
            No follow-ups match these filters
          </h4>
          <p class="text-muted mt-1 text-sm">
            Clear the filters to return to the complete queue.
          </p>
          <UButton
            v-if="hasActiveFilters"
            variant="link"
            color="neutral"
            class="mt-2"
            @click="clearFilters"
          >
            Clear filters
          </UButton>
        </div>

        <div v-else class="mt-8 flex flex-col gap-12">
          <TransitionGroup name="queue-section">
            <section
              v-for="section in visibleSections"
              :key="section.severity"
              :aria-labelledby="`severity-${section.severity}`"
            >
              <div class="flex items-center gap-3">
                <span
                  class="h-[3px] w-5 rounded-[2px]"
                  :class="severityAccentClass(section.severity)"
                  aria-hidden="true"
                />
                <h4
                  :id="`severity-${section.severity}`"
                  class="text-highlighted text-lg font-semibold"
                >
                  {{ SEVERITY_DISPLAY[section.severity].label }}
                </h4>
                <span class="text-muted text-sm tabular-nums">
                  {{ section.practiceCount }} practice{{
                    section.practiceCount === 1 ? "" : "s"
                  }}
                </span>
              </div>

              <div class="mt-4 space-y-4">
                <article
                  v-for="question in section.questions"
                  :id="rowId(question.questionId)"
                  :key="question.questionId"
                  tabindex="-1"
                  :data-question-group="question.questionId"
                  class="border-default focus-visible:ring-primary overflow-hidden rounded-lg border focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div
                    class="bg-primary/5 flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div class="min-w-0">
                      <p class="flex flex-wrap items-center gap-2 text-[13px]">
                        <span
                          v-if="question.questionReference"
                          class="bg-primary/10 text-primary rounded-md px-2 py-1 font-mono font-semibold"
                        >
                          {{ question.questionReference }}
                        </span>
                        <span class="text-muted">{{
                          question.pillarName
                        }}</span>
                      </p>
                      <h5 class="text-highlighted mt-1 text-base font-semibold">
                        {{ question.questionText }}
                      </h5>
                    </div>
                    <UButton
                      color="neutral"
                      variant="link"
                      size="sm"
                      icon="i-lucide-book-open"
                      class="shrink-0 px-0"
                      @click="openQuestionContext(question.questionId)"
                    >
                      Question details
                    </UButton>
                  </div>

                  <div
                    class="border-default bg-muted/50 flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                  >
                    <div>
                      <p class="text-default text-sm font-semibold">
                        {{ practiceListTitle(question) }}
                      </p>
                      <p class="text-muted mt-0.5 text-[13px]">
                        {{ practiceListInstruction(question) }}
                      </p>
                    </div>
                    <span class="text-muted shrink-0 text-[13px] tabular-nums">
                      {{ selectedPracticeCount(question) }} of
                      {{ question.practices.length }} in Handoff
                    </span>
                  </div>

                  <TransitionGroup
                    tag="ul"
                    name="practice-row"
                    class="bg-default"
                  >
                    <li
                      v-for="practice in visiblePractices(question)"
                      :id="
                        rowId(question.questionId, practice.practice.practiceId)
                      "
                      :key="`${practice.stage}:${practice.practice.practiceId}`"
                      tabindex="-1"
                      data-practice-row
                      :data-template-revision-id="entry.templateRevisionId"
                      :data-pillar-id="practice.practice.pillarId"
                      :data-pillar-name="practice.practice.pillarName"
                      :data-question-id="practice.practice.questionId"
                      :data-practice-id="practice.practice.practiceId"
                      class="focus-visible:ring-primary border-default min-w-0 border-t focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <button
                        v-if="selectableFor(practice.practice)"
                        type="button"
                        role="checkbox"
                        :aria-checked="isSelected(practice)"
                        :aria-label="selectionLabel(practice)"
                        :aria-disabled="
                          selectionBlockedFor(selectableFor(practice.practice)!)
                        "
                        class="focus-visible:ring-primary group flex min-h-16 w-full min-w-0 cursor-pointer flex-col gap-3 px-4 py-3 text-left transition-[background-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset active:translate-y-px motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                        :class="
                          selectionBlockedFor(selectableFor(practice.practice)!)
                            ? 'text-dimmed cursor-not-allowed opacity-60'
                            : isSelected(practice)
                              ? 'bg-primary/10'
                              : 'hover:bg-muted/70'
                        "
                        @click="handleToggle(practice)"
                      >
                        <span class="min-w-0 flex-1">
                          <span
                            v-if="
                              practice.practice.practiceText !==
                              question.questionText
                            "
                            class="text-toned block text-base leading-relaxed"
                          >
                            <InlineMarkdown
                              :text="practice.practice.practiceText"
                            />
                          </span>
                          <span
                            v-else
                            class="text-toned block text-base leading-relaxed"
                          >
                            Recorded answer: No
                          </span>
                          <span
                            v-if="
                              selectableFor(practice.practice)
                                ?.currentAssociation
                            "
                            class="text-muted mt-1 block text-[13px]"
                          >
                            Linked to
                            {{
                              selectableFor(practice.practice)!
                                .currentAssociation!.provider
                            }}
                            {{
                              selectableFor(practice.practice)!
                                .currentAssociation!.externalId
                            }}
                          </span>
                          <span
                            v-if="wasHandedOff(practice)"
                            class="text-dimmed mt-1 flex items-center gap-1.5 text-[13px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                            aria-hidden="true"
                          >
                            <Icon name="lucide:history" class="size-3.5" />
                            Handed off before · still needs evidence
                          </span>
                        </span>
                        <span
                          class="text-muted group-hover:text-default flex shrink-0 items-center gap-2 text-[13px] font-semibold"
                          :class="isSelected(practice) ? 'text-primary' : ''"
                        >
                          <span>
                            {{
                              isSelected(practice)
                                ? "In handoff"
                                : "Add to handoff"
                            }}
                          </span>
                          <span
                            v-if="
                              practiceOpportunities.get(
                                selectableFor(practice.practice)!.entityId
                              )
                            "
                            class="text-success tabular-nums"
                          >
                            +{{
                              practiceOpportunities.get(
                                selectableFor(practice.practice)!.entityId
                              )
                            }}
                            pts
                          </span>
                        </span>
                      </button>
                      <div
                        v-else-if="wasHandedOff(practice)"
                        class="bg-muted/40 flex min-h-16 min-w-0 items-center justify-between gap-6 px-4 py-3"
                      >
                        <p class="text-muted min-w-0 text-base">
                          <InlineMarkdown
                            :text="practice.practice.practiceText"
                          />
                        </p>
                        <UTooltip
                          text="Handed off previously. Still needs evidence in Assessment."
                          :delay-duration="0"
                          :content="{ side: 'top' }"
                        >
                          <span
                            tabindex="0"
                            aria-label="Handed off previously. Still needs evidence in Assessment."
                            class="text-dimmed focus-visible:ring-primary inline-flex size-8 shrink-0 items-center justify-center rounded-[7px] focus-visible:ring-2 focus-visible:outline-none"
                          >
                            <Icon
                              name="lucide:history"
                              class="size-4"
                              aria-hidden="true"
                            />
                          </span>
                        </UTooltip>
                      </div>
                      <UAlert
                        v-if="
                          selectableFor(practice.practice) &&
                          rowHasSelectionError(
                            selectableFor(practice.practice)!
                          )
                        "
                        role="alert"
                        color="error"
                        variant="subtle"
                        class="sm:basis-full"
                        :title="
                          selectionError || 'Selection could not be saved'
                        "
                      >
                        <template
                          v-if="selectionViolations.length > 0"
                          #description
                        >
                          <ul>
                            <li
                              v-for="violation in selectionViolations"
                              :key="violation.field"
                            >
                              {{ describeHandoffViolation(violation) }}
                            </li>
                          </ul>
                        </template>
                      </UAlert>
                    </li>
                  </TransitionGroup>
                  <button
                    v-if="hiddenPracticeCount(question) > 0"
                    type="button"
                    class="border-default text-muted hover:bg-muted hover:text-default focus-visible:ring-primary flex min-h-11 w-full items-center justify-center border-t px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                    :aria-expanded="
                      expandedQuestionIds.has(question.questionId)
                    "
                    @click="toggleQuestionPractices(question.questionId)"
                  >
                    {{
                      expandedQuestionIds.has(question.questionId)
                        ? "Show first 5 practices"
                        : `Show ${hiddenPracticeCount(question)} remaining practices`
                    }}
                  </button>
                </article>
              </div>
            </section>
          </TransitionGroup>

          <section
            v-if="visibleUnanswered.length > 0"
            class="border-default bg-primary/5 rounded-lg border p-5"
            :class="isEarlyCoverage ? 'order-first' : 'order-last'"
            aria-labelledby="continue-assessment-heading"
          >
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
            >
              <div>
                <h4
                  id="continue-assessment-heading"
                  class="text-highlighted text-lg font-semibold"
                >
                  {{ visibleUnanswered.length }} question{{
                    visibleUnanswered.length === 1 ? "" : "s"
                  }}
                  still {{ visibleUnanswered.length === 1 ? "needs" : "need" }}
                  an answer
                </h4>
                <p class="text-muted mt-1 text-sm">
                  Answer them to improve coverage and reveal any additional
                  practices needing follow-up.
                </p>
              </div>
              <UButton
                :to="assessmentLink"
                color="neutral"
                variant="outline"
                class="shrink-0"
              >
                Continue assessment
              </UButton>
            </div>

            <details class="group border-default mt-4 border-t pt-2">
              <summary
                class="focus-visible:ring-primary flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[7px] focus-visible:ring-2 focus-visible:outline-none"
              >
                <span class="text-default text-sm font-semibold">
                  Review unanswered questions
                </span>
                <Icon
                  name="lucide:chevron-down"
                  class="text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <ul class="border-default border-t">
                <li
                  v-for="question in visibleUnanswered"
                  :id="rowId(question.questionId)"
                  :key="question.questionId"
                  tabindex="-1"
                  class="border-default border-b py-4 last:border-b-0"
                >
                  <p class="text-muted text-[13px]">
                    <span
                      v-if="question.questionReference"
                      class="font-mono font-semibold"
                    >
                      {{ question.questionReference }} ·
                    </span>
                    {{ question.pillarName }}
                  </p>
                  <div
                    class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <p class="text-default text-base">
                      {{ question.questionText }}
                    </p>
                    <NuxtLink
                      :to="linkFor(question.questionId)"
                      class="text-primary focus-visible:ring-primary inline-flex min-h-9 shrink-0 items-center rounded-[7px] text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      @click="handleOpenQuestion($event, question.questionId)"
                    >
                      Open question
                    </NuxtLink>
                  </div>
                </li>
              </ul>
            </details>
          </section>
        </div>
      </section>

      <aside
        class="mt-8 min-w-0 lg:sticky lg:top-24 lg:mt-0 lg:block"
        :class="mobileView === 'handoff' ? 'block' : 'hidden lg:block'"
        aria-label="Handoff composer"
      >
        <slot name="handoff" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.queue-section-enter-active,
.queue-section-leave-active,
.practice-row-enter-active,
.practice-row-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.queue-section-enter-from,
.queue-section-leave-to,
.practice-row-enter-from,
.practice-row-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.queue-section-move,
.practice-row-move {
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .queue-section-enter-active,
  .queue-section-leave-active,
  .practice-row-enter-active,
  .practice-row-leave-active,
  .queue-section-move,
  .practice-row-move {
    transition: none;
  }
}
</style>
