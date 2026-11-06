/**
 * Private query helpers and types for product data access.
 * Consumed exclusively by ProductMutations.
 */
import { withDatabase, safeParse, eq, or, desc, inArray } from "~/local-db";
import {
  createLifecycleAuditRecord,
  type LifecycleActor,
} from "~/lifecycle/management";
import type { productOrigin, subjectStatus } from "#shared/db/schema";
import { subjects, productProfiles, reviews } from "#shared/db/schema";
import type { Product } from "~/models/product";

// Derive the ProductOrigin type from the schema const
type ProductOrigin = (typeof productOrigin)[number];
export type ProductSubjectStatus = (typeof subjectStatus)[number];

type LocalProductProfileRow = typeof productProfiles.$inferSelect;
type LocalReviewMetricsRow = {
  subjectId: string;
  status: string;
  updatedAt: string;
};

export type LocalProductRecord = LocalProductProfileRow & {
  subjectName: string;
  subjectStatus: ProductSubjectStatus;
};

export const ACTIVE_REVIEW_STATUSES = new Set(["draft", "in-progress"]);

// Parsed product type for app consumption
export interface ParsedLocalProduct extends Omit<
  Product,
  "teamIds" | "componentIds"
> {
  status: ProductSubjectStatus;
  teamIds: string[];
  componentIds: string[];
  localId: string;
  subjectId: string;
}

export type ProductMetrics = {
  totalReviewCount: number;
  activeReviewCount: number;
  lastActivityDate: string | null;
};

export function getProductLifecycleResources(
  product: Pick<ParsedLocalProduct, "totalReviewCount" | "activeReviewCount">
) {
  return {
    reviewsCount: product.totalReviewCount,
    activeReviewCount: product.activeReviewCount,
  };
}

export function createProductLifecycleAuditRecord(
  product: Pick<
    ParsedLocalProduct,
    "name" | "totalReviewCount" | "activeReviewCount"
  >,
  subjectId: string,
  action: "archive" | "restore" | "delete",
  actor: LifecycleActor
) {
  return createLifecycleAuditRecord({
    action,
    subjectType: "product",
    subjectId,
    subjectName: product.name,
    actor,
    source: "peaky.client",
    associatedResources: getProductLifecycleResources(product),
  });
}

/**
 * Parse JSON fields in product profile.
 */
export function parseProductProfile(
  row: LocalProductRecord,
  metricsBySubject: Map<string, ProductMetrics>
): ParsedLocalProduct {
  const metrics = metricsBySubject.get(row.subjectId);

  return {
    id: row.subjectId, // Use subjectId as the public ID
    localId: row.id,
    subjectId: row.subjectId,
    status: row.subjectStatus,
    name: row.subjectName,
    origin: row.origin as ProductOrigin,
    isExternal: row.isExternal === 1,
    productManagerId: row.productManagerId,
    engineeringLeadId: row.engineeringLeadId ?? undefined,
    teamIds: safeParse<string[]>(row.teamIds, []),
    componentIds: safeParse<string[]>(row.componentIds, []),
    roadmapUrl: row.roadmapUrl ?? undefined,
    documentationUrl: row.documentationUrl ?? undefined,
    supportChannel: row.supportChannel ?? undefined,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    totalReviewCount: metrics?.totalReviewCount ?? 0,
    activeReviewCount: metrics?.activeReviewCount ?? 0,
    lastActivityDate: metrics?.lastActivityDate ?? row.updatedAt,
  };
}

export function buildMetricsBySubject(
  reviewRows: LocalReviewMetricsRow[]
): Map<string, ProductMetrics> {
  const metrics = new Map<string, ProductMetrics>();

  for (const row of reviewRows) {
    const current = metrics.get(row.subjectId) ?? {
      totalReviewCount: 0,
      activeReviewCount: 0,
      lastActivityDate: null,
    };

    current.totalReviewCount += 1;
    if (ACTIVE_REVIEW_STATUSES.has(row.status)) {
      current.activeReviewCount += 1;
    }

    current.lastActivityDate =
      current.lastActivityDate === null ||
      new Date(row.updatedAt).getTime() >
        new Date(current.lastActivityDate).getTime()
        ? row.updatedAt
        : current.lastActivityDate;

    metrics.set(row.subjectId, current);
  }

  return metrics;
}

export async function fetchLocalProductRecords(
  productId?: string
): Promise<LocalProductRecord[]> {
  return withDatabase(async (db) => {
    const baseQuery = db
      .select({
        id: productProfiles.id,
        subjectId: productProfiles.subjectId,
        origin: productProfiles.origin,
        isExternal: productProfiles.isExternal,
        productManagerId: productProfiles.productManagerId,
        engineeringLeadId: productProfiles.engineeringLeadId,
        teamIds: productProfiles.teamIds,
        componentIds: productProfiles.componentIds,
        roadmapUrl: productProfiles.roadmapUrl,
        documentationUrl: productProfiles.documentationUrl,
        supportChannel: productProfiles.supportChannel,
        createdBy: productProfiles.createdBy,
        createdAt: productProfiles.createdAt,
        updatedAt: productProfiles.updatedAt,
        subjectName: subjects.name,
        subjectStatus: subjects.status,
      })
      .from(productProfiles)
      .innerJoin(subjects, eq(subjects.id, productProfiles.subjectId))
      .orderBy(desc(productProfiles.updatedAt));

    if (!productId) {
      return baseQuery;
    }

    return baseQuery
      .where(
        or(
          eq(productProfiles.subjectId, productId),
          eq(subjects.slug, productId)
        )
      )
      .limit(1);
  });
}

export async function fetchReviewMetrics(
  subjectIds: string[]
): Promise<Map<string, ProductMetrics>> {
  if (subjectIds.length === 0) {
    return new Map();
  }

  const reviewRows = await withDatabase(async (db) => {
    return db
      .select({
        subjectId: reviews.subjectId,
        status: reviews.status,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(inArray(reviews.subjectId, subjectIds));
  });

  return buildMetricsBySubject(reviewRows);
}
