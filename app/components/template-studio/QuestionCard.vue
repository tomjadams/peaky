<template>
  <article
    data-testid="question-card"
    :data-readonly="readonly"
    :data-expanded="isExpanded"
    class="question-card group/card relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    :class="[
      isExpanded
        ? `border-accented bg-default rounded-b-lg border border-t-2 dark:bg-slate-900 ${severityRuleClass}`
        : 'border-muted hover:bg-muted/50 border-t',
    ]"
  >
    <!-- Severity is the row's leading edge. Collapsed, a short tick flush to
         the card's left edge says what this question is worth before a word
         of it is read; expanded, the same reading moves into the card's own
         2px top rule (see `severityRuleClass`). Critical and High are the
         only alarms — Medium takes pencil gray, and an unrecognised value
         takes no mark at all rather than inventing one. -->
    <span
      v-if="!isExpanded && severityTickClass"
      class="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
      :class="severityTickClass"
      aria-hidden="true"
    />

    <!-- Expanded, the card is the sheet: it takes the screen's one heavy top
         rule (the pillar sheet behind it drops to a hairline) — inked by
         severity rather than plain ink — and wears the same hairline
         registration marks as the Guided Drafting Room's paper. -->
    <template v-if="isExpanded">
      <span class="reg-mark reg-mark-tl" aria-hidden="true" />
      <span class="reg-mark reg-mark-tr" aria-hidden="true" />
      <span class="reg-mark reg-mark-bl" aria-hidden="true" />
      <span class="reg-mark reg-mark-br" aria-hidden="true" />
    </template>

    <!-- Header Row -->
    <div
      class="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-3 px-5"
      :class="isExpanded ? 'py-4' : 'py-5'"
      @click="handleHeaderClick"
    >
      <!-- Drag handle is useful only while the row is collapsed. -->
      <UTooltip v-if="!readonly && !isExpanded" text="Drag to reorder">
        <div class="drag-handle text-dimmed cursor-grab transition-colors">
          <Icon name="lucide:grip-vertical" class="h-4 w-4" />
        </div>
      </UTooltip>

      <!-- Question Number -->
      <span
        class="bg-primary/10 text-primary shrink-0 rounded px-2 py-0.5 font-mono text-[13px] font-semibold"
      >
        {{ questionSlug }}
      </span>

      <!-- Question Preview -->
      <div
        class="flex-1"
        :class="isExpanded ? 'min-w-[12rem] lg:min-w-0' : 'min-w-0'"
      >
        <h3
          :id="questionTitleId"
          class="text-highlighted dark:text-slate-200"
          :class="isExpanded ? 'text-sm' : 'truncate text-base'"
        >
          <template v-if="question.text">
            <InlineMarkdown :text="question.text" />
          </template>
          <span v-else class="text-dimmed italic">Untitled question</span>
        </h3>
      </div>

      <button
        v-if="!isExpanded && !readonly"
        ref="placementShortcutRef"
        type="button"
        data-testid="edit-follow-up-placement"
        class="text-muted hover:text-primary hover:bg-primary/5 focus-visible:ring-primary flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        :aria-label="`Edit Follow-up placement, ${placementSummary.full}`"
        :title="`Edit Follow-up placement, ${placementSummary.full}`"
        @click.stop="openPlacement"
      >
        <Icon name="lucide:route" class="text-primary h-3.5 w-3.5 shrink-0" />
        <span class="hidden sm:inline">
          Placement · {{ placementSummary.compact }}
        </span>
        <span class="sm:hidden">{{ placementSummary.compact }}</span>
      </button>

      <!-- View Mode Toggle (only when expanded) -->
      <div
        v-if="isExpanded && !readonly"
        class="border-default bg-default order-last ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5 lg:order-none lg:ml-0"
        role="group"
        aria-label="Question editor mode"
        @click.stop
      >
        <!-- Guided button — opens the full-screen drafting room -->
        <button
          type="button"
          data-testid="view-mode-guided"
          :data-active="viewMode === 'guided'"
          :aria-pressed="viewMode === 'guided'"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
          :class="
            viewMode === 'guided'
              ? 'ring-primary/30 text-primary bg-[#EAF3FA] font-bold ring-1 ring-inset dark:bg-sky-400/10'
              : 'text-muted hover:text-default font-semibold'
          "
          @click.stop="selectGuided"
        >
          <Icon name="lucide:list" class="h-3.5 w-3.5" />
          Guided
        </button>

        <!-- Compact button -->
        <button
          type="button"
          data-testid="view-mode-compact"
          :data-active="viewMode === 'compact'"
          :aria-pressed="viewMode === 'compact'"
          class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-200"
          :class="
            viewMode === 'compact'
              ? 'ring-primary/30 text-primary bg-[#EAF3FA] font-bold ring-1 ring-inset dark:bg-sky-400/10'
              : 'text-muted hover:text-default font-semibold'
          "
          @click.stop="selectCompact"
        >
          <Icon name="lucide:columns-2" class="h-3.5 w-3.5" />
          Compact
        </button>
      </div>

      <!-- Risk Badge -->
      <div class="shrink-0" @click.stop>
        <TemplateStudioRiskLevelDropdown
          :model-value="question.riskLevel"
          :disabled="readonly"
          @update:model-value="updateRiskLevel"
        />
      </div>

      <!-- Expand Toggle -->
      <button
        ref="expandToggleRef"
        type="button"
        class="hover:bg-primary/10 hover:text-primary text-dimmed shrink-0 rounded-md p-1 transition-colors dark:hover:bg-slate-700"
        :aria-label="`${isExpanded ? 'Collapse' : 'Expand'} question ${questionSlug}`"
        :aria-expanded="isExpanded"
        :aria-controls="questionDetailsId"
        @click.stop="toggleExpand"
      >
        <Icon
          :name="isExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="h-4 w-4"
        />
      </button>
    </div>

    <div :id="questionDetailsId">
      <div
        v-if="isExpanded && readonly"
        class="border-warning/20 bg-warning/10 text-default flex items-center gap-2 border-t px-5 py-3 text-sm"
        role="status"
      >
        <Icon
          name="lucide:lock-keyhole"
          class="text-warning h-4 w-4 shrink-0"
        />
        <span class="font-semibold">Read-only</span>
        <span class="text-muted">{{
          readonlyReason ??
          "You can view this question, but you cannot edit it."
        }}</span>
      </div>

      <!-- Guided, expanded — the room owns the actual editing surface, so this
         is a slim hand-off row rather than an inline body. Without it the
         expanded header reads as a broken, empty husk once Done has closed
         the room but left the row expanded. -->
      <div
        v-if="viewMode === 'guided' && isExpanded && !readonly"
        class="border-muted flex items-center justify-between border-t px-5 py-4 dark:border-slate-700/20"
      >
        <p class="text-muted text-[15px]">
          Guided drafting happens in a full-screen room.
        </p>
        <UButton
          data-testid="open-drafting-room"
          size="sm"
          color="primary"
          variant="solid"
          @click="openDraftingRoom"
        >
          Open drafting room
        </UButton>
      </div>

      <!-- Expanded Content — Compact mode only. Guided opens the full-screen
         drafting room instead (see TemplateStudioGuidedDraftingRoom below). -->
      <div
        v-if="viewMode === 'compact' || readonly"
        :inert="!isExpanded"
        :aria-hidden="!isExpanded"
        class="grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        :class="
          isExpanded
            ? 'border-muted grid-rows-[1fr] border-t opacity-100 dark:border-slate-700/20'
            : 'grid-rows-[0fr] opacity-0'
        "
      >
        <div class="min-h-0 overflow-hidden">
          <TemplateStudioQuestionCardCompactView
            :question="question"
            :readonly="readonly"
            :readonly-reason="readonlyReason"
            @collapse="emit('collapse')"
            @delete="emit('delete')"
            @update:type="(value) => emit('update:type', value)"
            @update:text="updateText"
            @update:importance="updateImportance"
            @add-practice="addPractice"
            @update-practice="updatePractice"
            @delete-practice="(id) => emit('delete-practice', id)"
            @add-checklist-item="(text) => emit('add-checklist-item', text)"
            @update-checklist-item="
              (id, text) => emit('update-checklist-item', id, text)
            "
            @delete-checklist-item="(id) => emit('delete-checklist-item', id)"
            @reorder-checklist-items="
              (fromIndex, toIndex) =>
                emit('reorder-checklist-items', fromIndex, toIndex)
            "
            @add-link="(title, url) => emit('add-link', title, url)"
            @update-link="
              (index, title, url) => emit('update-link', index, title, url)
            "
            @delete-link="(index) => emit('delete-link', index)"
            @reorder-links="
              (fromIndex, toIndex) => emit('reorder-links', fromIndex, toIndex)
            "
            @reorder-practices="
              (fromIndex, toIndex) =>
                emit('reorder-practices', fromIndex, toIndex)
            "
          />
        </div>
      </div>
    </div>

    <!-- Guided Drafting Room — full-screen takeover, always mounted so its
         own enter/leave transition can play; visibility is driven by
         `roomOpen`, not a v-if here. -->
    <TemplateStudioGuidedDraftingRoom
      :open="roomOpen"
      :question="question"
      :question-slug="questionSlug"
      :has-previous-question="hasPreviousQuestion"
      :has-next-question="hasNextQuestion"
      :preview-open="previewOpen"
      :requested-section-id="guidedRequestedSectionId"
      @preview="emit('preview')"
      @close="handleRoomClose"
      @navigate-question="handleNavigateQuestion"
      @delete="emit('delete')"
      @update:type="(value) => emit('update:type', value)"
      @update:text="updateText"
      @update:importance="updateImportance"
      @add-practice="addPractice"
      @update-practice="updatePractice"
      @delete-practice="(id) => emit('delete-practice', id)"
      @add-checklist-item="(text) => emit('add-checklist-item', text)"
      @update-checklist-item="
        (id, text) => emit('update-checklist-item', id, text)
      "
      @delete-checklist-item="(id) => emit('delete-checklist-item', id)"
      @reorder-checklist-items="
        (fromIndex, toIndex) =>
          emit('reorder-checklist-items', fromIndex, toIndex)
      "
      @add-link="(title, url) => emit('add-link', title, url)"
      @update-link="
        (index, title, url) => emit('update-link', index, title, url)
      "
      @delete-link="(index) => emit('delete-link', index)"
      @reorder-links="
        (fromIndex, toIndex) => emit('reorder-links', fromIndex, toIndex)
      "
      @reorder-practices="
        (fromIndex, toIndex) => emit('reorder-practices', fromIndex, toIndex)
      "
    />
  </article>
</template>

<script setup lang="ts">
import type { TemplateQuestion, RiskLevel } from "~/models";
import { useQuestionEditorMode } from "~/composables/templates/useQuestionEditorMode";
import { useDraftingRoomHandoff } from "~/composables/templates/useDraftingRoomHandoff";
import { maturityDefinition } from "~/composables/templates/studio/useTemplateStudio-maturity";
import { MATURITY_STAGES } from "~/services/maturity/stages";

const { viewMode } = useQuestionEditorMode();
const { lastHandoffAt, markHandoff } = useDraftingRoomHandoff();

const props = defineProps<{
  question: TemplateQuestion;
  questionSlug: string;
  isExpanded: boolean;
  hasPreviousQuestion: boolean;
  hasNextQuestion: boolean;
  readonly?: boolean;
  readonlyReason?: string;
  previewOpen?: boolean;
}>();

const emit = defineEmits<{
  expand: [];
  collapse: [];
  delete: [];
  preview: [];
  "navigate-question": [direction: 1 | -1];
  "update:type": [value: "yes-no" | "checklist"];
  "update:text": [value: string];
  "update:riskLevel": [value: RiskLevel];
  "update:importance": [value: string];
  "add-practice": [text: string];
  "update-practice": [id: string, text: string];
  "delete-practice": [id: string];
  "add-checklist-item": [text: string];
  "update-checklist-item": [id: string, text: string];
  "delete-checklist-item": [id: string];
  "reorder-checklist-items": [fromIndex: number, toIndex: number];
  "add-link": [title: string, url: string];
  "update-link": [index: number, title: string, url: string];
  "delete-link": [index: number];
  "reorder-links": [fromIndex: number, toIndex: number];
  "reorder-practices": [fromIndex: number, toIndex: number];
}>();

const SEVERITY_RULE: Record<RiskLevel, string> = {
  critical: "border-t-[color:#B91C1C] dark:border-t-red-400",
  high: "border-t-[color:#B45309] dark:border-t-amber-400",
  medium: "border-t-inverted",
};

const SEVERITY_TICK: Record<RiskLevel, string> = {
  critical: "bg-[#B91C1C] dark:bg-red-400",
  high: "bg-[#B45309] dark:bg-amber-400",
  medium: "bg-[#94A3B8] dark:bg-slate-500",
};

const severityRuleClass = computed(
  () => SEVERITY_RULE[props.question.riskLevel]
);

const severityTickClass = computed(
  () => SEVERITY_TICK[props.question.riskLevel]
);

const stageName = (stageNumber: number) =>
  MATURITY_STAGES.find((stage) => stage.stage === stageNumber)?.name ??
  `Stage ${stageNumber}`;
const placementSummary = computed(() => {
  const associations = maturityDefinition.value?.associations;
  const questionStage = associations?.questions[props.question.id] ?? 1;
  const checklistItems = props.question.checklistItems ?? [];
  const stageNumbers =
    props.question.type === "checklist" && checklistItems.length > 0
      ? checklistItems.map(
          (item) =>
            associations?.practices[props.question.id]?.[item.id] ??
            questionStage
        )
      : [questionStage];
  const uniqueStages = [...new Set(stageNumbers)].toSorted(
    (left, right) => left - right
  );
  if (uniqueStages.length === 1) {
    const stage = uniqueStages[0]!;
    const name = stageName(stage);
    return {
      compact: `Stage ${stage}`,
      full: `Stage ${stage} · ${name}`,
    };
  }
  const stageList = uniqueStages.join(", ");
  return {
    compact: `Mixed · ${uniqueStages.length} stages`,
    full: `Mixed · stages ${stageList}`,
  };
});

const questionTitleId = computed(() => `question-${props.question.id}-title`);
const questionDetailsId = computed(
  () => `question-${props.question.id}-details`
);

const handleHeaderClick = () => {
  toggleExpand();
};

const toggleExpand = () => {
  if (props.isExpanded) {
    emit("collapse");
  } else {
    emit("expand");
  }
};

// ---------------------------------------------------------------------------
// Guided Drafting Room — full-screen takeover state.
//
// `roomOpen` is local: `expandedQuestionId` (owned by the page, one question
// at a time) already guarantees only one card is ever expanded, so watching
// `isExpanded` here is enough to keep the room in lockstep with it — no need
// to lift this state up.
// ---------------------------------------------------------------------------

const roomOpen = ref(false);
const guidedRequestedSectionId = ref<string | undefined>();
const expandToggleRef = ref<HTMLButtonElement | null>(null);
const placementShortcutRef = ref<HTMLButtonElement | null>(null);
const roomReturnFocusRef = shallowRef<HTMLElement | null>(null);

// A normal expansion shows the summary first and opens the room only after the
// explicit action. Cross-question handoffs reopen it directly. Collapsing the
// card always closes the room.
watch(
  () => props.isExpanded,
  (expanded) => {
    if (!expanded) {
      roomOpen.value = false;
      return;
    }
    if (
      viewMode.value === "guided" &&
      lastHandoffAt.value !== null &&
      Date.now() - lastHandoffAt.value < 1000
    ) {
      guidedRequestedSectionId.value = undefined;
      roomReturnFocusRef.value = expandToggleRef.value;
      roomOpen.value = true;
    }
  }
);

const openDraftingRoom = (event?: Event) => {
  guidedRequestedSectionId.value = undefined;
  roomReturnFocusRef.value =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : expandToggleRef.value;
  roomOpen.value = true;
};

const openPlacement = () => {
  guidedRequestedSectionId.value = "follow-up-placement";
  roomReturnFocusRef.value = placementShortcutRef.value;
  roomOpen.value = true;
};

const selectGuided = (event: Event) => {
  viewMode.value = "guided";
  openDraftingRoom(event);
};

const selectCompact = () => {
  viewMode.value = "compact";
  roomOpen.value = false;
};

// The room's Done button / Escape key: changes are already saved through
// the same autosave path as Compact, so closing never discards anything.
// This only hides the takeover — it does not collapse the row, since the
// mode toggle (and a route back to Compact) needs to stay reachable.
const handleRoomClose = () => {
  const returnTarget = roomReturnFocusRef.value ?? expandToggleRef.value;
  roomOpen.value = false;
  guidedRequestedSectionId.value = undefined;
  roomReturnFocusRef.value = null;
  nextTick(() => {
    if (returnTarget?.isConnected) returnTarget.focus();
  });
};

// The header's chevrons move `expandedQuestionId` to a neighbouring
// question, closing this room and opening a sibling QuestionCard's room a
// beat later. Mark the moment so that sibling's room can recognise this as
// a hand-off and play the abbreviated entrance instead of the full one.
const handleNavigateQuestion = (direction: 1 | -1) => {
  markHandoff();
  roomOpen.value = false;
  guidedRequestedSectionId.value = undefined;
  emit("navigate-question", direction);
};

const updateText = (value: string) => {
  if (value !== props.question.text) emit("update:text", value);
};

const updateRiskLevel = (value: RiskLevel) => {
  if (value !== props.question.riskLevel) emit("update:riskLevel", value);
};

const updateImportance = (value: string) => {
  if (value !== props.question.importance) emit("update:importance", value);
};

const updatePractice = (id: string, text: string) => {
  emit("update-practice", id, text);
};

const addPractice = () => {
  emit("add-practice", "");
};
</script>

<style scoped>
/* Smooth transition for expand/collapse */
.question-card {
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

/* Registration marks — the same hairline L-marks as the pillar sheet and the
   drafting room's paper, at card scale. Decorative only. */
.reg-mark {
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  z-index: 1;
}
.reg-mark::before,
.reg-mark::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  background: var(--ui-border);
}
.dark .reg-mark::before,
.dark .reg-mark::after {
  background: #334155;
}
.reg-mark::before {
  width: 10px;
  height: 1px;
}
.reg-mark::after {
  width: 1px;
  height: 10px;
}
.reg-mark-tl {
  top: 8px;
  left: 8px;
}
.reg-mark-tr {
  top: 8px;
  right: 8px;
  transform: scaleX(-1);
}
.reg-mark-bl {
  bottom: 8px;
  left: 8px;
  transform: scaleY(-1);
}
.reg-mark-br {
  bottom: 8px;
  right: 8px;
  transform: scale(-1);
}

/* Expanded card content animation */
.question-card :deep(.border-t) {
  animation: slideDown 0.25s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
