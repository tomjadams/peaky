<script setup lang="ts">
import { computed } from "vue";
import { useExclusiveHoverOverlay } from "~/composables/useExclusiveHoverOverlay";
import {
  maturityStage,
  type MaturityStageNumber,
  type StageThresholds,
} from "~/services/maturity/stages";

interface Props {
  stage: MaturityStageNumber;
  thresholds: StageThresholds;
  percent?: number | null;
  displayPercent?: number | null;
  previewPercent?: number | null;
  previewFromDisplayPercent?: number | null;
  previewDisplayPercent?: number | null;
  previewStage?: MaturityStageNumber | null;
  triggerClass?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

const props = withDefaults(defineProps<Props>(), {
  percent: null,
  displayPercent: null,
  previewPercent: null,
  previewFromDisplayPercent: null,
  previewDisplayPercent: null,
  previewStage: null,
  triggerClass: "",
  side: "bottom",
  align: "start",
});
const {
  isOpen,
  handleTriggerEnter,
  handleTriggerLeave,
  handleFocus,
  handleBlur,
  handleClick,
  handleEscape,
  handleOpenChange,
} = useExclusiveHoverOverlay();

const stageDefinition = computed(() => maturityStage(props.stage));
const scoreBoundaries = computed(() => [0, ...props.thresholds, 100]);
const scoreBands = computed(() =>
  scoreBoundaries.value.slice(1).map((upper, index) => ({
    stage: (index + 1) as MaturityStageNumber,
    lower: scoreBoundaries.value[index]!,
    upper,
  }))
);
const currentBand = computed(() => scoreBands.value[props.stage - 1]!);
const nextStage = computed(() =>
  props.stage === 5
    ? null
    : maturityStage((props.stage + 1) as MaturityStageNumber)
);
const hasPercent = computed(
  () => props.percent !== null && props.percent !== undefined
);
const visiblePercent = computed(() =>
  hasPercent.value ? (props.displayPercent ?? Math.round(props.percent!)) : null
);
const previewFromPercent = computed(
  () => props.previewFromDisplayPercent ?? visiblePercent.value
);
const showRoundingNote = computed(
  () =>
    hasPercent.value &&
    props.displayPercent !== null &&
    props.displayPercent !== undefined &&
    props.displayPercent !== props.percent
);
const stageRange = computed(() =>
  props.stage === 5
    ? `${currentBand.value.lower} to 100%`
    : `${currentBand.value.lower} to under ${currentBand.value.upper}%`
);
const stageGridColumns = computed(() =>
  scoreBands.value.map((band) => `${band.upper - band.lower}fr`).join(" ")
);
const bandFills = computed<(number | null)[]>(() =>
  scoreBands.value.map((band) => {
    if (!hasPercent.value) return band.stage === props.stage ? 100 : null;
    if (band.stage < props.stage) return 100;
    if (band.stage > props.stage) return null;

    const bandWidth = band.upper - band.lower;
    const withinBand = ((props.percent! - band.lower) / bandWidth) * 100;
    return Math.min(100, Math.max(0, withinBand));
  })
);
const hasPreview = computed(
  () =>
    props.previewPercent !== null &&
    props.previewPercent !== undefined &&
    props.previewDisplayPercent !== null &&
    props.previewDisplayPercent !== undefined &&
    props.previewStage !== null &&
    props.previewStage !== undefined &&
    props.previewPercent > (props.percent ?? -1)
);
const previewStageDefinition = computed(() =>
  hasPreview.value ? maturityStage(props.previewStage!) : null
);
const scoreBandsLabel = computed(() => {
  const current = hasPercent.value
    ? `Five proportional score bands. ${visiblePercent.value}% is in Stage ${props.stage}, ${stageDefinition.value.name}.`
    : `Five proportional score bands. Stage ${props.stage}, ${stageDefinition.value.name}, spans ${stageRange.value}.`;
  return hasPreview.value
    ? `${current} Completing the selected handoff practices would preview ${props.previewDisplayPercent}% in Stage ${props.previewStage}, ${previewStageDefinition.value!.name}.`
    : current;
});
</script>

<template>
  <UPopover
    :open="isOpen"
    :content="{
      side: props.side,
      align: props.align,
      sideOffset: 8,
      collisionPadding: 16,
    }"
    :ui="{
      content:
        'pointer-events-none z-[70] bg-transparent p-0 shadow-none ring-0 data-[state=open]:animate-none data-[state=closed]:hidden',
    }"
    @update:open="handleOpenChange"
  >
    <button
      type="button"
      :class="[
        'text-default hover:text-primary focus-visible:ring-primary max-w-full rounded-md text-left font-semibold underline decoration-[#CBD5E1] decoration-dotted underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:decoration-slate-600',
        triggerClass,
      ]"
      :aria-label="`About Stage ${stage}, ${stageDefinition.name}`"
      @mouseenter="handleTriggerEnter"
      @pointermove="handleTriggerEnter"
      @mouseleave="handleTriggerLeave"
      @focus="handleFocus"
      @blur="handleBlur"
      @click="handleClick"
      @keydown.esc.prevent.stop="handleEscape"
    >
      <slot name="trigger">Stage {{ stage }} · {{ stageDefinition.name }}</slot>
    </button>

    <template #content>
      <div
        class="border-default bg-elevated pointer-events-none w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-lg border p-5 shadow-[0_8px_24px_rgba(15,23,42,.10)] dark:border-slate-700"
      >
        <span
          class="mb-3 block h-[3px] w-10 rounded-[2px] bg-[#0284C7] dark:bg-sky-400"
          aria-hidden="true"
        />

        <span class="flex items-start gap-4">
          <span
            class="font-mono text-[36px] leading-none font-extrabold text-[#0284C7] tabular-nums dark:text-sky-400"
            aria-hidden="true"
          >
            {{ String(stage).padStart(2, "0") }}
          </span>
          <span class="min-w-0">
            <strong class="text-highlighted block text-base font-bold">
              Stage {{ stage }} · {{ stageDefinition.name }}
            </strong>
            <span class="text-muted mt-1 block text-sm leading-relaxed">
              {{ stageDefinition.description }}
            </span>
          </span>
        </span>

        <span
          data-testid="maturity-stage-score-bands"
          class="mt-5 grid items-center gap-1"
          :style="{ gridTemplateColumns: stageGridColumns }"
          role="img"
          :aria-label="scoreBandsLabel"
        >
          <span
            v-for="(band, index) in scoreBands"
            :key="band.stage"
            data-stage-band
            :data-stage="band.stage"
            :aria-current="band.stage === stage ? 'true' : undefined"
            :class="[
              'bg-muted relative h-2 min-w-[2px]',
              band.stage === stage
                ? 'outline-primary outline outline-2 outline-offset-1'
                : '',
            ]"
          >
            <span
              v-if="bandFills[index] !== null"
              data-stage-fill
              class="absolute inset-y-0 left-0 bg-[#0284C7] dark:bg-sky-400"
              :style="{ width: `${bandFills[index]}%` }"
            />
          </span>
        </span>

        <span v-if="hasPreview" class="mt-4 block">
          <span
            class="flex items-center justify-between gap-3 text-[13px] font-semibold"
          >
            <span class="text-muted tabular-nums">
              Current {{ previewFromPercent }}%
            </span>
            <span class="text-success text-right tabular-nums">
              If completed {{ previewDisplayPercent }}%
            </span>
          </span>
          <span
            class="bg-muted relative mt-2 block h-2 overflow-hidden rounded-[2px]"
            role="img"
            :aria-label="`Current maturity ${previewFromPercent} percent. Completing the handoff previews ${previewDisplayPercent} percent.`"
          >
            <span
              data-current-fill
              class="absolute inset-y-0 left-0 bg-[#0284C7] dark:bg-sky-400"
              :style="{ width: `${props.percent}%` }"
            />
            <span
              data-preview-fill
              class="bg-success/75 absolute inset-y-0 min-w-0.5"
              :style="{
                left: `${props.percent}%`,
                width: `${Math.max(0, props.previewPercent! - props.percent!)}%`,
              }"
            />
          </span>
        </span>

        <span
          class="mt-3 flex items-start justify-between gap-4 text-[13px] leading-snug"
        >
          <strong class="text-default font-semibold tabular-nums">
            <template v-if="hasPercent">{{ visiblePercent }}% now</template>
            <template v-else>{{ stageRange }}</template>
          </strong>
          <span v-if="nextStage" class="text-muted text-right">
            Next: Stage {{ nextStage.stage }} · {{ nextStage.name }} at
            {{ currentBand.upper }}%
          </span>
          <span v-else class="text-muted">Top stage</span>
        </span>

        <span
          v-if="showRoundingNote"
          class="text-dimmed mt-3 block text-[13px] leading-snug"
        >
          Peaky uses the exact score to choose the stage. The percentage shown
          here is rounded to the nearest whole number.
        </span>
      </div>
    </template>
  </UPopover>
</template>
