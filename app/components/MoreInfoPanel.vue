<template>
  <USlideover
    :open="isOpen"
    title="Question information"
    side="right"
    :ui="{ content: 'w-full sm:max-w-xl z-[60]', overlay: 'z-[60]' }"
    @update:open="!$event && closeMoreInfoPanel()"
  >
    <template #body>
      <div
        v-if="currentInfo"
        class="more-info-panel__question-info flex flex-col gap-8"
      >
        <div>
          <span
            class="bg-primary-600 dark:bg-primary-400 block h-[3px] w-10 rounded-[2px]"
            aria-hidden="true"
          />
          <p
            class="text-highlighted mt-4 text-[18px] leading-relaxed font-semibold"
          >
            <InlineMarkdown :text="currentInfo.title" />
          </p>
        </div>

        <section class="more-info-panel__section">
          <h3 class="text-highlighted text-[15px] font-semibold">
            Why this matters
          </h3>
          <p class="text-default mt-3 max-w-[65ch] text-base leading-[1.65]">
            {{ currentInfo.whyImportant }}
          </p>
        </section>

        <section
          v-if="currentInfo.leadingPractices.length > 0"
          class="more-info-panel__section"
        >
          <div class="flex items-baseline justify-between gap-4">
            <h3 class="text-highlighted text-[15px] font-semibold">
              Leading practices
            </h3>
            <span class="text-muted text-[13px] tabular-nums">
              {{ currentInfo.leadingPractices.length }} practice{{
                currentInfo.leadingPractices.length === 1 ? "" : "s"
              }}
            </span>
          </div>
          <ol
            id="question-info-leading-practices"
            class="more-info-panel__practices-list mt-3 flex flex-col gap-3"
          >
            <li
              v-for="(practice, index) in visiblePractices"
              :key="index"
              class="more-info-panel__practice-item grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-base leading-relaxed"
            >
              <span class="text-muted font-mono text-[13px] tabular-nums">
                {{ String(index + 1).padStart(2, "0") }}
              </span>
              <span class="more-info-panel__practice-text text-default">
                {{ practice }}
              </span>
            </li>
          </ol>
          <button
            v-if="hasMorePractices"
            type="button"
            class="text-muted hover:text-highlighted focus-visible:outline-primary mt-3 inline-flex min-h-9 items-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            :aria-expanded="practicesExpanded"
            aria-controls="question-info-leading-practices"
            @click="practicesExpanded = !practicesExpanded"
          >
            {{
              practicesExpanded
                ? "Show fewer"
                : `Show ${hiddenPracticesCount} more practices`
            }}
          </button>
        </section>

        <section
          v-if="currentInfo.helpfulLinks.length > 0"
          class="more-info-panel__section"
        >
          <h3 class="text-highlighted text-[15px] font-semibold">Resources</h3>
          <ul
            id="question-info-resources"
            class="more-info-panel__links-list mt-2 flex flex-col gap-1"
          >
            <li
              v-for="(link, index) in visibleLinks"
              :key="index"
              class="more-info-panel__link-item"
            >
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="more-info-panel__link text-primary decoration-primary/35 hover:decoration-primary flex min-h-9 items-center gap-2 text-base font-medium underline underline-offset-4"
              >
                <Icon
                  name="lucide:external-link"
                  class="h-4 w-4 shrink-0 opacity-70"
                  aria-hidden="true"
                />
                <span class="more-info-panel__link-text">{{ link.title }}</span>
                <span class="sr-only">Opens in a new tab</span>
              </a>
            </li>
          </ul>
          <button
            v-if="hasMoreLinks"
            type="button"
            class="text-muted hover:text-highlighted focus-visible:outline-primary mt-3 inline-flex min-h-9 items-center rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            :aria-expanded="linksExpanded"
            aria-controls="question-info-resources"
            @click="linksExpanded = !linksExpanded"
          >
            {{
              linksExpanded
                ? "Show fewer"
                : `Show ${hiddenLinksCount} more resources`
            }}
          </button>
        </section>

        <div v-if="currentInfo.action" class="border-default border-t pt-5">
          <UButton
            :to="currentInfo.action.to"
            color="primary"
            size="lg"
            block
            @click="closeMoreInfoPanel"
          >
            {{ currentInfo.action.label }}
          </UButton>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";

const PREVIEW_COUNT = 3;

const { isOpen, currentInfo, closeMoreInfoPanel } = useMoreInfoPanel();
const practicesExpanded = ref(false);
const linksExpanded = ref(false);

const hasMorePractices = computed(
  () => (currentInfo.value?.leadingPractices.length ?? 0) > PREVIEW_COUNT
);
const hiddenPracticesCount = computed(() =>
  Math.max((currentInfo.value?.leadingPractices.length ?? 0) - PREVIEW_COUNT, 0)
);
const visiblePractices = computed(() => {
  const practices = currentInfo.value?.leadingPractices ?? [];
  return practicesExpanded.value
    ? practices
    : practices.slice(0, PREVIEW_COUNT);
});
const hasMoreLinks = computed(
  () => (currentInfo.value?.helpfulLinks.length ?? 0) > PREVIEW_COUNT
);
const hiddenLinksCount = computed(() =>
  Math.max((currentInfo.value?.helpfulLinks.length ?? 0) - PREVIEW_COUNT, 0)
);
const visibleLinks = computed(() => {
  const links = currentInfo.value?.helpfulLinks ?? [];
  return linksExpanded.value ? links : links.slice(0, PREVIEW_COUNT);
});

watch(
  () => currentInfo.value?.title,
  () => {
    practicesExpanded.value = false;
    linksExpanded.value = false;
  }
);
</script>
