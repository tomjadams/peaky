/**
 * Orchestrates loading of assessment data (review + questions).
 *
 * Implements local-first fetch: checks local DB first via ReviewHydration,
 * falls back to remote API, then merges via hydration service.
 * No Vue imports — safe to call from any context.
 *
 * Local-first fetch strategy:
 *
 *   loadReview(reviewId)
 *     ├─ reviewHydration.hydrateReview()    — local SQLite first
 *     │   ├─ local only  → return local
 *     │   ├─ remote only → return remote
 *     │   └─ both        → merge (local wins for mutable fields)
 *     └─ fetchRemoteResource()              — fallback if local is empty
 */

import type {
  Question,
  Review,
  QuestionsResponse,
  ReviewTemplate,
} from "~/models";
import type { ReviewWorkspace } from "~/models/workspace";
import {
  reviewHydration,
  fetchRemoteResource,
} from "~/services/review/ReviewHydration";
import { waitForLocalDbReady } from "~/local-db";
import { fetchReviewWorkspace } from "~/composables/reviews/useReviewWorkspace";

export interface AssessmentReviewResult {
  review: Review | null;
  error: Error | null;
}

export interface AssessmentQuestionsResult {
  questions: QuestionsResponse | null;
  error: Error | null;
}

export interface AssessmentData {
  remoteReview: Review | null;
  remoteQuestions: QuestionsResponse | null;
  reviewOverlay: Review | null;
  questionsOverlay: QuestionsResponse | null;
  error: Error | null;
}

export function workspaceToAssessmentData(
  workspace: ReviewWorkspace
): Pick<AssessmentData, "reviewOverlay" | "questionsOverlay"> {
  const answerByQuestionId = new Map(
    workspace.answers.map((answer) => [answer.questionId, answer] as const)
  );
  const templates: ReviewTemplate[] = workspace.templateRevisions.map(
    (revision) => {
      const pillars = workspace.pillars
        .filter((pillar) => pillar.templateRevisionId === revision.id)
        .map((pillar) => {
          const answeredQuestions = pillar.questions.filter(
            (question) => answerByQuestionId.get(question.id)?.answer != null
          ).length;
          return {
            templateRevisionId: revision.id,
            key: `${revision.id}::${pillar.slug}`,
            slug: pillar.slug,
            name: pillar.name,
            progress:
              pillar.questions.length > 0
                ? Math.round(
                    (answeredQuestions / pillar.questions.length) * 100
                  )
                : 0,
            totalQuestions: pillar.questions.length,
            answeredQuestions,
          };
        });
      const totalQuestions = pillars.reduce(
        (total, pillar) => total + pillar.totalQuestions,
        0
      );
      const answeredQuestions = pillars.reduce(
        (total, pillar) => total + pillar.answeredQuestions,
        0
      );
      return {
        templateId: revision.templateId,
        templateRevisionId: revision.id,
        templateName: revision.name,
        revisionNumber: revision.revisionNumber,
        revisionSummary: revision.revisionSummary,
        progress:
          totalQuestions > 0
            ? Math.round((answeredQuestions / totalQuestions) * 100)
            : 0,
        pillars,
      };
    }
  );
  const primaryTemplate = templates[0];
  const questions: Question[] = workspace.pillars.flatMap((pillar) =>
    pillar.questions.map((question) => {
      const answer = answerByQuestionId.get(question.id);
      return {
        id: question.id,
        templateRevisionId: pillar.templateRevisionId,
        pillar: pillar.slug,
        pillarKey: `${pillar.templateRevisionId}::${pillar.slug}`,
        text: question.text,
        type: question.type,
        riskLevel: question.riskLevel ?? "medium",
        checklistItems: question.checklistItems,
        answer: answer?.answer ?? null,
        naReason: answer?.naReason,
        itemNAReasons: answer?.itemNaReasons,
        importance: question.importance,
        leadingPractices: question.leadingPractices?.map(
          (practice) => practice.text
        ),
        helpfulLinks: question.helpfulLinks,
      };
    })
  );
  return {
    reviewOverlay: {
      id: workspace.review.id,
      name: workspace.review.name,
      subjectId: workspace.subject.id,
      teamId: workspace.subject.type === "team" ? workspace.subject.id : "",
      orgId: workspace.subject.organizationId ?? "",
      templateId: primaryTemplate?.templateId ?? "",
      templateRevisionId: primaryTemplate?.templateRevisionId,
      templateName: primaryTemplate?.templateName ?? "",
      pillars: primaryTemplate?.pillars ?? [],
      templateIds: templates.map((template) => template.templateId),
      templateRevisionIds: templates.map(
        (template) => template.templateRevisionId
      ),
      templateNames: templates.map((template) => template.templateName),
      templates,
      applicationIds: [],
      status: workspace.review.status,
      createdAt: workspace.review.createdAt,
      updatedAt: workspace.review.updatedAt,
      assessors: workspace.assessors,
      advisors: workspace.advisors,
      reviewers: workspace.reviewers,
    },
    questionsOverlay: {
      reviewId: workspace.review.id,
      pillar: "all",
      questions,
    },
  };
}

export class AssessmentOrchestrator {
  async loadReview(reviewId: string): Promise<AssessmentReviewResult> {
    const localReview = await reviewHydration.hydrateReview(reviewId, null);
    if (localReview) {
      return { review: localReview, error: null };
    }

    const result = await fetchRemoteResource(
      () => $fetch<Review>(`/api/reviews/${reviewId}`),
      "Failed to fetch review"
    );

    if (result.error) {
      return { review: null, error: result.error };
    }

    const hydratedReview = await reviewHydration.hydrateReview(
      reviewId,
      result.data
    );

    return { review: hydratedReview ?? result.data, error: null };
  }

  async loadQuestions(reviewId: string): Promise<AssessmentQuestionsResult> {
    const localQuestions = await reviewHydration.hydrateQuestions(
      reviewId,
      null
    );
    if (localQuestions) {
      return { questions: localQuestions, error: null };
    }

    const result = await fetchRemoteResource(
      () => $fetch<QuestionsResponse>(`/api/reviews/${reviewId}/questions`),
      "Failed to fetch review questions"
    );

    if (result.error) {
      return { questions: null, error: result.error };
    }

    const hydratedQuestions = await reviewHydration.hydrateQuestions(
      reviewId,
      result.data
    );

    return { questions: hydratedQuestions ?? result.data, error: null };
  }

  /**
   * Load both the review and its questions in a single coordinated fetch.
   *
   * Waits for the local DB to be ready, then runs the local hydration for
   * review and questions in parallel. If both are available locally, returns
   * immediately without hitting the network. Otherwise, fetches both from the
   * remote API in parallel, then merges with local state via `ReviewHydration`.
   *
   * @returns `AssessmentData` containing `reviewOverlay` and `questionsOverlay`
   *   (the merged results ready for the UI), plus the raw `remoteReview` /
   *   `remoteQuestions` for callers that need the unmerged remote shape.
   *   `error` is non-null only when both the overlay and the remote fetch failed.
   */
  async loadFull(reviewId: string): Promise<AssessmentData> {
    await waitForLocalDbReady();
    try {
      const workspace = await fetchReviewWorkspace(reviewId);
      const assessment = workspaceToAssessmentData(workspace);
      return {
        remoteReview: null,
        remoteQuestions: null,
        ...assessment,
        error: null,
      };
    } catch (cause) {
      return {
        remoteReview: null,
        remoteQuestions: null,
        reviewOverlay: null,
        questionsOverlay: null,
        error:
          cause instanceof Error
            ? cause
            : new Error("Failed to fetch Review workspace"),
      };
    }
  }
}

export const assessmentOrchestrator = new AssessmentOrchestrator();
