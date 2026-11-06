<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type CSSProperties,
} from "vue";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";
import {
  DEFAULT_THRESHOLDS,
  MATURITY_STAGES,
  MIN_STAGE_WIDTH,
  type MaturityStageNumber,
  type StageThresholds,
} from "~/services/maturity/stages";

type BoundaryIndex = 0 | 1 | 2 | 3;

interface Props {
  thresholds: StageThresholds;
  editable: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "commit-boundary": [index: BoundaryIndex, value: number];
  reset: [];
}>();

const BOUNDARY_INDEXES: readonly BoundaryIndex[] = [0, 1, 2, 3];
const BASE_LIMITS: ReadonlyArray<readonly [number, number]> = [
  [5, 30],
  [15, 50],
  [40, 70],
  [65, 90],
];
const STAGE_ACCENT_CLASS: Record<MaturityStageNumber, string> = {
  1: "bg-[#94A3B8] dark:bg-slate-500",
  2: "bg-[#38BDF8] dark:bg-sky-400",
  3: "bg-[#0284C7] dark:bg-sky-500",
  4: "bg-[#0369A1] dark:bg-sky-600",
  5: "bg-[#075985] dark:bg-sky-700",
};
const STAGE_GRID_CLASS: Record<MaturityStageNumber, string> = {
  1: "md:col-start-1",
  2: "md:col-start-2",
  3: "md:col-start-3",
  4: "md:col-start-4",
  5: "md:col-start-5",
};
const EDITOR_ALIGNMENT_CLASS: Record<BoundaryIndex, string> = {
  0: "md:left-[-1rem]",
  1: "md:left-1/2 md:-translate-x-1/2",
  2: "md:left-1/2 md:-translate-x-1/2",
  3: "md:right-[-1rem]",
};
const KEYBOARD_ANNOUNCEMENT_DELAY = 300;

function copyThresholds(
  values: StageThresholds
): [number, number, number, number] {
  return [values[0], values[1], values[2], values[3]];
}

function replaceBoundary(
  thresholds: StageThresholds,
  index: BoundaryIndex,
  value: number
): [number, number, number, number] {
  const next = copyThresholds(thresholds);
  next[index] = value;
  return next;
}

const isOpen = ref(false);
const isNarrow = useMediaQuery("(max-width: 767px)");
const transientThresholds = ref<[number, number, number, number]>(
  copyThresholds(props.thresholds)
);
const editorTexts = ref<[string, string, string, string]>([
  String(props.thresholds[0]),
  String(props.thresholds[1]),
  String(props.thresholds[2]),
  String(props.thresholds[3]),
]);
const selectedBoundary = ref<BoundaryIndex | null>(null);
const draggingBoundary = ref<BoundaryIndex | null>(null);
const dragStartValue = ref<number | null>(null);
const dragBox = ref<DOMRect | null>(null);
const liveMessage = ref("");
const bandRail = ref<HTMLElement | null>(null);
const suppressBlur = [false, false, false, false];
let keyboardAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;

const stages = computed(() =>
  MATURITY_STAGES.map((stage, index) => {
    const lower = index === 0 ? 0 : transientThresholds.value[index - 1]!;
    const upper =
      index === MATURITY_STAGES.length - 1
        ? 100
        : transientThresholds.value[index]!;
    return {
      ...stage,
      range:
        index === MATURITY_STAGES.length - 1
          ? `${lower} to 100%`
          : `${lower} to under ${upper}%`,
    };
  })
);

const scoreBands = computed(() => {
  const points = [0, ...transientThresholds.value, 100];
  return MATURITY_STAGES.map((stage, index) => ({
    stage: stage.stage,
    width: points[index + 1]! - points[index]!,
  }));
});

function legalLimits(
  index: BoundaryIndex,
  values: StageThresholds = transientThresholds.value
) {
  const [baseMin, baseMax] = BASE_LIMITS[index]!;
  return {
    min:
      index === 0
        ? baseMin
        : Math.max(baseMin, values[index - 1]! + MIN_STAGE_WIDTH),
    max:
      index === 3
        ? baseMax
        : Math.min(baseMax, values[index + 1]! - MIN_STAGE_WIDTH),
  };
}

function isLegalValue(
  index: BoundaryIndex,
  value: number,
  values: StageThresholds = transientThresholds.value
) {
  const { min, max } = legalLimits(index, values);
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function parseEditorValue(text: string): number | null {
  const candidate = text.trim();
  if (!/^-?\d+$/.test(candidate)) return null;
  const value = Number(candidate);
  return Number.isSafeInteger(value) ? value : null;
}

function editorIsValid(index: BoundaryIndex) {
  const value = parseEditorValue(editorTexts.value[index]);
  return value !== null && isLegalValue(index, value);
}

const hasInvalidThreshold = computed(() =>
  BOUNDARY_INDEXES.some(
    (index) => !isLegalValue(index, transientThresholds.value[index])
  )
);
const hasInvalidEditor = computed(() =>
  BOUNDARY_INDEXES.some(
    (index) =>
      (isNarrow.value || selectedBoundary.value === index) &&
      !editorIsValid(index)
  )
);
const draggingDisabled = computed(
  () => hasInvalidThreshold.value || hasInvalidEditor.value
);
const usesDefaults = computed(() =>
  BOUNDARY_INDEXES.every(
    (index) => transientThresholds.value[index] === DEFAULT_THRESHOLDS[index]
  )
);

function sliderName(index: BoundaryIndex) {
  const nextStage = MATURITY_STAGES[index + 1]!;
  return `Stage ${nextStage.stage} ${nextStage.name} starts at`;
}

function editorName(index: BoundaryIndex) {
  return `${MATURITY_STAGES[index + 1]!.name} starts at`;
}

function valueText(index: BoundaryIndex) {
  return `${transientThresholds.value[index]} percent. ${MATURITY_STAGES[index + 1]!.name} starts here; ${MATURITY_STAGES[index]!.name} ends below it.`;
}

function boundaryStyle(index: BoundaryIndex): CSSProperties {
  const value = transientThresholds.value[index];
  const { min, max } = legalLimits(index);
  const layoutValue = Math.min(100, Math.max(0, value));
  const thumbPosition = max === min ? 50 : ((value - min) / (max - min)) * 100;
  return {
    "--boundary-position": `${layoutValue / 100}`,
    "--thumb-position": `${thumbPosition}%`,
  } as CSSProperties;
}

function boundaryChip(index: BoundaryIndex) {
  return `${transientThresholds.value[index]}%`;
}

function setEditorText(index: BoundaryIndex, event: Event) {
  const input = event.target as HTMLInputElement;
  const next = [...editorTexts.value] as [string, string, string, string];
  next[index] = input.value;
  editorTexts.value = next;
}

function focusEditor(index: BoundaryIndex) {
  nextTick(() => {
    document.getElementById(`maturity-boundary-input-${index}`)?.focus();
  });
}

function focusSlider(index: BoundaryIndex) {
  nextTick(() => {
    document.getElementById(`maturity-boundary-slider-${index}`)?.focus();
  });
}

function selectBoundary(index: BoundaryIndex) {
  selectedBoundary.value = index;
  const next = [...editorTexts.value] as [string, string, string, string];
  next[index] = String(transientThresholds.value[index]);
  editorTexts.value = next;
}

function adjacentRangeAnnouncement(index: BoundaryIndex, value: number) {
  const previous = index === 0 ? 0 : transientThresholds.value[index - 1]!;
  const next = index === 3 ? 100 : transientThresholds.value[index + 1]!;
  const leftRange = `${previous} to under ${value} percent`;
  const rightRange =
    index === 3
      ? `${value} to 100 percent`
      : `${value} to under ${next} percent`;
  return `${MATURITY_STAGES[index + 1]!.name} now starts at ${value} percent. ${MATURITY_STAGES[index]!.name} is ${leftRange}; ${MATURITY_STAGES[index + 1]!.name} is ${rightRange}.`;
}

function announceBoundary(index: BoundaryIndex, value: number) {
  liveMessage.value = adjacentRangeAnnouncement(index, value);
}

function scheduleBoundaryAnnouncement(index: BoundaryIndex, value: number) {
  if (keyboardAnnouncementTimer) clearTimeout(keyboardAnnouncementTimer);
  liveMessage.value = "";
  keyboardAnnouncementTimer = setTimeout(() => {
    announceBoundary(index, value);
    keyboardAnnouncementTimer = null;
  }, KEYBOARD_ANNOUNCEMENT_DELAY);
}

function commitBoundary(
  index: BoundaryIndex,
  value: number,
  announcement: "immediate" | "keyboard"
) {
  const current = transientThresholds.value[index];
  if (current === value) return;
  transientThresholds.value = replaceBoundary(
    transientThresholds.value,
    index,
    value
  );
  const nextEditorTexts = [...editorTexts.value] as [
    string,
    string,
    string,
    string,
  ];
  nextEditorTexts[index] = String(value);
  editorTexts.value = nextEditorTexts;
  emit("commit-boundary", index, value);
  if (announcement === "keyboard") {
    scheduleBoundaryAnnouncement(index, value);
  } else {
    announceBoundary(index, value);
  }
}

function toggleScoreRanges() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) return;
  draggingBoundary.value = null;
  dragStartValue.value = null;
  selectedBoundary.value = null;
  transientThresholds.value = copyThresholds(props.thresholds);
  editorTexts.value = props.thresholds.map(String) as [
    string,
    string,
    string,
    string,
  ];
}

function resetScoreRanges() {
  if (usesDefaults.value) return;
  draggingBoundary.value = null;
  dragStartValue.value = null;
  transientThresholds.value = copyThresholds(DEFAULT_THRESHOLDS);
  editorTexts.value = DEFAULT_THRESHOLDS.map(String) as [
    string,
    string,
    string,
    string,
  ];
  emit("reset");
  liveMessage.value =
    "Default score ranges restored: 5, 25, 50, and 75 percent.";
}

function onSliderFocus(index: BoundaryIndex) {
  selectBoundary(index);
}

function onSliderPointerDown(index: BoundaryIndex, event: PointerEvent) {
  selectBoundary(index);
  if (!props.editable || draggingDisabled.value) return;
  const slider = event.currentTarget as HTMLElement;
  const targetBox = isNarrow.value
    ? slider.getBoundingClientRect()
    : bandRail.value?.getBoundingClientRect();
  if (!targetBox || targetBox.width <= 0) return;
  event.preventDefault();
  slider.setPointerCapture?.(event.pointerId);
  draggingBoundary.value = index;
  dragStartValue.value = transientThresholds.value[index];
  dragBox.value = targetBox;
}

function onSliderPointerMove(index: BoundaryIndex, event: PointerEvent) {
  if (draggingBoundary.value !== index || !dragBox.value) return;
  const ratio = (event.clientX - dragBox.value.left) / dragBox.value.width;
  const { min, max } = legalLimits(index);
  const rawValue = isNarrow.value ? min + ratio * (max - min) : ratio * 100;
  const value = Math.min(max, Math.max(min, Math.round(rawValue)));
  transientThresholds.value = replaceBoundary(
    transientThresholds.value,
    index,
    value
  );
  const next = [...editorTexts.value] as [string, string, string, string];
  next[index] = String(value);
  editorTexts.value = next;
}

function onSliderPointerUp(index: BoundaryIndex, event: PointerEvent) {
  if (draggingBoundary.value !== index) return;
  const slider = event.currentTarget as HTMLElement;
  if (slider.hasPointerCapture?.(event.pointerId)) {
    slider.releasePointerCapture(event.pointerId);
  } else {
    slider.releasePointerCapture?.(event.pointerId);
  }
  const start = dragStartValue.value;
  const value = transientThresholds.value[index];
  draggingBoundary.value = null;
  dragStartValue.value = null;
  dragBox.value = null;
  if (start === null || start === value) return;
  emit("commit-boundary", index, value);
  announceBoundary(index, value);
}

function onSliderPointerCancel(index: BoundaryIndex, event: PointerEvent) {
  if (draggingBoundary.value !== index) return;
  const slider = event.currentTarget as HTMLElement;
  slider.releasePointerCapture?.(event.pointerId);
  if (dragStartValue.value !== null) {
    transientThresholds.value = replaceBoundary(
      transientThresholds.value,
      index,
      dragStartValue.value
    );
  }
  draggingBoundary.value = null;
  dragStartValue.value = null;
  dragBox.value = null;
}

function onSliderKeydown(index: BoundaryIndex, event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    selectBoundary(index);
    focusEditor(index);
    return;
  }

  const deltaByKey: Partial<Record<string, number>> = {
    ArrowLeft: -1,
    ArrowDown: -1,
    ArrowRight: 1,
    ArrowUp: 1,
    PageDown: -5,
    PageUp: 5,
  };
  const delta = deltaByKey[event.key];
  if (delta === undefined && event.key !== "Home" && event.key !== "End") {
    return;
  }
  event.preventDefault();
  if (!props.editable || draggingDisabled.value) return;

  const { min, max } = legalLimits(index);
  const current = transientThresholds.value[index];
  const requested =
    event.key === "Home" ? min : event.key === "End" ? max : current + delta!;
  const value = Math.min(max, Math.max(min, requested));
  commitBoundary(index, value, "keyboard");
}

function commitEditor(index: BoundaryIndex) {
  const value = parseEditorValue(editorTexts.value[index]);
  if (value === null || !isLegalValue(index, value)) return;
  commitBoundary(index, value, "immediate");
}

function onEditorKeydown(index: BoundaryIndex, event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEditor(index);
    return;
  }
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  suppressBlur[index] = true;
  const next = [...editorTexts.value] as [string, string, string, string];
  next[index] = String(transientThresholds.value[index]);
  editorTexts.value = next;
  focusSlider(index);
}

function onEditorBlur(index: BoundaryIndex) {
  if (suppressBlur[index]) {
    suppressBlur[index] = false;
    return;
  }
  commitEditor(index);
}

watch(
  () => props.thresholds,
  (thresholds) => {
    if (draggingBoundary.value !== null) return;
    transientThresholds.value = copyThresholds(thresholds);
    editorTexts.value = thresholds.map(String) as [
      string,
      string,
      string,
      string,
    ];
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (keyboardAnnouncementTimer) clearTimeout(keyboardAnnouncementTimer);
});
</script>

<template>
  <div data-testid="maturity-score-spectrum" class="mt-6 min-w-0">
    <div
      class="flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-1"
    >
      <div class="flex min-h-11 min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <p class="text-default text-sm font-semibold">Score stages</p>
        <button
          v-if="isOpen"
          type="button"
          class="text-primary hover:text-primary/80 focus-visible:ring-primary min-h-9 rounded-md px-1 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          :disabled="usesDefaults"
          @click="resetScoreRanges"
        >
          Use default ranges
        </button>
      </div>
      <button
        v-if="editable"
        type="button"
        class="text-primary hover:text-primary/80 focus-visible:ring-primary flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        :aria-expanded="isOpen"
        aria-controls="maturity-score-ranges"
        @click="toggleScoreRanges"
      >
        <span>Adjust score ranges</span>
        <Icon
          :name="isOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    </div>

    <div
      data-stage-spectrum
      class="border-default bg-elevated relative rounded-lg border shadow-[0_10px_24px_rgba(15,23,42,.08),0_2px_4px_rgba(15,23,42,.06)] dark:shadow-[0_12px_28px_rgba(0,0,0,.24)]"
    >
      <div
        v-if="isOpen"
        ref="bandRail"
        data-testid="maturity-score-band-rail"
        class="border-default absolute top-[52px] right-4 left-4 hidden h-3 border md:flex"
        aria-hidden="true"
      >
        <span
          v-for="band in scoreBands"
          :key="band.stage"
          data-score-band
          :data-stage="band.stage"
          class="border-default h-full min-w-0 border-l first:border-l-0"
          :class="STAGE_ACCENT_CLASS[band.stage]"
          :style="{ flexBasis: `${band.width}%` }"
        />
      </div>

      <p
        v-if="isOpen && (isNarrow || selectedBoundary === null)"
        class="text-muted px-4 pt-4 text-[13px] md:absolute md:top-[76px] md:left-4 md:z-10 md:p-0"
      >
        Drag a handle. Select it to type an exact percentage.
      </p>

      <ol
        id="maturity-score-ranges"
        class="grid min-w-0 grid-cols-1 md:grid-cols-5"
        :class="isOpen ? 'md:pt-40' : ''"
        aria-label="Score stages and percentage ranges"
      >
        <template v-for="(stage, stageIndex) in stages" :key="stage.stage">
          <li
            class="border-default group/stage relative grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-b px-4 py-6 last:border-b-0 md:row-start-1 md:block md:border-b-0 md:px-4"
            :class="[
              STAGE_GRID_CLASS[stage.stage],
              isOpen ? '' : 'md:not-first:border-l',
            ]"
          >
            <span
              v-if="!isOpen"
              data-stage-accent
              class="absolute inset-x-0 top-0 h-1"
              :class="STAGE_ACCENT_CLASS[stage.stage]"
              aria-hidden="true"
            />
            <span class="sr-only">Stage {{ stage.stage }}.</span>
            <span
              class="text-dimmed flex items-center gap-2 font-mono text-[17px] font-bold tabular-nums md:mb-2"
              aria-hidden="true"
            >
              <span
                v-if="isOpen"
                class="h-1 w-6 rounded-full"
                :class="STAGE_ACCENT_CLASS[stage.stage]"
              />
              {{ String(stage.stage).padStart(2, "0") }}
            </span>
            <div class="min-w-0">
              <MaturityStagePopover
                :stage="stage.stage"
                :thresholds="transientThresholds"
                trigger-class="inline-flex min-h-11 items-center text-[18px] leading-tight"
              >
                <template #trigger>{{ stage.name }}</template>
              </MaturityStagePopover>
              <span
                data-stage-range
                class="text-muted mt-2 block text-base leading-snug tabular-nums"
              >
                {{ stage.range }}
              </span>
            </div>
          </li>

          <li
            v-if="isOpen && stageIndex < 4"
            role="presentation"
            class="boundary-control border-default relative min-w-0 border-b px-4 py-3 md:absolute md:z-10 md:w-11 md:border-0 md:p-0"
            :style="boundaryStyle(stageIndex as BoundaryIndex)"
          >
            <p class="text-default mb-1 text-[13px] font-semibold md:sr-only">
              {{ stages[stageIndex + 1]!.name }} starts at
            </p>
            <button
              :id="`maturity-boundary-slider-${stageIndex}`"
              type="button"
              role="slider"
              tabindex="0"
              class="focus-visible:ring-primary relative block h-11 w-full cursor-ew-resize touch-none rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:w-11"
              :data-selected="
                selectedBoundary === stageIndex ? 'true' : undefined
              "
              :aria-label="sliderName(stageIndex as BoundaryIndex)"
              :aria-valuenow="transientThresholds[stageIndex]"
              :aria-valuemin="legalLimits(stageIndex as BoundaryIndex).min"
              :aria-valuemax="legalLimits(stageIndex as BoundaryIndex).max"
              :aria-valuetext="valueText(stageIndex as BoundaryIndex)"
              :aria-invalid="
                String(
                  !isLegalValue(
                    stageIndex as BoundaryIndex,
                    transientThresholds[stageIndex]!
                  )
                )
              "
              :aria-disabled="draggingDisabled ? 'true' : undefined"
              @focus="onSliderFocus(stageIndex as BoundaryIndex)"
              @pointerdown="
                onSliderPointerDown(stageIndex as BoundaryIndex, $event)
              "
              @pointermove="
                onSliderPointerMove(stageIndex as BoundaryIndex, $event)
              "
              @pointerup="
                onSliderPointerUp(stageIndex as BoundaryIndex, $event)
              "
              @pointercancel="
                onSliderPointerCancel(stageIndex as BoundaryIndex, $event)
              "
              @keydown="onSliderKeydown(stageIndex as BoundaryIndex, $event)"
            >
              <span
                class="text-muted absolute -top-[17px] left-1/2 hidden -translate-x-1/2 font-mono text-[13px] font-bold whitespace-nowrap tabular-nums md:block"
                :class="selectedBoundary === stageIndex ? 'text-primary' : ''"
              >
                {{ boundaryChip(stageIndex as BoundaryIndex) }}
              </span>
              <span
                class="bg-muted absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-md md:hidden"
                aria-hidden="true"
              />
              <span
                v-if="
                  isLegalValue(
                    stageIndex as BoundaryIndex,
                    transientThresholds[stageIndex]!
                  )
                "
                data-slider-thumb
                class="border-default bg-elevated absolute top-1/2 left-[var(--thumb-position)] flex h-8 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border shadow-sm transition-colors md:left-1/2"
                :class="
                  selectedBoundary === stageIndex
                    ? draggingBoundary === stageIndex
                      ? 'border-primary bg-primary/20 ring-primary ring-2'
                      : 'border-primary bg-primary/10 ring-primary/50 ring-2'
                    : ''
                "
                aria-hidden="true"
              >
                <Icon name="lucide:grip-vertical" class="text-muted h-4 w-4" />
              </span>
              <Icon
                v-else
                name="lucide:triangle-alert"
                class="text-error absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
            </button>

            <div
              v-if="isNarrow || selectedBoundary === stageIndex"
              data-stage-start-editor
              class="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:absolute md:top-12 md:z-30 md:mt-0 md:w-64"
              :class="EDITOR_ALIGNMENT_CLASS[stageIndex as BoundaryIndex]"
            >
              <label
                :for="`maturity-boundary-input-${stageIndex}`"
                class="text-default sr-only text-[13px] font-semibold whitespace-nowrap md:not-sr-only"
              >
                {{ stages[stageIndex + 1]!.name }} starts at
              </label>
              <div class="relative w-24">
                <input
                  :id="`maturity-boundary-input-${stageIndex}`"
                  type="text"
                  inputmode="numeric"
                  role="spinbutton"
                  class="border-default bg-muted text-default focus:border-primary focus:ring-primary h-9 w-full rounded-lg border px-2 pr-6 text-right text-sm font-semibold tabular-nums focus:ring-1 focus:outline-none"
                  :value="editorTexts[stageIndex]"
                  :aria-label="editorName(stageIndex as BoundaryIndex)"
                  :aria-valuemin="legalLimits(stageIndex as BoundaryIndex).min"
                  :aria-valuemax="legalLimits(stageIndex as BoundaryIndex).max"
                  :aria-invalid="
                    String(!editorIsValid(stageIndex as BoundaryIndex))
                  "
                  :aria-describedby="`maturity-boundary-help-${stageIndex}`"
                  @input="setEditorText(stageIndex as BoundaryIndex, $event)"
                  @blur="onEditorBlur(stageIndex as BoundaryIndex)"
                  @keydown="
                    onEditorKeydown(stageIndex as BoundaryIndex, $event)
                  "
                />
                <span
                  class="text-dimmed pointer-events-none absolute inset-y-0 right-2 flex items-center text-[13px]"
                  aria-hidden="true"
                  >%</span
                >
              </div>
              <p
                v-if="!editorIsValid(stageIndex as BoundaryIndex)"
                :id="`maturity-boundary-help-${stageIndex}`"
                role="alert"
                class="text-error basis-full text-[13px] leading-snug"
              >
                Choose {{ legalLimits(stageIndex as BoundaryIndex).min }}% to
                {{ legalLimits(stageIndex as BoundaryIndex).max }}% for where
                {{ stages[stageIndex + 1]!.name }} starts.
              </p>
              <p
                v-else
                :id="`maturity-boundary-help-${stageIndex}`"
                class="text-dimmed basis-full text-[13px] leading-snug"
              >
                Allowed {{ legalLimits(stageIndex as BoundaryIndex).min }}–{{
                  legalLimits(stageIndex as BoundaryIndex).max
                }}% · Arrow keys move 1%
              </p>
            </div>
          </li>
        </template>
      </ol>
    </div>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ liveMessage }}
    </p>
  </div>
</template>

<style scoped>
@media (min-width: 768px) {
  .boundary-control {
    top: 30px;
    left: calc(1rem + (100% - 2rem) * var(--boundary-position));
    transform: translateX(-50%);
  }
}
</style>
