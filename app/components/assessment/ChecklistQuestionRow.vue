<template>
  <article
    :id="`question-${questionId}`"
    tabindex="-1"
    :class="[
      'question-row border-default focus-visible:ring-primary w-full max-w-[960px] scroll-mt-24 rounded-lg border-b px-2 py-5 transition-all duration-300 last:border-b-0 focus-visible:ring-2 focus-visible:outline-none',
      isNA ? 'bg-muted/40' : '',
      highlighted ? 'question-row--highlighted' : '',
    ]"
  >
    <!-- Grid, not flex: badge / question line / control share one centered
         first row, and the meta + items block sits on the second grid row
         aligned exactly under the text column, whatever the badge width. -->
    <div
      class="question-row__container grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4"
    >
      <span
        v-if="questionLabel"
        class="question-row__id bg-primary/10 rounded-md px-2 py-0.5 font-mono text-[13px] font-semibold dark:bg-slate-700"
        :class="[isNA ? 'text-muted dark:text-slate-400' : 'text-primary']"
      >
        {{ questionLabel }}
      </span>
      <span v-else aria-hidden="true" />
      <div class="question-row__content flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          class="question-row__text text-default hover:bg-muted cursor-pointer rounded px-1 py-0.5 text-left text-[17px] leading-relaxed transition-colors disabled:cursor-default dark:text-slate-300 dark:hover:bg-slate-800/50"
          :disabled="disabled"
          @click="toggleExpanded"
        >
          <InlineMarkdown :text="questionText" />
        </button>
        <!-- The info affordance hugs the question it explains. -->
        <button
          type="button"
          class="question-row__info-button shrink-0 rounded-lg p-1 transition-colors"
          :class="[
            isInfoActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted hover:bg-muted hover:text-muted dark:hover:bg-slate-700 dark:hover:text-slate-300',
          ]"
          :aria-label="`Show information about this question`"
          @click.stop="$emit('info-click')"
        >
          <Icon
            name="lucide:info"
            class="question-row__info-icon text-base"
            aria-hidden="true"
          />
        </button>
      </div>
      <!-- Below: Progress Indicator and Checklist Items -->
      <div class="col-span-2 col-start-1 mt-3 space-y-3">
        <!-- Progress Indicator with Expand/Collapse -->
        <button
          v-if="!disabled"
          type="button"
          class="hover:bg-muted flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors dark:hover:bg-slate-800/50"
          :aria-expanded="isExpanded"
          :aria-controls="`checklist-items-${questionId}`"
          @click="toggleExpanded"
        >
          <Icon
            :name="isExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
            class="text-muted h-4 w-4 transition-transform"
          />
          <span class="text-muted text-[13px] font-medium tabular-nums">
            {{ checkedCount }} of {{ totalCount }} items complete
          </span>
          <div
            class="bg-accented h-1 w-24 overflow-hidden rounded-full dark:bg-slate-700"
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
          <span class="text-muted ml-auto text-[13px]">
            {{ isExpanded ? "Collapse" : "Expand" }}
          </span>
        </button>

        <!-- Checklist Items -->
        <div
          v-if="!disabled && isExpanded"
          :id="`checklist-items-${questionId}`"
          class="border-default max-w-[860px] overflow-hidden rounded-lg border"
        >
          <div
            class="bg-default flex min-h-11 items-center justify-between gap-4 px-3 py-1.5"
          >
            <div class="min-w-0">
              <span class="text-muted block text-[13px] font-semibold">
                Checklist answers
              </span>
              <span
                class="text-dimmed block text-[13px]"
                aria-live="polite"
                aria-atomic="true"
              >
                {{ checklistGuidance }}
              </span>
            </div>
            <fieldset class="flex flex-wrap items-center justify-end gap-1">
              <legend class="sr-only">{{ answerLegend }}</legend>
              <UButton
                v-if="hasAnswer"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Clear answer for this checklist"
                @click.stop="emit('clear-answer')"
              >
                Clear answer
              </UButton>
              <UButton
                :variant="isNA ? 'solid' : 'ghost'"
                color="neutral"
                size="sm"
                :aria-pressed="isNA"
                @click.stop="$emit('na-click')"
              >
                Mark entire checklist N/A
              </UButton>
            </fieldset>
          </div>
          <div
            v-for="item in checklistItems"
            :key="item.id"
            :data-practice-state="practiceState(item.id)"
            class="group grid min-h-11 grid-cols-[6px_20px_minmax(0,72ch)_44px] items-center gap-3 border-t px-3 py-2 transition-all first:border-t-0"
            :class="[
              // Dashed means no answer has been recorded. Once an answer
              // exists, every applicable row has a settled state.
              isNA
                ? 'border-default bg-muted cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/50'
                : isItemNA(item.id)
                  ? 'border-default bg-muted opacity-60 dark:border-slate-700 dark:bg-slate-800/50'
                  : isChecked(item.id)
                    ? 'border-success/50 bg-success/5 hover:border-success/70 dark:border-success/30 dark:bg-success/10 cursor-pointer'
                    : hasAnswer
                      ? 'border-default bg-muted/30 hover:border-accented hover:bg-muted/50 cursor-pointer dark:border-slate-700 dark:bg-slate-800/20 dark:hover:border-slate-600 dark:hover:bg-slate-800/40'
                      : 'border-default bg-muted/50 hover:border-accented hover:bg-default cursor-pointer border-dashed dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600 dark:hover:bg-slate-800/50',
            ]"
          >
            <!-- Dot indicator (like Template Studio) -->
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="
                isChecked(item.id) && !isNA && !isItemNA(item.id)
                  ? 'bg-success'
                  : 'bg-accented dark:bg-slate-600'
              "
            />
            <!-- Custom Checkbox -->
            <input
              :id="`checklist-${questionId}-${item.id}`"
              type="checkbox"
              class="border-accented text-success focus:ring-primary h-5 w-5 rounded"
              :checked="isChecked(item.id)"
              :disabled="isNA || isItemNA(item.id)"
              @change="toggleItem(item.id)"
            />
            <label
              :for="`checklist-${questionId}-${item.id}`"
              class="text-[15px] leading-relaxed"
              :class="[
                isNA || isItemNA(item.id)
                  ? 'text-muted'
                  : isChecked(item.id)
                    ? 'text-default dark:text-slate-300'
                    : 'text-muted group-hover:text-default dark:text-slate-400 dark:group-hover:text-slate-300',
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
            </label>
            <UButton
              v-if="!isNA"
              :variant="isItemNA(item.id) ? 'solid' : 'outline'"
              color="neutral"
              size="xs"
              class="text-[13px]"
              :aria-label="`Mark ${item.text} as not applicable`"
              :aria-pressed="isItemNA(item.id)"
              @click.stop="emit('item-na-click', item.id)"
            >
              N/A
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ChecklistItem } from "~/models/question";

interface Props {
  questionId: string;
  /**
   * Short derived slug (`REL-1`). Null when it cannot be derived — the badge
   * is then omitted rather than falling back to the opaque `questionId`.
   */
  questionLabel: string | null;
  questionText: string;
  checklistItems: ChecklistItem[];
  checkedItems: string[];
  naItems?: string[];
  isNA: boolean;
  hasAnswer?: boolean;
  isInfoActive?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  naItems: () => [],
  hasAnswer: false,
  isInfoActive: false,
  disabled: false,
  highlighted: false,
});

const emit = defineEmits<{
  (e: "update:checked-items" | "update:na-items", value: string[]): void;
  (e: "na-click" | "info-click" | "clear-answer"): void;
  (e: "item-na-click", itemId: string): void;
}>();

const answerLegend = computed(() =>
  props.questionLabel
    ? `Answer for question ${props.questionLabel}`
    : "Answer for this question"
);
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

const checkedSet = computed(() => new Set(props.checkedItems));
const naSet = computed(() => new Set(props.naItems));

const isChecked = (itemId: string): boolean => checkedSet.value.has(itemId);
const isItemNA = (itemId: string): boolean => naSet.value.has(itemId);

type PracticeState = "not-assessed" | "met" | "not-met" | "not-applicable";
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

// Collapse/expand state
const isExpanded = ref(false);
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};
</script>

<style scoped>
@keyframes question-highlight {
  0%,
  8% {
    background-color: rgb(14 165 233 / 0.1);
    box-shadow: inset 3px 0 0 rgb(14 165 233 / 0.9);
  }
  100% {
    background-color: transparent;
    box-shadow: inset 3px 0 0 transparent;
  }
}

.question-row--highlighted {
  animation: question-highlight 3s ease-out forwards;
}
</style>
