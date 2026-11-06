<template>
  <div class="filter-bar flex items-center gap-2">
    <div class="text-muted flex items-center gap-1.5 text-sm">
      <Icon name="lucide:filter" class="h-4 w-4" aria-hidden="true" />
      <span>Status:</span>
    </div>
    <UFieldGroup
      size="sm"
      role="tablist"
      aria-label="Filter applications by status"
    >
      <UButton
        v-for="filter in filters"
        :key="filter.value"
        role="tab"
        class="cursor-pointer"
        :color="activeFilter === filter.value ? 'primary' : 'neutral'"
        :variant="activeFilter === filter.value ? 'solid' : 'outline'"
        :aria-selected="activeFilter === filter.value"
        @click="activeFilter = filter.value"
      >
        {{ filter.label }}
      </UButton>
    </UFieldGroup>
  </div>
</template>

<script setup lang="ts">
type FilterValue = "all" | "ready" | "in_progress" | "action_needed";

const activeFilter = defineModel<FilterValue>({ default: "all" });

const filters = [
  { value: "all" as const, label: "All" },
  { value: "ready" as const, label: "Ready" },
  { value: "in_progress" as const, label: "In Progress" },
  { value: "action_needed" as const, label: "Action Needed" },
];
</script>
