<template>
  <div class="relative hidden lg:block" aria-hidden="true">
    <svg
      viewBox="0 0 1240 210"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      class="route-map h-auto w-full"
      :class="{ armed, 'is-in': start }"
    >
      <!-- graticule crosses: quiet chart-paper air, crisp straight hairlines -->
      <g stroke-width="1.25">
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M53 80h14 M60 73v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M143 52h14 M150 45v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M343 178h14 M350 171v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M518 44h14 M525 37v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M443 160h14 M450 153v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M728 60h14 M735 53v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M898 172h14 M905 165v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M978 50h14 M985 43v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M1078 142h14 M1085 135v14"
        />
        <path
          class="cross stroke-[#dde6ee] dark:stroke-slate-800"
          d="M1173 150h14 M1180 143v14"
        />
      </g>

      <mask id="routeDrawMask">
        <rect
          x="0"
          y="0"
          width="1240"
          height="210"
          fill="white"
          class="route-wipe"
        />
      </mask>

      <!-- the route: real dots, drawn as tiny round-cap dashes -->
      <path
        d="M36 162 C110 156 180 138 250 126 C320 114 370 102 424 98 C490 94 550 104 620 114 C690 124 750 130 812 126 C880 121 950 104 1020 88 C1090 72 1150 64 1200 60"
        class="stroke-sky-600 dark:stroke-sky-400"
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray="0.1 13"
        mask="url(#routeDrawMask)"
      />

      <!-- numbered waypoints: rings echo the chapter numerals below -->
      <circle
        cx="36"
        cy="162"
        r="17"
        class="waypoint waypoint-1 fill-white stroke-sky-600 dark:fill-slate-900 dark:stroke-sky-400"
        stroke-width="2"
      />
      <circle
        cx="424"
        cy="98"
        r="17"
        class="waypoint waypoint-2 fill-white stroke-sky-600 dark:fill-slate-900 dark:stroke-sky-400"
        stroke-width="2"
      />
      <circle
        cx="812"
        cy="126"
        r="17"
        class="waypoint waypoint-3 fill-white stroke-sky-600 dark:fill-slate-900 dark:stroke-sky-400"
        stroke-width="2"
      />
      <circle
        cx="1200"
        cy="60"
        r="17"
        fill="none"
        class="destination-pulse stroke-[#a7d5b8] dark:stroke-green-900"
        stroke-width="2"
      />
      <circle
        cx="1200"
        cy="60"
        r="17"
        class="destination-ring fill-white stroke-[#15803d] dark:fill-slate-900 dark:stroke-green-400"
        stroke-width="2"
      />
    </svg>
    <!-- labels live in HTML so they stay 13px at every viewport width -->
    <span
      class="wp-label wp-label-1 text-primary-600 dark:text-primary-400 pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none font-bold tracking-[0.02em] tabular-nums"
      :class="{ armed, 'is-in': start }"
      style="left: 2.903%; top: 77.143%"
    >
      01
    </span>
    <span
      class="wp-label wp-label-2 text-primary-600 dark:text-primary-400 pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none font-bold tracking-[0.02em] tabular-nums"
      :class="{ armed, 'is-in': start }"
      style="left: 34.194%; top: 46.667%"
    >
      02
    </span>
    <span
      class="wp-label wp-label-3 text-primary-600 dark:text-primary-400 pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none font-bold tracking-[0.02em] tabular-nums"
      :class="{ armed, 'is-in': start }"
      style="left: 65.484%; top: 60%"
    >
      03
    </span>
    <span
      class="wp-label wp-label-4 pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[13px] leading-none font-bold tracking-[0.02em] text-[#15803d] tabular-nums dark:text-green-400"
      :class="{ armed, 'is-in': start }"
      style="left: 96.774%; top: 28.571%"
    >
      04
    </span>
  </div>
</template>

<script setup lang="ts">
// `start` is set once the section scrolls into view (LandingShell). `armed`
// tracks our own mount so pre-hydration/no-JS renders the route fully drawn
// instead of a permanently blank map.
defineProps<{ start?: boolean }>();

const armed = ref(false);

onMounted(() => {
  armed.value = true;
});
</script>

<style scoped>
.cross {
  vector-effect: non-scaling-stroke;
}

.route-wipe {
  transform-box: fill-box;
  transform-origin: 0% 50%;
}

.waypoint,
.destination-ring,
.destination-pulse {
  transform-box: fill-box;
  transform-origin: center;
}

.armed .route-wipe {
  transform: scaleX(0);
}

.armed .waypoint,
.armed .destination-ring,
.armed .destination-pulse {
  opacity: 0;
}

.wp-label.armed {
  opacity: 0;
}

.armed.is-in .route-wipe {
  animation: route-wipe 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.armed.is-in .waypoint-1 {
  animation: waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 275ms both;
}

.armed.is-in .waypoint-2 {
  animation: waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 495ms both;
}

.armed.is-in .waypoint-3 {
  animation: waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 825ms both;
}

.armed.is-in .destination-ring {
  animation: waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 1100ms both;
}

.armed.is-in .destination-pulse {
  animation: destination-pulse 600ms ease-out 1100ms both;
}

.wp-label-1.armed.is-in {
  animation: wp-label-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 275ms both;
}

.wp-label-2.armed.is-in {
  animation: wp-label-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 495ms both;
}

.wp-label-3.armed.is-in {
  animation: wp-label-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 825ms both;
}

.wp-label-4.armed.is-in {
  animation: wp-label-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 1100ms both;
}

@keyframes route-wipe {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@keyframes waypoint-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes destination-pulse {
  from {
    opacity: 0.6;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.3);
  }
}

@keyframes wp-label-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .armed .route-wipe {
    transform: none;
  }
  .armed .waypoint,
  .armed .destination-ring,
  .wp-label.armed {
    opacity: 1;
  }
  .armed .route-wipe,
  .armed .waypoint,
  .armed .destination-ring,
  .armed .destination-pulse,
  .wp-label.armed {
    animation: none;
  }
}
</style>
