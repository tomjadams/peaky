<template>
  <!-- Checklist Question -->
  <AssessmentChecklistQuestionRow
    v-if="questionType === 'checklist'"
    :question-id="questionId"
    :question-label="questionLabel"
    :question-text="questionText"
    :checklist-items="checklistItems ?? []"
    :checked-items="checkedItems"
    :na-items="naItems"
    :is-n-a="normalizedAnswer === 'na'"
    :has-answer="normalizedAnswer !== null"
    :is-info-active="isInfoActive"
    :disabled="disabled"
    :highlighted="highlighted"
    @update:checked-items="handleChecklistUpdate"
    @update:na-items="handleNAItemsUpdate"
    @clear-answer="emit('update:answer', null)"
    @na-click="$emit('na-click')"
    @item-na-click="$emit('item-na-click', $event)"
    @info-click="$emit('info-click')"
  />

  <!-- Yes/No Question -->
  <article
    v-else
    :id="`question-${questionId}`"
    tabindex="-1"
    :class="[
      'question-row border-default focus-visible:ring-primary w-full max-w-[960px] scroll-mt-24 rounded-lg border-b px-2 py-5 transition-all duration-300 last:border-b-0 focus-visible:ring-2 focus-visible:outline-none',
      normalizedAnswer === 'na' ? 'bg-muted/40' : '',
      highlighted ? 'question-row--highlighted' : '',
    ]"
  >
    <!-- Grid, not flex: badge / question line / control share one centered
         first row whatever their heights, and the badge column auto-sizes
         (REL-1 vs REL-12) without pushing the text column around. -->
    <div
      class="question-row__container grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4"
    >
      <span
        v-if="questionLabel"
        class="question-row__id bg-primary/10 rounded-md px-2 py-0.5 font-mono text-[13px] font-semibold dark:bg-slate-700"
        :class="[
          normalizedAnswer === 'na'
            ? 'text-muted dark:text-slate-400'
            : 'text-primary',
        ]"
      >
        {{ questionLabel }}
      </span>
      <span v-else aria-hidden="true" />
      <div class="question-row__content flex min-w-0 items-center gap-1.5">
        <p
          class="question-row__text text-default text-[17px] leading-relaxed min-[1920px]:text-lg dark:text-slate-300"
        >
          <InlineMarkdown :text="questionText" />
        </p>
        <!-- The info affordance belongs to the question it explains — it
             hugs the text instead of floating in the row's dead space. -->
        <button
          type="button"
          class="question-row__info-button shrink-0 rounded-lg p-1 transition-colors"
          :class="[
            isInfoActive
              ? 'bg-primary/10 text-primary'
              : 'text-dimmed hover:bg-muted hover:text-muted dark:hover:bg-slate-700 dark:hover:text-slate-300',
          ]"
          :aria-label="`Show information about this question`"
          @click="$emit('info-click')"
        >
          <Icon
            name="lucide:info"
            class="question-row__info-icon text-base"
            aria-hidden="true"
          />
        </button>
      </div>
      <div
        class="question-row__actions col-start-2 mt-3 flex items-center justify-self-start"
      >
        <AssessmentAnswerToggle
          :model-value="normalizedAnswer"
          :legend="answerLegend"
          :disabled="disabled"
          @update:model-value="$emit('update:answer', $event)"
          @na-click="$emit('na-click')"
        />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { QuestionAnswer, ChecklistItem } from "~/models/question";
import { isChecklistWithNAAnswer } from "~/models/question";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";

interface Props {
  questionId: string;
  /**
   * Short derived slug (`REL-1`). Null when it cannot be derived — the badge
   * is then omitted rather than falling back to the opaque `questionId`.
   */
  questionLabel: string | null;
  questionText: string;
  questionType?: "yes-no" | "checklist";
  checklistItems?: ChecklistItem[];
  answer: QuestionAnswer | null;
  isInfoActive?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  questionType: "yes-no",
  checklistItems: () => [],
  isInfoActive: false,
  disabled: false,
  highlighted: false,
});

const emit = defineEmits<{
  (e: "update:answer", value: QuestionAnswer | null): void;
  (e: "na-click" | "info-click"): void;
  (e: "item-na-click", itemId: string): void;
}>();

const answerLegend = computed(() =>
  props.questionLabel
    ? `Answer for question ${props.questionLabel}`
    : "Answer for this question"
);

const normalizedAnswer = computed(() =>
  normalizeQuestionAnswer(
    { type: props.questionType, checklistItems: props.checklistItems },
    props.answer
  )
);

const checkedItems = computed(() =>
  isChecklistWithNAAnswer(normalizedAnswer.value)
    ? normalizedAnswer.value.checked
    : []
);

const naItems = computed(() =>
  isChecklistWithNAAnswer(normalizedAnswer.value)
    ? normalizedAnswer.value.na
    : []
);

const handleChecklistUpdate = (items: string[]) => {
  emit("update:answer", { checked: items, na: naItems.value });
};

const handleNAItemsUpdate = (items: string[]) => {
  emit("update:answer", { checked: checkedItems.value, na: items });
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
