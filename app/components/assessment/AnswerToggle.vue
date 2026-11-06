<template>
  <fieldset class="answer-toggle">
    <legend class="sr-only">{{ legend }}</legend>
    <UFieldGroup size="sm">
      <UButton
        v-for="option in options"
        :key="option.value"
        :class="`answer-toggle__button answer-toggle__button--${option.value} h-9 min-w-14 cursor-pointer px-3 text-sm`"
        color="neutral"
        :variant="modelValue === option.value ? 'solid' : 'outline'"
        :aria-pressed="modelValue === option.value"
        :disabled="disabled"
        @click="toggle(option.value)"
      >
        {{ option.label }}
      </UButton>
    </UFieldGroup>
  </fieldset>
</template>

<script setup lang="ts">
import type { QuestionAnswer } from "~/models/question";

interface Props {
  modelValue: QuestionAnswer | null;
  legend?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  legend: "Answer",
  disabled: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: QuestionAnswer | null): void;
  (e: "na-click"): void;
}>();

// All options render neutral: the selected state is ink-solid regardless of
// which answer was picked — selection must never read as right/wrong.
const options = [
  { value: "yes" as const, label: "Yes" },
  { value: "no" as const, label: "No" },
  { value: "na" as const, label: "N/A" },
];

const toggle = (value: QuestionAnswer) => {
  if (value === "na") {
    emit("na-click");
    return;
  }
  emit("update:modelValue", props.modelValue === value ? null : value);
};
</script>
