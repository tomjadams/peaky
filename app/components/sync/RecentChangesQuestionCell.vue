<script setup lang="ts">
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";

defineProps<{
  entry: RecentChangeEntry;
  pillarName: string;
}>();
</script>

<template>
  <div class="space-y-1">
    <div class="flex flex-wrap items-center gap-1.5">
      <span
        v-if="entry.questionReference"
        class="bg-primary/10 text-primary inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[13px] font-semibold"
      >
        {{ entry.questionReference }}
      </span>
      <span
        v-if="entry.templateName"
        class="text-muted text-[13px] font-medium"
      >
        {{ entry.templateName }}
      </span>
      <UTooltip
        v-if="entry.isConflict"
        text="Your answer was overridden by a newer version"
        :content="{ side: 'top' }"
      >
        <span
          class="bg-warning/10 border-warning/30 dark:text-warning inline-flex cursor-default items-center gap-1 rounded border px-1.5 py-0.5 text-[13px] font-bold text-[#92400E]"
        >
          <Icon name="lucide:alert-triangle" class="h-3 w-3" />
          Overridden
        </span>
      </UTooltip>
    </div>

    <p
      v-if="entry.questionText"
      class="text-highlighted line-clamp-2 text-base leading-snug"
    >
      <InlineMarkdown :text="entry.questionText" />
    </p>
    <p v-else class="text-muted text-[15px]">
      {{ pillarName }}
    </p>
  </div>
</template>
