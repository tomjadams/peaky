<template>
  <div class="flex items-end justify-between gap-4">
    <div>
      <div
        class="bg-primary-600 dark:bg-primary-400 mb-3 h-[3px] w-10 rounded-full"
        aria-hidden="true"
      />
      <h2 class="text-highlighted text-[26px] leading-tight font-extrabold">
        {{ title }}
      </h2>
      <p v-if="description" class="text-muted mt-1 text-[15px]">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.default" class="shrink-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
}

defineProps<Props>();
</script>
