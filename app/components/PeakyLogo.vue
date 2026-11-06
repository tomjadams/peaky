<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 36 28"
    xmlns="http://www.w3.org/2000/svg"
    class="peaky-logo"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0ea5e9" />
        <stop offset="100%" stop-color="#22c55e" />
      </linearGradient>
    </defs>
    <!-- Journey line with pronounced valleys -->
    <path
      d="M3 18 L9 10 L15 22 L21 12 L28 5"
      :stroke="`url(#${gradientId})`"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
    <!-- Hollow circles for journey steps -->
    <circle
      cx="3"
      cy="18"
      r="3"
      :stroke="`url(#${gradientId})`"
      stroke-width="2"
      class="fill-white dark:fill-slate-900"
    />
    <circle
      cx="9"
      cy="10"
      r="3"
      :stroke="`url(#${gradientId})`"
      stroke-width="2"
      class="fill-white dark:fill-slate-900"
    />
    <circle
      cx="15"
      cy="22"
      r="3"
      :stroke="`url(#${gradientId})`"
      stroke-width="2"
      class="fill-white dark:fill-slate-900"
    />
    <circle
      cx="21"
      cy="12"
      r="3"
      :stroke="`url(#${gradientId})`"
      stroke-width="2"
      class="fill-white dark:fill-slate-900"
    />
    <!-- Star at the endpoint - completion! -->
    <path
      d="M28 2 L29.5 4.5 L32.5 5 L30 7 L30.5 10 L28 8.5 L25.5 10 L26 7 L23.5 5 L26.5 4.5 Z"
      fill="#22c55e"
      class="peaky-logo__star"
    />
  </svg>
</template>

<script setup lang="ts">
const { size = 24 } = defineProps<{ size?: number }>();
const gradientId = `peaky-logo-${useId()}`;
</script>
