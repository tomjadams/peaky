<template>
  <svg
    width="340"
    height="340"
    viewBox="0 0 340 340"
    fill="none"
    aria-hidden="true"
    :class="{ armed }"
  >
    <circle
      cx="170"
      cy="170"
      r="134"
      class="stroke-[#e4eef6] dark:stroke-slate-800"
      stroke-width="1"
    />
    <circle
      cx="170"
      cy="170"
      r="124"
      class="compass-track stroke-[#dde6ee] dark:stroke-slate-700"
      stroke-width="1.5"
      stroke-dasharray="2.2 30.26"
    />
    <path
      d="M170 40 V58 M170 282 V300 M300 170 H282 M40 170 H58"
      class="stroke-slate-400 dark:stroke-slate-500"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M261.9 78.1 L249.2 90.8 M78.1 78.1 L90.8 90.8 M261.9 261.9 L249.2 249.2 M78.1 261.9 L90.8 249.2"
      class="stroke-slate-300 dark:stroke-slate-600"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <g class="compass-needle">
      <polygon
        points="237.9,102.1 176.4,176.4 163.6,163.6"
        class="fill-sky-600 dark:fill-sky-500"
      />
      <polygon
        points="137.5,202.5 176.4,176.4 163.6,163.6"
        class="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-500"
        stroke-width="1.4"
      />
      <circle
        cx="170"
        cy="170"
        r="4.5"
        class="fill-slate-900 dark:fill-slate-100"
      />
      <circle
        cx="170"
        cy="170"
        r="1.8"
        class="fill-white dark:fill-slate-900"
      />
    </g>
    <text
      x="170"
      y="28"
      text-anchor="middle"
      font-size="15"
      font-weight="600"
      class="fill-slate-600 dark:fill-slate-400"
      font-family="Public Sans, system-ui, sans-serif"
    >
      N
    </text>
  </svg>
</template>

<script setup lang="ts">
// Armed on mount so the needle settles into place once, then holds still —
// pre-hydration the needle just renders at rest (its drawn orientation).
const armed = ref(false);

onMounted(() => {
  armed.value = true;
});
</script>

<style scoped>
.compass-needle,
.compass-track {
  transform-box: view-box;
  transform-origin: 170px 170px;
}

.armed .compass-needle {
  animation: compass-needle-settle 1500ms ease-out 350ms both;
}

.armed .compass-track {
  animation: compass-track-settle 1500ms ease-out 350ms both;
}

@keyframes compass-needle-settle {
  0% {
    transform: rotate(-140deg);
  }
  70% {
    transform: rotate(6deg);
  }
  85% {
    transform: rotate(-2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes compass-track-settle {
  0% {
    transform: rotate(-8deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .armed .compass-needle,
  .armed .compass-track {
    animation: none;
    transform: none;
  }
}
</style>
