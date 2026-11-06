<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";
import type {
  ReviewWorkspace,
  WorkspaceMaturityEntry,
} from "~/models/workspace";
import {
  projectPillarQuestions,
  type PillarQuestionBreakdownRow,
  type PillarQuestionDisplayInfo,
} from "~/services/maturity/pillarQuestions";

interface Props {
  workspace: ReviewWorkspace;
  entry: Extract<WorkspaceMaturityEntry, { kind: "result" }>;
  pillarId: string;
  pillarName: string;
  subjectId: string;
  questions: ReadonlyMap<string, PillarQuestionDisplayInfo>;
}

const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });
const expandedQuestionId = ref<string | null>(null);
const showAllPractices = ref(false);

watch(open, (value) => {
  if (value) return;
  expandedQuestionId.value = null;
  showAllPractices.value = false;
});

const toggleQuestionEvidence = (questionId: string) => {
  expandedQuestionId.value =
    expandedQuestionId.value === questionId ? null : questionId;
  showAllPractices.value = false;
};
const visiblePractices = (question: PillarQuestionBreakdownRow) =>
  showAllPractices.value ? question.practices : question.practices.slice(0, 5);
const hiddenPracticeCount = (question: PillarQuestionBreakdownRow) =>
  Math.max(0, question.practices.length - 5);
const toggleAllPractices = () => {
  showAllPractices.value = !showAllPractices.value;
};
const practiceSummary = (question: PillarQuestionBreakdownRow): string => {
  const met = question.practices.filter(
    (practice) => practice.state === "met"
  ).length;
  const unmet = question.practices.filter(
    (practice) => practice.state === "unmet"
  ).length;
  const notCounted = question.practices.length - met - unmet;
  return [
    met > 0 ? `${met} met` : null,
    unmet > 0 ? `${unmet} need follow-up` : null,
    notCounted > 0 ? `${notCounted} not counted` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
};
const practiceStateIcon = (
  state: PillarQuestionBreakdownRow["practices"][number]["state"]
): string =>
  state === "met"
    ? "lucide:check"
    : state === "not-applicable"
      ? "lucide:minus"
      : "lucide:circle";
const practiceStateClass = (
  state: PillarQuestionBreakdownRow["practices"][number]["state"]
): string =>
  state === "met"
    ? "text-success"
    : state === "unmet"
      ? "text-warning"
      : "text-muted";

const subjectName = computed(() => {
  if (props.workspace.subject.id === props.subjectId) {
    return props.workspace.subject.name;
  }
  if (props.workspace.reviewSubject.id === props.subjectId) {
    return props.workspace.reviewSubject.name;
  }
  return props.workspace.reviewSubject.name;
});
const breakdown = computed(() =>
  projectPillarQuestions({
    trace: props.entry.trace,
    pillarId: props.pillarId,
    questions: props.questions,
  })
);
const slideoverTitle = computed(() => `${props.pillarName} maturity`);
const percentLabel = computed(() => {
  if (breakdown.value?.displayPercent === null || !breakdown.value) {
    return "No result yet";
  }
  return `${breakdown.value.displayPercent}%`;
});
const exactPercent = computed(() => {
  const result = breakdown.value?.trace.result;
  if (!result) return null;
  return (Number(result.numerator) / Number(result.denominator)) * 100;
});
const coverageLabel = computed(() => {
  if (!breakdown.value) return "Coverage unavailable.";
  const { answered, total, unanswered } = breakdown.value;
  if (unanswered === 0) {
    return `All ${total} question${total === 1 ? "" : "s"} answered.`;
  }
  return `${answered} of ${total} questions answered. This pillar result is provisional.`;
});
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="slideoverTitle"
    side="right"
    :ui="{ content: 'w-full sm:max-w-2xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-8">
        <p class="text-muted text-[13px]">
          {{ subjectName }} · {{ workspace.review.name }} ·
          {{ workspace.review.status }}
        </p>

        <div
          v-if="!breakdown"
          role="status"
          class="border-default rounded-lg border px-4 py-8 text-center"
        >
          <p class="text-default text-sm font-semibold">
            Pillar maturity is unavailable.
          </p>
          <p class="text-muted mt-1 text-[13px]">
            No matching pillar was found in this calculation trace.
          </p>
        </div>

        <template v-else>
          <section aria-labelledby="pillar-maturity-summary-heading">
            <div
              class="bg-primary mb-3 h-[3px] w-10 rounded-[2px]"
              aria-hidden="true"
            />
            <h3
              id="pillar-maturity-summary-heading"
              class="text-highlighted text-lg font-semibold"
            >
              Pillar result
            </h3>
            <div class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <strong
                class="text-highlighted text-[32px] leading-none font-extrabold tabular-nums"
              >
                {{ percentLabel }}
              </strong>
              <MaturityStagePopover
                v-if="breakdown.stage"
                :stage="breakdown.stage.stage"
                :thresholds="entry.trace.thresholds"
                :percent="exactPercent"
                :display-percent="breakdown.displayPercent"
                trigger-class="text-base"
              />
            </div>
            <p class="text-muted mt-2 text-sm">{{ coverageLabel }}</p>
            <p class="text-muted mt-2 text-sm">
              Template authors set the severity of each question. Higher
              severity gives a question more points in this pillar result.
            </p>
          </section>

          <section aria-labelledby="pillar-question-list-heading">
            <h3
              id="pillar-question-list-heading"
              class="text-highlighted text-lg font-semibold"
            >
              How each question contributes
            </h3>
            <ol
              v-if="breakdown.questions.length > 0"
              class="border-default mt-4 border-t"
            >
              <li
                v-for="question in breakdown.questions"
                :key="question.questionId"
                class="border-default border-b py-5"
              >
                <div class="flex flex-wrap items-center gap-2 text-[13px]">
                  <span
                    v-if="question.questionReference"
                    class="text-primary font-mono font-semibold"
                  >
                    {{ question.questionReference }}
                  </span>
                  <span class="text-dimmed" aria-hidden="true">·</span>
                  <span class="text-muted">{{
                    question.answerStatusLabel
                  }}</span>
                </div>
                <h4
                  class="text-default mt-1.5 text-base leading-snug font-semibold"
                >
                  {{ question.title }}
                </h4>

                <div class="mt-4">
                  <div class="flex items-center justify-between gap-4 text-sm">
                    <span
                      class="font-semibold"
                      :class="
                        question.contributionState === 'fully-contributing'
                          ? 'text-success'
                          : question.contributionState ===
                              'partially-contributing'
                            ? 'text-primary'
                            : 'text-muted'
                      "
                    >
                      {{ question.contributionLabel }}
                    </span>
                    <span
                      v-if="question.evidenceCompletionPercent !== null"
                      class="text-muted shrink-0 tabular-nums"
                    >
                      {{ question.evidenceCompletionPercent }}%
                    </span>
                  </div>
                  <button
                    v-if="question.practices.length > 0"
                    type="button"
                    class="group hover:bg-muted focus-visible:ring-primary mt-1.5 w-full rounded-[7px] px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    :aria-expanded="expandedQuestionId === question.questionId"
                    :aria-controls="`question-evidence-${question.questionId}`"
                    :aria-label="`View ${question.practices.length} checklist items for ${question.title}`"
                    @click="toggleQuestionEvidence(question.questionId)"
                  >
                    <span
                      class="bg-muted block h-1.5 overflow-hidden rounded-[2px]"
                    >
                      <span
                        v-if="question.evidenceCompletionPercent !== null"
                        class="block h-full"
                        :class="
                          question.evidenceCompletionPercent === 100
                            ? 'bg-success'
                            : 'bg-[#0284C7] dark:bg-sky-400'
                        "
                        :style="{
                          width: `${question.evidenceCompletionPercent}%`,
                        }"
                      />
                    </span>
                    <span
                      class="text-muted group-hover:text-default mt-2 flex items-center justify-between gap-3 text-[13px] font-semibold"
                    >
                      <span>
                        View {{ question.practices.length }} checklist item{{
                          question.practices.length === 1 ? "" : "s"
                        }}
                      </span>
                      <Icon
                        name="lucide:chevron-down"
                        class="size-4 shrink-0 transition-transform"
                        :class="
                          expandedQuestionId === question.questionId
                            ? 'rotate-180'
                            : ''
                        "
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  <div
                    v-else-if="question.evidenceCompletionPercent !== null"
                    class="bg-muted mt-2 h-1.5 overflow-hidden rounded-[2px]"
                    role="progressbar"
                    :aria-valuenow="question.evidenceCompletionPercent"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    :aria-label="`${question.title}: ${question.evidenceCompletionPercent} percent of available evidence earned`"
                  >
                    <div
                      class="h-full"
                      :class="
                        question.evidenceCompletionPercent === 100
                          ? 'bg-success'
                          : 'bg-[#0284C7] dark:bg-sky-400'
                      "
                      :style="{
                        width: `${question.evidenceCompletionPercent}%`,
                      }"
                    />
                  </div>
                  <p class="text-muted mt-2 text-[13px]">
                    {{ question.contributionDetail }}
                  </p>
                </div>

                <Transition name="question-evidence">
                  <div
                    v-if="expandedQuestionId === question.questionId"
                    :id="`question-evidence-${question.questionId}`"
                    class="border-default bg-muted/50 mt-4 rounded-lg border px-3 py-3"
                  >
                    <div
                      class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <p class="text-default text-sm font-semibold">
                        Checklist evidence
                      </p>
                      <p class="text-muted text-[13px]">
                        {{ practiceSummary(question) }}
                      </p>
                    </div>
                    <ul class="border-default mt-3 border-t">
                      <li
                        v-for="practice in visiblePractices(question)"
                        :key="practice.id"
                        class="border-default flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0"
                      >
                        <span class="text-default text-[13px] leading-relaxed">
                          {{ practice.title }}
                        </span>
                        <span
                          class="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold"
                          :class="practiceStateClass(practice.state)"
                        >
                          <Icon
                            :name="practiceStateIcon(practice.state)"
                            class="size-3.5"
                            aria-hidden="true"
                          />
                          {{ practice.stateLabel }}
                        </span>
                      </li>
                    </ul>
                    <button
                      v-if="hiddenPracticeCount(question) > 0"
                      type="button"
                      class="text-primary hover:text-primary/80 focus-visible:ring-primary mt-2 inline-flex min-h-9 items-center rounded-[7px] text-[13px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
                      @click="toggleAllPractices"
                    >
                      {{
                        showAllPractices
                          ? "Show first 5"
                          : `Show ${hiddenPracticeCount(question)} more`
                      }}
                    </button>
                  </div>
                </Transition>
              </li>
            </ol>

            <p
              v-else
              role="status"
              class="border-default text-muted mt-4 border-y py-6 text-center text-sm"
            >
              No traced questions belong to this pillar.
            </p>
          </section>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton color="neutral" variant="ghost" @click="open = false">
          Close
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.question-evidence-enter-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.question-evidence-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.question-evidence-leave-active {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .question-evidence-enter-active,
  .question-evidence-leave-active {
    transition: none;
  }
}
</style>
