import type { CatalogEntity } from "~/composables/catalog/useCatalogSearch";

interface FilterScopedCatalogEntitiesOptions<T extends CatalogEntity> {
  items: T[];
  preferredIds?: string[];
  query: string;
  selectedIds?: string[];
}

function matchesQuery<T extends CatalogEntity>(
  item: T,
  query: string
): boolean {
  return (
    item.id.toLowerCase().includes(query) ||
    item.displayName.toLowerCase().includes(query) ||
    (item.description?.toLowerCase().includes(query) ?? false)
  );
}

export function filterScopedCatalogEntities<T extends CatalogEntity>(
  options: FilterScopedCatalogEntitiesOptions<T>
): T[] {
  const query = options.query.trim().toLowerCase();
  const selectedIdSet = new Set(options.selectedIds ?? []);
  const preferredIdSet = new Set(options.preferredIds ?? []);

  const source =
    query.length === 0 && preferredIdSet.size > 0
      ? options.items.filter((item) => preferredIdSet.has(item.id))
      : options.items;

  return source.filter((item) => {
    if (selectedIdSet.has(item.id)) {
      return false;
    }

    return query.length === 0 || matchesQuery(item, query);
  });
}
