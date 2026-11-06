<script setup lang="ts">
import { computed } from "vue";
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";
import type { ChecklistContext } from "~/utils/recentChangesChecklist";
import { answerStyle } from "~/utils/recentChangesAnswer";

interface Props {
  entry: RecentChangeEntry;
  checklistContext?: ChecklistContext;
}

const props = defineProps<Props>();

const hasIntermediateTrail = computed(
  () => props.entry.changeCount > 1 && props.entry.trail.length > 1
);
const shouldShowPreviousAnswer = computed(
  () =>
    props.entry.previousAnswer !== props.entry.answer ||
    hasIntermediateTrail.value
);
const showChecklistPrevious = computed(
  () =>
    props.checklistContext?.summary.direction !== "same" ||
    hasIntermediateTrail.value
);

// Answer chips: "No" is ink-solid (inverted in dark), "Yes" an ink outline,
// "N/A" a muted well — anything else falls back to the well treatment.
const FALLBACK_CHIP_CLASS = "bg-muted text-muted";
const CHIP_CLASS: Record<string, string> = {
  no: "bg-inverted text-inverted",
  yes: "text-highlighted ring-accented ring-[1.5px] ring-inset",
  na: FALLBACK_CHIP_CLASS,
};

const chipClass = computed(
  () =>
    (props.entry.answer ? CHIP_CLASS[props.entry.answer] : undefined) ??
    FALLBACK_CHIP_CLASS
);
</script>

<template>
  <div class="space-y-1.5">
    <SyncRecentChangesChecklistPopover
      v-if="checklistContext"
      :ctx="checklistContext"
      :show-previous="showChecklistPrevious"
    />

    <div v-else class="flex items-center gap-1">
      <template v-if="shouldShowPreviousAnswer">
        <span
          v-if="entry.previousAnswer === null"
          class="text-muted text-[13px] font-normal"
          >new</span
        >
        <span
          v-else
          class="text-[13px] font-normal opacity-50"
          :class="answerStyle(entry.previousAnswer).textClass"
          >{{ answerStyle(entry.previousAnswer).label }}</span
        >
        <Icon
          name="lucide:arrow-right"
          class="text-dimmed mx-0.5 h-3 w-3 shrink-0"
        />
      </template>
      <span
        class="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold"
        :class="chipClass"
      >
        {{ answerStyle(entry.answer).label }}
      </span>
    </div>

    <SyncRecentChangesTrailPopover v-if="hasIntermediateTrail" :entry="entry" />
  </div>
</template>
