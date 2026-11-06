import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from "vue";

export interface CatalogEntity {
  id: string;
  displayName: string;
  description?: string;
}

export interface UseCatalogSearchOptions<T extends CatalogEntity> {
  items: MaybeRefOrGetter<T[]>;
  searchFields?: (keyof T)[];
}

export function useCatalogSearch<T extends CatalogEntity>(
  options: UseCatalogSearchOptions<T>
) {
  const allItems = computed<T[]>(() => toValue(options.items));
  const results = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);

  const fields = options.searchFields ?? ["id", "displayName", "description"];

  const search = (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      results.value = allItems.value;
      return;
    }

    loading.value = true;
    const q = trimmed.toLowerCase();
    results.value = allItems.value.filter((item) =>
      fields.some((field) => {
        const val = item[field];
        return typeof val === "string" && val.toLowerCase().includes(q);
      })
    );
    loading.value = false;
  };

  const clear = () => {
    results.value = [];
    loading.value = false;
  };

  const resolve = (id: string): T | undefined => {
    return allItems.value.find((item) => item.id === id);
  };

  return { allItems, results, loading, search, clear, resolve };
}
