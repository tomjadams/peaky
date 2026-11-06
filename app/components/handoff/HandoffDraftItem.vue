<script setup lang="ts">
/**
 * One practice in the ordered handoff draft (improvement-plans/REQ-006,
 * REQ-011; AC-021, AC-023, AC-024, AC-039).
 *
 * Shows the position out of the total, the selection-time snapshot with
 * pinned-Revision and question context, the binary evidence state, any
 * current external reference with an explicit replace entry, and the
 * editable rationale bounded by the shared HandoffLimits contract — an
 * over-limit rationale is rejected with a field-addressable error, never
 * truncated. Reorder controls expose the practice title, position, total,
 * and movement keys; the slideover owns the announcements.
 */
import type { AssociationTransition } from "~/services/handoff/association";
import type { OrderedDraftPractice } from "~/services/handoff/draft";
import {
  characterCount,
  describeHandoffViolation,
  HANDOFF_LIMITS,
  validateRationale,
} from "~/services/handoff/limits";

interface Props {
  practice: OrderedDraftPractice;
  /** Current external association, when one exists (resolved on read). */
  association: AssociationTransition | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  remove: [];
  move: [toIndex: number];
  "save-rationale": [value: string];
  replace: [];
}>();

const rationaleText = ref(props.practice.record.rationale ?? "");
const rationaleError = ref("");
/** Last rationale persisted on the record; unsaved edits are never reset. */
const savedRationale = ref(rationaleText.value);

watch(
  () => props.practice.record.id,
  () => {
    savedRationale.value = props.practice.record.rationale ?? "";
    rationaleText.value = savedRationale.value;
    rationaleError.value = "";
  }
);

// A synchronized rationale change for the same record id (another actor's
// edit) must reach the textarea; an in-progress local edit round-trips to
// the same value and is not clobbered.
watch(
  () => props.practice.record.rationale,
  (next) => {
    const value = next ?? "";
    if (value === savedRationale.value) return;
    savedRationale.value = value;
    rationaleText.value = value;
    rationaleError.value = "";
  }
);

const snapshot = computed(() => props.practice.record.snapshot);

const rationaleCount = computed(() => characterCount(rationaleText.value));

const isFirst = computed(() => props.practice.position === 1);
const isLast = computed(() => props.practice.position === props.practice.total);

const moveUpLabel = computed(
  () =>
    `Move "${snapshot.value.title}" up (position ${props.practice.position} of ${props.practice.total})`
);
const moveDownLabel = computed(
  () =>
    `Move "${snapshot.value.title}" down (position ${props.practice.position} of ${props.practice.total})`
);
const removeLabel = computed(
  () => `Remove "${snapshot.value.title}" from the draft`
);
const replaceLabel = computed(
  () => `Replace the reference for "${snapshot.value.title}"`
);
const rationaleLabel = computed(
  () => `Rationale for "${snapshot.value.title}"`
);

// Boundary controls stay focusable (aria-disabled, never the disabled
// attribute) so a move that lands on the boundary does not drop focus —
// focus stays on the moved practice (AC-024).
const handleMoveUp = () => {
  if (isFirst.value) return;
  emit("move", props.practice.position - 2);
};
const handleMoveDown = () => {
  if (isLast.value) return;
  emit("move", props.practice.position);
};

const handleRationaleBlur = () => {
  const persisted = props.practice.record.rationale ?? "";
  if (rationaleText.value === persisted) return;
  // The shared contract decides — an over-limit value is rejected with a
  // field-addressable error, never truncated (AC-039).
  const violations = validateRationale(rationaleText.value);
  if (violations.length > 0) {
    rationaleError.value = violations.map(describeHandoffViolation).join(" ");
    return;
  }
  rationaleError.value = "";
  emit("save-rationale", rationaleText.value);
};
</script>

<template>
  <div class="border-default border-b py-4">
    <div class="flex items-center justify-between gap-3">
      <span
        draggable="true"
        data-drag-handle
        title="Drag to reorder"
        class="text-dimmed inline-flex cursor-grab items-center gap-1 text-[13px] font-medium active:cursor-grabbing"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="size-4"
          aria-hidden="true"
        />
        {{ practice.position }} of {{ practice.total }}
      </span>
      <div class="flex shrink-0 items-center gap-0.5">
        <UButton
          icon="i-lucide-arrow-up"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-disabled="isFirst"
          :class="{ 'cursor-not-allowed opacity-50': isFirst }"
          :aria-label="moveUpLabel"
          aria-keyshortcuts="Alt+ArrowUp"
          data-move="up"
          @click="handleMoveUp"
          @keydown.alt.arrow-up.prevent="handleMoveUp"
        />
        <UButton
          icon="i-lucide-arrow-down"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-disabled="isLast"
          :class="{ 'cursor-not-allowed opacity-50': isLast }"
          :aria-label="moveDownLabel"
          aria-keyshortcuts="Alt+ArrowDown"
          data-move="down"
          @click="handleMoveDown"
          @keydown.alt.arrow-down.prevent="handleMoveDown"
        />
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="removeLabel"
          @click="emit('remove')"
        />
      </div>
    </div>
    <div class="mt-2 min-w-0">
      <p class="text-default text-sm font-medium">
        <InlineMarkdown :text="snapshot.title" />
      </p>
      <div
        v-if="association?.reference"
        class="mt-2 flex flex-wrap items-center gap-2"
      >
        <span
          v-if="association?.reference"
          class="border-default bg-muted text-muted inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[13px]"
        >
          Linked to {{ association.reference.provider }}
          {{ association.reference.externalId }}
        </span>
        <UButton
          v-if="association?.reference"
          variant="link"
          color="primary"
          size="sm"
          class="p-0"
          :aria-label="replaceLabel"
          @click="emit('replace')"
        >
          Replace…
        </UButton>
      </div>
    </div>

    <details class="mt-2" :open="Boolean(practice.record.rationale)">
      <summary
        class="text-primary focus-visible:ring-primary inline-flex min-h-9 cursor-pointer items-center rounded-[7px] text-[13px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
      >
        {{
          practice.record.rationale ? "Edit handoff note" : "Add a handoff note"
        }}
      </summary>
      <div class="mt-2">
        <UTextarea
          v-model="rationaleText"
          :aria-label="rationaleLabel"
          :rows="2"
          class="w-full"
          placeholder="Context the next team needs"
          @blur="handleRationaleBlur"
        />
        <div class="mt-0.5 flex items-center justify-between gap-2">
          <p v-if="rationaleError" class="text-error text-[13px]" role="alert">
            {{ rationaleError }}
          </p>
          <span v-else />
          <span class="text-dimmed text-[13px]">
            {{ rationaleCount.toLocaleString("en-US") }}/{{
              HANDOFF_LIMITS.rationaleChars.toLocaleString("en-US")
            }}
          </span>
        </div>
      </div>
    </details>
  </div>
</template>
