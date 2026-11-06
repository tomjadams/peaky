export type ProductOrigin = "bespoke" | "open-source" | "vendor";

/**
 * Product entity with provider-neutral identifiers.
 * Fields use `...Id` and `...Ids` naming convention for external catalog references.
 */
export interface Product {
  id: string;
  name: string;
  origin: ProductOrigin;
  isExternal: boolean;
  /** Product manager identifier from external catalog/directory */
  productManagerId: string;
  /** Engineering lead identifier from external catalog/directory */
  engineeringLeadId?: string;
  /** Team/group identifiers from external catalog/directory */
  teamIds: string[];
  /** Component/application identifiers from external catalog/directory */
  componentIds: string[];
  roadmapUrl?: string;
  documentationUrl?: string;
  supportChannel?: string;
  createdAt: string;
  createdBy: string;
  totalReviewCount: number;
  activeReviewCount: number;
  lastActivityDate: string;
}

// Backwards compatibility type aliases (deprecated, will be removed)
export type ProductLegacy = {
  productManagerRef: string;
  engineeringLeadRef?: string;
  teamRefs: string[];
  componentRefs: string[];
} & Omit<
  Product,
  "productManagerId" | "engineeringLeadId" | "teamIds" | "componentIds"
>;
