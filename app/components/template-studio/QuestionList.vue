<template>
  <div class="question-list">
    <!-- Header -->
    <div class="mb-6">
      <div
        class="bg-primary-600 dark:bg-primary-400 mb-3 h-[3px] w-10 rounded-full"
        aria-hidden="true"
      />
      <div class="flex items-baseline justify-between">
        <div class="flex items-baseline gap-3">
          <h2 class="text-highlighted text-[26px] leading-tight font-extrabold">
            {{ pillar.name }}
          </h2>
          <span class="text-muted text-[15px] tabular-nums">
            {{ pillar.questions.length }} question{{
              pillar.questions.length !== 1 ? "s" : ""
            }}
          </span>
        </div>
        <!-- The room's "Section n of m" vocabulary, one level up. -->
        <span
          v-if="pillarIndex !== undefined && pillarIndex >= 0 && pillarCount"
          class="text-dimmed text-[13px] tabular-nums"
        >
          Pillar {{ pillarIndex + 1 }} of {{ pillarCount }}
        </span>
      </div>
      <!-- Pillar Description -->
      <div class="mt-2">
        <TemplateStudioRichTextEditor
          :model-value="pillar.description || ''"
          :limit="150"
          :show-lists="false"
          :compact="true"
          :readonly="readonly"
          placeholder="Brief description of this pillar (one sentence)..."
          @update:model-value="$emit('update-pillar-description', $event)"
        />
      </div>
    </div>

    <!-- Questions -->
    <TransitionGroup ref="sortableRef" name="question-list" tag="div">
      <TemplateStudioQuestionCard
        v-for="(question, questionIndex) in pillar.questions"
        :key="question.id"
        :question="question"
        :question-slug="getQuestionSlug(pillar.slug, question.order)"
        :is-expanded="expandedQuestionId === question.id"
        :has-previous-question="questionIndex > 0"
        :has-next-question="questionIndex < pillar.questions.length - 1"
        :readonly="readonly"
        :readonly-reason="readonlyReason"
        :preview-open="previewOpen"
        @preview="$emit('preview')"
        @expand="$emit('expand-question', question.id)"
        @collapse="$emit('collapse-question')"
        @navigate-question="
          (direction: 1 | -1) =>
            $emit('navigate-question', question.id, direction)
        "
        @delete="$emit('delete-question', question.id)"
        @update:type="$emit('update-question', question.id, { type: $event })"
        @update:text="$emit('update-question', question.id, { text: $event })"
        @update:risk-level="
          $emit('update-question', question.id, { riskLevel: $event })
        "
        @update:importance="
          $emit('update-question', question.id, { importance: $event })
        "
        @add-practice="$emit('add-practice', question.id, $event)"
        @update-practice="
          (id: string, text: string) =>
            $emit('update-practice', question.id, id, text)
        "
        @delete-practice="
          (id: string) => $emit('delete-practice', question.id, id)
        "
        @add-checklist-item="$emit('add-checklist-item', question.id, $event)"
        @update-checklist-item="
          (id: string, text: string) =>
            $emit('update-checklist-item', question.id, id, text)
        "
        @delete-checklist-item="
          (id: string) => $emit('delete-checklist-item', question.id, id)
        "
        @reorder-checklist-items="
          (from: number, to: number) =>
            $emit('reorder-checklist-items', question.id, from, to)
        "
        @add-link="
          (title: string, url: string) =>
            $emit('add-link', question.id, title, url)
        "
        @update-link="
          (index: number, title: string, url: string) =>
            $emit('update-link', question.id, index, title, url)
        "
        @delete-link="
          (index: number) => $emit('delete-link', question.id, index)
        "
        @reorder-links="
          (from: number, to: number) =>
            $emit('reorder-links', question.id, from, to)
        "
        @reorder-practices="
          (from: number, to: number) =>
            $emit('reorder-practices', question.id, from, to)
        "
      />
    </TransitionGroup>

    <!-- Add Question -->
    <div class="mt-3" :title="readonly ? readonlyReason : undefined">
      <div
        class="group border-accented flex items-center gap-3 rounded-lg border-[1.5px] border-dashed px-4 py-4 transition-colors disabled:opacity-50 dark:border-slate-600"
        :class="
          readonly || questionLimitReached
            ? 'cursor-not-allowed opacity-45'
            : 'hover:border-primary/50 cursor-text dark:hover:border-slate-500'
        "
        @click="!readonly && !questionLimitReached && focusAddQuestionInput()"
      >
        <Icon
          name="lucide:plus"
          class="text-dimmed group-hover:text-muted h-5 w-5"
        />
        <input
          ref="addQuestionInputRef"
          v-model="newQuestionText"
          type="text"
          data-add-question-input
          :disabled="readonly || questionLimitReached"
          class="text-default placeholder:text-dimmed flex-1 bg-transparent text-base focus:outline-none disabled:cursor-not-allowed"
          :placeholder="
            readonly ? 'Adding questions is unavailable' : 'Add a question...'
          "
          @keydown.enter="addQuestion"
          @blur="addQuestion"
        />
        <span v-if="newQuestionText" class="text-muted text-[13px]">
          Press
          <kbd
            class="border-default bg-muted rounded border px-1.5 py-0.5 font-mono text-[13px] dark:border-slate-700 dark:bg-slate-800"
            >Enter</kbd
          >
          to add
        </span>
      </div>
      <p v-if="questionLimitReached" class="text-muted mt-2 text-[13px]">
        A scored template supports at most 10 questions. Remove a question to
        add another.
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-if="pillar.questions.length === 0 && !newQuestionText"
      class="mt-6 flex flex-col items-center py-12 text-center"
    >
      <div class="bg-muted mb-4 rounded-full p-3">
        <Icon name="lucide:file-question" class="text-dimmed h-6 w-6" />
      </div>
      <h3 class="text-default text-sm font-semibold">No questions yet</h3>
      <p class="text-muted mt-1 max-w-xs text-[13px]">
        Add your first question to start building this pillar.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TemplatePillar, TemplateQuestion } from "~/models";
import Sortable, { type SortableEvent } from "sortablejs";

const props = withDefaults(
  defineProps<{
    pillar: TemplatePillar;
    expandedQuestionId: string | null;
    getQuestionSlug: (pillarSlug: string, order: number) => string;
    pillarIndex?: number;
    pillarCount?: number;
    readonly?: boolean;
    readonlyReason?: string;
    previewOpen?: boolean;
    questionLimitReached?: boolean;
  }>(),
  {
    pillarIndex: undefined,
    pillarCount: undefined,
    readonly: false,
    readonlyReason: undefined,
    previewOpen: false,
    questionLimitReached: false,
  }
);

const emit = defineEmits<{
  "add-question": [text: string];
  "delete-question": [questionId: string];
  preview: [];
  "expand-question": [questionId: string];
  "collapse-question": [];
  "navigate-question": [questionId: string, direction: 1 | -1];
  "update-question": [questionId: string, updates: Partial<TemplateQuestion>];
  "add-practice": [questionId: string, text: string];
  "update-practice": [questionId: string, practiceId: string, text: string];
  "delete-practice": [questionId: string, practiceId: string];
  "add-checklist-item": [questionId: string, text: string];
  "update-checklist-item": [questionId: string, itemId: string, text: string];
  "delete-checklist-item": [questionId: string, itemId: string];
  "reorder-checklist-items": [
    questionId: string,
    fromIndex: number,
    toIndex: number,
  ];
  "add-link": [questionId: string, title: string, url: string];
  "update-link": [
    questionId: string,
    index: number,
    title: string,
    url: string,
  ];
  "delete-link": [questionId: string, index: number];
  "reorder-links": [questionId: string, fromIndex: number, toIndex: number];
  "reorder-practices": [questionId: string, fromIndex: number, toIndex: number];
  "reorder-questions": [fromIndex: number, toIndex: number];
  "update-pillar-description": [description: string];
}>();

const newQuestionText = ref("");
const sortableRef = ref<ComponentPublicInstance | null>(null);
const questionSortable = shallowRef<Sortable | null>(null);
const addQuestionInputRef = ref<HTMLInputElement | null>(null);

const focusAddQuestionInput = () => {
  if (!props.questionLimitReached) addQuestionInputRef.value?.focus();
};

onMounted(() => {
  if (sortableRef.value?.$el) {
    questionSortable.value = Sortable.create(sortableRef.value.$el, {
      animation: 200,
      handle: ".drag-handle", // Only drag via handle
      ghostClass: "sortable-ghost",
      onEnd: (evt: SortableEvent) => {
        if (
          evt.oldIndex !== undefined &&
          evt.newIndex !== undefined &&
          evt.oldIndex !== evt.newIndex
        ) {
          emit("reorder-questions", evt.oldIndex, evt.newIndex);
        }
      },
    });
  }
});

onUnmounted(() => questionSortable.value?.destroy());

const addQuestion = () => {
  if (!props.questionLimitReached && newQuestionText.value.trim()) {
    emit("add-question", newQuestionText.value.trim());
    newQuestionText.value = "";
  }
};
</script>

<style scoped>
.question-list-move,
.question-list-enter-active,
.question-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.question-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.question-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.question-list-leave-active {
  position: absolute;
  width: 100%;
}

.sortable-ghost {
  opacity: 0.5;
  background-color: var(--ui-bg-muted);
}

.dark .sortable-ghost {
  background-color: rgba(30, 41, 59, 0.5); /* slate-800/50 */
}
</style>
