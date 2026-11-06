/**
 * Review workspace endpoint - returns full assessment hydration in one response.
 *
 * Provides all data needed for the assessment screen in a single response:
 * - Review metadata and subject context
 * - Template versions and pillars with questions
 * - Current answer and note states
 * - Capabilities based on status
 * - Recent history derived from events
 * - Provenance for machine-generated answers
 *
 * @see site/docs/development/walkthroughs/local-first-api.md
 */
import { findReviewById } from "../../../data/review-lookup";
import { applications } from "../../../data/applications";
import { getProductById } from "../../../data/products";
import { getTeamById } from "../../../data/teams";
import { templateDetails } from "../../../data/templates";
import { getAnswersForReview } from "../../../data/answers";
import { getPillarNotesByReviewId } from "../../../data/pillar-notes";
import { getEventsByReviewId } from "../../../data/review-events";
import { deriveHistoryEntries } from "../../../data/history-derivation";
import { getProvenanceByReviewId } from "../../../data/provenance";
import { getLifecycleActor } from "../../../utils/lifecycleActor";
import type {
  ReviewWorkspace,
  WorkspaceSubject,
  WorkspacePillar,
  WorkspaceCapabilities,
  WorkspaceAnswer,
  WorkspaceNote,
} from "~/models/workspace";
import { buildWorkspace } from "~/models/workspace";

function buildWorkspaceSubject(
  review: ReturnType<typeof findReviewById> & object
): WorkspaceSubject {
  const reviewSubject = review as typeof review & {
    productId?: string;
    applicationId?: string;
  };

  if (reviewSubject.productId) {
    const product = getProductById(reviewSubject.productId);
    return {
      id: reviewSubject.productId,
      type: "product",
      name: product?.name ?? "Unknown Product",
      slug: reviewSubject.productId,
    };
  }

  if (reviewSubject.applicationId) {
    const application = applications.find(
      (app) => app.id === reviewSubject.applicationId
    );
    return {
      id: reviewSubject.applicationId,
      type: "application",
      name: application?.name ?? "Unknown Application",
      slug: reviewSubject.applicationId,
    };
  }

  const team = getTeamById(review.teamId);
  return {
    id: team?.id ?? review.teamId,
    type: "team",
    name: team?.name ?? "Unknown Team",
    slug: team?.id ?? review.teamId,
    organizationId: team?.orgId,
    organizationName: team?.orgName,
  };
}

/**
 * Resolve the subject that owns the persisted Review row. The routed context
 * can be a linked application, but SQLite Reviews still belong to their Team
 * or Product parent.
 */
function buildReviewSubject(
  review: ReturnType<typeof findReviewById> & object,
  routedSubject: WorkspaceSubject
): WorkspaceSubject {
  const reviewOwner = review as typeof review & { productId?: string };
  if (reviewOwner.productId) {
    const product = getProductById(reviewOwner.productId);
    return {
      id: reviewOwner.productId,
      type: "product",
      name: product?.name ?? "Unknown Product",
      slug: reviewOwner.productId,
    };
  }

  if (review.teamId) {
    const team = getTeamById(review.teamId);
    return {
      id: team?.id ?? review.teamId,
      type: "team",
      name: team?.name ?? "Unknown Team",
      slug: team?.id ?? review.teamId,
      organizationId: team?.orgId,
      organizationName: team?.orgName,
    };
  }

  if (routedSubject.type !== "application") return routedSubject;
  throw createError({
    statusCode: 409,
    statusMessage: "Review owner identity is unavailable",
  });
}

export default defineEventHandler(async (event): Promise<ReviewWorkspace> => {
  const reviewId = getRouterParam(event, "id");

  if (!reviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const review = findReviewById(reviewId);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  await getLifecycleActor(event);
  const subject = buildWorkspaceSubject(review);
  const reviewSubject = buildReviewSubject(review, subject);

  // Build selected Template Revisions and Pillars
  const templateRevisions = review.templates.flatMap((selection, position) => {
    const detail = templateDetails[selection.templateRevisionId];
    if (!detail) return [];
    const { pillars: _pillars, ...revision } = detail;
    return [{ ...revision, position }];
  });

  const questionOwners = new Set<string>();
  const pillars: WorkspacePillar[] = review.templates.flatMap((selection) => {
    const detail = templateDetails[selection.templateRevisionId];
    if (!detail)
      throw createError({
        statusCode: 409,
        statusMessage: `Selected Template Revision unavailable: ${selection.templateRevisionId}`,
      });
    return detail.pillars.map((p, i) => ({
      id: p.id,
      templateRevisionId: detail.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      // 1-based, matching every local writer (generateOrderKey) — the order
      // key doubles as the pillar/question position the UI derives display
      // slugs from (REL-1), so a 0-based key here mislabels every row.
      orderKey: String(i + 1).padStart(4, "0"),
      questions: p.questions.map((q, qi) => {
        if (questionOwners.has(q.id))
          throw createError({
            statusCode: 409,
            statusMessage: `Question belongs to multiple Revisions: ${q.id}`,
          });
        questionOwners.add(q.id);
        return {
          id: q.id,
          templateRevisionId: detail.id,
          pillarId: p.id,
          orderKey: String(qi + 1).padStart(4, "0"),
          text: q.text,
          type: q.type ?? "yes-no",
          riskLevel: q.riskLevel as "critical" | "high" | "medium" | undefined,
          importance: q.importance,
          checklistItems: q.checklistItems,
          leadingPractices: q.leadingPractices,
          helpfulLinks: q.helpfulLinks,
        };
      }),
    }));
  });

  // Get stored answers and build workspace answers
  const storedAnswers = getAnswersForReview(reviewId);
  const allQuestionIds = pillars.flatMap((p) => p.questions.map((q) => q.id));

  const answers: WorkspaceAnswer[] = allQuestionIds.map((questionId) => {
    const stored = storedAnswers[questionId];
    return {
      questionId,
      answer: stored?.answer ?? null,
      naReason: stored?.naReason,
      itemNaReasons: stored?.itemNAReasons,
      updatedAt: stored ? review.updatedAt : review.createdAt,
    };
  });

  // Get notes from pillar-notes store
  const pillarNotes = getPillarNotesByReviewId(reviewId);
  const notes: WorkspaceNote[] = pillarNotes.map((n) => ({
    id: n.id,
    scopeType: "pillar" as const,
    scopeId: n.pillarSlug,
    content: n.note ?? "",
    updatedAt: review.updatedAt,
  }));

  // Build capabilities based on status.
  const editableStatus =
    review.status === "draft" || review.status === "in-progress";
  const capabilities: WorkspaceCapabilities = {
    canEdit: editableStatus,
    canPublish: review.status === "in-progress",
    canDelete: review.status === "draft",
    canAddParticipants: editableStatus,
    canExport: true,
  };

  // Derive history from events (last 10 entries for quick context)
  const events = getEventsByReviewId(reviewId);
  const historyEntries = deriveHistoryEntries(events);
  const recentHistory = historyEntries.slice(-10).toReversed();

  // Get provenance for machine-generated answers
  const answerProvenance = getProvenanceByReviewId(reviewId);

  return buildWorkspace({
    review,
    subject,
    reviewSubject,
    templateRevisions,
    pillars,
    answers,
    notes,
    attachments: [],
    scores: [],
    capabilities,
    recentHistory,
    answerProvenance,
  });
});
