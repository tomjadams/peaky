<template>
  <USelectMenu
    :model-value="modelValue"
    :items="items"
    value-key="value"
    :search-input="false"
    size="sm"
    color="neutral"
    variant="outline"
    :disabled="disabled"
    aria-label="Risk level"
    class="text-sm font-semibold"
    :class="textColor[modelValue]"
    :ui="{ content: 'text-base', item: 'text-base' }"
    @update:model-value="onSelect"
  >
    <template #leading>
      <span class="h-1.5 w-1.5 rounded-full" :class="chipColor[modelValue]" />
    </template>
    <template #item-leading="{ item }">
      <span
        class="h-1.5 w-1.5 self-center rounded-full"
        :class="chipColor[(item as RiskOption).value]"
      />
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import type { RiskLevel } from "~/models";

interface RiskOption {
  label: string;
  value: RiskLevel;
}

withDefaults(
  defineProps<{
    modelValue: RiskLevel;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  "update:modelValue": [value: RiskLevel];
}>();

const items: RiskOption[] = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
];

const onSelect = (value: string) => {
  emit("update:modelValue", value as RiskLevel);
};

const textColor: Record<RiskLevel, string> = {
  critical: "text-red-700 dark:text-red-400",
  high: "text-amber-800 dark:text-orange-300",
  medium: "text-yellow-900 dark:text-yellow-300",
};

const chipColor: Record<RiskLevel, string> = {
  critical: "bg-red-600 dark:bg-red-400",
  high: "bg-orange-600 dark:bg-orange-400",
  medium: "bg-yellow-600 dark:bg-yellow-400",
};
</script>
