import type { MaturityDefinition, ScorableQuestion } from "./definition";
import type { DefinitionIssue } from "./validation";

function validateCustomShare(
  questionId: string,
  practiceId: string,
  share: number,
  issues: DefinitionIssue[]
): boolean {
  const path = `allocations.${questionId}.shares.${practiceId}`;
  const wholeNumber = Number.isInteger(share);
  if (!wholeNumber) {
    issues.push({
      code: "allocation-share-not-integer",
      path,
      message: `Share for practice ${practiceId} is not a whole percentage.`,
    });
  }
  if (share < 0) {
    issues.push({
      code: "allocation-share-negative",
      path,
      message: `Share for practice ${practiceId} is negative.`,
    });
  } else if (share === 0) {
    issues.push({
      code: "allocation-share-zero",
      path,
      message: `Share for practice ${practiceId} must be greater than zero.`,
    });
  }
  return wholeNumber && share > 0;
}

function validateCustomShares(
  questionId: string,
  shares: Readonly<Record<string, number>>,
  issues: DefinitionIssue[]
): ReadonlySet<string> {
  const valid = new Set<string>();
  for (const [practiceId, share] of Object.entries(shares)) {
    if (validateCustomShare(questionId, practiceId, share, issues)) {
      valid.add(practiceId);
    }
  }
  return valid;
}

export function validateAllocations(
  definition: MaturityDefinition,
  questionsById: ReadonlyMap<string, ScorableQuestion>,
  issues: DefinitionIssue[]
): void {
  for (const [questionId, allocation] of Object.entries(
    definition.allocations
  )) {
    const validPositiveShares =
      allocation.mode === "custom"
        ? validateCustomShares(questionId, allocation.shares, issues)
        : new Set<string>();
    const question = questionsById.get(questionId);
    if (!question) {
      issues.push({
        code: "allocation-unknown-question",
        path: `allocations.${questionId}`,
        message: `Allocation references unknown question ${questionId}.`,
      });
      continue;
    }
    if (question.type !== "checklist") {
      issues.push({
        code: "allocation-not-checklist",
        path: `allocations.${questionId}`,
        message: `Question ${questionId} is not a checklist question and cannot carry an allocation.`,
      });
      continue;
    }
    if (allocation.mode === "equal") continue;

    let total = 0;
    for (const [practiceId, share] of Object.entries(allocation.shares)) {
      const knownPractice = question.practiceIds.includes(practiceId);
      if (!knownPractice) {
        issues.push({
          code: "allocation-unknown-practice",
          path: `allocations.${questionId}.shares.${practiceId}`,
          message: `Allocation references unknown practice ${practiceId} on question ${questionId}.`,
        });
      }
      if (knownPractice && validPositiveShares.has(practiceId)) total += share;
    }
    for (const practiceId of question.practiceIds) {
      if (!(practiceId in allocation.shares)) {
        issues.push({
          code: "allocation-missing-practice",
          path: `allocations.${questionId}.shares.${practiceId}`,
          message: `Custom allocation for question ${questionId} does not cover practice ${practiceId}.`,
        });
      }
    }
    if (total !== 100) {
      issues.push({
        code: "allocation-total",
        path: `allocations.${questionId}.shares`,
        message: `Custom allocation for question ${questionId} totals ${total}; practice percentages must total exactly 100.`,
      });
    }
  }
}
