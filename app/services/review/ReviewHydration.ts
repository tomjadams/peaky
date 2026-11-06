/**
 * Local-first hydration strategy for reviews and questions.
 *
 * Merges remote server state with local SQLite state, giving priority
 * to local answers for optimistic UI while preserving remote metadata.
 * No Vue imports — safe to call from any context.
 *
 * Merge strategy:
 *
 *   Remote review data     +     Local SQLite state
 *         ↓                           ↓
 *     overlayReviewState()   (local answer rows win for
 *                             answer/naReason/status/name)
 *         ↓
 *     Hydrated review (shown in UI)
 *
 * Local wins on: name, status, updatedAt, pillars, templateId,
 *   applicationIds, and all per-question answer fields.
 * Remote wins on: everything else (subjectId, actorId, createdAt, etc.).
 * Null handling: if one side is null the other side is returned as-is.
 */

import type { QuestionsResponse, Review } from "~/models";
import type { TemplateRevisionDetail } from "~/models/template";
import { safeParse } from "~/local-db";
import {
  safeParseAnswer,
  reviewProjection,
} from "~/services/review/ReviewProjection";
import { fetchTemplateRevisionDetail } from "~/composables/templates/domain/useTemplateCatalog";
import { reviewRepository } from "~/services/review/ReviewRepository";
import type { LocalAnswerRow } from "~/services/review/ReviewRepository";

interface RemoteFetchResult<T> {
  data: T | null;
  error: Error | null;
}

export class ReviewHydration {
  private async fetchTemplateRevisionDetailSafe(
    templateId: string
  ): Promise<TemplateRevisionDetail | null> {
    try {
      return await fetchTemplateRevisionDetail(templateId);
    } catch {
      return null;
    }
  }

  private overlayRemoteCollection<T>(
    remoteItems: T[],
    localItems: T[],
    keySelector: (item: T) => string,
    merge: (remoteItem: T, localItem: T) => T
  ): T[] {
    const localByKey = new Map(
      localItems.map((item) => [keySelector(item), item] as const)
    );
    const remoteKeys = new Set(remoteItems.map((item) => keySelector(item)));

    return [
      ...remoteItems.map((item) => {
        const localItem = localByKey.get(keySelector(item));
        return localItem ? merge(item, localItem) : item;
      }),
      ...localItems.filter((item) => !remoteKeys.has(keySelector(item))),
    ];
  }

  private overlayReviewPillars(
    remoteReview: Review,
    localReview: Review
  ): Review["templates"] {
    const remoteByRevisionId = new Map(
      remoteReview.templates.map(
        (template) => [template.templateRevisionId, template] as const
      )
    );
    return localReview.templates.map((localTemplate) => {
      const remoteTemplate = remoteByRevisionId.get(
        localTemplate.templateRevisionId
      );
      if (!remoteTemplate) return localTemplate;
      return {
        ...remoteTemplate,
        ...localTemplate,
        pillars: this.overlayRemoteCollection(
          remoteTemplate.pillars,
          localTemplate.pillars,
          (pillar) => pillar.slug,
          (remotePillar, localPillar) => ({
            ...remotePillar,
            ...localPillar,
          })
        ),
      };
    });
  }

  overlayReviewState(
    remoteReview: Review | null,
    localReview: Review | null
  ): Review | null {
    if (!remoteReview) {
      return localReview;
    }

    if (!localReview) {
      return remoteReview;
    }

    const templates = this.overlayReviewPillars(remoteReview, localReview);
    const primaryTemplate =
      templates.find(
        (template) =>
          template.templateRevisionId ===
          (localReview.templateRevisionId ?? remoteReview.templateRevisionId)
      ) ??
      templates[0] ??
      null;

    return {
      ...remoteReview,
      name: localReview.name,
      subjectId: localReview.subjectId ?? remoteReview.subjectId,
      status: localReview.status,
      updatedAt: localReview.updatedAt,
      templateId: primaryTemplate?.templateId ?? remoteReview.templateId,
      templateRevisionId:
        primaryTemplate?.templateRevisionId ?? remoteReview.templateRevisionId,
      templateName: primaryTemplate?.templateName ?? remoteReview.templateName,
      pillars: primaryTemplate?.pillars ?? remoteReview.pillars,
      templateIds:
        templates.length > 0
          ? templates.map((template) => template.templateId)
          : remoteReview.templateIds,
      templateRevisionIds:
        templates.length > 0
          ? templates.map((template) => template.templateRevisionId)
          : remoteReview.templateRevisionIds,
      templateNames:
        templates.length > 0
          ? templates.map((template) => template.templateName)
          : remoteReview.templateNames,
      templates: templates.length > 0 ? templates : remoteReview.templates,
      applicationIds:
        localReview.applicationIds && localReview.applicationIds.length > 0
          ? localReview.applicationIds
          : remoteReview.applicationIds,
    };
  }

  overlayQuestionState(
    remoteQuestions: QuestionsResponse | null,
    localQuestions: QuestionsResponse | null
  ): QuestionsResponse | null {
    if (!remoteQuestions) {
      return localQuestions;
    }

    if (!localQuestions) {
      return remoteQuestions;
    }

    return {
      ...remoteQuestions,
      questions: this.overlayRemoteCollection(
        remoteQuestions.questions,
        localQuestions.questions,
        (question) => question.id,
        (remoteQuestion, localQuestion) => ({
          ...remoteQuestion,
          answer:
            localQuestion.answer !== undefined
              ? localQuestion.answer
              : remoteQuestion.answer,
          naReason:
            localQuestion.naReason !== undefined
              ? localQuestion.naReason
              : remoteQuestion.naReason,
          itemNAReasons:
            localQuestion.itemNAReasons !== undefined
              ? localQuestion.itemNAReasons
              : remoteQuestion.itemNAReasons,
        })
      ),
    };
  }

  applyAnswersToQuestions(
    remoteQuestions: QuestionsResponse,
    answers: LocalAnswerRow[]
  ): QuestionsResponse {
    if (answers.length === 0) {
      return remoteQuestions;
    }

    const answerByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer] as const)
    );

    return {
      ...remoteQuestions,
      questions: remoteQuestions.questions.map((question) => {
        const localAnswer = answerByQuestionId.get(question.id);
        if (!localAnswer) {
          return question;
        }

        return {
          ...question,
          answer: safeParseAnswer(localAnswer.answer),
          naReason: safeParse(localAnswer.naReason, undefined),
          itemNAReasons: safeParse(localAnswer.itemNaReasons, undefined),
        };
      }),
    };
  }

  async applyAnswersToReview(
    remoteReview: Review,
    answers: LocalAnswerRow[]
  ): Promise<Review> {
    if (answers.length === 0) {
      return remoteReview;
    }

    const selectedRevisionIds =
      remoteReview.templateRevisionIds ??
      remoteReview.templates.map((template) => template.templateRevisionId);
    const templateDetails = (
      await Promise.all(
        selectedRevisionIds.map((revisionId) =>
          this.fetchTemplateRevisionDetailSafe(revisionId)
        )
      )
    ).filter(
      (template): template is TemplateRevisionDetail => template !== null
    );
    if (templateDetails.length !== selectedRevisionIds.length)
      throw new Error("A selected Template Revision snapshot is unavailable");
    const templates = templateDetails.map((template) =>
      reviewProjection.buildTemplateProjection(template, answers)
    );
    const primaryTemplate =
      templates.find(
        (template) =>
          template.templateRevisionId === remoteReview.templateRevisionId
      ) ??
      templates[0] ??
      null;

    return {
      ...remoteReview,
      templateId: primaryTemplate?.templateId ?? remoteReview.templateId,
      templateRevisionId:
        primaryTemplate?.templateRevisionId ?? remoteReview.templateRevisionId,
      templateName: primaryTemplate?.templateName ?? remoteReview.templateName,
      pillars: primaryTemplate?.pillars ?? remoteReview.pillars,
      templateIds:
        templates.length > 0
          ? templates.map((template) => template.templateId)
          : remoteReview.templateIds,
      templateRevisionIds:
        templates.length > 0
          ? templates.map((template) => template.templateRevisionId)
          : remoteReview.templateRevisionIds,
      templateNames:
        templates.length > 0
          ? templates.map((template) => template.templateName)
          : remoteReview.templateNames,
      templates: templates.length > 0 ? templates : remoteReview.templates,
    };
  }

  /**
   * Produce a hydrated `Review` by merging remote and local state.
   *
   * Loads the local review row and all local answer rows from SQLite, then:
   * 1. Applies local answer rows onto `remoteReview` via `applyAnswersToReview()`
   *    (answer/naReason/itemNaReasons per question win locally).
   * 2. Overlays the local review row fields (name, status, pillars) via
   *    `overlayReviewState()`.
   *
   * If `remoteReview` is null, returns the local-only state.
   * If no local state exists, returns `remoteReview` (possibly with remote answers).
   */
  async hydrateReview(
    reviewId: string,
    remoteReview: Review | null
  ): Promise<Review | null> {
    const [localReview, answers] = await Promise.all([
      reviewRepository.fetchReview(reviewId),
      reviewRepository.fetchAnswerRows(reviewId).catch(() => []),
    ]);

    const reviewWithLocalAnswers = remoteReview
      ? await this.applyAnswersToReview(remoteReview, answers)
      : null;

    return this.overlayReviewState(reviewWithLocalAnswers, localReview);
  }

  /**
   * Produce a hydrated `QuestionsResponse` by merging remote and local state.
   *
   * Loads local question rows and answer rows from SQLite, then:
   * 1. Applies answer rows onto `remoteQuestions` via `applyAnswersToQuestions()`
   *    — local `answer`, `naReason`, and `itemNaReasons` win per question.
   * 2. Overlays the full local question collection via `overlayQuestionState()`.
   *
   * If `remoteQuestions` is null, returns local-only questions.
   * If no local state exists, returns `remoteQuestions` unchanged.
   */
  async hydrateQuestions(
    reviewId: string,
    remoteQuestions: QuestionsResponse | null
  ): Promise<QuestionsResponse | null> {
    const [localQuestions, answers] = await Promise.all([
      reviewRepository.fetchQuestions(reviewId),
      reviewRepository.fetchAnswerRows(reviewId).catch(() => []),
    ]);

    const questionsWithLocalAnswers = remoteQuestions
      ? this.applyAnswersToQuestions(remoteQuestions, answers)
      : null;

    return this.overlayQuestionState(questionsWithLocalAnswers, localQuestions);
  }
}

export const reviewHydration = new ReviewHydration();

/**
 * Generic remote resource fetcher with error normalization.
 * Used by composables to safely wrap API calls.
 */
export async function fetchRemoteResource<T>(
  fetcher: () => Promise<T>,
  fallbackMessage: string
): Promise<RemoteFetchResult<T>> {
  try {
    return {
      data: await fetcher(),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(fallbackMessage),
    };
  }
}
