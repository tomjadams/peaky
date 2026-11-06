<script setup lang="ts">
import { computed } from "vue";
import type { WorkspaceMaturityEntry } from "~/services/maturity/workspace";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";

const props = defineProps<{
  entry: WorkspaceMaturityEntry | null;
}>();

const result = computed(() =>
  props.entry?.kind === "result" ? props.entry : null
);
const exactPercent = computed(() => {
  if (!result.value) return null;
  const ratio = result.value.effectiveResult.result;
  return (Number(ratio.numerator) / Number(ratio.denominator)) * 100;
});
const emptyLabel = computed(() => {
  if (props.entry?.kind === "no-result") return "Answer one question";
  if (props.entry?.kind === "no-definition") return "Not configured";
  if (props.entry?.kind === "configuration-error") return "Unavailable";
  return null;
});
</script>

<template>
  <section
    v-if="entry"
    class="min-[1920px]:border-default flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] min-[1920px]:w-full min-[1920px]:border-t min-[1920px]:pt-2"
    aria-label="Live maturity calculation"
    aria-live="polite"
  >
    <span class="text-muted font-semibold">Maturity</span>
    <template v-if="result">
      <strong class="text-default text-base font-extrabold tabular-nums">
        {{ result.effectiveResult.displayPercent }}%
      </strong>
      <MaturityStagePopover
        :stage="result.effectiveResult.stage.stage"
        :thresholds="result.trace.thresholds"
        :percent="exactPercent"
        :display-percent="result.effectiveResult.displayPercent"
        trigger-class="text-[13px]"
        side="bottom"
        align="end"
      />
      <UPopover
        :content="{
          side: 'bottom',
          align: 'end',
          sideOffset: 8,
          collisionPadding: 16,
        }"
        :ui="{ content: 'w-[min(20rem,calc(100vw-2rem))] p-4' }"
      >
        <button
          type="button"
          class="text-muted hover:text-primary focus-visible:ring-primary inline-flex size-9 items-center justify-center rounded-[7px] focus-visible:ring-2 focus-visible:outline-none"
          aria-label="How live maturity is calculated"
        >
          <Icon name="lucide:info" class="size-4" aria-hidden="true" />
        </button>
        <template #content>
          <div>
            <p class="text-default text-sm font-semibold">
              How maturity changes
            </p>
            <div
              class="text-muted mt-3 space-y-2.5 text-[13px] leading-relaxed"
            >
              <p>
                <strong class="text-default font-semibold">
                  Question severity.
                </strong>
                Template authors set it. Higher severity gives a question more
                points.
              </p>
              <p>
                <strong class="text-default font-semibold">
                  Checklist items.
                </strong>
                They share the points for their question.
              </p>
              <p>
                <strong class="text-default font-semibold">Unanswered.</strong>
                The question earns 0 points. Its points remain in the score
                until it is answered.
              </p>
              <p>
                <strong class="text-default font-semibold">N/A.</strong>
                It removes the question's points from the score. For a checklist
                item, it removes only that item's points. N/A is not scored as
                0.
              </p>
            </div>
          </div>
        </template>
      </UPopover>
    </template>
    <span v-else-if="emptyLabel" class="text-muted font-semibold">
      {{ emptyLabel }}
    </span>
  </section>
</template>
