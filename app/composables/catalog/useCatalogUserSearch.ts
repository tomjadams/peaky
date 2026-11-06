import { computed } from "vue";
import type { DirectoryUser } from "#shared/catalog-directory-mirror";
import { fetchDirectoryUsers } from "~/catalog-directory-mirror/local";
import type { CatalogEntity } from "./useCatalogSearch";
import { useCatalogMirrorResource } from "./useCatalogMirrorResource";

export type CatalogUser = DirectoryUser & CatalogEntity;

const DIRECTORY_USERS_STATE_KEY = "catalog-directory-users";
const DIRECTORY_USERS_LOADED_KEY = "catalog-directory-users-loaded";

interface UseCatalogUserSearchOptions {
  eager?: boolean;
}

export const useCatalogUserSearch = (
  options: UseCatalogUserSearchOptions = {}
) => {
  const {
    allItems: allUsers,
    isRefreshing,
    loading: isSearching,
    ensureLoaded,
    refresh,
    search: searchCatalogUsers,
    ...rest
  } = useCatalogMirrorResource<CatalogUser>({
    stateKey: DIRECTORY_USERS_STATE_KEY,
    loadedKey: DIRECTORY_USERS_LOADED_KEY,
    fetchItems: fetchDirectoryUsers,
    searchFields: ["id", "displayName"],
    eager: options.eager ?? true,
  });

  const loading = computed(() => {
    return isRefreshing.value || isSearching.value;
  });

  const search = async (query: string) => {
    try {
      await ensureLoaded();
      searchCatalogUsers(query);
    } catch (error) {
      console.error("[useCatalogUserSearch] Failed to load users:", error);
    }
  };

  return {
    allUsers,
    loading,
    search,
    ensureLoaded,
    refresh,
    ...rest,
  };
};
