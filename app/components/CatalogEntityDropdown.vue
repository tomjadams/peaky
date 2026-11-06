<template>
  <div>
    <div v-if="selectedIds.length > 0" class="mb-3 flex flex-wrap gap-2">
      <span
        v-for="id in selectedIds"
        :key="id"
        class="bg-elevated border-default text-default inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
      >
        <Icon :name="icon" class="text-dimmed h-3 w-3" />
        {{ resolveSelectedLabel(id) }}
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          :aria-label="`Remove ${resolveSelectedLabel(id)}`"
          @click="$emit('remove', id)"
        />
      </span>
    </div>

    <div class="relative">
      <UInput
        v-model="query"
        size="lg"
        icon="i-lucide-search"
        :placeholder="placeholder"
        @focus="showResults = true"
        @blur="handleBlur"
      />

      <div
        v-if="showResults && shouldShowDropdown"
        class="border-default bg-default absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
      >
        <div v-if="requiresQuery" class="text-muted px-3 py-2.5 text-sm">
          Type at least {{ minQueryLength }} character{{
            minQueryLength === 1 ? "" : "s"
          }}
          to search.
        </div>

        <button
          v-for="item in filteredResults"
          :key="item.id"
          type="button"
          class="hover:bg-elevated flex w-full items-start gap-3 px-3 py-2.5 text-left"
          @mousedown.prevent="handleSelect(item.id)"
        >
          <Icon :name="icon" class="text-dimmed mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div class="min-w-0">
            <span class="text-default text-sm font-medium">{{
              item.displayName
            }}</span>
            <p
              v-if="item.description"
              class="text-muted mt-0.5 truncate text-xs"
            >
              {{ item.description }}
            </p>
          </div>
        </button>

        <div
          v-if="showResultLimitHint"
          class="border-default text-muted border-t px-3 py-2 text-xs"
        >
          Showing first {{ resultLimit }} matches. Keep typing to narrow
          further.
        </div>

        <div v-else-if="showNoResults" class="text-muted px-3 py-2.5 text-sm">
          No matching results.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { filterScopedCatalogEntities } from "~/catalog-directory-mirror/scoped-entities";
import type { CatalogEntity } from "~/composables/catalog/useCatalogSearch";

function dedupeItemsByDisplayName<T extends CatalogEntity>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = item.displayName.trim().toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

const props = withDefaults(
  defineProps<{
    allItems: CatalogEntity[];
    dedupeDisplayNames?: boolean;
    minQueryLength?: number;
    preferredIds?: string[];
    resultLimit?: number;
    selectedIds: string[];
    icon?: string;
    placeholder?: string;
  }>(),
  {
    icon: "lucide:box",
    placeholder: "Search...",
    preferredIds: () => [],
    dedupeDisplayNames: false,
    minQueryLength: 0,
    resultLimit: 50,
  }
);

const emit = defineEmits<{
  add: [id: string];
  remove: [id: string];
}>();

const itemLabelById = computed(() => {
  return new Map(props.allItems.map((item) => [item.id, item.displayName]));
});
const query = ref("");
const showResults = ref(false);
const trimmedQuery = computed(() => query.value.trim());
const requiresQuery = computed(() => {
  return (
    trimmedQuery.value.length < props.minQueryLength &&
    props.preferredIds.length === 0
  );
});

const matchingResults = computed(() => {
  if (requiresQuery.value) {
    return [];
  }

  const items = filterScopedCatalogEntities({
    items: props.allItems,
    preferredIds: props.preferredIds,
    query: query.value,
    selectedIds: props.selectedIds,
  });

  return props.dedupeDisplayNames ? dedupeItemsByDisplayName(items) : items;
});

const filteredResults = computed(() => {
  return matchingResults.value.slice(0, props.resultLimit);
});

const showNoResults = computed(() => {
  return (
    !requiresQuery.value &&
    trimmedQuery.value.length > 0 &&
    filteredResults.value.length === 0
  );
});

const showResultLimitHint = computed(() => {
  return matchingResults.value.length > props.resultLimit;
});

const shouldShowDropdown = computed(() => {
  return (
    requiresQuery.value ||
    filteredResults.value.length > 0 ||
    showNoResults.value
  );
});

const resolveSelectedLabel = (id: string) => {
  return itemLabelById.value.get(id) ?? id;
};

const handleSelect = (id: string) => {
  emit("add", id);
  query.value = "";
  showResults.value = false;
};

const handleBlur = () => {
  setTimeout(() => {
    showResults.value = false;
  }, 150);
};
</script>
