<script setup lang="ts">
import type {
  PlanItem,
  PlanFilters,
  PlanItemState,
} from "~/models/improvement-plan";
import type { RiskLevel } from "~/models/template";

type FilterKey = "state" | "severity" | "pillar" | "template";
type FilterOption = { label: string; value: string };

interface Props {
  items: PlanItem[];
  modelValue: PlanFilters;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: PlanFilters];
}>();

// ─── Static options ───────────────────────────────────────────

const stateOptions: { label: string; value: PlanItemState | "all" }[] = [
  { label: "All states", value: "all" },
  { label: "Follow-up", value: "follow-up" },
  { label: "Checklist gap", value: "checklist-gap" },
  { label: "Not assessed", value: "not-assessed" },
  { label: "Exception", value: "documented-exception" },
];

const severityOptions: { label: string; value: RiskLevel | "all" }[] = [
  { label: "All severities", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
];

// ─── Derived options ──────────────────────────────────────────

const pillarOptions = computed(() => {
  const slugs = new Map<string, string>();
  for (const item of props.items) {
    slugs.set(
      `${item.identity.templateRevisionId}::${item.identity.pillarSlug}`,
      `${item.pillarName} — ${item.templateName} v${item.revisionNumber ?? "?"}`
    );
  }
  return [
    { label: "All pillars", value: "all" as const },
    ...[...slugs.entries()].map(([slug, name]) => ({
      label: name,
      value: slug,
    })),
  ];
});

const templateOptions = computed(() => {
  const ids = new Map<string, string>();
  for (const item of props.items) {
    ids.set(
      item.identity.templateRevisionId,
      `${item.templateName} v${item.revisionNumber ?? "?"}`
    );
  }
  if (ids.size <= 1) return [];
  return [
    { label: "All templates", value: "all" as const },
    ...[...ids.entries()].map(([id, name]) => ({ label: name, value: id })),
  ];
});

// ─── Handlers ────────────────────────────────────────────────

const update = (patch: Partial<PlanFilters>) => {
  emit("update:modelValue", { ...props.modelValue, ...patch });
};

const optionLabel = (options: FilterOption[], value: string) =>
  options.find((option) => option.value === value)?.label ??
  options[0]?.label ??
  "";

const selectFilter = (filter: FilterKey, value: string) => {
  update({ [filter]: value });
};

const menuItems = (filter: FilterKey, options: FilterOption[], value: string) =>
  options.map((option) => ({
    label: option.label,
    icon: option.value === value ? "i-lucide-check" : undefined,
    onSelect: () => selectFilter(filter, option.value),
  }));

const stateMenuItems = computed(() =>
  menuItems("state", stateOptions, props.modelValue.state)
);

const severityMenuItems = computed(() =>
  menuItems("severity", severityOptions, props.modelValue.severity)
);

const pillarMenuItems = computed(() =>
  menuItems("pillar", pillarOptions.value, props.modelValue.pillar)
);

const templateMenuItems = computed(() =>
  menuItems("template", templateOptions.value, props.modelValue.template)
);
</script>

<template>
  <div
    class="review-plan-filters mb-6 flex w-full min-w-0 flex-wrap items-center gap-3"
  >
    <!-- Search -->
    <div class="relative min-w-48 flex-1">
      <UInput
        :model-value="modelValue.search"
        size="md"
        icon="i-lucide-search"
        aria-label="Search plan items"
        placeholder="Search items..."
        class="w-full"
        @update:model-value="update({ search: String($event) })"
      />
    </div>

    <div
      class="review-plan-filters__label text-muted flex items-center gap-1.5 text-[13px] font-medium"
    >
      <Icon name="lucide:filter" class="h-3.5 w-3.5" />
      <span>Filters</span>
    </div>

    <div class="review-plan-filters__select relative">
      <UDropdownMenu
        :items="stateMenuItems"
        :modal="false"
        :portal="false"
        :content="{ align: 'start', sideOffset: 4 }"
      >
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Filter by state"
          class="w-40 justify-between"
        >
          {{ optionLabel(stateOptions, modelValue.state) }}
        </UButton>
      </UDropdownMenu>
    </div>

    <div class="review-plan-filters__select relative">
      <UDropdownMenu
        :items="severityMenuItems"
        :modal="false"
        :portal="false"
        :content="{ align: 'start', sideOffset: 4 }"
      >
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Filter by severity"
          class="w-40 justify-between"
        >
          {{ optionLabel(severityOptions, modelValue.severity) }}
        </UButton>
      </UDropdownMenu>
    </div>

    <div
      v-if="pillarOptions.length > 2"
      class="review-plan-filters__select relative"
    >
      <UDropdownMenu
        :items="pillarMenuItems"
        :modal="false"
        :portal="false"
        :content="{ align: 'start', sideOffset: 4 }"
      >
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Filter by pillar"
          class="w-40 justify-between"
        >
          {{ optionLabel(pillarOptions, modelValue.pillar) }}
        </UButton>
      </UDropdownMenu>
    </div>

    <div
      v-if="templateOptions.length > 1"
      class="review-plan-filters__select relative"
    >
      <UDropdownMenu
        :items="templateMenuItems"
        :modal="false"
        :portal="false"
        :content="{ align: 'start', sideOffset: 4 }"
      >
        <UButton
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
          aria-label="Filter by template"
          class="w-44 justify-between"
        >
          {{ optionLabel(templateOptions, modelValue.template) }}
        </UButton>
      </UDropdownMenu>
    </div>
  </div>
</template>
