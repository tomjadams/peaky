interface FilterField<T> {
  stateKey: string;
  defaultValue: string;
  match: (item: T, value: string) => boolean;
}

interface EntityFiltersConfig<T> {
  searchStateKey: string;
  searchFields: (item: T) => string[];
  filterFields?: Record<string, FilterField<T>>;
}

export function useFilterState<T>(config: EntityFiltersConfig<T>) {
  const searchQuery = useState(config.searchStateKey, () => "");

  const filterStates = config.filterFields
    ? Object.fromEntries(
        Object.entries(config.filterFields).map(([key, field]) => [
          key,
          useState(field.stateKey, () => field.defaultValue),
        ])
      )
    : {};

  const filterItems = (items: T[]): T[] => {
    let result = items;

    if (config.filterFields) {
      for (const [key, field] of Object.entries(config.filterFields)) {
        const stateValue = filterStates[key]!;
        if (stateValue.value !== field.defaultValue) {
          result = result.filter((item) => field.match(item, stateValue.value));
        }
      }
    }

    const query = searchQuery.value.trim().toLowerCase();
    if (query.length > 0) {
      result = result.filter((item) =>
        config
          .searchFields(item)
          .some((field) => field.toLowerCase().includes(query))
      );
    }

    return result;
  };

  const resetFilters = () => {
    searchQuery.value = "";
    if (config.filterFields) {
      for (const [key, field] of Object.entries(config.filterFields)) {
        filterStates[key]!.value = field.defaultValue;
      }
    }
  };

  return {
    searchQuery,
    filterStates,
    filterItems,
    resetFilters,
  };
}
