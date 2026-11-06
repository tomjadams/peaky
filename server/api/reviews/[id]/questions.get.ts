import type { Question } from "../../../../app/models";
import { findReviewById } from "../../../data/review-lookup";
import { templateDetails } from "../../../data/templates";
import { getAnswersForReview } from "../../../data/answers";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const pillar = query.pillar as string | undefined;
  const templateRevisionId = query.templateRevisionId as string | undefined;

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  const review = findReviewById(id);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  const selections = templateRevisionId
    ? review.templates.filter(
        (candidate) => candidate.templateRevisionId === templateRevisionId
      )
    : review.templates;
  if (selections.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Template Revision is not selected by this Review",
    });
  }

  let reviewQuestions: Question[] = selections.flatMap((selection) => {
    const detail = templateDetails[selection.templateRevisionId];
    if (!detail)
      throw createError({
        statusCode: 409,
        statusMessage: "Selected Template Revision is unavailable",
      });
    return detail.pillars.flatMap((templatePillar) =>
      templatePillar.questions.map((question) => ({
        id: question.id,
        templateRevisionId: detail.id,
        pillar: templatePillar.slug,
        pillarKey: `${detail.id}::${templatePillar.slug}`,
        text: question.text,
        type: question.type ?? "yes-no",
        riskLevel: question.riskLevel,
        checklistItems: question.checklistItems,
        answer: null,
        importance: question.importance,
        leadingPractices: question.leadingPractices.map(
          (practice) => practice.text
        ),
        helpfulLinks: question.helpfulLinks,
      }))
    );
  });

  if (pillar) {
    reviewQuestions = reviewQuestions.filter(
      (question) => question.pillar === pillar || question.pillarKey === pillar
    );
  }

  // Merge persisted answers from the answers store
  const savedAnswers = getAnswersForReview(id);
  const mergedQuestions = reviewQuestions.map((question) => {
    const saved = savedAnswers[question.id];
    if (!saved) return question;
    return Object.assign({}, question, {
      answer: saved.answer,
      naReason: saved.naReason ?? question.naReason,
      itemNAReasons: saved.itemNAReasons ?? question.itemNAReasons,
    });
  });

  return {
    reviewId: id,
    pillar: pillar ?? "all",
    questions: mergedQuestions,
  };
});
