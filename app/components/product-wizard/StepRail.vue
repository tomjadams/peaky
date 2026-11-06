<script setup lang="ts">
export interface WizardRailStep {
  value: number;
  title: string;
  /** What the step asks for, replaced by a live summary once it has input. */
  detail: string;
  /** True once the step's required input is present. */
  settled: boolean;
}

const props = defineProps<{
  steps: WizardRailStep[];
  currentStep: number;
  /** The highest step reached so far — anything beyond it stays locked. */
  furthestStep: number;
}>();

const emit = defineEmits<{ select: [step: number] }>();

function isReachable(step: WizardRailStep): boolean {
  return step.value <= props.furthestStep;
}

// Same waypoint vocabulary as the assessment rail and the drafting room:
// confirm green once the step is done, sky where you are, a hollow sky ring
// for a step already reached, hollow gray for the road ahead.
function waypointClass(step: WizardRailStep): string {
  if (step.value === props.currentStep) {
    return "border-sky-600 bg-sky-600 dark:border-sky-400 dark:bg-sky-400";
  }
  if (step.value < props.currentStep && step.settled) {
    return "border-success bg-success";
  }
  if (isReachable(step)) {
    return "bg-default border-sky-600 dark:border-sky-400";
  }
  return "border-accented bg-default dark:border-slate-600";
}

function titleClass(step: WizardRailStep): string {
  if (step.value === props.currentStep) {
    return "text-sky-700 dark:text-sky-300";
  }
  return isReachable(step) ? "text-default" : "text-dimmed";
}
</script>

<template>
  <nav
    class="product-rail self-start lg:sticky lg:top-24"
    aria-label="Product setup steps"
  >
    <ol class="relative">
      <span
        class="border-default pointer-events-none absolute top-5 bottom-5 left-[19px] w-px border-l border-dashed dark:border-slate-700"
        aria-hidden="true"
      />
      <li v-for="step in steps" :key="step.value">
        <button
          type="button"
          :data-testid="`wizard-rail-step-${step.value}`"
          :disabled="!isReachable(step)"
          :aria-current="step.value === currentStep ? 'step' : undefined"
          class="relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 rounded-lg px-2 py-2.5 text-left transition-colors disabled:cursor-default"
          :class="
            step.value === currentStep
              ? 'bg-[#EAF3FA] dark:bg-sky-400/10'
              : isReachable(step)
                ? 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                : ''
          "
          @click="emit('select', step.value)"
        >
          <span class="mt-[5px] flex justify-center">
            <span
              class="h-2.5 w-2.5 rounded-full border-2"
              :class="waypointClass(step)"
              aria-hidden="true"
            />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold" :class="titleClass(step)">
              {{ step.title }}
            </span>
            <span class="text-dimmed mt-0.5 block text-[13px]">
              {{ step.detail }}
            </span>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>
