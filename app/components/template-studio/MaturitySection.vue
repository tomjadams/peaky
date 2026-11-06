<script setup lang="ts">
import MaturityScoreSpectrum from "~/components/template-studio/MaturityScoreSpectrum.vue";
import MaturityScoringReference from "~/components/template-studio/MaturityScoringReference.vue";
import { useTemplateStudio } from "~/composables/templates/studio/useTemplateStudio";
import {
  adjustThreshold,
  resetEqualThresholds,
  setPracticeGuidance,
  setQuestionGuidance,
  setStageGuidance,
  useEqualAllocation,
} from "~/services/maturity/authoring";
import {
  DEFAULT_THRESHOLDS,
  type StageThresholds,
} from "~/services/maturity/stages";

const emit = defineEmits<{
  preview: [];
}>();

const {
  isEditable,
  maturityDefinition,
  maturitySaveIssues,
  setActivePillar,
  setExpandedQuestion,
  template,
  withMaturityMutation,
} = useTemplateStudio();

const thresholds = computed<StageThresholds>(
  () => maturityDefinition.value?.thresholds ?? DEFAULT_THRESHOLDS
);

const customAllocations = computed(() =>
  Object.entries(maturityDefinition.value?.allocations ?? {})
    .filter(([, allocation]) => allocation.mode === "custom")
    .map(([questionId]) => ({
      questionId,
      label:
        template.value?.pillars
          .flatMap((pillar) => pillar.questions)
          .find((question) => question.id === questionId)?.text ?? questionId,
    }))
);

const customAllocationQuestion = (path: string) =>
  /^allocations\.([^.]+)\.shares(?:\.|$)/.exec(path)?.[1];

const onBoundary = (index: 0 | 1 | 2 | 3, value: number) => {
  withMaturityMutation((definition) =>
    adjustThreshold(definition, index, value)
  );
};

const resetScoreRanges = () => {
  withMaturityMutation((definition) => resetEqualThresholds(definition));
};

const useEqualWeighting = (questionId: string) => {
  withMaturityMutation((definition) =>
    useEqualAllocation(definition, questionId)
  );
};

const resetCustomAllocation = (path: string) => {
  const questionId = customAllocationQuestion(path);
  if (questionId) useEqualWeighting(questionId);
};

const clearInvalidGuidance = (path: string) => {
  if (!window.confirm("Remove this invalid hidden guidance from the draft?")) {
    return;
  }
  const stage = /^guidance\.stages\.([^.]+)$/.exec(path)?.[1];
  if (stage) {
    withMaturityMutation((definition) =>
      setStageGuidance(definition, Number(stage), "")
    );
    return;
  }
  const questionId = /^guidance\.questions\.([^.]+)$/.exec(path)?.[1];
  if (questionId) {
    withMaturityMutation((definition) =>
      setQuestionGuidance(definition, questionId, "")
    );
    return;
  }
  const practice = /^guidance\.practices\.([^.]+)\.([^.]+)$/.exec(path);
  if (practice?.[1] && practice[2]) {
    withMaturityMutation((definition) =>
      setPracticeGuidance(definition, practice[1]!, practice[2]!, "")
    );
  }
};

const locateAssociation = (path: string) => {
  const questionId =
    /^associations\.questions\.([^.]+)$/.exec(path)?.[1] ??
    /^associations\.practices\.([^.]+)\./.exec(path)?.[1];
  if (!questionId || !template.value) return;
  const pillar = template.value.pillars.find((candidate) =>
    candidate.questions.some((question) => question.id === questionId)
  );
  if (!pillar) return;
  setActivePillar(pillar.slug);
  setExpandedQuestion(questionId);
};
</script>

<template>
  <section
    aria-labelledby="maturity-section-heading"
    class="mx-auto mb-8 w-full max-w-[80rem]"
    data-testid="maturity-section"
  >
    <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div>
        <span
          class="mb-2 block h-[3px] w-10 rounded-[2px] bg-[#0284C7] dark:bg-sky-400"
          aria-hidden="true"
        />
        <h2
          id="maturity-section-heading"
          class="text-highlighted text-[26px] leading-tight font-extrabold"
        >
          Maturity score
        </h2>
        <p class="text-muted mt-1 text-[15px] leading-relaxed">
          Answers place a review in one of five stages.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <p class="text-muted text-[13px] font-semibold">
          Whole template · all pillars
        </p>
        <button
          type="button"
          class="text-primary hover:text-primary/80 focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          @click="emit('preview')"
        >
          <Icon name="lucide:eye" class="h-4 w-4" aria-hidden="true" />
          Test maturity scoring
        </button>
      </div>
    </div>

    <UAlert
      v-if="customAllocations.length > 0"
      color="warning"
      variant="subtle"
      title="This draft retains custom practice weighting from an earlier version"
      class="mt-5"
    >
      <template #description>
        <ul class="mt-2 space-y-2">
          <li
            v-for="allocation in customAllocations"
            :key="allocation.questionId"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span>
              {{ allocation.label }} still uses its stored custom weighting.
            </span>
            <UButton
              color="warning"
              variant="outline"
              size="sm"
              @click="useEqualWeighting(allocation.questionId)"
            >
              Use equal weighting
            </UButton>
          </li>
        </ul>
      </template>
    </UAlert>

    <UAlert
      v-if="maturitySaveIssues.length > 0"
      color="error"
      variant="subtle"
      title="Maturity settings need attention before this draft can be saved"
      class="mt-5"
    >
      <template #description>
        <ul class="mt-2 space-y-2">
          <li
            v-for="issue in maturitySaveIssues"
            :key="`${issue.path}:${issue.message}`"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span>{{ issue.message }}</span>
            <UButton
              v-if="customAllocationQuestion(issue.path)"
              color="error"
              variant="link"
              size="sm"
              @click="resetCustomAllocation(issue.path)"
            >
              Use equal weighting
            </UButton>
            <UButton
              v-else-if="issue.path.startsWith('guidance.')"
              color="error"
              variant="link"
              size="sm"
              @click="clearInvalidGuidance(issue.path)"
            >
              Remove invalid guidance
            </UButton>
            <UButton
              v-else-if="issue.code === 'association-missing'"
              color="error"
              variant="link"
              size="sm"
              @click="locateAssociation(issue.path)"
            >
              Go to question
            </UButton>
          </li>
        </ul>
      </template>
    </UAlert>

    <MaturityScoreSpectrum
      :thresholds="thresholds"
      :editable="isEditable"
      @commit-boundary="onBoundary"
      @reset="resetScoreRanges"
    />
    <MaturityScoringReference />
  </section>
</template>
