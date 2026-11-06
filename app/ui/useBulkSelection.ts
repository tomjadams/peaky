interface Application {
  id: string;
  [key: string]: unknown;
}

export const useBulkSelection = () => {
  const selectedIds = ref<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds.value);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds.value = newSet;
  };

  const toggleAll = (applications: Application[]) => {
    if (selectedIds.value.size === applications.length) {
      selectedIds.value = new Set();
    } else {
      selectedIds.value = new Set(applications.map((app) => app.id));
    }
  };

  const isSelected = (id: string) => {
    return selectedIds.value.has(id);
  };

  const clearSelection = () => {
    selectedIds.value = new Set();
  };

  const selectedCount = computed(() => selectedIds.value.size);

  const selectedApplicationIds = computed(() => Array.from(selectedIds.value));

  return {
    selectedIds,
    selectedCount,
    selectedApplicationIds,
    toggleSelection,
    toggleAll,
    isSelected,
    clearSelection,
  };
};
