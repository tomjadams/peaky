<script setup lang="ts">
/**
 * Trace-backed calculation explanation (maturity-score/REQ-015; AC-024,
 * AC-028, AC-029, AC-035).
 *
 * Every row derives from the calculation trace via `explainCalculation` —
 * never from a second calculation. The exact unrounded result leads, the
 * whole-percent display follows, and when rounding appears to cross a pinned
 * stage boundary the straddle is explained (AC-035). Long question lists
 * show an explicit summarized remainder so a representative row can never
 * become the denominator (AC-029).
 */
import { computed, ref } from "vue";
import type {
  ReviewWorkspace,
  WorkspaceMaturityEntry,
} from "~/models/workspace";
import type { QuestionTrace } from "~/services/maturity/calculate";
import type { SerializedRatio } from "~/services/maturity/ratio";
import { explainCalculation } from "~/services/maturity/projections";
import type { StagePathQuestionInfo } from "~/services/maturity/stagePath";
import { maturityStage } from "~/services/maturity/stages";

interface Props {
  open: boolean;
  workspace: ReviewWorkspace;
  entry: Extract<WorkspaceMaturityEntry, { kind: "result" }>;
  questions: ReadonlyMap<string, StagePathQuestionInfo>;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const explanation = computed(() => explainCalculation(props.entry.trace));
const effective = computed(() => props.entry.effectiveResult);
const effectiveStage = computed(() =>
  maturityStage(effective.value.stage.stage)
);
const override = computed(() =>
  props.entry.effectiveResult.source === "override"
    ? props.entry.effectiveResult.override
    : null
);

/** Representative rows plus the explicit summarized remainder (AC-029). */
const SHOWN_QUESTION_LIMIT = 5;
const showAllQuestions = ref(false);
const rows = computed(() =>
  explanation.value.summarizeRemainder(
    explanation.value.questions
      .slice(0, SHOWN_QUESTION_LIMIT)
      .map((question) => question.questionId)
  )
);
const visibleQuestions = computed(() =>
  showAllQuestions.value ? explanation.value.questions : rows.value.shown
);
const provisionalMessage = computed(() => {
  const unanswered = explanation.value.coverage.unanswered;
  if (unanswered === 0) {
    const total = explanation.value.coverage.total;
    return `Based on all ${total} question${total === 1 ? "" : "s"}.`;
  }
  return `Provisional. ${unanswered} unanswered question${unanswered === 1 ? "" : "s"} currently contribute${unanswered === 1 ? "s" : ""} 0 points, so this result can still change.`;
});
const stageRange = computed(() => {
  const stage = effective.value.stage.stage;
  const lower = stage === 1 ? 0 : explanation.value.thresholds[stage - 2]!;
  const upper = stage === 5 ? 100 : explanation.value.thresholds[stage - 1]!;
  return stage === 5
    ? `Stage 5 starts at ${lower}% and includes 100%.`
    : `Stage ${stage} spans ${lower}% to under ${upper}%.`;
});

const percentLabel = (ratio: SerializedRatio): string => {
  const numerator = BigInt(ratio.numerator);
  const denominator = BigInt(ratio.denominator);
  const scaledTenths = numerator * 1000n;
  if (scaledTenths % denominator !== 0n) {
    const roundedTenths =
      (2n * scaledTenths + denominator) / (2n * denominator);
    return `about ${roundedTenths / 10n}.${roundedTenths % 10n}%`;
  }

  const exactTenths = scaledTenths / denominator;
  return exactTenths % 10n === 0n
    ? `${exactTenths / 10n}%`
    : `${exactTenths / 10n}.${exactTenths % 10n}%`;
};

const ratioLabel = (ratio: SerializedRatio): string =>
  `${ratio.numerator}/${ratio.denominator} · ${percentLabel(ratio)}`;
const exactPointsLabel = (ratio: SerializedRatio): string =>
  `${ratio.numerator}/${ratio.denominator}`;

const formatPoints = (ratio: SerializedRatio): string => {
  const numerator = BigInt(ratio.numerator);
  const denominator = BigInt(ratio.denominator);
  if (numerator % denominator === 0n) return String(numerator / denominator);

  const roundedHundredths =
    (200n * numerator + denominator) / (2n * denominator);
  return `${roundedHundredths / 100n}.${String(roundedHundredths % 100n).padStart(2, "0")}`;
};

const questionText = (questionId: string) =>
  props.questions.get(questionId)?.text ?? questionId;

const practiceText = (questionId: string, practiceId: string) =>
  props.questions
    .get(questionId)
    ?.practices.find((practice) => practice.id === practiceId)?.text ??
  practiceId;

const exclusionLabel = (question: QuestionTrace): string | null => {
  switch (question.exclusion) {
    case "unanswered":
      return "Unanswered · Not assessed";
    case "question-na":
      return "Not applicable — excluded";
    case "all-practices-na":
      return "All practices not applicable — excluded";
    default:
      return null;
  }
};

const questionStateLabel = (question: QuestionTrace): string => {
  if (question.exclusion === "unanswered") return "Unanswered";
  if (question.exclusion) return "Not applicable";
  if (!question.result) return "Not scored";
  const numerator = BigInt(question.result.numerator);
  const denominator = BigInt(question.result.denominator);
  if (numerator === 0n) return "Not met";
  if (numerator === denominator) return "Fully met";
  return "Partly met";
};

const practiceDetailsLabel = (question: QuestionTrace): string => {
  const count = question.practices?.length ?? 0;
  return `Show ${count} practice detail${count === 1 ? "" : "s"}`;
};

const practiceStateLabel = {
  met: "Met",
  unmet: "Unmet",
  "not-applicable": "Not applicable",
} as const;
</script>

<template>
  <USlideover
    :open="open"
    title="How maturity is calculated"
    side="right"
    :ui="{ content: 'w-full sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-8">
        <p class="text-muted text-[13px]">
          {{ workspace.subject.name }} · {{ workspace.review.name }} ·
          {{ workspace.review.status }}
        </p>

        <section aria-labelledby="maturity-meaning-heading">
          <div
            class="mb-3 h-[3px] w-10 rounded-[2px] bg-[#0284C7] dark:bg-sky-400"
            aria-hidden="true"
          />
          <h3
            id="maturity-meaning-heading"
            class="text-highlighted text-lg font-semibold"
          >
            What this means
          </h3>
          <div class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <strong
              class="text-highlighted text-[32px] leading-none font-extrabold tabular-nums"
            >
              {{ effective.displayPercent }}%
            </strong>
            <span class="text-default text-lg font-semibold">
              Stage {{ effective.stage.stage }} · {{ effective.stage.name }}
            </span>
          </div>
          <p class="text-default mt-2 text-sm">
            {{ effectiveStage.description }}
          </p>
          <p class="text-muted mt-1 text-sm">{{ stageRange }}</p>
          <p
            class="mt-3 text-sm"
            :class="
              explanation.coverage.unanswered > 0
                ? 'dark:text-warning text-[#92400E]'
                : 'text-muted'
            "
          >
            {{ provisionalMessage }}
          </p>
          <p class="text-default mt-4 text-base">
            <span v-if="override" class="font-semibold"
              >Calculated score:
            </span>
            <strong>{{ formatPoints(explanation.earned) }}</strong> earned
            points ÷ <strong>{{ formatPoints(explanation.available) }}</strong>
            available points =
            <strong>{{ percentLabel(explanation.exactResult) }}</strong>
          </p>
          <p
            v-if="explanation.boundaryStraddle"
            class="text-muted mt-3 text-sm"
          >
            The displayed {{ explanation.boundaryStraddle.displayPercent }}%
            appears to cross the pinned
            {{ explanation.boundaryStraddle.boundary }}% boundary, but stage
            resolution uses the exact result ({{
              percentLabel(explanation.exactResult)
            }}), so the stage stays {{ explanation.stage.name }}.
          </p>
        </section>

        <details class="border-default border-b pb-4">
          <summary
            class="text-primary focus-visible:ring-primary inline-flex min-h-11 cursor-pointer items-center rounded-[7px] text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Show exact calculation
          </summary>
          <div class="mt-2 space-y-1 text-[13px]">
            <p class="text-default">
              Exact result:
              <span class="font-mono"
                >{{ explanation.exactResult.numerator }}/{{
                  explanation.exactResult.denominator
                }}</span
              >
              ({{ percentLabel(explanation.exactResult) }})
            </p>
            <p class="text-muted">
              Displayed as {{ explanation.displayPercent }}% · Stage
              {{ explanation.stage.stage }} · {{ explanation.stage.name }}.
            </p>
            <p class="text-muted">
              Stage boundaries:
              {{
                explanation.thresholds
                  .map((boundary) => `${boundary}%`)
                  .join(" · ")
              }}
            </p>
            <p class="text-muted">
              Coverage: {{ explanation.coverage.answered }} of
              {{ explanation.coverage.total }} questions answered.
            </p>
            <p class="text-muted">
              Exact points: {{ exactPointsLabel(explanation.earned) }} earned of
              {{ exactPointsLabel(explanation.available) }} available.
            </p>
            <p class="text-muted">
              Approximate points: {{ formatPoints(explanation.earned) }} of
              {{ formatPoints(explanation.available) }}.
            </p>
          </div>
        </details>

        <section aria-labelledby="maturity-question-impact-heading">
          <h3
            id="maturity-question-impact-heading"
            class="text-highlighted text-lg font-semibold"
          >
            What shaped the score
          </h3>
          <p class="text-muted mt-1 text-sm">
            Severity sets each question's weight. Checklist practices split that
            weight.
          </p>
          <ul class="mt-3">
            <li
              v-for="question in visibleQuestions"
              :key="question.questionId"
              class="border-t border-[#EEF3F8] py-4 dark:border-white/10"
            >
              <div
                class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <p class="text-default min-w-0 text-base font-medium">
                  {{ questionText(question.questionId) }}
                </p>
                <span class="text-muted shrink-0 text-[13px] font-semibold">
                  {{ questionStateLabel(question) }}
                </span>
              </div>
              <p class="text-muted mt-1 text-[13px]">
                Weight {{ question.weight }}
                <template v-if="exclusionLabel(question)">
                  · {{ exclusionLabel(question) }}
                </template>
                <template v-else>
                  · {{ formatPoints(question.earned) }} of
                  {{ formatPoints(question.available) }} points
                </template>
              </p>
              <details v-if="question.practices" class="mt-2">
                <summary
                  class="text-primary focus-visible:ring-primary inline-flex min-h-9 cursor-pointer items-center rounded-[7px] text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {{ practiceDetailsLabel(question) }}
                </summary>
                <ul class="mt-1">
                  <li
                    v-for="practice in question.practices"
                    :key="practice.practiceId"
                    class="text-muted flex min-w-0 flex-col gap-1 border-t border-[#EEF3F8] py-2 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-white/10"
                  >
                    <span class="min-w-0 break-words">
                      {{
                        practiceText(question.questionId, practice.practiceId)
                      }}
                    </span>
                    <span class="shrink-0">
                      {{ practiceStateLabel[practice.state] }} · share
                      {{ ratioLabel(practice.share) }}
                    </span>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
          <div
            v-if="rows.remainder && !showAllQuestions"
            class="border-t border-[#EEF3F8] py-4 dark:border-white/10"
          >
            <UButton
              variant="link"
              color="neutral"
              class="p-0"
              @click="showAllQuestions = true"
            >
              Show all {{ explanation.questions.length }} questions
            </UButton>
            <p class="text-muted mt-1 text-[13px]">
              {{ rows.remainder.count }} more questions contribute
              {{ formatPoints(rows.remainder.earned) }} of
              {{ formatPoints(rows.remainder.available) }} points to the same
              total.
            </p>
          </div>
        </section>

        <section
          v-if="override"
          aria-label="Advisor review"
          class="border-primary/50 border-l-2 py-1 pl-4"
        >
          <h3 class="text-highlighted text-base font-semibold">
            Advisor review
          </h3>
          <p class="text-default mt-2 text-sm">
            Reviewed: {{ entry.effectiveResult.displayPercent }}% · Stage
            {{ entry.effectiveResult.stage.stage }} ·
            {{ entry.effectiveResult.stage.name }}
          </p>
          <p class="text-muted text-sm">
            Calculated: {{ explanation.displayPercent }}% · Stage
            {{ explanation.stage.stage }} · {{ explanation.stage.name }}
          </p>
          <p class="text-muted mt-2 text-[13px]">
            Reviewed by {{ override.actorId }} · {{ override.occurredAt }}
          </p>
          <p class="text-muted mt-1 text-sm">{{ override.explanation }}</p>
          <ul class="mt-2 flex flex-wrap gap-1">
            <li
              v-for="item in override.evidence"
              :key="item"
              class="border-default text-muted rounded-md border px-2 py-0.5 font-mono text-[13px]"
            >
              {{ item }}
            </li>
          </ul>
        </section>
      </div>
    </template>
  </USlideover>
</template>
