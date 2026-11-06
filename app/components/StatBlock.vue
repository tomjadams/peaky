<template>
  <div
    ref="rootRef"
    class="stat-block"
    :class="{ 'stat-block--armed': armed, 'stat-block--in': revealed }"
    :style="{ '--stat-block-delay': `${revealIndex * 120}ms` }"
  >
    <p class="text-muted text-[15px] font-medium">{{ label }}</p>

    <p class="mt-1 inline-flex items-baseline gap-1">
      <span
        class="text-[32px] leading-none font-extrabold tabular-nums min-[1920px]:text-[40px]"
        :class="tone === 'attention' ? 'text-warning' : 'text-highlighted'"
      >
        {{ value }}
      </span>
      <span
        v-if="valueSuffix"
        class="text-muted text-[18px] leading-none font-medium"
      >
        {{ valueSuffix }}
      </span>
    </p>

    <p
      v-if="subLabel"
      class="text-muted mt-1 flex items-center gap-1.5 text-sm"
    >
      <span
        v-if="tone === 'attention'"
        class="bg-warning h-1.5 w-1.5 shrink-0 rounded-full"
        aria-hidden="true"
      />
      {{ subLabel }}
    </p>

    <!-- Route motif: dotted remaining distance + solid drawn progress +
         waypoint (or a success ring once the destination is reached). -->
    <div
      v-if="clampedProgress !== undefined"
      class="route-progress mt-3"
      :class="{
        'route-progress--armed': armed,
        'route-progress--in': revealed,
      }"
      :style="{ '--route-final-offset': routeFinalOffset }"
      role="progressbar"
      :aria-valuenow="clampedProgress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${clampedProgress}% complete`"
    >
      <svg
        viewBox="0 0 200 10"
        width="200"
        height="10"
        class="h-auto w-full max-w-[200px]"
        aria-hidden="true"
      >
        <line
          x1="3"
          y1="5"
          x2="197"
          y2="5"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="1 4.5"
          class="stroke-default dark:stroke-slate-600"
        />
        <line
          x1="3"
          y1="5"
          x2="197"
          y2="5"
          stroke-width="2.5"
          stroke-linecap="round"
          pathLength="100"
          stroke-dasharray="100"
          class="route-progress-fill stroke-primary-600 dark:stroke-primary-400"
        />
        <circle
          v-if="clampedProgress < 100"
          :cx="waypointX"
          cy="5"
          r="2.75"
          class="route-progress-marker fill-primary-600 dark:fill-primary-400"
        />
        <circle
          v-else
          cx="197"
          cy="5"
          r="4"
          fill="none"
          stroke-width="1.75"
          class="route-progress-marker stroke-success"
        />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  tone?: "default" | "attention";
  subLabel?: string;
  progress?: number;
  /** Renders as ` / {denominator}` next to the numeral, e.g. "18 / 24". */
  denominator?: string | number;
  /** Renders next to the numeral, e.g. "%". Ignored when denominator is set. */
  unit?: string;
  /** Position within a StatStrip — drives the reveal stagger (index * 120ms). */
  revealIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  tone: "default",
  subLabel: undefined,
  progress: undefined,
  denominator: undefined,
  unit: undefined,
  revealIndex: 0,
});

const rootRef = ref<HTMLElement | null>(null);

// Hidden entrance state only arms after mount, so SSR/no-JS and the
// pre-hydration frame always render the fully-settled block.
const armed = ref(false);
const revealed = useRevealOnce(rootRef);

onMounted(() => {
  armed.value = true;
});

const clampedProgress = computed(() =>
  props.progress === undefined
    ? undefined
    : Math.min(100, Math.max(0, props.progress))
);

const routeFinalOffset = computed(() =>
  clampedProgress.value === undefined ? 100 : 100 - clampedProgress.value
);

const waypointX = computed(() => {
  if (clampedProgress.value === undefined) return 3;
  return 3 + (194 * clampedProgress.value) / 100;
});

const valueSuffix = computed(() => {
  if (props.denominator !== undefined && props.denominator !== null) {
    return `/ ${props.denominator}`;
  }
  return props.unit || null;
});
</script>

<style scoped>
.stat-block--armed {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(5px);
}

.stat-block--armed.stat-block--in {
  animation: stat-block-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--stat-block-delay, 0ms);
}

@keyframes stat-block-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

/* Route fill: SSR/no-JS render at the final drawn length; JS arms it hidden
   and draws it in once the block is revealed (mirrors LandingRouteMap). */
.route-progress--armed:not(.route-progress--in) .route-progress-fill {
  stroke-dashoffset: 100;
}

.route-progress--armed.route-progress--in .route-progress-fill {
  animation: route-progress-draw 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes route-progress-draw {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: var(--route-final-offset);
  }
}

.route-progress-fill {
  stroke-dashoffset: var(--route-final-offset);
  transform-box: fill-box;
}

.route-progress-marker {
  transform-box: fill-box;
  transform-origin: center;
}

.route-progress--armed:not(.route-progress--in) .route-progress-marker {
  opacity: 0;
  transform: scale(0.6);
}

.route-progress--armed.route-progress--in .route-progress-marker {
  animation: route-progress-marker-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 500ms
    both;
}

@keyframes route-progress-marker-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stat-block--armed,
  .stat-block--armed.stat-block--in {
    opacity: 1;
    transform: none;
    filter: none;
    animation: none;
  }

  .route-progress--armed:not(.route-progress--in) .route-progress-fill,
  .route-progress--armed.route-progress--in .route-progress-fill {
    stroke-dashoffset: var(--route-final-offset);
    animation: none;
  }

  .route-progress--armed:not(.route-progress--in) .route-progress-marker,
  .route-progress--armed.route-progress--in .route-progress-marker {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
