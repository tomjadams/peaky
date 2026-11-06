import type { CatalogEntity } from "./useCatalogSearch";
import { useCatalogSearch } from "./useCatalogSearch";
import { scheduleWhenBrowserIdle } from "~/utils/schedule";

interface CatalogMirrorResourceOptions<T extends CatalogEntity> {
  eager?: boolean;
  loadedKey: string;
  searchFields?: (keyof T)[];
  stateKey: string;
  fetchItems: () => Promise<T[]>;
}

const activeLoads = new Map<string, Promise<void>>();

export function useCatalogMirrorResource<T extends CatalogEntity>(
  options: CatalogMirrorResourceOptions<T>
) {
  const items = useState<T[]>(options.stateKey, () => []);
  const hasLoaded = useState<boolean>(options.loadedKey, () => false);
  const isRefreshing = useState<boolean>(
    `${options.stateKey}-refreshing`,
    () => false
  );

  const refresh = async () => {
    const existingLoad = activeLoads.get(options.stateKey);

    if (existingLoad) {
      await existingLoad;
      return;
    }

    isRefreshing.value = true;

    const loadPromise = options
      .fetchItems()
      .then((fetchedItems) => {
        items.value = fetchedItems;
        hasLoaded.value = true;
      })
      .finally(() => {
        isRefreshing.value = false;
        activeLoads.delete(options.stateKey);
      });

    activeLoads.set(options.stateKey, loadPromise);
    await loadPromise;
  };

  const ensureLoaded = async () => {
    if (hasLoaded.value) {
      return;
    }

    await refresh();
  };

  if (import.meta.client && options.eager !== false && !hasLoaded.value) {
    scheduleWhenBrowserIdle(
      () =>
        ensureLoaded().catch((error) => {
          console.error(
            `[useCatalogMirrorResource] Failed to load ${options.stateKey}:`,
            error
          );
        }),
      {
        timeoutMs: 3000,
      }
    );
  }

  const searchState = useCatalogSearch<T>({
    items,
    searchFields: options.searchFields,
  });

  return {
    ...searchState,
    hasLoaded,
    isRefreshing,
    ensureLoaded,
    refresh,
  };
}
