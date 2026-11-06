<script setup lang="ts">
import { computed } from "vue";
import { useExclusiveHoverOverlay } from "~/composables/useExclusiveHoverOverlay";
import type { ReviewWorkspace } from "~/models/workspace";
import { maturityStage } from "~/services/maturity/stages";

interface Props {
  workspace: ReviewWorkspace;
  templateRevisionId: string;
  pillarSlug: string;
}

const props = defineProps<Props>();
const {
  isOpen,
  handleTriggerEnter,
  handleTriggerLeave,
  handleFocus,
  handleBlur,
  handleClick,
  handleEscape,
  handleOpenChange,
} = useExclusiveHoverOverlay();

const entry = computed(() =>
  props.workspace.maturity.find(
    (candidate) => candidate.templateRevisionId === props.templateRevisionId
  )
);
const workspacePillar = computed(() =>
  props.workspace.pillars.find(
    (pillar) =>
      pillar.templateRevisionId === props.templateRevisionId &&
      pillar.slug === props.pillarSlug
  )
);
const pillarName = computed(
  () => workspacePillar.value?.name ?? props.pillarSlug
);
const result = computed(() => {
  if (entry.value?.kind !== "result" || !workspacePillar.value) return null;
  return (
    entry.value.pillars.find(
      (pillar) => pillar.pillarId === workspacePillar.value!.id
    ) ?? null
  );
});
const stage = computed(() =>
  result.value?.stage ? maturityStage(result.value.stage) : null
);
const coverageLabel = computed(() => {
  if (!result.value) return "";
  return result.value.unanswered > 0
    ? `Provisional: ${result.value.answered} of ${result.value.total} questions answered.`
    : `Settled: all ${result.value.total} questions answered.`;
});
const unavailableLabel = computed(() => {
  if (entry.value?.kind === "no-definition") return "Not configured";
  if (entry.value?.kind === "configuration-error") return "Unavailable";
  return "Not enough data";
});
</script>

<template>
  <UPopover
    v-if="result && stage"
    :open="isOpen"
    :content="{
      side: 'left',
      align: 'center',
      sideOffset: 8,
      collisionPadding: 16,
    }"
    :ui="{
      content:
        'pointer-events-none z-[70] bg-transparent p-0 shadow-none ring-0 data-[state=open]:animate-none data-[state=closed]:hidden',
    }"
    @update:open="handleOpenChange"
  >
    <button
      type="button"
      :aria-label="`About ${pillarName} maturity`"
      class="text-default hover:text-primary focus-visible:ring-primary max-w-full rounded-md text-left text-sm font-semibold underline decoration-[#CBD5E1] decoration-dotted underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none dark:decoration-slate-600"
      @mouseenter="handleTriggerEnter"
      @pointermove="handleTriggerEnter"
      @mouseleave="handleTriggerLeave"
      @focus="handleFocus"
      @blur="handleBlur"
      @click="handleClick"
      @keydown.esc.prevent.stop="handleEscape"
    >
      <span class="tabular-nums">{{ result.displayPercent }}%</span>
      <span class="text-muted">
        · Stage {{ stage.stage }} {{ stage.name }}
      </span>
    </button>

    <template #content>
      <div
        class="border-default bg-elevated pointer-events-none w-[min(20rem,calc(100vw-2rem))] rounded-lg border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,.10)] dark:border-slate-700"
      >
        <strong class="text-highlighted block text-sm font-semibold">
          {{ pillarName }}
        </strong>
        <span class="text-default mt-2 block text-sm font-semibold">
          {{ result.displayPercent }}% · Stage {{ stage.stage }} ·
          {{ stage.name }}
        </span>
        <span class="text-muted mt-1 block text-sm leading-relaxed">
          {{ stage.description }}
        </span>
        <span class="text-muted mt-3 block text-[13px]">
          {{ coverageLabel }}
        </span>
      </div>
    </template>
  </UPopover>
  <span v-else class="text-muted text-sm">{{ unavailableLabel }}</span>
</template>
