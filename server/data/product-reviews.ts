import type {
  ProductReview,
  ReviewStatus,
  ReviewParticipant,
  ReviewTemplate,
  Pillar,
} from "../../app/models";
import {
  findSelectablePublishedRevisionDetail,
  templates as templateStore,
} from "./templates";

export const productReviews: ProductReview[] = [];

const archivedStatusByReviewId = new Map<
  string,
  Exclude<ReviewStatus, "archived">
>();

let reviewCounter = 0;

const buildReviewTemplates = (
  templateRevisionIds: string[]
): ReviewTemplate[] => {
  return templateRevisionIds
    .map((revisionId) => {
      const revision = findSelectablePublishedRevisionDetail(revisionId);
      if (!revision) return null;
      const entry = templateStore.find(
        (candidate) => candidate.template.id === revision.templateId
      );
      if (!entry) return null;
      const pillarSlugs = entry.pillarSlugsByRevisionId[revision.id] ?? [];

      const pillars: Pillar[] = pillarSlugs.map((slug) => {
        const detailPillar = revision.pillars.find(
          (pillar) => pillar.slug === slug
        );
        return {
          slug,
          name: detailPillar?.name ?? slug,
          progress: 0,
          totalQuestions: detailPillar?.questions.length ?? 0,
          answeredQuestions: 0,
        };
      });

      return {
        templateId: entry.template.id,
        templateRevisionId: revision.id,
        templateName: revision.name,
        revisionNumber: revision.revisionNumber,
        revisionSummary: revision.revisionSummary,
        progress: 0,
        pillars,
      } satisfies ReviewTemplate;
    })
    .filter((t): t is ReviewTemplate => t !== null);
};

const participants: Record<string, ReviewParticipant> = {
  "user-001": {
    id: "user-001",
    name: "Sarah Chen",
    email: "sarah.chen@example.com",
  },
  "user-002": {
    id: "user-002",
    name: "Marcus Johnson",
    email: "marcus.j@example.com",
  },
};

export const getProductReviewsByProductId = (
  productId: string,
  includeArchived = false
): ProductReview[] => {
  return productReviews
    .filter((review) => {
      if (review.productId !== productId) {
        return false;
      }

      if (!includeArchived && review.status === "archived") {
        return false;
      }

      return true;
    })
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
};

export const deleteProductReviewsByProductId = (productId: string): void => {
  const remainingReviews = productReviews.filter(
    (review) => review.productId !== productId
  );

  productReviews.splice(0, productReviews.length, ...remainingReviews);

  for (const [reviewId] of archivedStatusByReviewId) {
    if (!productReviews.some((review) => review.id === reviewId)) {
      archivedStatusByReviewId.delete(reviewId);
    }
  }
};

export const getProductReviewById = (
  productId: string,
  reviewId: string
): ProductReview | undefined => {
  return productReviews.find(
    (review) => review.productId === productId && review.id === reviewId
  );
};

export const findProductReviewById = (
  reviewId: string
): ProductReview | undefined => {
  return productReviews.find((review) => review.id === reviewId);
};

export const renameProductReview = (
  reviewId: string,
  name: string
): ProductReview | undefined => {
  const review = findProductReviewById(reviewId);

  if (!review) {
    return undefined;
  }

  review.name = name;
  review.updatedAt = new Date().toISOString();

  return review;
};

export const archiveProductReview = (
  reviewId: string
): ProductReview | undefined => {
  const review = findProductReviewById(reviewId);

  if (!review) {
    return undefined;
  }

  if (review.status !== "archived") {
    archivedStatusByReviewId.set(reviewId, review.status);
  }

  review.status = "archived";
  review.updatedAt = new Date().toISOString();

  return review;
};

export const restoreProductReview = (
  reviewId: string
): ProductReview | undefined => {
  const review = findProductReviewById(reviewId);

  if (!review) {
    return undefined;
  }

  const restoredStatus = archivedStatusByReviewId.get(reviewId) ?? "draft";
  archivedStatusByReviewId.delete(reviewId);

  review.status = restoredStatus;
  review.updatedAt = new Date().toISOString();

  return review;
};

export const deleteProductReview = (
  reviewId: string
): ProductReview | undefined => {
  const index = productReviews.findIndex((review) => review.id === reviewId);

  if (index === -1) {
    return undefined;
  }

  const [deletedReview] = productReviews.splice(index, 1);
  archivedStatusByReviewId.delete(reviewId);

  return deletedReview;
};

export const clearProductReviewLifecycleState = (): void => {
  archivedStatusByReviewId.clear();
};

export const createProductReview = (input: {
  productId: string;
  name: string;
  templateRevisionIds: string[];
  templateNames: string[];
  applicationIds?: string[];
}): ProductReview => {
  reviewCounter += 1;
  const id = `product-review-${String(reviewCounter).padStart(3, "0")}`;

  const templates = buildReviewTemplates(input.templateRevisionIds);
  const primaryTemplate = templates[0];

  const review: ProductReview = {
    id,
    productId: input.productId,
    name: input.name,
    templateIds: templates.map((template) => template.templateId),
    templateRevisionIds: input.templateRevisionIds,
    templateNames: input.templateNames,
    templateId: primaryTemplate?.templateId ?? "",
    templateRevisionId: primaryTemplate?.templateRevisionId ?? "",
    templateName: input.templateNames[0] ?? "",
    pillars: primaryTemplate?.pillars ?? [],
    templates,
    applicationIds: input.applicationIds,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assessors: [participants["user-001"]!],
    advisors: [],
    reviewers: [],
  };
  productReviews.push(review);
  return review;
};

// Seed data
const seedTemplates = buildReviewTemplates([
  "01932b3c-7d00-7000-8100-000000001001",
]);
productReviews.push({
  id: "01932b3c-7d00-7000-8000-000000003001",
  productId: "01932b3c-7d00-7000-8000-000000000001",
  name: "Demo Product Review",
  templateIds: ["01932b3c-7d00-7000-8000-000000001001"],
  templateRevisionIds: ["01932b3c-7d00-7000-8100-000000001001"],
  templateNames: ["Operational Readiness Review (ORR)"],
  templateId: "01932b3c-7d00-7000-8000-000000001001",
  templateRevisionId: "01932b3c-7d00-7000-8100-000000001001",
  templateName: "Operational Readiness Review (ORR)",
  pillars: seedTemplates[0]?.pillars ?? [],
  templates: seedTemplates,
  status: "in-progress",
  createdAt: "2025-10-01T00:00:00Z",
  updatedAt: "2025-12-15T10:30:00Z",
  assessors: [participants["user-001"]!],
  advisors: [],
  reviewers: [],
});
reviewCounter = 1;
