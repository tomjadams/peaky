<script setup lang="ts">
/**
 * Interactive five-stage maturity path (maturity-score/REQ-013, REQ-014;
 * AC-036 through AC-038, AC-057 through AC-059).
 *
 * Selecting a stage reveals its associated practices: met/unmet state for
 * earlier stages, unmet gaps for the current stage, and non-prescriptive
 * guidance for future stages. The revealed content is announced through a
 * live region and receives focus (AC-059). Practice filters are scoped to
 * this one Revision with a visible count; a stage change that invalidates
 * the state filter resets it and announces the reset (AC-058).
 */
import type { RouteLocationRaw } from "vue-router";
import type { CalculationTrace } from "~/services/maturity/calculate";
import type { MaturityDefinition } from "~/services/maturity/definition";
import {
  MATURITY_STAGES,
  type MaturityStageNumber,
} from "~/services/maturity/stages";
import {
  buildStagePanel,
  describeStagePanel,
  filterStagePractices,
  isStateFilterApplicable,
  stagePillarOptions,
  type PracticeStateFilter,
  type StagePathQuestionInfo,
  type StagePracticeState,
} from "~/services/maturity/stagePath";

interface Props {
  definition: MaturityDefinition;
  trace: CalculationTrace;
  /** Effective stage from the workspace entry — never recalculated here. */
  currentStage: MaturityStageNumber;
  /** AC-056: below full coverage the current stage is qualified provisional. */
  provisional: boolean;
  questions: ReadonlyMap<string, StagePathQuestionInfo>;
  linkFor: (questionId: string) => RouteLocationRaw;
}

const props = defineProps<Props>();

const selectedStage = ref<MaturityStageNumber>(props.currentStage);
const pillarFilter = ref("all");
const stateFilter = ref<PracticeStateFilter>("all");
const announcement = ref("");
const panelElement = ref<HTMLElement>();

const panel = computed(() =>
  buildStagePanel({
    stage: selectedStage.value,
    currentStage: props.currentStage,
    definition: props.definition,
    trace: props.trace,
    questions: props.questions,
  })
);

const pillarOptions = computed(() => [
  { label: "All pillars", value: "all" },
  ...stagePillarOptions(panel.value.practices),
]);

const stateOptions: { label: string; value: PracticeStateFilter }[] = [
  { label: "All states", value: "all" },
  { label: "Met", value: "met" },
  { label: "Unmet", value: "unmet" },
];

const filteredPractices = computed(() =>
  filterStagePractices(panel.value.practices, {
    pillarId: pillarFilter.value,
    state: stateFilter.value,
  })
);

const selectStage = (stage: MaturityStageNumber) => {
  selectedStage.value = stage;
  let message = describeStagePanel(panel.value);
  // AC-058: a stage change that invalidates the state filter resets it and
  // announces the reset.
  if (!isStateFilterApplicable(panel.value.kind, stateFilter.value)) {
    const label = stateFilter.value === "met" ? "Met" : "Unmet";
    stateFilter.value = "all";
    message = `${message} ${label} filter reset because it does not apply to the selected stage.`;
  }
  announcement.value = message;
  nextTick(() => panelElement.value?.focus());
};

const clearFilters = () => {
  pillarFilter.value = "all";
  stateFilter.value = "all";
};

const statePresentation: Record<
  StagePracticeState,
  { label: string; color: "success" | "neutral" }
> = {
  met: { label: "Met", color: "success" },
  unmet: { label: "Unmet", color: "neutral" },
  "not-applicable": { label: "Not applicable", color: "neutral" },
  unknown: { label: "Not assessed", color: "neutral" },
};
</script>

<template>
  <div class="maturity-stage-path">
    <p role="status" aria-live="polite" class="sr-only">{{ announcement }}</p>

    <ol
      class="maturity-stage-path__stages flex flex-wrap gap-2"
      aria-label="Maturity stages"
    >
      <li
        v-for="stage in MATURITY_STAGES"
        :key="stage.stage"
        class="min-w-28 flex-1"
      >
        <button
          type="button"
          :aria-pressed="selectedStage === stage.stage"
          class="focus-visible:ring-primary flex h-full w-full flex-col gap-1 border-b-2 px-2 py-3 text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
          :class="
            selectedStage === stage.stage
              ? 'border-primary bg-primary/5'
              : 'border-default hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
          "
          @click="selectStage(stage.stage)"
        >
          <span class="text-muted text-[13px] font-semibold">
            Stage {{ stage.stage }}
          </span>
          <span class="text-default text-sm font-semibold">
            {{ stage.name }}
          </span>
          <span
            v-if="stage.stage === currentStage"
            class="mt-1 inline-flex flex-wrap items-center gap-1"
          >
            <UBadge color="primary" variant="subtle" size="sm">
              Score result
            </UBadge>
            <UBadge
              v-if="provisional"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              Provisional
            </UBadge>
          </span>
        </button>
      </li>
    </ol>

    <section
      ref="panelElement"
      tabindex="-1"
      role="region"
      :aria-label="`Stage ${panel.stage} ${panel.name}`"
      class="border-primary/50 focus-visible:ring-primary mt-4 border-l-2 py-1 pl-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      <p class="text-muted text-sm">{{ panel.description }}</p>
      <p v-if="panel.kind === 'future'" class="text-muted mt-1 text-[13px]">
        A future stage is guidance, not a required target.
      </p>
      <p
        v-if="panel.kind === 'future' && panel.stageGuidance"
        class="text-muted mt-2 text-sm"
      >
        {{ panel.stageGuidance }}
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <USelect
          v-model="pillarFilter"
          :items="pillarOptions"
          aria-label="Filter by pillar"
          size="sm"
          class="w-44 max-w-full"
        />
        <USelect
          v-if="panel.kind !== 'future'"
          v-model="stateFilter"
          :items="stateOptions"
          aria-label="Filter by state"
          size="sm"
          class="w-36 max-w-full"
        />
        <span class="text-muted text-[13px]">
          Showing {{ filteredPractices.length }} of
          {{ panel.practices.length }} practices
        </span>
      </div>

      <div
        v-if="filteredPractices.length === 0"
        class="border-default mt-3 flex flex-col items-start gap-2 border-t py-4"
      >
        <p class="text-muted text-sm">No practices match the active filters.</p>
        <UButton variant="ghost" size="sm" @click="clearFilters">
          Clear filters
        </UButton>
      </div>

      <ul v-else class="mt-3">
        <li
          v-for="practice in filteredPractices"
          :key="`${practice.questionId}:${practice.practiceId}`"
          class="border-default flex min-w-0 flex-col items-start gap-2 border-t py-3 md:flex-row md:justify-between md:gap-4"
        >
          <div class="min-w-0">
            <NuxtLink
              :to="linkFor(practice.questionId)"
              class="text-primary text-base font-medium break-words hover:underline"
            >
              {{ practice.practiceText }}
            </NuxtLink>
            <p
              v-if="practice.practiceText !== practice.questionText"
              class="text-muted mt-0.5 text-[13px]"
            >
              {{ practice.pillarName }} · {{ practice.questionText }}
            </p>
            <p v-else class="text-muted mt-0.5 text-[13px]">
              {{ practice.pillarName }}
            </p>
            <p v-if="practice.guidance" class="text-muted mt-1 text-[13px]">
              {{ practice.guidance }}
            </p>
          </div>
          <UBadge
            v-if="panel.kind !== 'future'"
            :color="statePresentation[practice.state].color"
            variant="subtle"
            size="sm"
          >
            {{ statePresentation[practice.state].label }}
          </UBadge>
        </li>
      </ul>
    </section>
  </div>
</template>
