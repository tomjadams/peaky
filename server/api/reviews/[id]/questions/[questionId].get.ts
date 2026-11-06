import type { Question } from "../../../../../app/models";
import { findReviewById } from "../../../../data/review-lookup";
import { templateDetails } from "../../../../data/templates";
import { getAnswer } from "../../../../data/answers";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");
  const questionId = getRouterParam(event, "questionId");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review ID is required",
    });
  }

  if (!questionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Question ID is required",
    });
  }

  const review = findReviewById(id);

  if (!review) {
    throw createError({
      statusCode: 404,
      statusMessage: "Review not found",
    });
  }

  const templateQuestions: Question[] = review.templates.flatMap(
    (selection) => {
      const detail = templateDetails[selection.templateRevisionId];
      if (!detail) return [];
      return detail.pillars.flatMap((pillar) =>
        pillar.questions.map((question) => ({
          id: question.id,
          templateRevisionId: detail.id,
          pillar: pillar.slug,
          pillarKey: `${detail.id}::${pillar.slug}`,
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
    }
  );

  const question = templateQuestions.find((entry) => entry.id === questionId);

  if (!question) {
    throw createError({
      statusCode: 404,
      statusMessage: "Question not found",
    });
  }

  // Merge persisted answer from the answers store
  const savedAnswer = getAnswer(id, questionId);
  const mergedQuestion = savedAnswer
    ? {
        ...question,
        answer: savedAnswer.answer,
        naReason: savedAnswer.naReason ?? question.naReason,
        itemNAReasons: savedAnswer.itemNAReasons ?? question.itemNAReasons,
      }
    : question;

  return {
    reviewId: id,
    question: mergedQuestion,
  };
});
