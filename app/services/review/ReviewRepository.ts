/**
 * Local DB queries for review records, template selections, and answer state.
 *
 * All methods use withDatabase() for async SQLite access.
 * No Vue imports — safe to call from any context.
 */

import type { QuestionsResponse } from "~/models/question";
import type { Review, ReviewSummary } from "~/models/review";
import type { TemplateRevisionDetail } from "~/models/template";
import { fetchTemplateRevisionDetail } from "~/composables/templates/domain/useTemplateCatalog";
import { fetchLocalTemplateRevisionById } from "~/composables/local/useLocalTemplateDraft";
import { withDatabase, eq, asc, firstOrNull } from "~/local-db";
import {
  reviews,
  reviewTemplateSelections,
  reviewAnswerState,
} from "#shared/db/schema";
import { reviewProjection } from "~/services/review/ReviewProjection";

export type LocalReviewRow = typeof reviews.$inferSelect;
export type LocalTemplateSelectionRow =
  typeof reviewTemplateSelections.$inferSelect;
export type LocalAnswerRow = typeof reviewAnswerState.$inferSelect;

export interface ReviewRecord {
  review: LocalReviewRow;
  selections: LocalTemplateSelectionRow[];
  answers: LocalAnswerRow[];
}

export class ReviewRepository {
  async fetchRevisionSnapshotSafe(
    revisionId: string
  ): Promise<TemplateRevisionDetail | null> {
    try {
      const local = await fetchLocalTemplateRevisionById(revisionId);
      return local ?? (await fetchTemplateRevisionDetail(revisionId));
    } catch {
      return null;
    }
  }

  async fetchSelectedRevisionSnapshots(
    selections: LocalTemplateSelectionRow[]
  ): Promise<TemplateRevisionDetail[]> {
    if (selections.length < 1 || selections.length > 3)
      throw new Error(
        "A Review requires one to three Template Revision selections"
      );
    const revisionIds = new Set<string>();
    for (const [index, selection] of selections.entries()) {
      if (
        selection.position !== index ||
        selection.position < 0 ||
        selection.position > 2
      )
        throw new Error(
          `Invalid Review selection position: ${selection.position}`
        );
      if (revisionIds.has(selection.templateRevisionId))
        throw new Error("Review Template Revision selections must be distinct");
      revisionIds.add(selection.templateRevisionId);
    }

    const snapshots = await Promise.all(
      selections.map((selection) =>
        this.fetchRevisionSnapshotSafe(selection.templateRevisionId)
      )
    );
    const missingIndex = snapshots.findIndex((snapshot) => snapshot === null);
    if (missingIndex >= 0)
      throw new Error(
        `Selected Template Revision not found: ${selections[missingIndex]!.templateRevisionId}`
      );
    return snapshots as TemplateRevisionDetail[];
  }

  async fetchRecord(reviewId: string): Promise<ReviewRecord | null> {
    return withDatabase(async (db) => {
      const [reviewRows, selections, answers] = await Promise.all([
        db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1),
        db
          .select()
          .from(reviewTemplateSelections)
          .where(eq(reviewTemplateSelections.reviewId, reviewId))
          .orderBy(asc(reviewTemplateSelections.position)),
        db
          .select()
          .from(reviewAnswerState)
          .where(eq(reviewAnswerState.reviewId, reviewId)),
      ]);

      const review = firstOrNull(reviewRows);
      if (!review) {
        return null;
      }

      return { review, selections, answers };
    });
  }

  async fetchAnswerRows(reviewId: string): Promise<LocalAnswerRow[]> {
    return withDatabase(async (db) => {
      return db
        .select()
        .from(reviewAnswerState)
        .where(eq(reviewAnswerState.reviewId, reviewId));
    });
  }

  async fetchRecordsBySubject(subjectId: string): Promise<ReviewRecord[]> {
    return withDatabase(async (db) => {
      const reviewRows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.subjectId, subjectId))
        .orderBy(asc(reviews.createdAt));

      return Promise.all(
        reviewRows.map(async (review) => {
          const [selections, answers] = await Promise.all([
            db
              .select()
              .from(reviewTemplateSelections)
              .where(eq(reviewTemplateSelections.reviewId, review.id))
              .orderBy(asc(reviewTemplateSelections.position)),
            db
              .select()
              .from(reviewAnswerState)
              .where(eq(reviewAnswerState.reviewId, review.id)),
          ]);

          return { review, selections, answers };
        })
      );
    });
  }

  async fetchReview(reviewId: string): Promise<Review | null> {
    const record = await this.fetchRecord(reviewId);
    if (!record) {
      return null;
    }

    const templateDetails = await this.fetchSelectedRevisionSnapshots(
      record.selections
    );

    const templates = templateDetails.map((template) =>
      reviewProjection.buildTemplateProjection(template, record.answers)
    );
    const primaryTemplate = templateDetails[0];

    return {
      id: record.review.id,
      name: record.review.name,
      subjectId: record.review.subjectId,
      teamId: "",
      orgId: "",
      templateId: primaryTemplate?.templateId ?? "",
      templateRevisionId: primaryTemplate?.id,
      templateName: primaryTemplate?.name ?? "",
      pillars: primaryTemplate
        ? reviewProjection.buildPillars(primaryTemplate, record.answers)
        : [],
      templateIds: templateDetails.map((template) => template.templateId),
      templateRevisionIds: record.selections.map(
        (selection) => selection.templateRevisionId
      ),
      templateNames: templateDetails.map((template) => template.name),
      templates,
      applicationIds: [],
      status: record.review.status,
      createdAt: record.review.createdAt,
      updatedAt: record.review.updatedAt,
      assessors: [],
      reviewers: [],
    };
  }

  async fetchQuestions(
    reviewId: string,
    options?: { pillar?: string; templateRevisionId?: string }
  ): Promise<QuestionsResponse | null> {
    const record = await this.fetchRecord(reviewId);
    if (!record) {
      return null;
    }

    const templateDetails = await this.fetchSelectedRevisionSnapshots(
      record.selections
    );
    const selectedTemplates = options?.templateRevisionId
      ? templateDetails.filter(
          (candidate) => candidate.id === options.templateRevisionId
        )
      : templateDetails;
    if (selectedTemplates.length === 0) return null;

    const [pillarRevisionId, pillarSlug] = options?.pillar?.includes("::")
      ? options.pillar.split("::", 2)
      : [undefined, options?.pillar];
    return {
      reviewId,
      pillar: options?.pillar ?? "all",
      questions: selectedTemplates.flatMap((template) =>
        reviewProjection.buildQuestionsProjection(
          template,
          record.answers,
          pillarRevisionId && pillarRevisionId !== template.id
            ? "__not_selected__"
            : pillarSlug
        )
      ),
    };
  }

  async fetchSubjectReviews(subjectId: string): Promise<ReviewSummary[]> {
    const records = await this.fetchRecordsBySubject(subjectId);

    const reviewsWithTemplates = await Promise.all(
      records.map(async (record) => {
        const templateDetails = await this.fetchSelectedRevisionSnapshots(
          record.selections
        ).catch((error) => {
          console.warn(
            "[ReviewRepository.fetchSubjectReviews] Skipping incomplete local Review",
            {
              diagnostic: "REVIEW_SELECTION_PROJECTION_FAILED",
              subjectId,
              reviewId: record.review.id,
              errorName: error instanceof Error ? error.name : "UnknownError",
            }
          );
          return null;
        });
        if (!templateDetails) return null;

        const templates = templateDetails.map((template) =>
          reviewProjection.buildTemplateProjection(template, record.answers)
        );
        const totalQuestions = templates.reduce(
          (sum, template) =>
            sum +
            template.pillars.reduce(
              (pillarSum, pillar) => pillarSum + pillar.totalQuestions,
              0
            ),
          0
        );
        const answeredQuestions = templates.reduce(
          (sum, template) =>
            sum +
            template.pillars.reduce(
              (pillarSum, pillar) => pillarSum + pillar.answeredQuestions,
              0
            ),
          0
        );

        return {
          id: record.review.id,
          name: record.review.name,
          templateIds: templateDetails.map((template) => template.templateId),
          templateRevisionIds: record.selections.map(
            (selection) => selection.templateRevisionId
          ),
          templateNames: templateDetails.map((template) => template.name),
          status: record.review.status,
          progress:
            totalQuestions > 0
              ? Math.round((answeredQuestions / totalQuestions) * 100)
              : 0,
          createdAt: record.review.createdAt,
          updatedAt: record.review.updatedAt,
          assessors: [],
          reviewers: [],
        } satisfies ReviewSummary;
      })
    );

    return reviewsWithTemplates
      .filter((review) => review !== null)
      .toSorted(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }
}

export const reviewRepository = new ReviewRepository();
