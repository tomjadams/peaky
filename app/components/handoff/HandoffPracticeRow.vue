<script setup lang="ts">
/**
 * Selectable handoff practice row (improvement-plans/REQ-005, REQ-011;
 * AC-015 through AC-020, AC-042).
 *
 * One provider-neutral row per unmet practice: an aria-labelled checkbox
 * (the label text names the practice and its select action), pinned-Revision
 * and question context, binary
 * evidence state with provenance, any current external reference, and an
 * assessment deep link. When the shared 50-practice maximum is reached,
 * unselected rows disable selection instead of silently dropping input
 * (AC-042) — the limit number comes from HANDOFF_LIMITS, never a local
 * constant.
 */
import type { SelectablePractice } from "~/services/handoff/projection";

interface Props {
  practice: SelectablePractice;
  selected: boolean;
  /** True when the handoff already holds the maximum and this row is unselected. */
  selectionLimitReached: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ toggle: [selected: boolean] }>();

const evidenceProvenance = computed(() =>
  props.practice.evidence.provenance.kind === "yes-no"
    ? "Answered No"
    : "Checklist item not checked"
);

const revisionLabel = computed(() =>
  props.practice.revisionNumber === null
    ? props.practice.templateName
    : `${props.practice.templateName} · revision ${props.practice.revisionNumber}`
);

const checkboxLabel = computed(
  () =>
    `${props.selected ? "Remove" : "Add"} "${props.practice.title}" ${props.selected ? "from" : "to"} handoff`
);

/** Defense in depth: only validated https references render as links. */
const associationLinkSafe = computed(
  () => props.practice.currentAssociation?.url.startsWith("https://") ?? false
);

const handleToggle = () => {
  // aria-disabled keeps the control focusable and announced; the guard makes
  // the 50-practice maximum a visible stop rather than a silent one (AC-042).
  if (props.selectionLimitReached && !props.selected) return;
  emit("toggle", !props.selected);
};
</script>

<template>
  <div
    class="handoff-practice-row border-default flex min-w-0 flex-col gap-3 border-b py-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
    :class="selected ? 'bg-primary/5' : 'hover:bg-muted'"
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-default text-sm font-medium">
          {{ practice.title }}
        </span>
        <UBadge color="neutral" variant="subtle" size="sm">Unmet</UBadge>
        <span class="text-muted text-[13px]">{{ evidenceProvenance }}</span>
      </div>
      <p class="text-muted mt-0.5 text-[13px]">
        {{ practice.pillarName }} · {{ practice.questionText }}
      </p>
      <div class="mt-1.5 flex flex-wrap items-center gap-2">
        <span class="text-muted text-[13px] font-semibold">
          {{ revisionLabel }}
        </span>
        <span
          v-if="practice.currentAssociation"
          class="text-muted inline-flex items-center gap-1 text-[13px]"
        >
          Linked to {{ practice.currentAssociation.provider }}
          {{ practice.currentAssociation.externalId }}
          <a
            v-if="associationLinkSafe"
            :href="practice.currentAssociation.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary inline-flex items-center hover:underline"
            :aria-label="`Open ${practice.currentAssociation.externalId} in ${practice.currentAssociation.provider}`"
          >
            <UIcon name="i-lucide-external-link" class="size-3" />
          </a>
        </span>
        <NuxtLink
          :to="practice.deepLink"
          class="text-primary focus-visible:ring-primary inline-flex min-h-11 items-center rounded-[7px] text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
          :aria-label="`Open &quot;${practice.title}&quot; in the assessment`"
        >
          Open in assessment
        </NuxtLink>
      </div>
    </div>
    <button
      type="button"
      role="checkbox"
      :aria-checked="selected"
      :aria-label="checkboxLabel"
      :aria-disabled="selectionLimitReached && !selected"
      class="focus-visible:ring-primary inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[7px] px-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
      :class="
        selectionLimitReached && !selected
          ? 'text-dimmed cursor-not-allowed opacity-60'
          : selected
            ? 'bg-primary/10 text-primary'
            : 'text-muted hover:bg-muted hover:text-default'
      "
      @click="handleToggle"
    >
      {{ selected ? "In handoff" : "Add to handoff" }}
    </button>
  </div>
</template>
