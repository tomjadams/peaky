<script setup lang="ts">
import { formatRelativeDate, formatFullDate } from "~/utils/date";
import type { ReviewStatus } from "~/models";

interface Props {
  name: string;
  status: ReviewStatus;
  templateNamesLabel: string;
  createdAt: string;
  isEditingName: boolean;
  editedName: string;
  isSavingName: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:editedName": [value: string];
  startEditing: [];
  saveName: [];
  cancelEditing: [];
  nameKeydown: [event: KeyboardEvent];
  viewPlan: [];
  continueAssessment: [];
}>();

const statusClass = computed(() => {
  switch (props.status) {
    case "completed":
      return "border-success/25 bg-success/10 text-success";
    case "in-progress":
      return "border-primary/25 bg-primary/10 text-primary";
    default:
      return "border-default bg-muted text-muted";
  }
});

const statusLabel = computed(() => {
  switch (props.status) {
    case "completed":
      return "Completed";
    case "in-progress":
      return "In Progress";
    default:
      return "Draft";
  }
});
</script>

<template>
  <div
    class="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between"
  >
    <div class="min-w-0">
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <template v-if="isEditingName">
          <UInput
            :model-value="editedName"
            :disabled="isSavingName"
            :maxlength="120"
            size="lg"
            class="max-w-md"
            autofocus
            @update:model-value="emit('update:editedName', $event)"
            @keydown="emit('nameKeydown', $event)"
          />
          <UButton
            color="primary"
            size="sm"
            :disabled="isSavingName || !editedName.trim()"
            @click="emit('saveName')"
          >
            Save
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="isSavingName"
            @click="emit('cancelEditing')"
          >
            Cancel
          </UButton>
        </template>
        <template v-else>
          <h2
            class="max-w-full min-w-0 text-[30px] font-extrabold tracking-[-0.015em]"
          >
            <button
              type="button"
              class="text-highlighted hover:text-primary max-w-full cursor-pointer text-left break-words transition-colors"
              title="Click to rename"
              @click="emit('startEditing')"
            >
              {{ name }}
            </button>
          </h2>
          <span
            class="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
            :class="statusClass"
          >
            {{ statusLabel }}
          </span>
        </template>
      </div>
      <div
        class="text-muted mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[15px]"
      >
        <span class="inline-flex min-w-0 items-center gap-1.5 break-words">
          <Icon name="lucide:file-text" class="h-4 w-4 shrink-0" />
          {{ templateNamesLabel }}
        </span>
        <span class="text-dimmed">•</span>
        <span class="inline-flex items-center gap-1.5">
          <Icon name="lucide:calendar" class="h-4 w-4" />
          <ClientOnly>
            Created {{ formatRelativeDate(createdAt) }}
            <template #fallback>
              Created {{ formatFullDate(createdAt) }}
            </template>
          </ClientOnly>
        </span>
      </div>
    </div>

    <div class="flex max-w-full flex-wrap items-center gap-2">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-clipboard-list"
        size="lg"
        class="text-highlighted ring-accented text-[15px] font-bold ring-[1.5px]"
        @click="emit('viewPlan')"
      >
        Follow-ups
      </UButton>
      <UButton
        color="primary"
        icon="i-lucide-clipboard-check"
        size="lg"
        class="text-[15px] font-bold"
        @click="emit('continueAssessment')"
      >
        Continue assessment
      </UButton>
    </div>
  </div>
</template>
