<script setup lang="ts">
import { computed, ref } from "vue";
import type { ReviewWorkspace } from "~/models/workspace";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import MaturityOverrideModal from "~/components/maturity/MaturityOverrideModal.vue";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";

const props = defineProps<{
  workspace: ReviewWorkspace;
  templateRevisionId: string;
}>();
const emit = defineEmits<{ changed: [] }>();

const { actor } = useCurrentActor();
const overrideOpen = ref(false);
const entry = computed(() =>
  props.workspace.maturity.find(
    (candidate) => candidate.templateRevisionId === props.templateRevisionId
  )
);
const result = computed(() =>
  entry.value?.kind === "result" ? entry.value : null
);
const exactPercent = computed(() => {
  if (!result.value) return null;
  const ratio = result.value.effectiveResult.result;
  return (Number(ratio.numerator) / Number(ratio.denominator)) * 100;
});
const canOverride = computed(() =>
  props.workspace.advisors.some(
    (participant) => participant.id === actor.value.id
  )
);
const resultContext = computed(() => {
  if (!result.value) return "";
  const { total, unanswered } = result.value.coverage;
  if (unanswered === 0) {
    return `Settled from all ${total} question${total === 1 ? "" : "s"}.`;
  }
  return `Provisional: ${unanswered} of ${total} questions ${unanswered === 1 ? "is" : "are"} unanswered, so this result can change.`;
});
const stateLabel = computed(() => {
  switch (entry.value?.kind) {
    case "no-definition":
      return "Not configured";
    case "configuration-error":
      return "Unavailable";
    case "no-result":
      return "No result yet";
    default:
      return "Unavailable";
  }
});
const stateDetail = computed(() => {
  if (entry.value?.kind === "no-result") {
    return `${entry.value.coverage.answered} of ${entry.value.coverage.total} questions answered.`;
  }
  if (entry.value?.kind === "no-definition") {
    return "This pinned revision has no maturity definition.";
  }
  return "This pinned revision cannot produce a maturity result.";
});
</script>

<template>
  <div
    v-if="entry"
    class="border-default min-w-0 border-y py-2.5 lg:border-y-0 lg:border-l lg:py-0 lg:pl-6"
    role="region"
    aria-label="Maturity estimate"
  >
    <div
      v-if="result"
      class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
    >
      <div class="min-w-0">
        <h3 class="text-muted text-sm font-semibold">Maturity estimate</h3>
        <div class="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong
            class="text-default text-2xl leading-none font-extrabold tabular-nums"
          >
            {{ result.effectiveResult.displayPercent }}%
          </strong>
          <MaturityStagePopover
            :stage="result.effectiveResult.stage.stage"
            :thresholds="result.trace.thresholds"
            :percent="exactPercent"
            :display-percent="result.effectiveResult.displayPercent"
            side="top"
            align="start"
            trigger-class="text-base"
          />
          <span
            v-if="result.effectiveResult.source === 'override'"
            class="text-primary text-[13px] font-semibold"
          >
            Advisor reviewed
          </span>
        </div>
        <p class="text-muted mt-1 text-[13px]">{{ resultContext }}</p>
      </div>
      <UButton
        v-if="canOverride"
        color="neutral"
        variant="link"
        size="sm"
        class="shrink-0"
        @click="overrideOpen = true"
      >
        Record advisor review
      </UButton>
    </div>
    <div v-else>
      <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 class="text-muted text-sm font-semibold">Maturity estimate</h3>
        <span class="text-default text-base font-semibold">{{
          stateLabel
        }}</span>
      </div>
      <p class="text-muted mt-1 text-sm">{{ stateDetail }}</p>
    </div>

    <MaturityOverrideModal
      v-if="result"
      v-model:open="overrideOpen"
      :workspace="workspace"
      :entry="result"
      @saved="emit('changed')"
    />
  </div>
</template>
