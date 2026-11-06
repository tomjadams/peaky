import type { Application } from "~/composables/applications/useApplications";
import { useFilterState } from "~/composables/table/useFilterState";

export const useApplicationFilters = () => {
  const { searchQuery, filterStates, filterItems, resetFilters } =
    useFilterState<Application>({
      searchStateKey: "applications-search-query",
      searchFields: (app) => [
        app.name ?? "",
        app.owner ?? "",
        app.orgName ?? "",
        app.productName ?? "",
      ],
      filterFields: {
        org: {
          stateKey: "applications-org-filter",
          defaultValue: "all",
          match: (app, value) => app.orgId === value,
        },
        product: {
          stateKey: "applications-product-filter",
          defaultValue: "all",
          match: (app, value) => app.productId === value,
        },
      },
    });

  const orgFilter = filterStates.org;
  const productFilter = filterStates.product;

  const filterApplications = (applications: Application[]) =>
    filterItems(applications);

  return {
    searchQuery,
    orgFilter,
    productFilter,
    filterApplications,
    resetFilters,
  };
};
