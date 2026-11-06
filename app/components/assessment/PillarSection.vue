<template>
  <section
    :id="`pillar-${pillarSlug}`"
    class="pillar-section scroll-mt-24"
    :aria-label="`${pillarName} Questions`"
    :data-variant="variant"
  >
    <div
      class="pillar-section__card"
      :class="
        variant === 'flat'
          ? ''
          : 'border-default bg-elevated rounded-lg border p-6 dark:border-slate-700 dark:bg-slate-800/70'
      "
    >
      <div class="pillar-section__header mb-6">
        <span
          v-if="variant === 'flat'"
          data-pillar-index-tick
          class="mb-3 block h-[3px] w-10 rounded-[2px] bg-[#0284C7] dark:bg-sky-400"
          aria-hidden="true"
        />
        <div
          v-else
          class="text-primary mb-2 flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Icon name="lucide:layers-3" class="h-3.5 w-3.5" aria-hidden="true" />
          <span>Template pillar</span>
        </div>
        <div
          class="flex items-center justify-between"
          :class="variant === 'flat' ? 'flex-wrap gap-3' : ''"
        >
          <h2 class="pillar-section__title text-highlighted text-2xl font-bold">
            {{ pillarName }}
          </h2>
          <div class="pillar-section__progress flex items-center gap-3">
            <span class="text-muted text-sm tabular-nums">
              {{ answeredCount }} of {{ totalCount }} answered
            </span>
            <div v-if="showNotesSection" class="group/notes relative">
              <button
                type="button"
                class="pillar-section__notes-anchor text-dimmed hover:bg-muted hover:text-muted relative flex items-center justify-center rounded-lg p-1.5 transition-colors dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Jump to pillar notes"
                @click="scrollToNotes"
              >
                <Icon name="lucide:sticky-note" class="h-4 w-4" />
                <span
                  v-if="hasNotesContent"
                  class="bg-primary absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                  aria-hidden="true"
                />
              </button>
              <div
                class="pointer-events-none absolute right-0 bottom-full z-20 mb-2 hidden rounded-lg bg-slate-900 px-2.5 py-1.5 text-[13px] whitespace-nowrap text-white shadow-lg group-hover/notes:block dark:bg-slate-700"
              >
                Jump to notes
              </div>
            </div>
          </div>
        </div>
        <p v-if="pillarDescription" class="text-muted mt-2 text-[15px]">
          {{ pillarDescription }}
        </p>
      </div>

      <div
        v-if="totalCount > 0"
        class="pillar-section__questions-list flex w-full flex-col"
        :class="variant === 'flat' ? 'border-default gap-0 border-t' : 'gap-3'"
      >
        <slot />
      </div>
      <div v-else class="flex items-center justify-center p-8">
        <span class="text-dimmed text-sm">No questions in this pillar</span>
      </div>

      <template v-if="showNotesSection">
        <div
          class="pillar-section__separator border-default my-6 border-t border-dashed dark:border-slate-700"
        />

        <AssessmentPillarNotes
          :review-id="reviewId"
          :pillar-slug="pillarSlug"
          :pillar-name="pillarName"
          :collapsed="notesCollapsed"
          @toggle="notesCollapsed = !notesCollapsed"
          @saved="$emit('notes-saved')"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  pillarName: string;
  pillarSlug: string;
  pillarDescription?: string;
  answeredCount: number;
  totalCount: number;
  reviewId?: string;
  showNotesSection?: boolean;
  hasNotesContent?: boolean;
  variant?: "card" | "flat";
}

const props = withDefaults(defineProps<Props>(), {
  pillarDescription: "",
  reviewId: "",
  showNotesSection: false,
  hasNotesContent: false,
  variant: "card",
});

defineEmits<{
  "notes-saved": [];
}>();

const notesCollapsed = ref(true);

function scrollToNotes() {
  const notesEl = document.getElementById(`pillar-notes-${props.pillarSlug}`);
  if (notesEl) {
    notesCollapsed.value = false;
    notesEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
</script>
