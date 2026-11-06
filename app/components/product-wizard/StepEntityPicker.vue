<template>
  <div class="space-y-4">
    <SearchInput
      :model-value="search"
      :placeholder="searchPlaceholder"
      class="sm:max-w-md"
      @update:model-value="search = $event"
    />

    <p v-if="scopeNote && !isSearching" class="text-dimmed text-[13px]">
      {{ scopeNote }}
    </p>

    <!-- Selection tray: what you have picked so far, always in reach and
         always removable. -->
    <div
      v-if="selectedItems.length > 0"
      class="border-default rounded-lg border p-3"
    >
      <div class="mb-2 flex items-baseline justify-between gap-3">
        <span class="text-default text-[13px] font-semibold">
          {{ selectedLabel }}
        </span>
        <span class="text-muted text-[13px] font-medium tabular-nums">
          {{ selectedCountLabel }}
        </span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="item in selectedItems"
          :key="item.id"
          type="button"
          class="border-default text-muted hover:border-accented hover:text-default inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors"
          @click="emit('toggle', item.id)"
        >
          {{ item.displayName }}
          <Icon name="lucide:x" class="h-3.5 w-3.5" aria-hidden="true" />
          <span class="sr-only">Remove {{ item.displayName }}</span>
        </button>
      </div>
    </div>

    <template v-if="filteredItems.length > 0">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="text-default text-sm font-semibold">{{ pageLabel }}</h3>
        <span class="text-muted text-[13px] font-medium tabular-nums">
          {{ countLabel }}
        </span>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          type="button"
          :aria-pressed="isSelected(item.id)"
          :class="[
            'flex h-full flex-col rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
            isSelected(item.id)
              ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
              : 'border-default bg-default hover:border-accented',
          ]"
          @click="emit('toggle', item.id)"
        >
          <span class="flex w-full items-start gap-2">
            <span class="text-default min-w-0 flex-1 text-[15px] font-semibold">
              {{ item.displayName }}
            </span>
            <Icon
              :name="
                isSelected(item.id) ? 'lucide:check-circle-2' : 'lucide:plus'
              "
              class="h-5 w-5 shrink-0"
              :class="
                isSelected(item.id)
                  ? 'text-sky-600 dark:text-sky-400'
                  : 'text-dimmed'
              "
            />
          </span>
          <span
            v-if="item.description"
            class="text-muted mt-1.5 line-clamp-2 text-sm"
          >
            {{ item.description }}
          </span>
          <!-- Directory id, pinned to the bottom edge so it lines up across
               the row and the cards read as a comparison table. Skipped when
               the id is the display name — repeating it says nothing. -->
          <span v-if="item.id !== item.displayName" class="mt-auto pt-3">
            <span
              class="border-default bg-muted text-muted inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[13px] font-medium"
            >
              {{ item.id }}
            </span>
          </span>
        </button>
      </div>

      <button
        v-if="hasRevealToggle"
        type="button"
        :aria-expanded="isRevealed"
        class="text-muted hover:text-default flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        @click="toggleReveal"
      >
        <Icon
          :name="
            revealLabel === 'Show fewer'
              ? 'lucide:chevron-up'
              : 'lucide:chevron-down'
          "
          class="h-4 w-4"
        />
        {{ revealLabel }}
      </button>
    </template>

    <div
      v-else
      class="border-default text-muted rounded-lg border border-dashed px-4 py-6 text-sm"
    >
      {{
        isSearching
          ? "No matches for your search."
          : "Nothing to choose from yet."
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { filterScopedCatalogEntities } from "~/catalog-directory-mirror/scoped-entities";
import type { CatalogEntity } from "~/composables/catalog/useCatalogSearch";

const props = withDefaults(
  defineProps<{
    allItems: CatalogEntity[];
    preferredIds?: string[];
    selectedIds: string[];
    searchPlaceholder?: string;
    selectedLabel?: string;
    pageLabel?: string;
    /** Singular noun for the count grammar, e.g. "team". */
    itemNoun?: string;
    /** Explains a narrowed list, shown only while the search is empty. */
    scopeNote?: string;
  }>(),
  {
    searchPlaceholder: "Search...",
    selectedLabel: "Selected",
    pageLabel: "Items",
    itemNoun: "item",
    scopeNote: "",
    preferredIds: () => [],
  }
);

const emit = defineEmits<{ toggle: [id: string] }>();

// Long lists preview, then reveal — the same recipe as the review wizard's
// shelves, rather than a 4-per-page pager that hides the shape of the set.
const PREVIEW = 6;
const REVEAL_STEP = 24;
const SHOW_ALL_THRESHOLD = 12;

const search = ref("");
const revealed = ref(0);

const isSearching = computed(() => search.value.trim().length > 0);

const selectedItems = computed(() =>
  props.allItems.filter((item) => props.selectedIds.includes(item.id))
);

const filteredItems = computed(() =>
  filterScopedCatalogEntities({
    items: props.allItems,
    preferredIds: props.preferredIds,
    query: search.value,
  })
);

const visibleItems = computed(() =>
  filteredItems.value.slice(0, PREVIEW + revealed.value)
);

const hiddenCount = computed(
  () => filteredItems.value.length - visibleItems.value.length
);

const hasRevealToggle = computed(() => filteredItems.value.length > PREVIEW);
const isRevealed = computed(() => revealed.value > 0);

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

// "{N} {noun}" normally; "{K} of {N} {noun}" while the list is truncated —
// the same grammar the table sheets use, so truncation is never silent.
const countLabel = computed(() => {
  const total = filteredItems.value.length;
  const shown = visibleItems.value.length;
  if (shown < total) return `${shown} of ${plural(total, props.itemNoun)}`;
  return plural(total, props.itemNoun);
});

const selectedCountLabel = computed(() =>
  plural(selectedItems.value.length, props.itemNoun)
);

const revealLabel = computed(() => {
  if (hiddenCount.value === 0) return "Show fewer";
  if (hiddenCount.value <= SHOW_ALL_THRESHOLD) {
    return `Show all ${plural(filteredItems.value.length, props.itemNoun)}`;
  }
  return `Show ${Math.min(REVEAL_STEP, hiddenCount.value)} more`;
});

function toggleReveal() {
  if (hiddenCount.value === 0) revealed.value = 0;
  else if (hiddenCount.value <= SHOW_ALL_THRESHOLD)
    revealed.value = filteredItems.value.length - PREVIEW;
  else revealed.value += REVEAL_STEP;
}

function isSelected(id: string): boolean {
  return props.selectedIds.includes(id);
}

watch(search, () => {
  revealed.value = 0;
});
</script>
