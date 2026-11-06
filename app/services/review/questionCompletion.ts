/**
 * Single source of truth for "is this question complete?".
 *
 * Checklist interaction records every unchecked applicable practice as unmet,
 * so any valid checklist shape is complete. This predicate is the one place
 * that decides completeness so progress bars, pillar-tab checkmarks, and
 * header counts cannot drift from each other.
 */

import type {
  ChecklistItem,
  QuestionAnswer,
  QuestionType,
} from "~/models/question";
import { isChecklistWithNAAnswer } from "~/models/question";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";

export interface QuestionCompletionShape {
  type?: QuestionType;
  checklistItems?: ChecklistItem[];
}

/**
 * A question counts as complete when it has a type-compatible recorded
 * answer. For a checklist, every unchecked applicable practice is an explicit
 * unmet answer once any checklist shape, including an empty one, is recorded.
 * Null and type-incompatible stale data remain incomplete. Whole-question N/A
 * is valid for either question type.
 */
export function isQuestionComplete(
  question: QuestionCompletionShape,
  answer: QuestionAnswer | null | undefined
): boolean {
  const type = question.type ?? "yes-no";
  const normalized = normalizeQuestionAnswer(
    { type, checklistItems: question.checklistItems },
    answer
  );
  if (type === "checklist") {
    return normalized === "na" || isChecklistWithNAAnswer(normalized);
  }
  return normalized === "yes" || normalized === "no" || normalized === "na";
}
