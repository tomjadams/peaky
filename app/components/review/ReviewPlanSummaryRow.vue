<script setup lang="ts">
import type { PlanSummary } from "~/models/improvement-plan";

interface Props {
  summary: PlanSummary;
}

defineProps<Props>();
</script>

<template>
  <StatStrip layout="quad-stacked" class="mb-14">
    <StatBlock
      label="Total items"
      :value="summary.total"
      sub-label="Needing attention"
      :reveal-index="0"
    />

    <StatBlock
      label="High priority"
      :value="summary.critical + summary.high"
      tone="attention"
      :sub-label="`${summary.critical} critical · ${summary.high} high`"
      :reveal-index="1"
    />

    <StatBlock
      label="Follow-up"
      :value="summary.followUp + summary.checklistGaps"
      :sub-label="`${summary.followUp} no answers · ${summary.checklistGaps} checklist gaps`"
      :reveal-index="2"
    />

    <StatBlock
      label="Not assessed"
      :value="summary.notAssessed"
      sub-label="Questions unanswered"
      :reveal-index="3"
    />
  </StatStrip>
</template>
