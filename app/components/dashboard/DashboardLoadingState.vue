<template>
  <div class="animate-pulse">
    <div
      class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="space-y-2">
        <div class="bg-elevated h-8 w-56 rounded-lg" />
        <div class="bg-elevated h-4 w-80 max-w-full rounded-lg" />
      </div>

      <div v-if="showPrimaryAction" class="bg-muted h-11 w-40 rounded-lg" />
    </div>

    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div
        v-for="card in metricCards"
        :key="card"
        class="bg-elevated border-default rounded-lg border p-6"
      >
        <div class="bg-muted h-3 w-24 rounded-lg" />
        <div class="bg-muted mt-4 h-8 w-16 rounded-lg" />
      </div>
    </div>

    <div
      class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="bg-muted h-10 flex-1 rounded-lg sm:max-w-md" />

      <div class="flex flex-wrap items-center gap-3">
        <div
          v-for="filter in filters"
          :key="filter"
          class="bg-muted h-10 w-56 rounded-lg"
        />
      </div>
    </div>

    <div class="bg-elevated border-default overflow-hidden rounded-lg border">
      <div
        class="border-default grid gap-3 border-b px-4 py-3"
        :style="{ gridTemplateColumns: tableColumnsTemplate }"
      >
        <div
          v-for="column in columns"
          :key="column"
          class="bg-muted h-3 rounded-lg"
        />
      </div>

      <div
        v-for="row in rows"
        :key="row"
        class="border-default grid gap-3 border-b px-4 py-4 last:border-b-0"
        :style="{ gridTemplateColumns: tableColumnsTemplate }"
      >
        <div
          v-for="column in columns"
          :key="`${row}-${column}`"
          class="bg-muted h-4 rounded-lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    columnCount?: number;
    filterCount?: number;
    rowCount?: number;
    showPrimaryAction?: boolean;
  }>(),
  {
    columnCount: 5,
    filterCount: 1,
    rowCount: 6,
    showPrimaryAction: false,
  }
);

const metricCards = computed(() =>
  Array.from({ length: 3 }, (_, index) => index)
);
const filters = computed(() => {
  return Array.from({ length: props.filterCount }, (_, index) => index);
});
const rows = computed(() =>
  Array.from({ length: props.rowCount }, (_, index) => index)
);
const columns = computed(() => {
  return Array.from({ length: props.columnCount }, (_, index) => index);
});
const tableColumnsTemplate = computed(() => {
  return `repeat(${props.columnCount}, minmax(0, 1fr))`;
});
</script>
