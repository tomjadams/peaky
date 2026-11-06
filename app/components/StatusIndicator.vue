<template>
  <UBadge
    :color="statusConfig[status].color"
    variant="subtle"
    :label="statusConfig[status].label"
    :aria-label="`Status: ${statusConfig[status].label}`"
  />
</template>

<script setup lang="ts">
interface Props {
  status: "ready" | "in_progress" | "action_needed";
}

defineProps<Props>();

const statusConfig = {
  ready: {
    label: "Ready",
    color: "success" as const,
  },
  in_progress: {
    label: "In Progress",
    color: "warning" as const,
  },
  action_needed: {
    label: "Action Needed",
    color: "error" as const,
  },
};
</script>
