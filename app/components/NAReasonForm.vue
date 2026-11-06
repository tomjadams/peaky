<template>
  <div class="space-y-6">
    <!-- Header with question context -->
    <div>
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">
        {{
          itemText
            ? "Why is this item not applicable?"
            : "Why is this question not applicable?"
        }}
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Please choose a reason and share more if necessary.
      </p>

      <!-- Item Text (for checklist items) -->
      <div
        v-if="itemText"
        class="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/50"
      >
        <Icon
          name="lucide:check-square"
          class="mt-0.5 shrink-0 text-lg text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            {{ itemText }}
          </p>
        </div>
      </div>

      <!-- Question Text (for full questions or as context for items) -->
      <div
        v-else-if="questionText"
        class="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/50"
      >
        <Icon
          name="lucide:help-circle"
          class="mt-0.5 shrink-0 text-lg text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <TemplateStudioRichTextEditor
            :model-value="questionText"
            :readonly="true"
            :show-toolbar="false"
            :compact="true"
          />
        </div>
      </div>
    </div>

    <!-- Reason Selection -->
    <div class="space-y-3">
      <label class="text-dimmed text-[13px] font-semibold"> Reasoning </label>
      <div class="space-y-2">
        <label
          v-for="item in reasonItems"
          :key="item.value"
          class="has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-primary/20 dark:has-[:checked]:border-primary dark:has-[:checked]:bg-primary/10 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-all hover:border-gray-300 hover:bg-gray-50 has-[:checked]:ring-2 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600 dark:hover:bg-gray-800"
        >
          <input
            type="radio"
            :value="item.value"
            :checked="selectedReason === item.value"
            class="text-primary focus-visible:ring-primary h-4 w-4 shrink-0 rounded-full border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-gray-600"
            @change="$emit('update:selectedReason', item.value)"
          />
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            {{ item.label }}
          </span>
        </label>
      </div>
    </div>

    <!-- Comment -->
    <div class="space-y-2">
      <label for="na-comment" class="text-dimmed text-[13px] font-semibold">
        Additional details (optional)
      </label>
      <div class="group relative w-full">
        <UTextarea
          id="na-comment"
          :model-value="comment"
          placeholder="Details will be saved with your answer for your team's reference."
          :rows="8"
          style="width: 100%"
          class="w-full"
          :class="{ 'ring-2 ring-red-500': isCommentOverLimit }"
          :ui="{
            base: 'min-h-[180px] text-base px-4 py-3 !w-full',
            root: '!w-full',
          }"
          @update:model-value="$emit('update:comment', $event)"
        />
        <div
          class="pointer-events-none absolute right-4 bottom-3 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm"
          :class="
            isCommentOverLimit ? 'font-semibold text-red-500' : 'text-gray-400'
          "
        >
          {{ comment.length }}/200
        </div>
      </div>
      <div
        v-if="isCommentOverLimit"
        class="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"
      >
        <Icon name="lucide:alert-circle" class="h-3.5 w-3.5" />
        <span>Maximum 200 characters</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between pt-2">
      <UButton
        v-if="isEditing"
        variant="outline"
        color="error"
        @click="$emit('clear')"
      >
        Clear N/A
      </UButton>
      <div v-else />
      <div class="flex gap-3">
        <UButton variant="outline" color="neutral" @click="$emit('cancel')">
          Cancel
        </UButton>
        <UButton :disabled="!canConfirm" @click="$emit('confirm')">
          {{ isEditing ? "Update" : "Confirm" }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NAReasonType } from "~/models/question";

const props = defineProps<{
  questionText?: string;
  itemText?: string; // For checklist item N/A
  selectedReason: NAReasonType | null;
  comment: string;
  isEditing?: boolean; // True if editing existing N/A
}>();

defineEmits<{
  "update:selectedReason": [value: NAReasonType];
  "update:comment": [value: string];
  confirm: [];
  cancel: [];
  clear: [];
}>();

const isCommentOverLimit = computed(() => props.comment.length > 200);

const canConfirm = computed(() => {
  return props.selectedReason !== null && !isCommentOverLimit.value;
});

const reasonItems = [
  { value: "not-in-scope" as NAReasonType, label: "Not in scope" },
  {
    value: "handled-by-infrastructure" as NAReasonType,
    label: "Handled by infrastructure",
  },
  { value: "legacy-system" as NAReasonType, label: "Legacy system" },
  {
    value: "pending-deprecation" as NAReasonType,
    label: "Pending deprecation",
  },
  { value: "other" as NAReasonType, label: "Other" },
];
</script>
