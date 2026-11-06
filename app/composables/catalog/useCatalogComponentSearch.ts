import type { CatalogComponent as MirrorCatalogComponent } from "#shared/catalog-directory-mirror";
import { fetchCatalogComponents } from "~/catalog-directory-mirror/local";
import type { CatalogEntity } from "./useCatalogSearch";
import { useCatalogMirrorResource } from "./useCatalogMirrorResource";

export interface CatalogComponent
  extends MirrorCatalogComponent, CatalogEntity {}

const CATALOG_COMPONENTS_STATE_KEY = "catalog-directory-components";
const CATALOG_COMPONENTS_LOADED_KEY = "catalog-directory-components-loaded";

interface UseCatalogComponentSearchOptions {
  eager?: boolean;
}

export const useCatalogComponentSearch = (
  options: UseCatalogComponentSearchOptions = {}
) => {
  const {
    allItems: allComponents,
    refresh,
    ...rest
  } = useCatalogMirrorResource<CatalogComponent>({
    stateKey: CATALOG_COMPONENTS_STATE_KEY,
    loadedKey: CATALOG_COMPONENTS_LOADED_KEY,
    fetchItems: fetchCatalogComponents,
    eager: options.eager ?? true,
  });
  return { allComponents, refresh, ...rest };
};
