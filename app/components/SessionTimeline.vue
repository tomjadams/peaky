<template>
  <div ref="containerRef" class="session-timeline group/timeline">
    <!-- SVG Progress Graph -->
    <div class="relative mb-4 h-40 overflow-visible">
      <svg class="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        <g class="opacity-20">
          <line
            v-for="i in 3"
            :key="`grid-${i}`"
            :x1="paddingLeft"
            :y1="paddingTop + ((i - 1) * chartHeight) / 2"
            :x2="containerWidth - paddingRight"
            :y2="paddingTop + ((i - 1) * chartHeight) / 2"
            stroke="currentColor"
            stroke-width="1"
            stroke-dasharray="4 4"
            class="text-slate-400 dark:text-slate-600"
          />
        </g>

        <!-- Area fill under curve — a flat Index-sky tint, no gradient wash -->
        <path
          :d="areaPath"
          class="fill-[#0284C7]/[0.06] transition-all duration-500 dark:fill-sky-400/10"
        />

        <!-- Progress line — Index sky, drawn flat (violet is retired) -->
        <path
          :d="linePath"
          fill="none"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-[#0284C7] transition-all duration-500 dark:stroke-sky-400"
        />

        <!-- Interactive nodes -->
        <g
          v-for="(point, index) in dataPoints"
          :key="point.session.id"
          class="cursor-pointer"
          @click="emit('select', point.session)"
          @mouseenter="hoveredIndex = index"
          @mouseleave="hoveredIndex = null"
        >
          <!-- Hover area (larger hit target) -->
          <circle :cx="point.x" :cy="point.y" r="24" fill="transparent" />

          <!-- Halo for hovered/selected -->
          <circle
            v-if="hoveredIndex === index || selectedId === point.session.id"
            :cx="point.x"
            :cy="point.y"
            r="16"
            class="fill-[#0284C7]/15 transition-all duration-200 dark:fill-sky-400/20"
          />

          <!-- Node circle -->
          <circle
            :cx="point.x"
            :cy="point.y"
            :r="
              hoveredIndex === index || selectedId === point.session.id ? 10 : 8
            "
            class="transition-all duration-200"
            :class="nodeClass(point.session, index)"
            stroke-width="3"
          />

          <!-- Inner dot for non-latest -->
          <circle
            v-if="index !== sessions.length - 1"
            :cx="point.x"
            :cy="point.y"
            r="3"
            class="pointer-events-none"
            :class="
              selectedId === point.session.id
                ? 'fill-white dark:fill-slate-900'
                : 'fill-[#0284C7] dark:fill-sky-400'
            "
          />

          <!-- Check icon for latest -->
          <g
            v-if="index === sessions.length - 1"
            :transform="`translate(${point.x - 5}, ${point.y - 5})`"
          >
            <path
              d="M2 5L4.5 7.5L8 3"
              fill="none"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="stroke-white dark:stroke-slate-900"
            />
          </g>

          <!-- Date label below node -->
          <text
            :x="point.x"
            :y="point.y + 28"
            text-anchor="middle"
            class="fill-slate-500 text-[11px] font-medium dark:fill-slate-400"
          >
            {{ formatShortDate(point.session.createdAt) }}
          </text>
        </g>

        <!-- Y-axis labels -->
        <text
          :x="paddingLeft - 8"
          :y="paddingTop + 4"
          text-anchor="end"
          class="fill-slate-400 text-[10px]"
        >
          100%
        </text>
        <text
          :x="paddingLeft - 8"
          :y="paddingTop + chartHeight / 2 + 4"
          text-anchor="end"
          class="fill-slate-400 text-[10px]"
        >
          50%
        </text>
        <text
          :x="paddingLeft - 8"
          :y="paddingTop + chartHeight + 4"
          text-anchor="end"
          class="fill-slate-400 text-[10px]"
        >
          0%
        </text>
      </svg>

      <!-- Floating tooltip (positioned based on node location) -->
      <Transition name="tooltip-fade">
        <div
          v-if="hoveredIndex !== null && dataPoints[hoveredIndex]"
          class="pointer-events-none absolute z-30"
          :style="{
            left: `${dataPoints[hoveredIndex]!.x}px`,
            top: `${dataPoints[hoveredIndex]!.y - 16}px`,
            transform: 'translate(-50%, -100%)',
          }"
        >
          <div
            class="rounded-lg bg-slate-900 px-3 py-2 text-center shadow-xl dark:bg-slate-700"
          >
            <div class="text-xs font-semibold text-white">
              {{ dataPoints[hoveredIndex]?.session.snapshot.overallProgress }}%
              complete
            </div>
            <div class="mt-0.5 text-[11px] text-slate-300">
              {{
                formatFullDate(
                  dataPoints[hoveredIndex]?.session.createdAt || ""
                )
              }}
            </div>
            <div
              v-if="
                (dataPoints[hoveredIndex]?.session.delta.questionsAnswered ||
                  0) > 0
              "
              class="text-success mt-1 text-xs font-semibold"
            >
              +{{ dataPoints[hoveredIndex]?.session.delta.questionsAnswered }}
              answers
            </div>
          </div>
          <div
            class="mx-auto h-0 w-0 border-x-6 border-t-6 border-x-transparent border-t-slate-900 dark:border-t-slate-700"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssessmentSession } from "~/models";
import { formatShortDate, formatDate as formatFullDate } from "~/utils/date";

const props = defineProps<{
  sessions: AssessmentSession[];
  selectedId?: string;
}>();

const emit = defineEmits<{
  select: [session: AssessmentSession];
}>();

const containerRef = ref<HTMLElement | null>(null);
const hoveredIndex = ref<number | null>(null);
const containerWidth = ref(800);

// Chart dimensions
const paddingLeft = 50;
const paddingRight = 30;
const paddingTop = 20;
const chartHeight = 80;

// Update container width on mount and resize
onMounted(() => {
  updateContainerWidth();
  window.addEventListener("resize", updateContainerWidth);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateContainerWidth);
});

const updateContainerWidth = () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.offsetWidth;
  }
};

const dataPoints = computed(() => {
  if (props.sessions.length === 0) return [];

  const usableWidth = containerWidth.value - paddingLeft - paddingRight;

  return props.sessions.map((session, index) => {
    const x =
      props.sessions.length === 1
        ? containerWidth.value / 2
        : paddingLeft + (index / (props.sessions.length - 1)) * usableWidth;
    const y =
      paddingTop +
      chartHeight -
      (session.snapshot.overallProgress / 100) * chartHeight;
    return { x, y, session };
  });
});

const linePath = computed(() => {
  if (dataPoints.value.length === 0) return "";
  if (dataPoints.value.length === 1) {
    const p = dataPoints.value[0]!;
    return `M ${p.x} ${p.y}`;
  }

  let path = `M ${dataPoints.value[0]!.x} ${dataPoints.value[0]!.y}`;

  for (let i = 1; i < dataPoints.value.length; i++) {
    const prev = dataPoints.value[i - 1]!;
    const curr = dataPoints.value[i]!;
    const cpx = (prev.x + curr.x) / 2;
    path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  return path;
});

const areaPath = computed(() => {
  if (dataPoints.value.length === 0) return "";

  const baseline = paddingTop + chartHeight;
  let path = linePath.value;
  const lastPoint = dataPoints.value[dataPoints.value.length - 1]!;
  const firstPoint = dataPoints.value[0]!;

  path += ` L ${lastPoint.x} ${baseline}`;
  path += ` L ${firstPoint.x} ${baseline}`;
  path += " Z";

  return path;
});

// Filled Index-sky node for the selected/latest checkpoint, hollow for the
// rest — same vocabulary as the route-map waypoints.
const nodeClass = (session: AssessmentSession, index: number): string => {
  if (props.selectedId === session.id || index === props.sessions.length - 1)
    return "fill-[#0284C7] stroke-[#0369A1] dark:fill-sky-400 dark:stroke-sky-300";
  return "fill-white stroke-[#0284C7] dark:fill-slate-900 dark:stroke-sky-400";
};
</script>

<style scoped>
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: all 0.15s ease-out;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -90%);
}
</style>
