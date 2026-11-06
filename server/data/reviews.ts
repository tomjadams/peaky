import type {
  Review,
  ReviewParticipant,
  ReviewStatus,
  ReviewTemplate,
  Pillar,
} from "../../app/models";
import {
  participants,
  orrProgressPillars,
  pciProgressPillars,
  pciDraftPillars,
  reliabilityDrillPillars,
  reportingBaselinePillars,
} from "./reviews-seed";
import { findPublishedTemplateRevisionDetail } from "./templates";

const calculateTemplateProgress = (pillars: Pillar[]): number => {
  const totalQuestions = pillars.reduce(
    (sum, pillar) => sum + pillar.totalQuestions,
    0
  );
  if (totalQuestions === 0) return 0;
  const answeredQuestions = pillars.reduce(
    (sum, pillar) => sum + pillar.answeredQuestions,
    0
  );
  return Math.round((answeredQuestions / totalQuestions) * 100);
};

const reviewTemplate = (
  templateId: string,
  progressPillars: Pillar[]
): ReviewTemplate => {
  const revision = findPublishedTemplateRevisionDetail(templateId);
  if (!revision) {
    throw new Error(`Missing published fixture Revision for ${templateId}`);
  }
  const pillars = revision.pillars.map((pillar) => {
    const progress = progressPillars.find(
      (candidate) => candidate.slug === pillar.slug
    );
    return {
      slug: pillar.slug,
      name: pillar.name,
      progress: progress?.progress ?? 0,
      totalQuestions: pillar.questions.length,
      answeredQuestions: progress?.answeredQuestions ?? 0,
    };
  });
  return {
    templateId,
    templateRevisionId: revision.id,
    templateName: revision.name,
    revisionNumber: revision.revisionNumber,
    revisionSummary: revision.revisionSummary,
    progress: calculateTemplateProgress(pillars),
    pillars,
  };
};

const buildReview = (
  input: Omit<
    Review,
    "templateId" | "templateName" | "pillars" | "templateIds" | "templateNames"
  > & {
    templateIds?: string[];
    templateNames?: string[];
    advisors?: ReviewParticipant[];
    reviewers?: ReviewParticipant[];
  }
): Review => {
  const templateIds =
    input.templateIds ?? input.templates.map((template) => template.templateId);
  const templateNames =
    input.templateNames ??
    input.templates.map((template) => template.templateName);
  const primaryTemplate = input.templates[0];
  const advisors = input.advisors ?? input.reviewers ?? [];

  return {
    ...input,
    applicationId: input.applicationId ?? input.applicationIds?.[0],
    templateId: primaryTemplate?.templateId ?? "",
    templateRevisionId: primaryTemplate?.templateRevisionId,
    templateName: primaryTemplate?.templateName ?? "",
    pillars: primaryTemplate?.pillars ?? [],
    templateIds,
    templateRevisionIds: input.templates.map(
      (template) => template.templateRevisionId
    ),
    templateNames,
    advisors,
    reviewers: advisors,
  };
};

export const reviews: Review[] = [
  buildReview({
    id: "01932b3c-7d00-7000-8000-000000002001",
    name: "2026 Operational Readiness Review",
    applicationIds: ["01932b3c-7d00-7000-8000-000000004001"],
    teamId: "payments-scalability",
    orgId: "org-payments",
    templates: [
      reviewTemplate(
        "01932b3c-7d00-7000-8000-000000001001",
        orrProgressPillars
      ),
      reviewTemplate(
        "01932b3c-7d00-7000-8000-000000001004",
        pciProgressPillars
      ),
    ],
    status: "in-progress",
    createdAt: "2025-10-01T00:00:00Z",
    updatedAt: "2025-12-15T10:30:00Z",
    assessors: [
      participants.heitorl!,
      participants.vlads!,
      participants.vladk!,
    ],
    reviewers: [participants["advisor-001"]!, participants["advisor-002"]!],
  }),
  buildReview({
    id: "01932b3c-7d00-7000-8000-000000002002",
    name: "Demo Payments Scalability Security Review",
    teamId: "payments-scalability",
    orgId: "org-payments",
    templates: [
      reviewTemplate("01932b3c-7d00-7000-8000-000000001003", pciDraftPillars),
    ],
    applicationIds: ["modificationqueueprocessor"],
    status: "draft",
    createdAt: "2025-11-15T00:00:00Z",
    updatedAt: "2025-11-15T00:00:00Z",
    assessors: [participants.heitor!],
    reviewers: [participants["advisor-003"]!],
  }),
  buildReview({
    id: "01932b3c-7d00-7000-8000-000000002006",
    name: "Demo Payments Scalability Reliability Drill",
    teamId: "payments-scalability",
    orgId: "org-payments",
    templates: [
      reviewTemplate(
        "01932b3c-7d00-7000-8000-000000001001",
        reliabilityDrillPillars
      ),
      reviewTemplate("01932b3c-7d00-7000-8000-000000001004", pciDraftPillars),
      reviewTemplate(
        "01932b3c-7d00-7000-8000-000000001003",
        reportingBaselinePillars
      ),
    ],
    applicationIds: ["modificationqueueprocessor"],
    status: "in-progress",
    createdAt: "2026-01-20T00:00:00Z",
    updatedAt: "2026-02-12T14:00:00Z",
    assessors: [participants.vlads!, participants.helen!],
    reviewers: [participants["advisor-004"]!],
  }),
];

const archivedStatusByReviewId = new Map<
  string,
  Exclude<ReviewStatus, "archived">
>();

export const findReviewById = (reviewId: string): Review | undefined => {
  return reviews.find((review) => review.id === reviewId);
};

export const renameReview = (
  reviewId: string,
  name: string
): Review | undefined => {
  const review = findReviewById(reviewId);

  if (!review) {
    return undefined;
  }

  review.name = name;
  review.updatedAt = new Date().toISOString();

  return review;
};

export const archiveReview = (reviewId: string): Review | undefined => {
  const review = findReviewById(reviewId);

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

export const restoreReview = (reviewId: string): Review | undefined => {
  const review = findReviewById(reviewId);

  if (!review) {
    return undefined;
  }

  const restoredStatus = archivedStatusByReviewId.get(reviewId) ?? "draft";
  archivedStatusByReviewId.delete(reviewId);

  review.status = restoredStatus;
  review.updatedAt = new Date().toISOString();

  return review;
};

export const deleteReview = (reviewId: string): Review | undefined => {
  const index = reviews.findIndex((review) => review.id === reviewId);

  if (index === -1) {
    return undefined;
  }

  const [deletedReview] = reviews.splice(index, 1);
  archivedStatusByReviewId.delete(reviewId);

  return deletedReview;
};

export const clearReviewLifecycleState = (): void => {
  archivedStatusByReviewId.clear();
};

export interface ReviewMetrics {
  overallProgress: number;
  pillarsCompleted: number;
  totalPillars: number;
  actionsNeeded: number;
  daysSinceUpdate: number;
}

export const getReviewMetrics = (review: Review): ReviewMetrics => {
  const allPillars = review.templates.flatMap((template) => template.pillars);
  const totalQuestions = allPillars.reduce(
    (sum, pillar) => sum + pillar.totalQuestions,
    0
  );
  const answeredQuestions = allPillars.reduce(
    (sum, pillar) => sum + pillar.answeredQuestions,
    0
  );
  const overallProgress =
    totalQuestions > 0
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;

  const pillarsCompleted = allPillars.filter(
    (pillar) => pillar.progress === 100
  ).length;

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(review.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    overallProgress,
    pillarsCompleted,
    totalPillars: allPillars.length,
    actionsNeeded: totalQuestions - answeredQuestions,
    daysSinceUpdate,
  };
};

export const getReviewsByTeamId = (
  teamId: string,
  includeArchived = false
): Review[] => {
  return reviews
    .filter((review) => {
      if (review.teamId !== teamId) return false;
      if (!includeArchived && review.status === "archived") return false;
      return true;
    })
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
};

export const getReviewsByApplicationId = (
  applicationId: string,
  includeArchived = false
): Review[] => {
  return reviews
    .filter((review) => {
      const linkedToApplication =
        review.applicationIds?.includes(applicationId) ?? false;
      if (!linkedToApplication) return false;
      if (!includeArchived && review.status === "archived") return false;
      return true;
    })
    .toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
};
