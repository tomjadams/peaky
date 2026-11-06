import type { DirectoryGroup } from "#shared/catalog-directory-mirror";
import { computed } from "vue";
import { dedupeDirectoryGroups } from "~/catalog-directory-mirror/groups";
import { fetchDirectoryGroups } from "~/catalog-directory-mirror/local";
import type { CatalogEntity } from "./useCatalogSearch";
import { useCatalogMirrorResource } from "./useCatalogMirrorResource";

export type CatalogGroup = DirectoryGroup & CatalogEntity;

const DIRECTORY_GROUPS_STATE_KEY = "catalog-directory-groups";
const DIRECTORY_GROUPS_LOADED_KEY = "catalog-directory-groups-loaded";

interface UseCatalogGroupSearchOptions {
  eager?: boolean;
}

export const useCatalogGroupSearch = (
  options: UseCatalogGroupSearchOptions = {}
) => {
  const {
    allItems: allGroups,
    refresh,
    ...rest
  } = useCatalogMirrorResource<CatalogGroup>({
    stateKey: DIRECTORY_GROUPS_STATE_KEY,
    loadedKey: DIRECTORY_GROUPS_LOADED_KEY,
    fetchItems: fetchDirectoryGroups,
    eager: options.eager ?? true,
  });

  const dedupedGroups = computed(() => dedupeDirectoryGroups(allGroups.value));

  return {
    allGroups,
    dedupedGroups,
    refresh,
    ...rest,
  };
};
