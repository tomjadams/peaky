<template>
  <div
    v-if="selectedCount > 0"
    class="bulk-action-bar border-default bg-default fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border px-6 py-3 shadow-lg"
    role="toolbar"
    aria-label="Bulk actions"
  >
    <span class="bulk-action-bar__count text-highlighted text-sm font-medium">
      {{ selectedCount }} selected
    </span>
    <div class="bulk-action-bar__divider bg-accented h-6 w-px" />
    <div class="bulk-action-bar__actions flex items-center gap-2">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-user-round-cog"
        label="Transfer"
        @click="$emit('transfer')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-archive"
        label="Archive"
        @click="$emit('archive')"
      />
      <UButton
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        label="Delete"
        @click="$emit('delete')"
      />
    </div>
    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      aria-label="Clear selection"
      class="ml-2"
      @click="$emit('clear')"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedCount: number;
}

defineProps<Props>();

defineEmits<{
  transfer: [];
  archive: [];
  delete: [];
  clear: [];
}>();
</script>
