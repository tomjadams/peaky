<script setup lang="ts">
import type { TemplateQuestion } from "~/models";
import { useTemplateStudio } from "~/composables/templates/studio/useTemplateStudio";
import {
  bulkAssignPracticeStages,
  setPracticeStage,
  setQuestionStage,
} from "~/services/maturity/authoring";
import {
  MATURITY_STAGES,
  type MaturityStageNumber,
} from "~/services/maturity/stages";

const props = withDefaults(
  defineProps<{
    question: TemplateQuestion;
    mode?: "question" | "bulk" | "practice";
    practiceId?: string;
    practiceText?: string;
    practiceIndex?: number;
    readonly?: boolean;
  }>(),
  {
    mode: "question",
    practiceId: undefined,
    practiceText: undefined,
    practiceIndex: undefined,
    readonly: false,
  }
);

const emit = defineEmits<{
  "placement-change": [message: string];
}>();

const STAGE_ITEMS = [
  [
    { type: "label" as const, label: "Maturity stages", value: 0 },
    ...MATURITY_STAGES.map((stage) => ({
      label: `Stage ${stage.stage} · ${stage.name}`,
      description: stage.description,
      value: stage.stage,
    })),
  ],
];
const PLACEMENT_MENU_UI = {
  content:
    "z-[60] max-h-[24rem] w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]",
  item: "items-start py-2.5 text-[15px]",
  itemLabel: "whitespace-normal leading-snug",
  itemDescription: "mt-0.5 whitespace-normal text-[13px] leading-snug",
};

const { maturityDefinition, withMaturityMutation } = useTemplateStudio();
const announcement = ref("");

const questionStage = computed(
  () =>
    (maturityDefinition.value?.associations.questions[props.question.id] ??
      1) as MaturityStageNumber
);
const practiceStage = computed(() => {
  if (!props.practiceId) return questionStage.value;
  return (maturityDefinition.value?.associations.practices[props.question.id]?.[
    props.practiceId
  ] ?? questionStage.value) as MaturityStageNumber;
});
const bulkStage = computed<MaturityStageNumber | undefined>(() => {
  const practices = props.question.checklistItems ?? [];
  if (practices.length === 0) return undefined;
  const associations =
    maturityDefinition.value?.associations.practices[props.question.id];
  const stages = practices.map(
    (practice) => associations?.[practice.id] ?? questionStage.value
  );
  const first = stages[0];
  return stages.every((stage) => stage === first)
    ? (first as MaturityStageNumber)
    : undefined;
});
const practiceLabel = computed(() => {
  const text = props.practiceText?.trim();
  return text ? text : `practice ${props.practiceIndex ?? 1}`;
});
const placementControlId = computed(() => {
  const suffix =
    props.mode === "practice"
      ? (props.practiceId ?? `practice-${props.practiceIndex ?? 1}`)
      : props.mode;
  return `follow-up-placement-${props.question.id}-${suffix}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  );
});
const stageLabel = (stage: number) => {
  const selected = MATURITY_STAGES.find(
    (candidate) => candidate.stage === stage
  );
  return selected
    ? `Stage ${selected.stage} · ${selected.name}`
    : `Stage ${stage}`;
};

const announcePlacement = (stage: number, bulk = false) => {
  announcement.value = bulk
    ? `Score unchanged. All practices are grouped under ${stageLabel(stage)} in Follow-ups.`
    : `Score unchanged. This item is grouped under ${stageLabel(stage)} in Follow-ups.`;
  emit("placement-change", announcement.value);
};

const onQuestionStage = (stage: number) => {
  const changed = withMaturityMutation((definition, questions) =>
    setQuestionStage(definition, questions, props.question.id, stage)
  );
  if (changed) announcePlacement(stage);
};

const onBulkStage = (stage: number) => {
  const changed = withMaturityMutation((definition, questions) =>
    bulkAssignPracticeStages(definition, questions, props.question.id, stage)
  );
  if (changed) announcePlacement(stage, true);
};

const onPracticeStage = (stage: number) => {
  if (!props.practiceId) return;
  const changed = withMaturityMutation((definition, questions) =>
    setPracticeStage(definition, questions, {
      questionId: props.question.id,
      practiceId: props.practiceId!,
      stage,
    })
  );
  if (changed) announcePlacement(stage);
};
</script>

<template>
  <span class="contents">
    <USelect
      v-if="mode === 'bulk'"
      :id="placementControlId"
      :model-value="bulkStage"
      :items="STAGE_ITEMS"
      :ui="PLACEMENT_MENU_UI"
      value-key="value"
      :disabled="readonly"
      aria-label="Set all Follow-up placements"
      class="h-11 w-52 max-w-full"
      @update:model-value="onBulkStage"
    >
      <template #default>Set all placements</template>
    </USelect>
    <USelect
      v-else-if="mode === 'practice'"
      :id="placementControlId"
      :model-value="practiceStage"
      :items="STAGE_ITEMS"
      :ui="PLACEMENT_MENU_UI"
      value-key="value"
      :disabled="readonly"
      :aria-label="`Follow-up placement for ${practiceLabel}`"
      class="h-11 w-60 max-w-full"
      @update:model-value="onPracticeStage"
    />
    <USelect
      v-else
      :id="placementControlId"
      :model-value="questionStage"
      :items="STAGE_ITEMS"
      :ui="PLACEMENT_MENU_UI"
      value-key="value"
      :disabled="readonly"
      aria-label="Follow-up placement for this question"
      class="h-11 w-full sm:w-72"
      @update:model-value="onQuestionStage"
    />
    <span role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ announcement }}
    </span>
  </span>
</template>
