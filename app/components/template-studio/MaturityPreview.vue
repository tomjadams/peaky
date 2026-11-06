<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { QuestionAnswer } from "~/models/question";
import {
  calculateMaturity,
  type AnswerValue,
} from "~/services/maturity/calculate";
import type {
  MaturityDefinition,
  ScorableQuestion,
} from "~/services/maturity/definition";
import {
  addExact,
  deserializeRatio,
  toWholePercent,
  ZERO_RATIO,
  type ExactRatio,
} from "~/services/maturity/ratio";
import { validateMaturityDefinition } from "~/services/maturity/validation";
import { workspaceAnswerToValue } from "~/services/maturity/workspace";

interface Props {
  templateRevisionId: string;
  definition: MaturityDefinition | null;
  questions: readonly ScorableQuestion[];
  answers: Readonly<Partial<Record<string, QuestionAnswer>>>;
}

const props = defineProps<Props>();

const QUESTION_WEIGHT_LEVELS = [
  {
    severity: "medium",
    label: "Medium",
    weight: 1,
    textClass: "text-muted",
  },
  {
    severity: "high",
    label: "High",
    weight: 2,
    textClass: "text-[#92400E] dark:text-amber-300",
  },
  {
    severity: "critical",
    label: "Critical",
    weight: 3,
    textClass: "text-[#B91C1C] dark:text-red-300",
  },
] as const;

function formatPointRatio(value: ExactRatio): string {
  const isNegative = value.numerator < 0n;
  const numerator = isNegative ? -value.numerator : value.numerator;
  const hundredths =
    (numerator * 200n + value.denominator) / (2n * value.denominator);
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${isNegative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

const scoringDetailsOpen = ref(false);
const liveStatus = ref("");

const normalizedAnswers = computed<Record<string, AnswerValue>>(() => {
  const answers: Record<string, AnswerValue> = {};
  for (const question of props.questions) {
    answers[question.questionId] = workspaceAnswerToValue(
      props.answers[question.questionId] ?? null
    );
  }
  return answers;
});

const questionWeightMix = computed(() =>
  QUESTION_WEIGHT_LEVELS.map((level) => ({
    ...level,
    count: props.questions.filter(
      (question) => question.severity === level.severity
    ).length,
  })).filter((level) => level.count > 0)
);

const definitionIssues = computed(() =>
  props.definition
    ? validateMaturityDefinition(props.definition, props.questions)
    : []
);

const previewUnavailable = computed(
  () => props.definition === null || definitionIssues.value.length > 0
);

const calculation = computed(() => {
  if (
    props.questions.length === 0 ||
    props.definition === null ||
    definitionIssues.value.length > 0
  ) {
    return null;
  }
  return calculateMaturity({
    templateRevisionId: props.templateRevisionId,
    definition: props.definition,
    questions: props.questions,
    answers: normalizedAnswers.value,
  });
});

const resultTrace = computed(() => {
  const current = calculation.value;
  return current?.kind === "result" ? current.trace : null;
});

const noResult = computed(() => calculation.value?.kind === "no-result");

const coverage = computed(() => {
  const current = calculation.value;
  if (!current || current.kind === "configuration-error") return null;
  return current.kind === "result" ? current.trace.coverage : current.coverage;
});

const displayPercent = computed(() => {
  const trace = resultTrace.value;
  return trace ? toWholePercent(deserializeRatio(trace.result)) : null;
});

const exactPercent = computed(() => {
  const trace = resultTrace.value;
  if (!trace) return 0;
  const ratio = deserializeRatio(trace.result);
  return Number((ratio.numerator * 10_000n) / ratio.denominator) / 100;
});

const provisional = computed(
  () => (resultTrace.value?.coverage.unanswered ?? 0) > 0
);

const scoringPointTotals = computed<{
  earned: ExactRatio;
  available: ExactRatio;
} | null>(() => {
  const current = calculation.value;
  if (!current || current.kind === "configuration-error") return null;
  if (current.kind === "result") {
    return {
      earned: deserializeRatio(current.trace.earned),
      available: deserializeRatio(current.trace.available),
    };
  }

  let available: ExactRatio = ZERO_RATIO;
  for (const question of current.questions) {
    available = addExact(available, deserializeRatio(question.available));
  }
  return { earned: ZERO_RATIO, available };
});

const earnedPoints = computed(() => {
  const points = scoringPointTotals.value;
  return points ? formatPointRatio(points.earned) : "—";
});

const availablePoints = computed(() => {
  const points = scoringPointTotals.value;
  return points ? formatPointRatio(points.available) : "—";
});

const equationResult = computed(() =>
  displayPercent.value === null ? "—" : `${displayPercent.value}%`
);

const coverageLabel = computed(() => {
  const current = coverage.value;
  return current
    ? `${current.answered} of ${current.total} answered`
    : `0 of ${props.questions.length} answered`;
});

const outcomeStatus = computed(() => {
  if (props.questions.length === 0) return "No questions to preview.";
  if (
    previewUnavailable.value ||
    calculation.value?.kind === "configuration-error"
  ) {
    return "Maturity preview unavailable.";
  }
  if (noResult.value) {
    return `No maturity result yet. ${coverageLabel.value}.`;
  }

  const trace = resultTrace.value;
  return trace && displayPercent.value !== null
    ? `Maturity score ${displayPercent.value}%. Stage ${trace.stage.stage}, ${trace.stage.name}. ${coverageLabel.value}${provisional.value ? ", provisional" : ""}.`
    : "";
});

watch(
  outcomeStatus,
  (status) => {
    liveStatus.value = "";
    nextTick(() => {
      liveStatus.value = status;
    });
  },
  { flush: "post", immediate: true }
);
</script>

<template>
  <section aria-labelledby="maturity-preview-heading" class="py-3">
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ liveStatus }}
    </p>

    <div class="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="block h-[3px] w-6 rounded-[2px] bg-[#0284C7] dark:bg-sky-400"
            aria-hidden="true"
          />
          <h2
            id="maturity-preview-heading"
            class="text-muted text-[13px] font-semibold"
          >
            Maturity · current draft
          </h2>
        </div>

        <div
          v-if="resultTrace && displayPercent !== null"
          class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"
          role="group"
          aria-label="Maturity score preview"
        >
          <strong
            class="text-highlighted text-[30px] leading-none font-extrabold tabular-nums"
          >
            {{ displayPercent }}%
          </strong>
          <TemplateStudioMaturityStagePopover
            :stage="resultTrace.stage.stage"
            :thresholds="resultTrace.thresholds"
            :percent="exactPercent"
            :display-percent="displayPercent"
            trigger-class="text-base"
          >
            <template #trigger>
              Stage {{ resultTrace.stage.stage }} · {{ resultTrace.stage.name }}
            </template>
          </TemplateStudioMaturityStagePopover>
        </div>

        <p
          v-else-if="noResult"
          class="text-default mt-2 text-base font-semibold"
        >
          Answer one question to see the score
        </p>
        <p
          v-else-if="questions.length === 0"
          class="text-default mt-2 text-base font-semibold"
        >
          Add a question to preview the score
        </p>
        <p v-else class="text-default mt-2 text-base font-semibold">
          Score preview unavailable
        </p>
      </div>

      <div class="flex items-center gap-3">
        <p
          v-if="questions.length > 0"
          class="text-muted text-[13px] font-semibold"
        >
          <template v-if="provisional">Provisional score · </template
          >{{ coverageLabel }}
        </p>
        <button
          type="button"
          class="text-muted hover:text-default focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-md px-2 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          :aria-expanded="scoringDetailsOpen"
          aria-controls="maturity-preview-scoring-details"
          @click="scoringDetailsOpen = !scoringDetailsOpen"
        >
          How scoring works
          <Icon
            :name="
              scoringDetailsOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'
            "
            class="h-4 w-4"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <div
      v-if="scoringDetailsOpen"
      id="maturity-preview-scoring-details"
      class="mt-4 pt-3"
    >
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-default text-sm font-semibold">Live calculation</h3>
        <p class="text-muted text-[13px]">Updates with every answer</p>
      </div>
      <div
        data-live-calculation
        class="border-default bg-elevated relative flex flex-wrap items-center gap-x-3 gap-y-3 overflow-hidden rounded-lg border px-4 pt-5 pb-4 shadow-[0_10px_24px_rgba(15,23,42,.08),0_2px_4px_rgba(15,23,42,.06)] dark:shadow-[0_12px_28px_rgba(0,0,0,.24)]"
        role="group"
        aria-label="Current scoring equation"
      >
        <span
          class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#94A3B8] via-[#0284C7] to-[#075985] dark:from-slate-500 dark:via-sky-500 dark:to-sky-700"
          aria-hidden="true"
        />
        <span
          class="inline-flex items-baseline gap-2 whitespace-nowrap"
          :aria-label="`${earnedPoints} points earned`"
        >
          <strong
            class="text-highlighted text-[26px] leading-none font-extrabold tabular-nums"
          >
            {{ earnedPoints }}
          </strong>
          <span class="text-muted text-[13px] font-semibold">
            points earned
          </span>
        </span>
        <span class="text-dimmed text-lg">÷</span>
        <span
          class="inline-flex items-center gap-2 whitespace-nowrap"
          :aria-label="`${availablePoints} weighted points available from ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`"
        >
          <strong
            class="text-highlighted text-[26px] leading-none font-extrabold tabular-nums"
          >
            {{ availablePoints }}
          </strong>
          <span class="flex flex-col">
            <span class="text-muted text-[13px] font-semibold">
              weighted points available
            </span>
            <span class="text-dimmed text-[11px] leading-tight">
              from {{ questions.length }}
              {{ questions.length === 1 ? "question" : "questions" }}
            </span>
          </span>
        </span>
        <span class="text-dimmed text-lg">=</span>
        <span
          class="inline-flex items-baseline gap-2 whitespace-nowrap"
          :aria-label="`${equationResult} maturity`"
        >
          <strong
            class="text-highlighted text-[26px] leading-none font-extrabold tabular-nums"
          >
            {{ equationResult }}
          </strong>
          <span class="text-muted text-[13px] font-semibold">maturity</span>
        </span>
        <span
          v-if="resultTrace"
          class="border-default inline-flex items-center gap-2 border-l pl-3 text-[13px] sm:ml-auto"
        >
          <Icon
            name="lucide:arrow-right"
            class="text-dimmed h-3.5 w-3.5"
            aria-hidden="true"
          />
          <span class="text-dimmed font-semibold">Score stage</span>
          <strong class="text-default font-semibold">
            Stage {{ resultTrace.stage.stage }} · {{ resultTrace.stage.name }}
          </strong>
        </span>
      </div>

      <div class="mt-5 space-y-3">
        <section
          v-if="questionWeightMix.length > 0"
          aria-labelledby="maturity-current-question-mix-heading"
          class="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)] md:items-center"
        >
          <h3
            id="maturity-current-question-mix-heading"
            class="text-default text-sm font-semibold"
          >
            Current question mix
          </h3>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span
              v-for="level in questionWeightMix"
              :key="level.severity"
              class="text-[13px] font-semibold"
              :class="level.textClass"
              :aria-label="`${level.count} ${level.label} ${level.count === 1 ? 'question' : 'questions'} at ${level.weight} ${level.weight === 1 ? 'point' : 'points'} each`"
            >
              <strong class="font-extrabold tabular-nums">
                {{ level.count }}
              </strong>
              {{ level.label }} × {{ level.weight }}
            </span>
          </div>
        </section>

        <section
          aria-labelledby="maturity-scoring-rules-heading"
          class="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start"
        >
          <h3
            id="maturity-scoring-rules-heading"
            class="text-default text-sm font-semibold"
          >
            Scoring rules
          </h3>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p
              data-scoring-rule
              class="text-muted inline-flex items-start gap-2 text-[13px]"
            >
              <Icon
                name="lucide:list-checks"
                class="text-primary mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>Checklist items share question weight</span>
            </p>
            <p
              data-scoring-rule
              class="text-muted inline-flex items-start gap-2 text-[13px]"
            >
              <Icon
                name="lucide:circle-dashed"
                class="text-muted mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>Unanswered earns 0; its weight stays available</span>
            </p>
            <p
              data-scoring-rule
              class="text-muted inline-flex items-start gap-2 text-[13px]"
            >
              <Icon
                name="lucide:circle-slash"
                class="text-muted mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>N/A · excluded, not × 0</span>
            </p>
          </div>
        </section>

        <section
          aria-labelledby="maturity-assessment-note-heading"
          class="grid gap-2 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start"
        >
          <h3
            id="maturity-assessment-note-heading"
            class="text-default text-sm font-semibold"
          >
            Note
          </h3>
          <div
            class="text-muted flex items-start gap-2 text-[13px] leading-relaxed"
          >
            <Icon
              name="lucide:info"
              class="text-primary mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <p>
              People completing an assessment see the live maturity result. They
              do not see question severity labels, point totals, available
              points, or the question mix shown above. This keeps the focus on
              the evidence for each answer, not on increasing the score.
            </p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
