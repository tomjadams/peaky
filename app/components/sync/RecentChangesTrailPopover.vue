<script setup lang="ts">
import { computed, ref } from "vue";
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";
import { formatRelativeTime } from "~/utils/date";
import { answerLabel, answerStyle } from "~/utils/recentChangesAnswer";

const MAX_VISIBLE_TRAIL = 10;

const props = defineProps<{ entry: RecentChangeEntry }>();

const visibleTrail = computed(() =>
  props.entry.trail.slice(0, MAX_VISIBLE_TRAIL)
);
const isTruncated = computed(
  () => props.entry.trail.length > MAX_VISIBLE_TRAIL
);
const displayCount = computed(() =>
  isTruncated.value ? "10+" : String(props.entry.changeCount)
);

const open = ref(false);
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'left', align: 'start', sideOffset: 8 }"
  >
    <button
      type="button"
      class="text-primary hover:bg-primary/10 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] font-medium transition-colors"
    >
      <Icon name="lucide:list-tree" class="h-3.5 w-3.5 shrink-0" />
      {{ displayCount }} changes
    </button>

    <template #content>
      <div
        class="bg-elevated border-default w-72 overflow-hidden rounded-lg border p-3 shadow-[0_8px_24px_rgba(15,23,42,.10)]"
      >
        <div class="mb-2 flex items-center gap-2">
          <Icon name="lucide:list-tree" class="text-primary h-4 w-4" />
          <span class="text-highlighted text-sm font-semibold">
            Intermediate trail
          </span>
        </div>
        <p v-if="isTruncated" class="text-dimmed mb-2 text-[13px]">
          Showing the 10 most recent changes
        </p>
        <ol
          class="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1"
          tabindex="0"
          aria-label="Intermediate change history"
        >
          <li
            v-for="change in visibleTrail"
            :key="change.id"
            class="border-default bg-muted/30 rounded-lg border px-2.5 py-2"
          >
            <div class="text-dimmed mb-1 text-[13px]">
              {{ formatRelativeTime(change.updatedAt) }}
            </div>
            <div class="flex items-center gap-1">
              <span
                class="text-[13px] font-normal opacity-60"
                :class="answerStyle(change.previousAnswer).textClass"
              >
                {{ answerLabel(change.previousAnswer, "new") }}
              </span>
              <Icon
                name="lucide:arrow-right"
                class="text-dimmed mx-0.5 h-3 w-3 shrink-0"
              />
              <span
                class="text-sm font-semibold"
                :class="answerStyle(change.answer).textClass"
              >
                {{ answerLabel(change.answer) }}
              </span>
            </div>
          </li>
        </ol>
      </div>
    </template>
  </UPopover>
</template>
