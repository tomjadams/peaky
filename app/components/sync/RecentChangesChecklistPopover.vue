<script setup lang="ts">
import { ref } from "vue";
import type { ChecklistContext } from "~/utils/recentChangesChecklist";

defineProps<{
  ctx: ChecklistContext;
  showPrevious: boolean;
}>();

const open = ref(false);
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ side: 'left', align: 'start', sideOffset: 12 }"
    :ui="{ content: 'bg-transparent shadow-none ring-0 rounded-none p-0' }"
  >
    <button
      type="button"
      class="group hover:bg-muted/60 flex cursor-pointer items-center gap-1 rounded py-0.5 transition-colors"
    >
      <template v-if="showPrevious">
        <span
          v-if="ctx.prev"
          class="text-dimmed text-[13px] tabular-nums opacity-70"
          >{{ ctx.prev.checked.length }}/{{ ctx.items.length }}</span
        >
        <span v-else class="text-dimmed text-[13px] opacity-70">new</span>
        <Icon
          name="lucide:arrow-right"
          class="text-dimmed mx-0.5 h-3 w-3 shrink-0"
        />
        <span
          class="text-sm font-semibold tabular-nums underline decoration-dotted underline-offset-2"
          :class="{
            'text-success': ctx.summary.direction === 'up',
            'text-error': ctx.summary.direction === 'down',
            'text-muted': ctx.summary.direction === 'same',
          }"
        >
          {{ ctx.curr?.checked.length ?? 0 }}/{{ ctx.items.length }}
        </span>
      </template>
      <span
        v-else
        class="text-muted text-sm tabular-nums underline decoration-dotted underline-offset-2"
      >
        {{ ctx.curr?.checked.length ?? 0 }}/{{ ctx.items.length }}
      </span>
    </button>

    <template #content>
      <div
        class="bg-elevated border-default w-[30rem] overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(15,23,42,.10)]"
      >
        <div
          class="bg-muted/40 border-default flex items-center justify-between border-b px-4 py-3"
        >
          <div class="flex items-center gap-2">
            <Icon name="lucide:list-checks" class="text-primary h-4 w-4" />
            <span class="text-highlighted text-sm font-semibold">
              Checklist
            </span>
            <div class="flex items-center gap-1.5">
              <span
                v-if="ctx.diff.addedIds.size"
                class="bg-success/15 text-success rounded-full px-1.5 py-0.5 text-[13px] font-semibold"
              >
                +{{ ctx.diff.addedIds.size }} checked
              </span>
              <span
                v-if="ctx.diff.removedIds.size"
                class="bg-error/15 text-error rounded-full px-1.5 py-0.5 text-[13px] font-semibold"
              >
                &minus;{{ ctx.diff.removedIds.size }} unchecked
              </span>
            </div>
          </div>
          <span class="text-muted text-[13px] tabular-nums">
            {{ ctx.curr?.checked.length ?? 0 }}/{{ ctx.items.length }}
          </span>
        </div>

        <div
          class="max-h-80 overflow-y-auto overscroll-contain px-3 py-3"
          tabindex="0"
          role="region"
          aria-label="Checklist change details"
        >
          <template v-if="ctx.view.length === 0">
            <p class="text-muted px-1 py-2 text-sm">
              {{ ctx.diff.addedIds.size }} item(s) checked,
              {{ ctx.diff.removedIds.size }} unchecked.
              <span class="text-dimmed">Detail loading…</span>
            </p>
          </template>
          <div v-else class="space-y-2">
            <div
              v-for="item in ctx.view"
              :key="item.id"
              class="flex items-start gap-3 overflow-hidden rounded-lg border border-dashed px-3 py-2.5 transition-colors"
              :class="{
                'border-success/40 bg-success/5':
                  item.change === 'added' ||
                  (item.change === null && item.state === 'checked'),
                'border-error/40 bg-error/5': item.change === 'removed',
                'border-muted/60 bg-muted/10':
                  item.change === 'added-na' || item.change === 'removed-na',
                'border-default':
                  item.change === null && item.state !== 'checked',
              }"
            >
              <span
                class="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-all"
                :class="{
                  'border-success/80 bg-success/70': item.state === 'checked',
                  'border-default bg-transparent': item.state === 'unchecked',
                  'border-muted bg-muted/40': item.state === 'na',
                }"
              >
                <Icon
                  v-if="item.state === 'checked'"
                  name="lucide:check"
                  class="h-2.5 w-2.5 text-white"
                />
                <Icon
                  v-else-if="item.state === 'na'"
                  name="lucide:minus"
                  class="text-dimmed h-2.5 w-2.5"
                />
              </span>
              <span
                class="flex-1 text-sm leading-snug"
                :class="{
                  'text-default font-medium': item.state === 'checked',
                  'text-muted': item.state === 'unchecked',
                  'text-dimmed line-through': item.state === 'na',
                }"
              >
                {{ item.text }}
              </span>
              <span
                v-if="item.change === 'added'"
                class="bg-success/15 text-success mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[13px] font-medium"
                >checked</span
              >
              <span
                v-else-if="item.change === 'removed'"
                class="bg-error/15 text-error mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[13px] font-medium"
                >unchecked</span
              >
              <span
                v-else-if="
                  item.change === 'added-na' || item.change === 'removed-na'
                "
                class="bg-muted text-muted mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[13px] font-medium"
                >N/A</span
              >
            </div>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
