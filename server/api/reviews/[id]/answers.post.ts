import { findReviewById } from "../../../data/review-lookup";
import {
  setAnswer,
  clearAnswer,
  getAnswersForReview,
} from "../../../data/answers";
import type { StoredAnswer } from "../../../data/answers";
import { templateDetails } from "../../../data/templates";
import type { ReviewTemplate } from "../../../../app/models";

function isValidAnswerShape(answer: unknown): boolean {
  return (
    answer === null ||
    answer === "yes" ||
    answer === "no" ||
    answer === "na" ||
    Array.isArray(answer) ||
    (typeof answer === "object" &&
      answer !== null &&
      "checked" in answer &&
      "na" in answer)
  );
}

function recalculatePillarStats(
  reviewId: string,
  templates: ReviewTemplate[]
): void {
  const savedAnswers = getAnswersForReview(reviewId);
  for (const template of templates) {
    const detail = templateDetails[template.templateRevisionId];
    if (!detail) continue;

    for (const detailPillar of detail.pillars) {
      const questionIds = detailPillar.questions.map((q) => q.id);
      const answeredCount = questionIds.filter(
        (qId) => savedAnswers[qId] != null
      ).length;
      const totalCount = questionIds.length;
      const progress =
        totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

      const reviewPillar = template.pillars.find(
        (p) => p.slug === detailPillar.slug
      );
      if (reviewPillar) {
        reviewPillar.answeredQuestions = answeredCount;
        reviewPillar.totalQuestions = totalCount;
        reviewPillar.progress = progress;
      }
    }
  }
}

export default defineEventHandler(async (event) => {
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

  const body = await readBody(event);

  if (!body?.questionId || typeof body.questionId !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "questionId is required",
    });
  }

  if (
    !body?.templateRevisionId ||
    typeof body.templateRevisionId !== "string"
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "templateRevisionId is required",
    });
  }
  const selectedRevision = review.templates.find(
    (template) => template.templateRevisionId === body.templateRevisionId
  );
  const selectedDetail = selectedRevision
    ? templateDetails[selectedRevision.templateRevisionId]
    : undefined;
  const ownsQuestion = selectedDetail?.pillars.some((pillar) =>
    pillar.questions.some((question) => question.id === body.questionId)
  );
  if (!ownsQuestion) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Question does not belong to the selected Template Revision",
    });
  }

  if (body.answer === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: "answer is required",
    });
  }

  // Validate answer shape: must be "yes", "no", "na", string[], or { checked, na }
  const { answer } = body;

  if (!isValidAnswerShape(answer)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid answer value",
    });
  }

  if (answer === null) {
    clearAnswer(reviewId, body.questionId);
  } else {
    const storedAnswer: StoredAnswer = {
      answer: body.answer,
    };

    if (body.naReason) {
      storedAnswer.naReason = body.naReason;
    }

    if (body.itemNAReasons) {
      storedAnswer.itemNAReasons = body.itemNAReasons;
    }

    setAnswer(reviewId, body.questionId, storedAnswer);
  }

  // Recalculate pillar stats after saving an answer
  recalculatePillarStats(reviewId, review.templates);

  return { success: true };
});
