<template>
  <div class="flex flex-wrap items-center gap-1" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="focus-visible:outline-primary rounded-[7px] px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        option.value === modelValue
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted hover:text-default bg-transparent'
      "
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
      <span v-if="option.count !== undefined" class="tabular-nums">
        ({{ option.count }})
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
export interface FilterChipOption {
  label: string;
  value: string;
  count?: number;
}

defineProps<{
  options: FilterChipOption[];
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>
