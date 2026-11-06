import type { Product, ProductOrigin } from "../../app/models";
import {
  deleteProductReviewsByProductId,
  getProductReviewsByProductId,
} from "./product-reviews";

type ProductStatus = "active" | "inactive" | "archived";

const ACTIVE_REVIEW_STATUSES = new Set(["draft", "in-progress"]);

export const products: Product[] = [
  {
    id: "01932b3c-7d00-7000-8000-000000000001",
    name: "Demo Payments Scalability",
    origin: "bespoke",
    isExternal: false,
    productManagerId: "vlads",
    engineeringLeadId: "heitorl",
    teamIds: ["payments-scalability"],
    componentIds: ["modificationqueueprocessor"],
    roadmapUrl: "https://linear.app/example/demo-payments-scalability",
    documentationUrl: "https://docs.example.com/demo-payments-scalability",
    supportChannel: "#help-payments-scalability",
    createdAt: "2025-01-15T00:00:00Z",
    createdBy: "heitorl",
    totalReviewCount: 1,
    activeReviewCount: 1,
    lastActivityDate: "2025-12-15T10:30:00Z",
  },
];
let productCounter = 1;
const archivedProductIds = new Set<string>();

const withMetrics = (product: Product): Product => {
  const relatedReviews = getProductReviewsByProductId(product.id);
  const latestReviewActivity = relatedReviews[0]?.updatedAt;

  return {
    ...product,
    totalReviewCount: relatedReviews.length,
    activeReviewCount: relatedReviews.filter((review) =>
      ACTIVE_REVIEW_STATUSES.has(review.status)
    ).length,
    lastActivityDate:
      latestReviewActivity &&
      new Date(latestReviewActivity).getTime() >
        new Date(product.lastActivityDate).getTime()
        ? latestReviewActivity
        : product.lastActivityDate,
  };
};

export const getProductsWithMetrics = (
  status: Extract<ProductStatus, "active" | "archived"> = "active"
): Product[] => {
  return products
    .filter((product) => {
      const isArchived = archivedProductIds.has(product.id);
      return status === "archived" ? isArchived : !isArchived;
    })
    .map(withMetrics);
};

export const getProductById = (productId: string): Product | undefined => {
  return getProductByIdWithOptions(productId);
};

export const getProductByIdWithOptions = (
  productId: string,
  options: {
    includeArchived?: boolean;
  } = {}
): Product | undefined => {
  if (archivedProductIds.has(productId) && !options.includeArchived) {
    return undefined;
  }

  const product = products.find((p) => p.id === productId);
  return product ? withMetrics(product) : undefined;
};

export const isProductArchived = (productId: string): boolean => {
  return archivedProductIds.has(productId);
};

export const createProduct = (input: {
  name: string;
  origin: ProductOrigin;
  isExternal: boolean;
  productManagerId: string;
  engineeringLeadId?: string;
  teamIds: string[];
  componentIds?: string[];
  roadmapUrl?: string;
  documentationUrl?: string;
  supportChannel?: string;
}): Product => {
  productCounter += 1;
  const id = `product-${String(productCounter).padStart(3, "0")}`;
  const product: Product = {
    id,
    name: input.name,
    origin: input.origin,
    isExternal: input.isExternal,
    productManagerId: input.productManagerId,
    engineeringLeadId: input.engineeringLeadId,
    teamIds: input.teamIds,
    componentIds: input.componentIds ?? [],
    roadmapUrl: input.roadmapUrl,
    documentationUrl: input.documentationUrl,
    supportChannel: input.supportChannel,
    createdAt: new Date().toISOString(),
    createdBy: "current-user",
    totalReviewCount: 0,
    activeReviewCount: 0,
    lastActivityDate: new Date().toISOString(),
  };
  products.push(product);
  return product;
};

export const updateProduct = (
  productId: string,
  updates: Partial<
    Pick<
      Product,
      | "name"
      | "origin"
      | "isExternal"
      | "productManagerId"
      | "engineeringLeadId"
      | "teamIds"
      | "componentIds"
      | "roadmapUrl"
      | "documentationUrl"
      | "supportChannel"
    >
  > & { status?: ProductStatus }
): Product | undefined => {
  const index = products.findIndex((p) => p.id === productId);
  if (index === -1) return undefined;

  const existing = products[index]!;
  const { status, ...productUpdates } = updates;

  if (status === "archived") {
    archivedProductIds.add(productId);
  } else if (status === "active" || status === "inactive") {
    archivedProductIds.delete(productId);
  }

  const updated: Product = {
    ...existing,
    ...productUpdates,
    lastActivityDate: new Date().toISOString(),
  };
  products[index] = updated;

  return withMetrics(updated);
};

export const deleteProduct = (productId: string): Product | undefined => {
  if (!archivedProductIds.has(productId)) {
    return undefined;
  }

  const index = products.findIndex((product) => product.id === productId);
  if (index === -1) {
    return undefined;
  }

  const [deletedProduct] = products.splice(index, 1);
  archivedProductIds.delete(productId);
  deleteProductReviewsByProductId(productId);

  return deletedProduct ? withMetrics(deletedProduct) : undefined;
};

export const setArchivedProductIds = (productIds: Iterable<string>): void => {
  archivedProductIds.clear();

  for (const productId of productIds) {
    archivedProductIds.add(productId);
  }
};
