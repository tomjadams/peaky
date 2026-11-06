<template>
  <section>
    <div class="flex items-baseline justify-between gap-4">
      <div class="flex items-baseline gap-2">
        <h3 class="text-default text-sm font-semibold">{{ title }}</h3>
        <span class="text-muted text-[13px] tabular-nums">
          {{ countLabel }}
        </span>
      </div>
      <button
        type="button"
        class="text-primary hover:text-primary/80 shrink-0 text-[13px] font-medium transition-colors"
        @click="emit('edit')"
      >
        {{ editLabel }}
      </button>
    </div>

    <div v-if="items.length > 0" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="item in items"
        :key="item"
        class="border-default bg-muted text-muted inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium"
      >
        {{ item }}
      </span>
    </div>

    <!-- Dashed = still open. Nothing is linked yet and nothing has to be. -->
    <p
      v-else
      class="border-default text-muted mt-3 rounded-lg border border-dashed px-3 py-3 text-sm"
    >
      {{ emptyText }}
    </p>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    items: string[];
    countLabel: string;
    emptyText?: string;
    editLabel?: string;
  }>(),
  {
    emptyText: "Nothing selected.",
    editLabel: "Edit",
  }
);

const emit = defineEmits<{ edit: [] }>();
</script>
