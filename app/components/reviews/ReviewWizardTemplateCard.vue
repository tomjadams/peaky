<script setup lang="ts">
import { formatRelativeTime } from "~/utils/date";

export interface TemplateShelfCard {
  id: string;
  templateId: string;
  name: string;
  description: string;
  revisionNumber: number | null;
  pillarCount: number;
  questionCount: number;
  reviewsCount: number;
  ownerTeamId: string;
  updatedAt: string;
}

interface Props {
  card: TemplateShelfCard;
  selected: boolean;
  ownerName: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [templateId: string];
}>();

const updatedLabel = computed(() => formatRelativeTime(props.card.updatedAt));

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
const structureLabel = computed(() => {
  const parts = [
    plural(props.card.pillarCount, "pillar"),
    plural(props.card.questionCount, "question"),
  ];
  if (props.card.reviewsCount > 0)
    parts.push(plural(props.card.reviewsCount, "review"));
  return parts.join(" · ");
});
</script>

<template>
  <button
    type="button"
    :data-testid="`template-card-${card.id}`"
    :aria-pressed="selected"
    :class="[
      'flex h-full flex-col rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
      selected
        ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
        : 'border-default bg-default hover:border-accented',
    ]"
    @click="emit('toggle', card.id)"
  >
    <span
      class="mb-2.5 h-[3px] w-6 shrink-0 rounded-full bg-[#0284C7] dark:bg-sky-400"
      aria-hidden="true"
    />
    <div class="flex w-full items-center gap-2">
      <h3
        class="text-default min-w-0 flex-1 truncate text-[15px] font-semibold"
      >
        {{ card.name }}
      </h3>
      <span
        class="border-default bg-muted text-muted shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium"
      >
        {{
          card.revisionNumber === null ? "Published" : `v${card.revisionNumber}`
        }}
      </span>
      <Icon
        v-if="selected"
        name="lucide:check-circle-2"
        class="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
      />
    </div>

    <p class="text-dimmed mt-1 w-full truncate text-[13px]">
      <template v-if="ownerName">by {{ ownerName }} · </template>updated
      {{ updatedLabel }}
    </p>

    <p v-if="card.description" class="text-muted mt-2 line-clamp-2 text-sm">
      {{ card.description }}
    </p>

    <!-- Pinned to the card's bottom edge so the stats line up across every
         card in a grid row — the shelf reads as a comparison table. -->
    <p class="text-dimmed mt-auto w-full pt-3 text-[13px]">
      {{ structureLabel }}
    </p>
  </button>
</template>
