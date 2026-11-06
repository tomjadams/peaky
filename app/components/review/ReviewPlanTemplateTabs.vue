<script setup lang="ts">
import { computed } from "vue";
import type { ReviewWorkspace } from "~/models/workspace";
import type { WorkspaceMaturityEntry } from "~/services/maturity/workspace";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";
import type { HandoffMaturityPreview } from "~/services/maturity/handoffPreview";

interface Props {
  workspace: ReviewWorkspace;
  modelValue: string;
  maturityPreview?: HandoffMaturityPreview | null;
}

interface RevisionOption {
  label: string;
  value: string;
  name: string;
  revision: string;
  summary: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:modelValue": [revisionId: string];
}>();

const revisionName = (revisionId: string): string =>
  props.workspace.templateRevisions.find(
    (revision) => revision.id === revisionId
  )?.name ?? revisionId;

const revisionNumber = (revisionId: string): number | null | undefined =>
  props.workspace.templateRevisions.find(
    (revision) => revision.id === revisionId
  )?.revisionNumber;

const summaryFor = (entry: WorkspaceMaturityEntry): string => {
  switch (entry.kind) {
    case "result":
      return `${entry.effectiveResult.displayPercent}% · Stage ${entry.effectiveResult.stage.stage} ${entry.effectiveResult.stage.name}`;
    case "no-result":
      return "No result yet";
    case "configuration-error":
      return "Configuration issue";
    case "no-definition":
      return "No maturity definition";
  }
};

const options = computed<RevisionOption[]>(() =>
  props.workspace.maturity.map((entry) => {
    const name = revisionName(entry.templateRevisionId);
    const number = revisionNumber(entry.templateRevisionId);
    const revision =
      number === null || number === undefined
        ? "Pinned revision"
        : `Revision ${number}`;
    return {
      label: `${name} · ${revision.toLowerCase()}`,
      value: entry.templateRevisionId,
      name,
      revision,
      summary: summaryFor(entry),
    };
  })
);
const selectedValue = computed(
  () => props.modelValue || options.value[0]?.value || ""
);
const selectedOption = computed(
  () =>
    options.value.find((option) => option.value === selectedValue.value) ??
    options.value[0] ??
    null
);
const selectedEntry = computed(() =>
  props.workspace.maturity.find(
    (entry) => entry.templateRevisionId === selectedValue.value
  )
);
const result = computed(() =>
  selectedEntry.value?.kind === "result" ? selectedEntry.value : null
);
const exactPercent = computed(() => {
  if (!result.value) return null;
  const ratio = result.value.effectiveResult.result;
  return (Number(ratio.numerator) / Number(ratio.denominator)) * 100;
});
const hasHandoffPreview = computed(() => {
  const preview = props.maturityPreview;
  return Boolean(
    preview &&
    preview.selectedCount > 0 &&
    preview.delta.displayPercentagePoints > 0
  );
});
const previewExactPercent = computed(() => {
  if (!hasHandoffPreview.value || !props.maturityPreview) return null;
  const ratio = props.maturityPreview.projected.result;
  return (Number(ratio.numerator) / Number(ratio.denominator)) * 100;
});
const coverage = computed(() => {
  const entry = selectedEntry.value;
  return entry && "coverage" in entry ? entry.coverage : null;
});
const coveragePercent = computed(() => {
  if (!coverage.value || coverage.value.total === 0) return 0;
  return Math.round((coverage.value.answered / coverage.value.total) * 100);
});
const isEarlyEstimate = computed(() => {
  if (!coverage.value || coverage.value.total === 0) return false;
  return coverage.value.answered < 3 || coveragePercent.value < 25;
});
const maturityQualifier = computed(() => {
  if (!result.value) return "";
  const { total, unanswered } = result.value.coverage;
  if (isEarlyEstimate.value) {
    return "Early estimate · incomplete answers can move it significantly";
  }
  if (unanswered > 0) {
    return `Provisional until all ${total} questions are answered`;
  }
  return `Based on all ${total} answers`;
});

function handleTabKey(event: KeyboardEvent, index: number) {
  const last = options.value.length - 1;
  const targetIndex =
    event.key === "ArrowRight"
      ? (index + 1) % options.value.length
      : event.key === "ArrowLeft"
        ? (index - 1 + options.value.length) % options.value.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : null;
  if (targetIndex === null) return;
  event.preventDefault();
  const option = options.value[targetIndex];
  if (!option) return;
  emit("update:modelValue", option.value);
  const tablist = (event.currentTarget as HTMLElement).closest(
    '[role="tablist"]'
  );
  (
    tablist?.querySelectorAll<HTMLElement>('[role="tab"]')[targetIndex] ?? null
  )?.focus();
}
</script>

<template>
  <section
    class="follow-up-scope-mat border-default grid min-w-0 gap-4 rounded-lg border p-6 lg:grid-cols-[minmax(0,5fr)_minmax(12rem,3fr)_minmax(16rem,4fr)] lg:items-start lg:gap-8"
    aria-label="Follow-up scope"
  >
    <div class="min-w-0" role="group" aria-label="Selected template">
      <p class="text-muted text-sm font-semibold">Selected template</p>
      <div
        v-if="options.length > 1"
        role="tablist"
        aria-label="Template revision"
        class="mt-2 hidden gap-2 sm:grid"
        :style="{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }"
      >
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          role="tab"
          :aria-selected="option.value === selectedValue"
          :tabindex="option.value === selectedValue ? 0 : -1"
          class="focus-visible:ring-primary min-h-11 min-w-0 rounded-[7px] border px-3 py-2 text-left transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-px motion-reduce:transition-none"
          :class="
            option.value === selectedValue
              ? 'border-primary bg-elevated text-highlighted'
              : 'text-muted hover:border-primary/40 hover:bg-primary/10 hover:text-primary border-transparent'
          "
          @click="emit('update:modelValue', option.value)"
          @keydown="handleTabKey($event, index)"
        >
          <span class="block truncate text-sm font-semibold">
            {{ option.name }}
          </span>
          <span class="mt-0.5 block text-[13px]">{{ option.revision }}</span>
        </button>
      </div>
      <USelectMenu
        v-if="options.length > 1"
        :model-value="selectedValue"
        :items="options"
        value-key="value"
        :search-input="false"
        size="lg"
        color="neutral"
        variant="outline"
        aria-label="Choose template revision"
        class="mt-1.5 w-full sm:hidden"
        :ui="{ item: 'py-2.5', content: 'max-w-[calc(100vw-2rem)]' }"
        @update:model-value="emit('update:modelValue', String($event))"
      >
        <template #item="{ item }">
          <div class="min-w-0">
            <p class="text-default truncate text-sm font-semibold">
              {{ (item as RevisionOption).label }}
            </p>
            <p class="text-muted mt-0.5 truncate text-[13px]">
              {{ (item as RevisionOption).summary }}
            </p>
          </div>
        </template>
      </USelectMenu>
      <p
        v-else-if="selectedOption"
        class="text-highlighted mt-1 text-base font-semibold"
      >
        {{ selectedOption.label }}
      </p>
    </div>

    <div
      v-if="coverage"
      class="border-default relative min-w-0 border-t pt-4 lg:border-t-0 lg:pt-0 lg:pl-8"
      aria-label="Assessment coverage"
    >
      <span
        class="absolute top-0 left-0 hidden h-2.5 w-px bg-[#0F172A]/30 lg:block dark:bg-white/35"
        aria-hidden="true"
      />
      <p class="text-muted text-sm font-semibold">Assessment coverage</p>
      <p class="text-highlighted mt-1 text-[26px] font-extrabold tabular-nums">
        {{ coverage.answered }} of {{ coverage.total }}
      </p>
      <p class="text-muted text-[13px]">questions answered</p>
      <div class="bg-muted mt-2 h-1 overflow-hidden rounded-full">
        <div
          class="h-full bg-[#0284C7] transition-[width] dark:bg-sky-400"
          :style="{ width: `${coveragePercent}%` }"
        />
      </div>
    </div>

    <div
      v-if="result"
      class="border-default relative min-w-0 border-t pt-4 lg:border-t-0 lg:pt-0 lg:pl-8"
      role="region"
      aria-label="Maturity estimate"
    >
      <span
        class="absolute top-0 left-0 hidden h-2.5 w-px bg-[#0F172A]/30 lg:block dark:bg-white/35"
        aria-hidden="true"
      />
      <p class="text-muted text-sm font-semibold">Maturity estimate</p>
      <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong
          class="leading-none font-extrabold tabular-nums"
          :class="
            isEarlyEstimate
              ? 'text-muted text-2xl'
              : 'text-[32px] text-[#0284C7] dark:text-sky-400'
          "
        >
          {{ result.effectiveResult.displayPercent }}%
        </strong>
        <MaturityStagePopover
          :stage="result.effectiveResult.stage.stage"
          :thresholds="result.trace.thresholds"
          :percent="exactPercent"
          :display-percent="result.effectiveResult.displayPercent"
          :preview-percent="previewExactPercent"
          :preview-from-display-percent="
            maturityPreview?.current.displayPercentTenths
          "
          :preview-display-percent="
            maturityPreview?.projected.displayPercentTenths
          "
          :preview-stage="maturityPreview?.projected.stage.stage"
          :trigger-class="
            isEarlyEstimate ? 'text-sm text-muted' : 'text-[15px]'
          "
        >
          <template #trigger>
            Stage {{ result.effectiveResult.stage.stage }} ·
            {{ result.effectiveResult.stage.name }}
          </template>
        </MaturityStagePopover>
        <span
          v-if="result.effectiveResult.source === 'override'"
          class="text-primary text-[13px] font-semibold"
        >
          Advisor reviewed
        </span>
      </div>
      <p class="text-muted mt-1.5 text-[13px]">
        {{ maturityQualifier }}
      </p>
    </div>
    <div
      v-else-if="selectedOption"
      class="border-default relative border-t pt-4 lg:border-t-0 lg:pt-0 lg:pl-8"
      role="region"
      aria-label="Maturity estimate"
    >
      <span
        class="absolute top-0 left-0 hidden h-2.5 w-px bg-[#0F172A]/30 lg:block dark:bg-white/35"
        aria-hidden="true"
      />
      <p class="text-muted text-sm font-semibold">Maturity estimate</p>
      <p class="text-default mt-1 text-sm font-semibold">
        {{ selectedOption.summary }}
      </p>
    </div>
  </section>
</template>

<style>
.follow-up-scope-mat {
  position: relative;
  overflow: hidden;
  border-color: #e8e3d9;
  border-top: 2px solid #0f172a;
  border-bottom-color: #dbd4c4;
  background-color: #f9f7f2;
  background-image: radial-gradient(circle, #d8e7ee 1px, transparent 1px);
  background-size: 24px 24px;
}

.follow-up-scope-mat::before {
  position: absolute;
  inset: 6px;
  border: 1px solid #e3ddd0;
  border-radius: 4px;
  content: "";
  pointer-events: none;
}

.follow-up-scope-mat > * {
  position: relative;
  z-index: 1;
}

.dark .follow-up-scope-mat {
  border-color: #334155;
  border-top-color: #94a3b8;
  background-color: #020617;
  background-image: radial-gradient(
    circle,
    rgba(51, 65, 85, 0.65) 1px,
    transparent 1px
  );
}

.dark .follow-up-scope-mat::before {
  border-color: rgb(255 255 255 / 8%);
}
</style>
