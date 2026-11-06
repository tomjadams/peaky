<script setup lang="ts">
defineProps<{ reviewName: string }>();
</script>

<template>
  <header class="min-w-0">
    <h2 class="text-highlighted text-[26px] font-extrabold tracking-[-0.015em]">
      {{ reviewName }}
    </h2>
    <p class="text-muted mt-1 max-w-3xl text-[15px]">
      Choose areas needing attention, then prepare the work for handoff.
    </p>
  </header>
</template>
