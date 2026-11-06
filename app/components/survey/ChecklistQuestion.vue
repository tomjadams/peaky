<template>
  <div class="survey-checklist space-y-6">
    <!-- Header with progress -->
    <div
      class="survey-checklist__header flex items-start justify-between gap-6"
    >
      <div class="flex flex-col items-start gap-2">
        <p class="text-muted text-sm font-semibold xl:text-base">
          Select all that apply
        </p>
        <span
          class="text-dimmed text-[13px] xl:text-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          {{ checklistGuidance }}
        </span>
        <button
          type="button"
          class="focus-visible:ring-primary -ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium underline decoration-dotted underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:outline-none xl:text-[15px]"
          :class="isNA ? 'text-highlighted' : 'text-muted hover:text-default'"
          :aria-pressed="isNA"
          @click="$emit('na-click')"
        >
          Not applicable to this question
        </button>
        <button
          v-if="hasAnswer"
          type="button"
          class="text-muted hover:text-default focus-visible:ring-primary -ml-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium underline decoration-dotted underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:outline-none xl:text-[15px]"
          aria-label="Clear checklist answer"
          @click="emit('clear-answer')"
        >
          Clear answer
        </button>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span
          class="text-dimmed text-[13px] font-semibold tabular-nums xl:text-[15px]"
        >
          {{ checkedCount }}/{{ totalCount }}
        </span>
        <div
          class="bg-accented h-1 w-16 overflow-hidden rounded-full xl:h-1.5 xl:w-24 dark:bg-slate-700"
        >
          <div
            class="h-full transition-all duration-300"
            :class="
              progress === 100
                ? 'bg-success'
                : 'bg-primary-600 dark:bg-primary-400'
            "
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Checklist Items (always expanded) -->
    <div :class="density.list">
      <button
        v-for="item in checklistItems"
        :key="item.id"
        type="button"
        :data-practice-state="practiceState(item.id)"
        class="group flex w-full items-center rounded-lg border-2 text-left transition-all"
        :class="[
          density.row,
          isNA
            ? 'border-default bg-muted cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/50'
            : isItemNA(item.id)
              ? 'border-default bg-muted opacity-60 dark:border-slate-700 dark:bg-slate-800/50'
              : isChecked(item.id)
                ? 'border-success/50 bg-success/5 hover:bg-success/10 dark:border-success/30 dark:bg-success/10'
                : hasAnswer
                  ? 'border-default bg-muted/30 hover:border-accented hover:bg-muted/50 dark:border-slate-700 dark:bg-slate-800/20 dark:hover:border-slate-600 dark:hover:bg-slate-800/40'
                  : 'border-default bg-default hover:border-accented hover:bg-muted border-dashed dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600 dark:hover:bg-slate-800/50',
        ]"
        :disabled="isNA || isItemNA(item.id)"
        @click="!isNA && !isItemNA(item.id) && toggleItem(item.id)"
      >
        <!-- Custom Checkbox -->
        <span
          class="flex shrink-0 items-center justify-center rounded border-2 transition-all"
          :class="[
            density.checkbox,
            isNA || isItemNA(item.id)
              ? 'border-accented bg-muted dark:border-slate-600 dark:bg-slate-700'
              : isChecked(item.id)
                ? 'border-success bg-success'
                : 'border-accented bg-default group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:group-hover:border-slate-500',
          ]"
        >
          <Icon
            v-if="isChecked(item.id) && !isNA && !isItemNA(item.id)"
            name="lucide:check"
            class="text-white"
            :class="density.checkIcon"
          />
        </span>

        <!-- Item text -->
        <span
          class="flex-1"
          :class="[
            density.label,
            isNA || isItemNA(item.id)
              ? 'text-dimmed'
              : isChecked(item.id)
                ? 'text-highlighted dark:text-slate-100'
                : 'text-default dark:text-slate-300',
          ]"
        >
          <span class="block">{{ item.text }}</span>
          <span
            v-if="practiceState(item.id) === 'not-met'"
            class="text-dimmed block text-[13px] font-medium"
            aria-hidden="true"
          >
            Not met
          </span>
        </span>

        <!-- Per-item N/A button -->
        <UButton
          v-if="!isNA"
          :variant="isItemNA(item.id) ? 'solid' : 'outline'"
          color="neutral"
          size="xs"
          class="text-[13px]"
          :class="density.naButton"
          :aria-label="`Mark ${item.text} as not applicable`"
          :aria-pressed="isItemNA(item.id)"
          @click.stop="$emit('item-na-click', item.id)"
        >
          N/A
        </UButton>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChecklistItem } from "~/models/question";

interface Props {
  checklistItems: ChecklistItem[];
  checkedItems: string[];
  naItems?: string[];
  isNA: boolean;
  hasAnswer?: boolean;
}

type PracticeState = "not-assessed" | "met" | "not-met" | "not-applicable";

const props = withDefaults(defineProps<Props>(), {
  naItems: () => [],
  hasAnswer: false,
});

const emit = defineEmits<{
  (e: "update:checked-items", value: string[]): void;
  (e: "na-click" | "clear-answer"): void;
  (e: "item-na-click", itemId: string): void;
}>();

// Kiosk rows are sized generously for the validated 2–4 item case. Real
// templates go up to 17 items (pilot data), so past 6 items every row steps
// down one size — padding/gap by roughly a third, label text down from the
// kiosk 19px to 17px — so ~10 items fit a 1600x1000 kiosk viewport without
// scrolling and 17 reads as a scannable list rather than a wall of oversized
// rows. Two floors are held regardless of density: label text never drops
// below the 16px Cartographer meta floor, and the checkbox never drops below
// a 20px touch target.
const DENSITY_THRESHOLD = 6;
const dense = computed(() => props.checklistItems.length > DENSITY_THRESHOLD);
const density = computed(() => ({
  list: dense.value ? "space-y-1.5" : "space-y-2",
  row: dense.value
    ? "gap-[11px] p-[11px] xl:gap-[13px] xl:p-[13px]"
    : "gap-4 p-4 xl:gap-5 xl:p-5",
  checkbox: dense.value ? "h-5 w-5" : "h-6 w-6 xl:h-8 xl:w-8",
  checkIcon: dense.value ? "h-3.5 w-3.5" : "h-4 w-4 xl:h-5 xl:w-5",
  label: dense.value ? "text-base xl:text-[17px]" : "text-base xl:text-[19px]",
  // Text stays at the 13px meta floor either way (see class="text-[13px]"
  // above) — density only tightens the button's own footprint.
  naButton: dense.value ? "h-6 px-2" : "",
}));
const checklistGuidance = computed(() => {
  if (props.isNA) return "This checklist is marked N/A.";
  return props.hasAnswer
    ? "Unchecked applicable practices count as Not met."
    : "Unchecked practices are Not assessed.";
});

const totalCount = computed(() => props.checklistItems.length);
const checkedCount = computed(() => {
  // Count items that are checked OR marked as N/A
  const naCount = props.naItems.length;
  return props.checkedItems.length + naCount;
});
const progress = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((checkedCount.value / totalCount.value) * 100);
});

const isChecked = (itemId: string): boolean => {
  return props.checkedItems.includes(itemId);
};

const isItemNA = (itemId: string): boolean => {
  return props.naItems.includes(itemId);
};

const practiceState = (itemId: string): PracticeState => {
  if (props.isNA || isItemNA(itemId)) return "not-applicable";
  if (isChecked(itemId)) return "met";
  return props.hasAnswer ? "not-met" : "not-assessed";
};

const toggleItem = (itemId: string) => {
  if (props.isNA || isItemNA(itemId)) return;

  const newCheckedItems = isChecked(itemId)
    ? props.checkedItems.filter((id) => id !== itemId)
    : [...props.checkedItems, itemId];

  emit("update:checked-items", newCheckedItems);
};
</script>
