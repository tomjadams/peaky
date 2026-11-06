import type {
  QuestionAnswer,
  NotApplicableReason,
} from "../../app/models/question";
import { reviews } from "./reviews";
import { templateDetails } from "./templates";

export interface StoredAnswer {
  answer: QuestionAnswer;
  naReason?: NotApplicableReason;
  itemNAReasons?: Record<string, NotApplicableReason>;
}

interface SeedQuestion {
  id: string;
  type?: "yes-no" | "checklist";
  checklistItems?: Array<{ id: string }>;
}

const SHOWCASE_REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";

function seedAnswer(
  question: SeedQuestion,
  index: number,
  sparseShowcase: boolean
): StoredAnswer {
  if (question.type === "checklist") {
    const practiceIds = question.checklistItems?.map((item) => item.id) ?? [];
    const checked =
      index % 3 === 0
        ? practiceIds.slice(
            0,
            sparseShowcase ? Math.ceil(practiceIds.length * 0.4) : -1
          )
        : practiceIds.slice();
    return { answer: { checked, na: [] } };
  }
  return { answer: index % 3 === 0 ? "no" : "yes" };
}

function buildSeedAnswers(): Record<string, Record<string, StoredAnswer>> {
  const store: Record<string, Record<string, StoredAnswer>> = {};
  for (const review of reviews) {
    const reviewAnswers: Record<string, StoredAnswer> = {};
    let answerIndex = 0;
    for (const template of review.templates) {
      const detail = templateDetails[template.templateRevisionId];
      if (!detail) continue;
      for (const pillar of detail.pillars) {
        const answered =
          template.pillars.find((candidate) => candidate.slug === pillar.slug)
            ?.answeredQuestions ?? 0;
        for (const question of pillar.questions.slice(0, answered)) {
          reviewAnswers[question.id] = seedAnswer(
            question,
            answerIndex,
            review.id === SHOWCASE_REVIEW_ID
          );
          answerIndex += 1;
        }
      }
    }
    if (Object.keys(reviewAnswers).length > 0) {
      store[review.id] = reviewAnswers;
    }
  }
  return store;
}

/** In-memory answers store: reviewId -> questionId -> StoredAnswer */
let answersStore: Record<
  string,
  Record<string, StoredAnswer>
> = buildSeedAnswers();

export function getAnswer(
  reviewId: string,
  questionId: string
): StoredAnswer | undefined {
  return answersStore[reviewId]?.[questionId];
}

export function getAnswersForReview(
  reviewId: string
): Record<string, StoredAnswer> {
  return answersStore[reviewId] ?? {};
}

export function setAnswer(
  reviewId: string,
  questionId: string,
  data: StoredAnswer
): void {
  if (!answersStore[reviewId]) {
    answersStore[reviewId] = {};
  }
  answersStore[reviewId][questionId] = data;
}

export function clearAnswer(reviewId: string, questionId: string): void {
  const reviewAnswers = answersStore[reviewId];
  if (!reviewAnswers || !(questionId in reviewAnswers)) return;
  const { [questionId]: _, ...rest } = reviewAnswers;
  if (Object.keys(rest).length === 0) {
    const { [reviewId]: __, ...restStore } = answersStore;
    answersStore = restStore;
  } else {
    answersStore = { ...answersStore, [reviewId]: rest };
  }
}

export function clearAnswers(): void {
  answersStore = {};
}
