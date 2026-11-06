import {
  isChecklistAnswer,
  isChecklistWithNAAnswer,
  type ChecklistAnswerWithNA,
  type QuestionType,
} from "~/models/question";

export interface AnswerQuestionShape {
  readonly type?: QuestionType;
  readonly practiceIds?: readonly string[];
  readonly checklistItems?: readonly { readonly id: string }[];
}

export type NormalizedQuestionAnswer =
  | "yes"
  | "no"
  | "na"
  | ChecklistAnswerWithNA
  | null;

function knownPracticeIds(
  question: AnswerQuestionShape
): ReadonlySet<string> | null {
  const ids =
    question.practiceIds ?? question.checklistItems?.map((item) => item.id);
  return ids === undefined ? null : new Set(ids);
}

function normalizePracticeIds(
  ids: readonly string[],
  known: ReadonlySet<string> | null
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if ((known === null || known.has(id)) && !seen.has(id)) {
      seen.add(id);
      normalized.push(id);
    }
  }
  return normalized;
}

/**
 * Converts stored or temporary answer data to the shape allowed by the current
 * question type. Incompatible stale data is unanswered. Whole-question N/A is
 * valid for either type, and a recorded empty checklist stays recorded.
 */
export function normalizeQuestionAnswer(
  question: AnswerQuestionShape,
  answer: unknown
): NormalizedQuestionAnswer {
  if (answer === "na") return "na";
  if (question.type !== "checklist") {
    return answer === "yes" || answer === "no" ? answer : null;
  }

  const known = knownPracticeIds(question);
  if (isChecklistAnswer(answer)) {
    return { checked: normalizePracticeIds(answer, known), na: [] };
  }
  if (!isChecklistWithNAAnswer(answer)) return null;

  const na = normalizePracticeIds(answer.na, known);
  const notApplicable = new Set(na);
  const checked = normalizePracticeIds(answer.checked, known).filter(
    (id) => !notApplicable.has(id)
  );
  return { checked, na };
}
