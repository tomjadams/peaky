<template>
  <!-- top-44 lines the rail up with the top of the question column on the
       kiosk layout (survey/Page.vue's sticky progress header is top-0, no
       AppHeader above it) — tuned to the header's rendered height, not a
       magic number. -->
  <aside
    class="border-default bg-muted rounded-lg border p-8 xl:sticky xl:top-44"
    aria-label="Why this matters"
  >
    <div
      class="bg-primary-600 dark:bg-primary-400 h-[3px] w-10 rounded-full"
      aria-hidden="true"
    />

    <section v-if="importance">
      <h3 class="text-highlighted mt-6 text-[15px] font-semibold">
        Why this matters
      </h3>
      <p class="text-default mt-3 text-[17px] leading-[1.65] xl:text-[18px]">
        {{ importance }}
      </p>
    </section>

    <section v-if="leadingPractices && leadingPractices.length > 0">
      <h3 class="text-highlighted mt-8 text-[15px] font-semibold">
        Leading practices
      </h3>
      <ul id="leading-practices-list" class="mt-3 flex flex-col gap-3">
        <li
          v-for="(practice, index) in visiblePractices"
          :key="index"
          class="text-default flex gap-2.5 text-base leading-relaxed"
        >
          <span
            class="bg-success mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
            aria-hidden="true"
          />
          <span>{{ practice }}</span>
        </li>
      </ul>
      <button
        v-if="hasMorePractices"
        type="button"
        class="text-muted hover:text-highlighted focus-visible:outline-primary mt-3 cursor-pointer rounded-sm text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        :aria-expanded="practicesExpanded"
        aria-controls="leading-practices-list"
        @click="practicesExpanded = !practicesExpanded"
      >
        {{
          practicesExpanded
            ? "Show fewer"
            : `+ ${hiddenPracticesCount} more practices`
        }}
      </button>
    </section>

    <section v-if="helpfulLinks && helpfulLinks.length > 0">
      <h3 class="text-highlighted mt-8 text-[15px] font-semibold">
        Helpful links
      </h3>
      <ul id="helpful-links-list" class="mt-3 flex flex-col gap-2.5">
        <li v-for="(link, index) in visibleLinks" :key="index">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group text-primary flex items-center gap-1.5 text-[15px] font-semibold hover:underline"
          >
            {{ link.title }}
            <Icon
              name="lucide:external-link"
              class="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100"
              aria-label="Opens in new window"
            />
          </a>
        </li>
      </ul>
      <button
        v-if="hasMoreLinks"
        type="button"
        class="text-muted hover:text-highlighted focus-visible:outline-primary mt-3 cursor-pointer rounded-sm text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        :aria-expanded="linksExpanded"
        aria-controls="helpful-links-list"
        @click="linksExpanded = !linksExpanded"
      >
        {{ linksExpanded ? "Show fewer" : `+ ${hiddenLinksCount} more links` }}
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
/**
 * Kiosk-mode info rail — the "why this matters" teaching content, always
 * visible alongside the current question at xl+ instead of hiding behind a
 * click (see MoreInfoPanel.vue, which still handles this below xl).
 *
 * Rendered only when the current question has at least one of importance,
 * leadingPractices, or helpfulLinks — callers should gate on that same
 * condition to decide the surrounding grid layout (see survey/Page.vue).
 *
 * Real templates can carry many leading practices / helpful links (pilot
 * data: templates with a dozen-plus practices in the rail). To keep the
 * kiosk calm under that load, each list previews the first 3 entries and
 * reveals the rest in place behind a quiet text disclosure — no modal, no
 * navigation, one-way expand (kiosk sessions are short-lived, but "Show
 * fewer" is trivial to keep since it's a pure state toggle).
 */
import type { HelpfulLink } from "~/models/question";

const PREVIEW_COUNT = 3;

const props = defineProps<{
  /** Optional — when provided, changing it resets both disclosures. Not
   *  required: the practices/helpfulLinks array identity watches below
   *  cover callers that don't plumb a question id through. */
  questionId?: string;
  importance?: string;
  leadingPractices?: string[];
  helpfulLinks?: HelpfulLink[];
}>();

const practicesExpanded = ref(false);
const linksExpanded = ref(false);

const hasMorePractices = computed(
  () => (props.leadingPractices?.length ?? 0) > PREVIEW_COUNT
);
const hiddenPracticesCount = computed(() =>
  Math.max((props.leadingPractices?.length ?? 0) - PREVIEW_COUNT, 0)
);
const visiblePractices = computed(() => {
  const practices = props.leadingPractices ?? [];
  return practicesExpanded.value
    ? practices
    : practices.slice(0, PREVIEW_COUNT);
});

const hasMoreLinks = computed(
  () => (props.helpfulLinks?.length ?? 0) > PREVIEW_COUNT
);
const hiddenLinksCount = computed(() =>
  Math.max((props.helpfulLinks?.length ?? 0) - PREVIEW_COUNT, 0)
);
const visibleLinks = computed(() => {
  const links = props.helpfulLinks ?? [];
  return linksExpanded.value ? links : links.slice(0, PREVIEW_COUNT);
});

// Reset both disclosures whenever the underlying content changes identity —
// a new question id, or (defensively, for callers that don't pass one) a
// new practices/links array — so question 5 never inherits question 4's
// expanded rail.
watch(
  () => props.questionId,
  () => {
    practicesExpanded.value = false;
    linksExpanded.value = false;
  }
);
watch(
  () => props.leadingPractices,
  () => {
    practicesExpanded.value = false;
  }
);
watch(
  () => props.helpfulLinks,
  () => {
    linksExpanded.value = false;
  }
);
</script>
