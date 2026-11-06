<script setup lang="ts">
import { formatRelativeDate, formatFullDate } from "~/utils/date";
import type { RouteLocationRaw } from "vue-router";

interface Props {
  overallProgress: number;
  actionsNeeded: number | null;
  attentionLoading?: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  updatedAt: string;
  planRoute?: RouteLocationRaw;
}

const props = withDefaults(defineProps<Props>(), {
  attentionLoading: false,
  planRoute: undefined,
});

const attentionValue = computed(() =>
  props.attentionLoading || props.actionsNeeded === null
    ? "—"
    : props.actionsNeeded
);
const attentionTone = computed(() =>
  props.attentionLoading || props.actionsNeeded === null
    ? "default"
    : "attention"
);
</script>

<template>
  <StatStrip layout="quad">
    <StatBlock
      label="Overall progress"
      :value="overallProgress"
      unit="%"
      :progress="overallProgress"
      :reveal-index="0"
    />

    <NuxtLink
      v-if="planRoute"
      :to="planRoute"
      :aria-busy="attentionLoading"
      class="focus-visible:outline-primary block rounded focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <StatBlock
        label="Needs attention"
        :value="attentionValue"
        :tone="attentionTone"
        :reveal-index="1"
      />
    </NuxtLink>
    <StatBlock
      v-else
      label="Needs attention"
      :value="attentionValue"
      :tone="attentionTone"
      :reveal-index="1"
    />

    <StatBlock
      label="Questions answered"
      :value="answeredQuestions"
      :denominator="totalQuestions"
      :reveal-index="2"
    />

    <ClientOnly>
      <StatBlock
        label="Last activity"
        :value="formatRelativeDate(updatedAt)"
        :sub-label="formatFullDate(updatedAt)"
        :reveal-index="3"
      />
      <template #fallback>
        <StatBlock
          label="Last activity"
          value="—"
          :sub-label="formatFullDate(updatedAt)"
          :reveal-index="3"
        />
      </template>
    </ClientOnly>
  </StatStrip>
</template>
