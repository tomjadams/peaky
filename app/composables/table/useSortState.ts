/**
 * Generic composable for table sorting
 * Can be used with any data type
 */
export function useSortState<T extends Record<string, unknown>>(
  items: Ref<T[]> | ComputedRef<T[]>,
  defaultSortKey = "name",
  defaultDirection: "asc" | "desc" = "asc"
) {
  const sortBy = ref<string>(defaultSortKey);
  const sortDirection = ref<"asc" | "desc">(defaultDirection);

  const sortedItems = computed(() => {
    return unref(items).toSorted((a, b) => {
      const aVal = a[sortBy.value];
      const bVal = b[sortBy.value];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection.value === "asc" ? -1 : 1;
      if (bVal == null) return sortDirection.value === "asc" ? 1 : -1;

      // Convert to string for comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return sortDirection.value === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection.value === "asc" ? 1 : -1;
      return 0;
    });
  });

  const handleSort = (key: string) => {
    if (sortBy.value === key) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    } else {
      sortBy.value = key;
      sortDirection.value = "asc";
    }
  };

  return {
    sortBy,
    sortDirection,
    sortedItems,
    handleSort,
  };
}
