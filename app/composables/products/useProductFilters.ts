import type { Product, ProductOrigin } from "~/models";
import { useFilterState } from "~/composables/table/useFilterState";

export interface ProductOriginInfo {
  value: ProductOrigin;
  label: string;
  description: string;
  example: string;
}

export const PRODUCT_ORIGIN_INFO: ProductOriginInfo[] = [
  {
    value: "bespoke",
    label: "Bespoke",
    description: "Built in-house. You own the roadmap and release cycle",
    example: "e.g., Checkout, Jobs framework, Uplift",
  },
  {
    value: "open-source",
    label: "Open-source",
    description: "Community-maintained. You operate and may customize it",
    example: "e.g., Kafka, Kubernetes, Backstage (Launchpad)",
  },
  {
    value: "vendor",
    label: "Vendor",
    description:
      "Commercial third-party product. You self-host or consume as-is",
    example: "e.g., GitLab, HashiCorp Vault, Grafana",
  },
];

export const PRODUCT_ORIGIN_OPTIONS = [
  { label: "All origins", value: "all" },
  ...PRODUCT_ORIGIN_INFO.map((o) => ({ label: o.label, value: o.value })),
];

export const PRODUCT_ORIGIN_LABELS: Record<ProductOrigin, string> =
  Object.fromEntries(
    PRODUCT_ORIGIN_INFO.map((o) => [o.value, o.label])
  ) as Record<ProductOrigin, string>;

export const useProductFilters = () => {
  const { searchQuery, filterStates, filterItems, resetFilters } =
    useFilterState<Product>({
      searchStateKey: "products-search-query",
      searchFields: (product) => [product.name],
      filterFields: {
        origin: {
          stateKey: "products-origin-filter",
          defaultValue: "all",
          match: (product, value) => product.origin === value,
        },
      },
    });

  const originFilter = filterStates.origin as ReturnType<
    typeof useState<ProductOrigin | "all">
  >;

  const filterProducts = (products: Product[]): Product[] =>
    filterItems(products);

  return {
    searchQuery,
    originFilter,
    filterProducts,
    resetFilters,
  };
};
