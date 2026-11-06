import type { RiskLevel } from "./template";

export type QuestionType = "yes-no" | "checklist";

export interface ChecklistAnswerWithNA {
  checked: string[];
  na: string[];
}

export type QuestionAnswer =
  | "yes"
  | "no"
  | "na"
  | string[]
  | ChecklistAnswerWithNA
  | null;

export type NAReasonType =
  | "not-in-scope"
  | "handled-by-infrastructure"
  | "legacy-system"
  | "pending-deprecation"
  | "other";

export interface NotApplicableReason {
  reason: NAReasonType;
  comment?: string;
}

export interface HelpfulLink {
  id?: string;
  order?: number;
  title: string;
  url: string;
}

export interface ChecklistItem {
  id: string;
  order: number;
  text: string;
}

export interface Question {
  id: string;
  templateRevisionId?: string;
  pillar: string;
  pillarKey?: string;
  text: string;
  type: QuestionType;
  riskLevel: RiskLevel;
  checklistItems?: ChecklistItem[];
  answer?: QuestionAnswer;
  naReason?: NotApplicableReason; // Question-level N/A reason
  itemNAReasons?: Record<string, NotApplicableReason>; // Per-item N/A reasons (itemId -> reason)
  importance?: string;
  leadingPractices?: string[];
  helpfulLinks?: HelpfulLink[];
}

export interface QuestionsResponse {
  reviewId: string;
  pillar: string;
  questions: Question[];
}

export interface QuestionDetailResponse {
  reviewId: string;
  question: Question;
}

export function isChecklistQuestion(question: Question): boolean {
  return question.type === "checklist";
}

export function isYesNoQuestion(question: Question): boolean {
  return question.type === "yes-no";
}

export function isChecklistAnswer(answer: unknown): answer is string[] {
  return (
    Array.isArray(answer) && answer.every((item) => typeof item === "string")
  );
}

export function isChecklistWithNAAnswer(
  answer: unknown
): answer is ChecklistAnswerWithNA {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return false;
  }
  const candidate = answer as Record<string, unknown>;
  return (
    isChecklistAnswer(candidate.checked) && isChecklistAnswer(candidate.na)
  );
}
