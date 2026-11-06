<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useHandoffCopy } from "~/composables/handoff/useHandoffCopy";
import { useHandoffSyncGate } from "~/composables/handoff/useHandoffSyncGate";
import {
  resolveCurrentAssociation,
  type AssociationTransition,
} from "~/services/handoff/association";
import type {
  HandoffDraft,
  HandoffPracticeRecord,
  OrderedDraftPractice,
} from "~/services/handoff/draft";
import {
  clearHandoffPractices,
  deselectHandoffPractice,
  reorderHandoffPractice,
  setHandoffPracticeRationale,
} from "~/services/handoff/handoffWrite";
import { HandoffLimitError } from "~/services/handoff/limits";
import {
  practiceEntityId,
  type PracticeReference,
} from "~/services/handoff/practice";
import type { HandoffMaturityPreview } from "~/services/maturity/handoffPreview";
import {
  maturityStage,
  type MaturityStageNumber,
} from "~/services/maturity/stages";
import HandoffAssociationForm from "~/components/handoff/HandoffAssociationForm.vue";
import HandoffDraftItem from "~/components/handoff/HandoffDraftItem.vue";
import HandoffReplaceModal from "~/components/handoff/HandoffReplaceModal.vue";

interface Props {
  draft: HandoffDraft;
  rows: readonly HandoffPracticeRecord[];
  history: readonly AssociationTransition[];
  maturityPreviews?: readonly HandoffMaturityPreview[];
  active?: boolean;
  practicePathFor: (reference: PracticeReference) => string;
  reviewPath?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ changed: []; complete: [] }>();

const { gate } = useHandoffSyncGate();
const announcement = ref("");
const copyNoticeDismissed = ref(false);
const linkSuccessMessage = ref("");
const showAssociationForm = ref(false);
const replaceTarget = ref<AssociationTransition | null>(null);
const draggingId = ref<string | null>(null);
const dragTargetId = ref<string | null>(null);
const dragPlacement = ref<"before" | "after" | null>(null);
const listRef = ref<HTMLElement | null>(null);
const pendingFocusId = ref<string | null>(null);
const optimisticPractices = ref<readonly OrderedDraftPractice[] | null>(null);

const practices = computed<readonly OrderedDraftPractice[]>(
  () =>
    optimisticPractices.value ??
    (props.draft.kind === "ready" ? props.draft.practices : [])
);
const roundTenth = (value: number): number => Math.round(value * 10) / 10;
const maturityMovement = computed(() =>
  (props.maturityPreviews ?? [])
    .filter(
      (preview) =>
        preview.selectedCount > 0 && preview.delta.displayPercentagePoints > 0
    )
    .map((preview) => {
      const targetStage = preview.crossesStage
        ? preview.projected.stage
        : preview.projected.stage.stage < 5
          ? maturityStage(
              (preview.projected.stage.stage + 1) as MaturityStageNumber
            )
          : null;
      const totalGap = preview.crossesStage
        ? preview.delta.displayPercentagePoints
        : roundTenth(
            preview.delta.displayPercentagePoints +
              (preview.pointsStillNeeded?.displayPercentagePoints ?? 0)
          );
      return {
        templateRevisionId: preview.templateRevisionId,
        templateName:
          props.rows.find(
            (row) =>
              row.reference.templateRevisionId === preview.templateRevisionId
          )?.snapshot.templateName ?? "Pinned template",
        current: preview.current.displayPercentTenths,
        projected: preview.projected.displayPercentTenths,
        delta: preview.delta.displayPercentagePoints,
        targetStage,
        reachedTargetStage: preview.crossesStage,
        totalGap,
        gapProgress:
          targetStage && totalGap > 0
            ? preview.crossesStage
              ? 100
              : Math.min(
                  99,
                  (preview.delta.displayPercentagePoints / totalGap) * 100
                )
            : null,
      };
    })
);
const copyDraft = computed<HandoffDraft>(() =>
  props.draft.kind === "ready"
    ? { ...props.draft, practices: practices.value }
    : props.draft
);
const {
  status: copyStatus,
  failureReason: copyFailureReason,
  canCopy,
  copy,
} = useHandoffCopy({
  draft: copyDraft,
  reviewPath: () => props.reviewPath,
  practicePath: (practice) => props.practicePathFor(practice.record.reference),
});
const handoffItemId = (entityId: string): string =>
  `handoff-practice-${encodeURIComponent(entityId)}`;

watch(
  () => props.draft,
  (draft) => {
    const optimistic = optimisticPractices.value;
    if (!optimistic) return;
    if (draft.kind !== "ready") {
      optimisticPractices.value = null;
      return;
    }
    const persisted = draft.practices.map((practice) => practice.record.id);
    const visible = optimistic.map((practice) => practice.record.id);
    if (
      persisted.length === visible.length &&
      persisted.every((id, index) => id === visible[index])
    ) {
      optimisticPractices.value = null;
    }
  }
);
watch(
  practices,
  () => {
    if (!pendingFocusId.value) return;
    const entityId = pendingFocusId.value;
    pendingFocusId.value = null;
    void nextTick(() => {
      const item = listRef.value?.querySelector(
        `[data-practice-id="${entityId}"]`
      );
      (item?.querySelector('[data-move="up"]') as HTMLElement | null)?.focus();
    });
  },
  { flush: "post" }
);

const currentAssociationFor = (entityId: string) =>
  resolveCurrentAssociation(props.history, entityId);
const replaceTitle = computed(() => {
  const target = replaceTarget.value;
  if (!target) return "";
  const entityId = practiceEntityId(target.practice);
  return (
    practices.value.find((practice) => practice.record.id === entityId)?.record
      .snapshot.title ?? ""
  );
});
const handleReplaceRequest = (reference: PracticeReference) => {
  replaceTarget.value = resolveCurrentAssociation(
    props.history,
    practiceEntityId(reference)
  );
};
const handleRemove = async (entityId: string) => {
  await deselectHandoffPractice({
    rows: props.rows,
    entityId,
    updatedAt: new Date().toISOString(),
  });
  emit("changed");
};
const handleClearAll = async () => {
  await clearHandoffPractices({
    rows: props.rows,
    updatedAt: new Date().toISOString(),
  });
  announcement.value = "All practices removed from the handoff.";
  emit("changed");
};
const handleMove = async (entityId: string, toIndex: number, title: string) => {
  const fromIndex = practices.value.findIndex(
    (practice) => practice.record.id === entityId
  );
  const total = practices.value.length;
  const clamped = Math.max(0, Math.min(toIndex, total - 1));
  if (fromIndex === -1 || clamped === fromIndex) return;

  pendingFocusId.value = entityId;
  const reordered = [...practices.value];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return;
  reordered.splice(clamped, 0, moved);
  optimisticPractices.value = reordered.map((practice, index) => ({
    record: practice.record,
    position: index + 1,
    total,
  }));

  try {
    await reorderHandoffPractice({
      rows: props.rows,
      entityId,
      toIndex: clamped,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    pendingFocusId.value = null;
    optimisticPractices.value = null;
    announcement.value =
      error instanceof HandoffLimitError
        ? error.message
        : "The reorder could not be saved.";
    return;
  }
  announcement.value = `"${title}" moved to position ${clamped + 1} of ${total}.`;
  emit("changed");
};
const handleSaveRationale = async (entityId: string, value: string) => {
  try {
    await setHandoffPracticeRationale({
      rows: props.rows,
      entityId,
      rationale: value,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    announcement.value =
      error instanceof HandoffLimitError
        ? error.message
        : "The handoff note could not be saved.";
    return;
  }
  emit("changed");
};
const clearDragState = () => {
  draggingId.value = null;
  dragTargetId.value = null;
  dragPlacement.value = null;
};
const handleDragStart = (event: DragEvent, entityId: string) => {
  draggingId.value = entityId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entityId);
  }
};
const handleDragOver = (event: DragEvent, targetEntityId: string) => {
  if (!draggingId.value || draggingId.value === targetEntityId) return;
  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  dragTargetId.value = targetEntityId;
  dragPlacement.value =
    event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
};
const handleDrop = async (targetEntityId: string) => {
  const from = draggingId.value;
  const placement = dragPlacement.value;
  const targetIndex = practices.value.findIndex(
    (practice) => practice.record.id === targetEntityId
  );
  const fromIndex = practices.value.findIndex(
    (practice) => practice.record.id === from
  );
  const moved = practices.value.find((practice) => practice.record.id === from);
  clearDragState();
  if (!from || !placement || from === targetEntityId || targetIndex === -1) {
    return;
  }
  let destination = targetIndex + (placement === "after" ? 1 : 0);
  if (fromIndex < destination) destination -= 1;
  if (!moved) return;
  await handleMove(from, destination, moved.record.snapshot.title);
};
const handleCopy = async () => {
  copyNoticeDismissed.value = false;
  await copy();
};
const handleConfirmed = () => {
  showAssociationForm.value = false;
  linkSuccessMessage.value = "Existing work item linked to the handoff.";
  announcement.value = linkSuccessMessage.value;
  emit("changed");
};
const handleReplaced = () => {
  replaceTarget.value = null;
  linkSuccessMessage.value =
    "Reference replaced; previous history is retained.";
  announcement.value = linkSuccessMessage.value;
  emit("changed");
};
</script>

<template>
  <section
    class="border-default bg-elevated min-w-0 rounded-lg border p-5 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col"
    aria-labelledby="handoff-composer-heading"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h3
        id="handoff-composer-heading"
        class="text-highlighted text-xl font-extrabold"
      >
        Handoff
      </h3>
      <span class="text-muted text-sm tabular-nums">
        {{ practices.length }} selected
      </span>
    </div>
    <p class="text-muted mt-1 text-sm">
      Build the delivery sequence as you select work.
    </p>
    <p role="status" aria-live="polite" class="sr-only">{{ announcement }}</p>

    <div
      v-if="maturityMovement.length > 0"
      class="border-default mt-4 border-y py-3"
      aria-label="Potential maturity movement"
    >
      <p class="text-muted text-[13px] font-semibold">
        Potential maturity movement
      </p>
      <div
        v-for="movement in maturityMovement"
        :key="movement.templateRevisionId"
        class="mt-3"
      >
        <div
          class="flex flex-col items-start gap-1 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <span
            class="text-default max-w-full font-semibold sm:min-w-0 sm:truncate"
          >
            {{ movement.templateName }}
          </span>
          <span class="text-success shrink-0 font-semibold tabular-nums">
            {{ movement.current }}% → {{ movement.projected }}% · +{{
              movement.delta
            }}
          </span>
        </div>
        <template v-if="movement.targetStage && movement.gapProgress !== null">
          <div
            class="text-muted mt-2 flex items-center justify-between gap-3 text-[13px]"
          >
            <span>
              {{ movement.reachedTargetStage ? "Reached" : "Toward" }}
              Stage {{ movement.targetStage.stage }} ·
              {{ movement.targetStage.name }}
            </span>
            <span class="shrink-0 tabular-nums">
              {{ movement.delta }} of {{ movement.totalGap }} pts
            </span>
          </div>
          <div
            class="bg-muted relative mt-1.5 h-2 overflow-hidden rounded-[2px]"
            role="img"
            :aria-label="`${movement.templateName}: selected practices cover ${movement.delta} of ${movement.totalGap} maturity points and ${movement.reachedTargetStage ? 'reach' : 'move toward'} Stage ${movement.targetStage.stage}, ${movement.targetStage.name}.`"
          >
            <span
              data-movement-fill
              class="bg-success/75 absolute inset-y-0 left-0 min-w-0.5 transition-[width] duration-200 motion-reduce:transition-none"
              :style="{ width: `${movement.gapProgress}%` }"
            />
            <span
              class="absolute inset-y-0 left-0 w-1 bg-[#0284C7] dark:bg-sky-400"
              aria-hidden="true"
            />
          </div>
        </template>
      </div>
    </div>

    <UAlert
      v-if="copyStatus === 'failed' && !copyNoticeDismissed"
      role="alert"
      color="error"
      variant="subtle"
      class="mt-4"
      :title="copyFailureReason ?? 'Copying to the clipboard failed.'"
      close
      @update:open="copyNoticeDismissed = true"
    />
    <Transition name="copy-confirmation">
      <div
        v-if="copyStatus === 'copied' && !copyNoticeDismissed"
        role="status"
        aria-live="polite"
        class="border-success/30 bg-success/5 mt-4 flex items-center gap-3 rounded-lg border px-3 py-3"
      >
        <span
          class="border-success/40 bg-success/10 text-success flex size-9 shrink-0 items-center justify-center rounded-lg border"
          aria-hidden="true"
        >
          <Icon name="lucide:check" class="size-4" />
        </span>
        <span class="min-w-0 flex-1">
          <strong class="text-default block text-sm font-semibold">
            Markdown copied
          </strong>
          <span class="text-muted mt-0.5 block text-[13px]">
            Ready to paste and edit in your tracker.
          </span>
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          aria-label="Dismiss copy confirmation"
          @click="copyNoticeDismissed = true"
        />
      </div>
    </Transition>
    <UAlert
      v-if="linkSuccessMessage"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      class="mt-4"
      :title="linkSuccessMessage"
      close
      @update:open="linkSuccessMessage = ''"
    />
    <div v-if="draft.kind === 'empty'" class="mt-5 py-8 text-center">
      <p class="text-default text-sm font-semibold">
        Select a practice to start
      </p>
      <p class="text-muted mt-1 text-[13px]">
        Your delivery sequence will appear here.
      </p>
    </div>

    <template v-else>
      <div class="mt-5 flex items-center justify-between gap-3">
        <span class="text-muted text-[13px] tabular-nums">
          {{ practices.length }} selected
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          @click="handleClearAll"
        >
          Clear all
        </UButton>
      </div>
      <ol
        ref="listRef"
        aria-label="Selected practices"
        class="border-default mt-2 border-t lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2"
      >
        <TransitionGroup name="handoff-sequence">
          <li
            v-for="practice in practices"
            :id="handoffItemId(practice.record.id)"
            :key="practice.record.id"
            :data-practice-id="practice.record.id"
            tabindex="-1"
            class="relative transition-[opacity,background-color,transform] duration-150"
            :class="[
              draggingId === practice.record.id
                ? 'scale-[0.99] opacity-45'
                : '',
              dragTargetId === practice.record.id ? 'bg-primary/5' : '',
            ]"
            @dragstart="handleDragStart($event, practice.record.id)"
            @dragend="clearDragState"
            @dragover.prevent="handleDragOver($event, practice.record.id)"
            @drop.prevent="handleDrop(practice.record.id)"
          >
            <span
              v-if="dragTargetId === practice.record.id && dragPlacement"
              class="pointer-events-none absolute inset-x-0 z-10 flex items-center"
              :class="dragPlacement === 'before' ? '-top-1' : '-bottom-1'"
              aria-hidden="true"
            >
              <span class="size-2 rounded-full bg-[#0284C7] dark:bg-sky-400" />
              <span class="h-0.5 flex-1 bg-[#0284C7] dark:bg-sky-400" />
              <span class="size-2 rounded-full bg-[#0284C7] dark:bg-sky-400" />
            </span>
            <HandoffDraftItem
              :practice="practice"
              :association="currentAssociationFor(practice.record.id)"
              @remove="handleRemove(practice.record.id)"
              @move="
                (toIndex: number) =>
                  handleMove(
                    practice.record.id,
                    toIndex,
                    practice.record.snapshot.title
                  )
              "
              @save-rationale="
                (value: string) =>
                  handleSaveRationale(practice.record.id, value)
              "
              @replace="
                replaceTarget = currentAssociationFor(practice.record.id)
              "
            />
          </li>
        </TransitionGroup>
      </ol>

      <div v-if="!gate.sharedViewCurrent" class="mt-4 shrink-0">
        <p class="text-muted text-[13px] font-semibold">Saved on this device</p>
        <p class="text-muted mt-1 text-[13px]">
          Existing work-item linking needs a current shared sync view. Copying
          Markdown remains available.
        </p>
      </div>

      <div class="mt-5 grid shrink-0 gap-2">
        <UButton
          color="primary"
          icon="i-lucide-clipboard-copy"
          :disabled="!canCopy"
          class="w-full justify-center"
          @click="handleCopy"
        >
          Copy Markdown
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-link"
          class="w-full justify-center"
          @click="showAssociationForm = true"
        >
          Link existing work item
        </UButton>
      </div>
    </template>

    <div
      v-if="active && practices.length > 0"
      class="border-default mt-5 shrink-0 border-t pt-3"
    >
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-circle-check"
        class="w-full justify-center"
        @click="emit('complete')"
      >
        Close handoff
      </UButton>
      <p class="text-dimmed mt-1 text-center text-[13px]">
        Handoff history is saved on this device.
      </p>
    </div>

    <UModal
      v-model:open="showAssociationForm"
      title="Link existing work item"
      :ui="{ content: 'max-w-xl' }"
    >
      <template #body>
        <HandoffAssociationForm
          embedded
          :practices="practices"
          :history="history"
          @confirmed="handleConfirmed"
          @replace="(conflict) => handleReplaceRequest(conflict.practice)"
        />
      </template>
    </UModal>

    <HandoffReplaceModal
      v-if="replaceTarget"
      :open="true"
      :current="replaceTarget"
      :practice-title="replaceTitle"
      :history="history"
      @update:open="replaceTarget = null"
      @saved="handleReplaced"
    />
  </section>
</template>

<style scoped>
.handoff-sequence-move {
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.copy-confirmation-enter-active,
.copy-confirmation-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.copy-confirmation-enter-from,
.copy-confirmation-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

@media (prefers-reduced-motion: reduce) {
  .handoff-sequence-move,
  .copy-confirmation-enter-active,
  .copy-confirmation-leave-active {
    transition: none;
  }
}
</style>
