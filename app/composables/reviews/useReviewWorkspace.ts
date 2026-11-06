/**
 * Workspace composable - provides reactive access to the review workspace.
 *
 * The workspace is a page-oriented read model that bundles all data needed
 * for the assessment screen in a single response. This reduces chatty reads
 * and enables local-first projection assembly.
 */

import type {
  ReviewWorkspace,
  WorkspaceCapabilities,
  WorkspaceTemplateRevision,
} from "~/models/workspace";
import type { TemplateRevisionDetail } from "~/models/template";
import { buildWorkspace } from "~/models/workspace";
import type { NotApplicableReason, QuestionAnswer } from "~/models/question";
import type { ReviewParticipant } from "~/models/review";
import { reviewRepository } from "~/services/review/ReviewRepository";
import { materializeReviewWorkspace } from "~/services/review/ReviewWorkspaceMaterializer";
import { overrideTransitionFromRow } from "~/services/maturity/overridePersistence";
import {
  eq,
  firstOrNull,
  reviewMaturityOverrides,
  reviewParticipants,
  subjects,
  withDatabase,
  waitForLocalDbReady,
} from "~/local-db";

function parseJsonValue<T>(value: string | null): T | undefined {
  if (value == null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function unavailableLocalCapabilities(): WorkspaceCapabilities {
  return {
    canEdit: false,
    canPublish: false,
    canDelete: false,
    canAddParticipants: false,
    canExport: false,
  };
}

function assertRemoteReviewWorkspace(
  value: unknown,
  requestedReviewId: string
): asserts value is ReviewWorkspace {
  if (
    typeof value !== "object" ||
    value === null ||
    !("review" in value) ||
    typeof value.review !== "object" ||
    value.review === null ||
    !("id" in value.review) ||
    value.review.id !== requestedReviewId ||
    !("templateRevisions" in value) ||
    !Array.isArray(value.templateRevisions) ||
    !("pillars" in value) ||
    !Array.isArray(value.pillars) ||
    !("answers" in value) ||
    !Array.isArray(value.answers)
  ) {
    throw new Error("Remote Review workspace did not match the request.");
  }
}

function participantFromRow(row: {
  actorId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}): ReviewParticipant {
  return {
    id: row.actorId,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl ?? undefined,
  };
}

function toWorkspaceRevision(
  revision: TemplateRevisionDetail,
  position: number
): WorkspaceTemplateRevision {
  return {
    id: revision.id,
    templateId: revision.templateId,
    name: revision.name,
    description: revision.description,
    status: revision.status,
    revisionNumber: revision.revisionNumber,
    revisionSummary: revision.revisionSummary,
    createdByActorId: revision.createdByActorId,
    updatedByActorId: revision.updatedByActorId,
    publishedByActorId: revision.publishedByActorId,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
    publishedAt: revision.publishedAt,
    position,
    // Pinned maturity definition document (maturity-score/REQ-009); the
    // workspace derives per-Revision maturity from it on read (AC-030).
    maturityDefinition: revision.maturityDefinition ?? null,
  };
}

async function fetchLocalWorkspace(
  reviewId: string
): Promise<ReviewWorkspace | null> {
  if (import.meta.server) return null;

  const record = await reviewRepository.fetchRecord(reviewId);
  if (!record) return null;

  const subject = await withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(subjects)
      .where(eq(subjects.id, record.review.subjectId))
      .limit(1);

    return firstOrNull(rows);
  });

  const templateDetails = await reviewRepository.fetchSelectedRevisionSnapshots(
    record.selections
  );

  // Append-only Advisor override stream (maturity-score/REQ-016); the
  // workspace resolves the effective result from it on read (AC-030, AC-031).
  const overrides = await withDatabase(async (db) => {
    const rows = await db
      .select()
      .from(reviewMaturityOverrides)
      .where(eq(reviewMaturityOverrides.reviewId, reviewId));
    return rows.map(overrideTransitionFromRow);
  });

  const participantRows = await withDatabase((db) =>
    db
      .select()
      .from(reviewParticipants)
      .where(eq(reviewParticipants.reviewId, reviewId))
  );
  const assessors = participantRows
    .filter((participant) => participant.role === "assessor")
    .map(participantFromRow);
  const advisors = participantRows
    .filter((participant) => participant.role === "reviewer")
    .map(participantFromRow);

  const templateRevisions = templateDetails.map((revision, index) =>
    toWorkspaceRevision(revision, record.selections[index]!.position)
  );

  const questionOwners = new Set<string>();
  const pillars = templateDetails.flatMap((revision) =>
    revision.pillars.map((pillar) => ({
      id: pillar.id,
      templateRevisionId: revision.id,
      slug: pillar.slug,
      name: pillar.name,
      description: pillar.description,
      orderKey: String(pillar.order).padStart(4, "0"),
      questions: pillar.questions.map((question) => {
        if (questionOwners.has(question.id))
          throw new Error(
            `Question belongs to multiple Revisions: ${question.id}`
          );
        questionOwners.add(question.id);
        return {
          id: question.id,
          templateRevisionId: revision.id,
          pillarId: pillar.id,
          orderKey: String(question.order).padStart(4, "0"),
          text: question.text,
          type: question.type ?? "yes-no",
          riskLevel: question.riskLevel,
          importance: question.importance,
          checklistItems: question.checklistItems,
          leadingPractices: question.leadingPractices,
          helpfulLinks: question.helpfulLinks,
        };
      }),
    }))
  );

  const answerRows = new Map(
    record.answers.map((answer) => [answer.questionId, answer])
  );
  const answers = pillars.flatMap((pillar) =>
    pillar.questions.map((question) => {
      const answer = answerRows.get(question.id);
      return {
        questionId: question.id,
        answer: parseJsonValue<QuestionAnswer>(answer?.answer ?? null) ?? null,
        naReason: parseJsonValue<NotApplicableReason>(answer?.naReason ?? null),
        itemNaReasons: parseJsonValue<Record<string, NotApplicableReason>>(
          answer?.itemNaReasons ?? null
        ),
        updatedAt: answer?.updatedAt ?? record.review.updatedAt,
      };
    })
  );

  return buildWorkspace({
    review: {
      id: record.review.id,
      name: record.review.name,
      status: record.review.status,
      createdAt: record.review.createdAt,
      updatedAt: record.review.updatedAt,
      teamId: record.review.subjectId,
      orgId: "",
      assessors,
      advisors,
      reviewers: advisors,
    },
    subject: {
      id: subject?.id ?? record.review.subjectId,
      type: subject?.type ?? "team",
      name: subject?.name ?? record.review.subjectId,
      slug: subject?.slug ?? record.review.subjectId,
    },
    reviewSubject: {
      id: subject?.id ?? record.review.subjectId,
      type: subject?.type ?? "team",
      name: subject?.name ?? record.review.subjectId,
      slug: subject?.slug ?? record.review.subjectId,
    },
    templateRevisions,
    pillars,
    answers,
    notes: [],
    attachments: [],
    scores: [],
    // Local Review status is not an authorization grant. Until capabilities
    // are persisted from an authoritative server response, the local read
    // model fails closed. Advisor identity above still comes only from the
    // persisted participant rows.
    capabilities: unavailableLocalCapabilities(),
    recentHistory: [],
    answerProvenance: {},
    overrides,
  });
}

export interface ReviewWorkspaceFetchState {
  workspace: ReviewWorkspace;
  localWritesReady: boolean;
  localWriteError: Error | null;
}

export async function fetchReviewWorkspaceState(
  reviewId: string
): Promise<ReviewWorkspaceFetchState> {
  try {
    const localWorkspace = await fetchLocalWorkspace(reviewId);
    if (localWorkspace) {
      return {
        workspace: localWorkspace,
        localWritesReady: true,
        localWriteError: null,
      };
    }
  } catch (error) {
    console.warn(
      "[useReviewWorkspace] Falling back after local workspace assembly failed",
      {
        diagnostic: "LOCAL_REVIEW_WORKSPACE_INCOMPLETE",
        reviewId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      }
    );
  }

  const remoteWorkspace = await $fetch<unknown>(
    `/api/reviews/${reviewId}/workspace`
  );
  assertRemoteReviewWorkspace(remoteWorkspace, reviewId);
  try {
    await materializeReviewWorkspace(remoteWorkspace);
    return {
      workspace: remoteWorkspace,
      localWritesReady: true,
      localWriteError: null,
    };
  } catch (cause) {
    const localWriteError =
      cause instanceof Error
        ? cause
        : new Error("The Review could not be prepared for local changes.");
    console.warn("[useReviewWorkspace] Remote workspace is read-only locally", {
      diagnostic: "REMOTE_REVIEW_MATERIALIZATION_FAILED",
      reviewId,
      errorName: localWriteError.name,
    });
    return {
      workspace: remoteWorkspace,
      localWritesReady: false,
      localWriteError,
    };
  }
}

export async function fetchReviewWorkspace(
  reviewId: string
): Promise<ReviewWorkspace> {
  const state = await fetchReviewWorkspaceState(reviewId);
  if (!state.localWritesReady) throw state.localWriteError;
  return state.workspace;
}

export function useReviewWorkspace(reviewId: MaybeRef<string>) {
  const workspace = ref<ReviewWorkspace | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);
  const localWritesReady = ref(false);
  const localWriteError = ref<Error | null>(null);

  const fetchWorkspace = async () => {
    if (import.meta.server) {
      loading.value = true;
      return;
    }

    await waitForLocalDbReady();

    loading.value = true;
    error.value = null;
    localWritesReady.value = false;
    localWriteError.value = null;
    try {
      const id = toValue(reviewId);
      const state = await fetchReviewWorkspaceState(id);
      workspace.value = state.workspace;
      localWritesReady.value = state.localWritesReady;
      localWriteError.value = state.localWriteError;
    } catch (e) {
      workspace.value = null;
      error.value =
        e instanceof Error ? e : new Error("Failed to fetch workspace");
    } finally {
      loading.value = false;
    }
  };

  watch(() => toValue(reviewId), fetchWorkspace, { immediate: true });

  return {
    workspace,
    loading,
    error,
    localWritesReady: readonly(localWritesReady),
    localWriteError: readonly(localWriteError),
    refresh: fetchWorkspace,
  };
}
