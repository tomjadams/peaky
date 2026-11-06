import type { WorkspaceAnswer, WorkspacePillar } from "~/models/workspace";
import { isChecklistWithNAAnswer } from "~/models/question";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";

export interface PillarEvidenceProgress {
  readonly completed: number;
  readonly total: number;
  readonly percent: number;
}

export function calculatePillarEvidenceProgress(
  pillar: WorkspacePillar,
  answers: readonly WorkspaceAnswer[]
): PillarEvidenceProgress {
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer] as const)
  );
  let completed = 0;
  let total = 0;

  for (const question of pillar.questions) {
    const answer = answerByQuestion.get(question.id);
    const normalized = normalizeQuestionAnswer(question, answer?.answer);
    if (question.type !== "checklist") {
      total += 1;
      if (normalized === "yes" || normalized === "no" || normalized === "na") {
        completed += 1;
      }
      continue;
    }

    const itemIds = new Set(
      (question.checklistItems ?? []).map((item) => item.id)
    );
    total += itemIds.size;
    if (normalized === "na") {
      completed += itemIds.size;
      continue;
    }
    if (!isChecklistWithNAAnswer(normalized)) continue;
    const resolved = new Set([
      ...normalized.checked,
      ...normalized.na,
      ...Object.keys(answer?.itemNaReasons ?? {}),
    ]);
    completed += [...resolved].filter((itemId) => itemIds.has(itemId)).length;
  }

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
