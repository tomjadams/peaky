<script setup lang="ts">
import { ref } from "vue";

const isOpen = ref(false);
</script>

<template>
  <div class="mt-3 min-w-0">
    <button
      type="button"
      class="text-muted hover:text-default focus-visible:ring-primary flex min-h-11 w-full items-center justify-between gap-4 rounded-md text-left text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      :aria-expanded="isOpen"
      aria-controls="maturity-authoring-scoring-details"
      @click="isOpen = !isOpen"
    >
      <span>How scoring works</span>
      <Icon
        :name="isOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
        class="h-4 w-4 shrink-0"
        aria-hidden="true"
      />
    </button>

    <div
      v-if="isOpen"
      id="maturity-authoring-scoring-details"
      class="mt-2 grid gap-3 pb-2"
    >
      <section
        aria-labelledby="maturity-authoring-formula-label"
        class="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-3"
      >
        <h3
          id="maturity-authoring-formula-label"
          class="text-default text-sm font-semibold"
        >
          Formula
        </h3>
        <p class="text-muted text-[13px] leading-relaxed">
          points earned ÷ weighted points available = maturity
        </p>
      </section>

      <section
        aria-labelledby="maturity-authoring-weights-label"
        class="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-3"
      >
        <h3
          id="maturity-authoring-weights-label"
          class="text-default text-sm font-semibold"
        >
          Question weights
        </h3>
        <p
          class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] font-semibold"
        >
          <span class="text-muted">Medium × 1</span>
          <span class="text-[#92400E] dark:text-amber-300">High × 2</span>
          <span class="text-[#B91C1C] dark:text-red-300">Critical × 3</span>
          <span
            data-scoring-rule
            class="text-muted inline-flex items-center gap-1.5 font-medium"
          >
            <Icon
              name="lucide:circle-slash"
              class="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>N/A · excluded, not × 0</span>
          </span>
        </p>
      </section>

      <section
        aria-labelledby="maturity-authoring-rules-label"
        class="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-3"
      >
        <h3
          id="maturity-authoring-rules-label"
          class="text-default text-sm font-semibold"
        >
          Answer rules
        </h3>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            data-scoring-rule
            class="text-muted inline-flex items-start gap-2 text-[13px]"
          >
            <Icon
              name="lucide:list-checks"
              class="text-primary mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>Checklist items share question weight</span>
          </p>
          <p
            data-scoring-rule
            class="text-muted inline-flex items-start gap-2 text-[13px]"
          >
            <Icon
              name="lucide:circle-dashed"
              class="text-muted mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>Unanswered earns 0; its weight stays available</span>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
