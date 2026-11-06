<script setup lang="ts">
import { computed } from "vue";
import type { ReviewTemplate } from "~/models/review-template";

interface TemplateOption {
  label: string;
  value: string;
  progress: number;
}

const props = defineProps<{
  templates: readonly ReviewTemplate[];
  modelValue: string;
}>();
const emit = defineEmits<{ "update:modelValue": [templateId: string] }>();

const options = computed<TemplateOption[]>(() =>
  props.templates.map((template) => ({
    label: template.templateName,
    value: template.templateId,
    progress: template.progress,
  }))
);
const selected = computed(
  () =>
    options.value.find((option) => option.value === props.modelValue) ??
    options.value[0] ??
    null
);
</script>

<template>
  <div v-if="options.length > 1" class="mb-5 min-w-0">
    <div class="sm:hidden">
      <p class="text-muted text-sm font-semibold">Template</p>
      <USelectMenu
        :model-value="modelValue"
        :items="options"
        value-key="value"
        :search-input="false"
        size="lg"
        color="neutral"
        variant="outline"
        aria-label="Choose breakdown template"
        class="mt-2 w-full"
        @update:model-value="emit('update:modelValue', String($event))"
      >
        <template #item="{ item }">
          <div class="min-w-0">
            <p class="text-default truncate text-sm font-semibold">
              {{ (item as TemplateOption).label }}
            </p>
            <p class="text-muted mt-0.5 text-[13px] tabular-nums">
              {{ (item as TemplateOption).progress }}% answered
            </p>
          </div>
        </template>
      </USelectMenu>
      <p v-if="selected" class="text-muted mt-1 text-[13px] tabular-nums">
        {{ selected.progress }}% answered
      </p>
    </div>

    <UTabs
      :model-value="modelValue"
      :items="options"
      :content="false"
      variant="link"
      class="bg-muted/50 hidden w-fit max-w-full overflow-x-auto rounded-lg p-1 sm:flex"
      :ui="{
        list: 'border-0',
        trigger:
          'rounded-md px-4 py-2.5 text-[15px] font-semibold text-muted transition-colors data-[state=active]:bg-elevated data-[state=active]:text-highlighted min-[1920px]:text-base',
        indicator: 'hidden',
      }"
      @update:model-value="emit('update:modelValue', String($event))"
    >
      <template #trailing="{ item }">
        <span class="text-muted text-sm tabular-nums">
          {{ (item as TemplateOption).progress }}% answered
        </span>
      </template>
    </UTabs>
  </div>
</template>
