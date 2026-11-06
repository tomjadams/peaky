/**
 * Internal helpers for ImprovementPlanProjection.
 *
 * Extracted to keep the main projection file under the max-lines limit.
 * Not part of the public API — import from ImprovementPlanProjection instead.
 */

import type { Question } from "~/models/question";
import type {
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
} from "~/models/template";
import type {
  PlanItem,
  PlanItemIdentity,
  PlanItemState,
} from "~/models/improvement-plan";
import type { AnswerStateLike } from "./ReviewProjection";
import { safeParse } from "~/local-db";
import { formatQuestionReference } from "~/utils/questionReference";

// ─── Context ──────────────────────────────────────────────────

export interface QuestionBuildContext {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  template: TemplateRevisionDetail;
  pillar: TemplatePillar;
  answerByQuestionId: Map<string, AnswerStateLike>;
}

// ─── Checklist parsing ─────────────────────────────────────────

/**
 * Parse a checklist answer into checked and na arrays.
 */
function parseChecklistAnswer(answer: Question["answer"]): {
  checked: string[];
  na: string[];
} {
  if (
    answer != null &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "checked" in answer &&
    "na" in answer
  ) {
    const checked = (answer as { checked?: unknown }).checked;
    const na = (answer as { na?: unknown }).na;
    return {
      checked: Array.isArray(checked)
        ? checked.filter((id) => typeof id === "string")
        : [],
      na: Array.isArray(na) ? na.filter((id) => typeof id === "string") : [],
    };
  }
  if (Array.isArray(answer)) {
    return { checked: answer, na: [] };
  }
  return { checked: [], na: [] };
}

// ─── Classification ────────────────────────────────────────────

/**
 * Classify a single question's attention state based on its answer.
 */
function classifyItem(question: Question): PlanItemState | null {
  // N/A at question level → documented exception
  if (question.answer === "na") {
    return "documented-exception";
  }

  // Unanswered → not assessed
  if (question.answer == null) {
    return "not-assessed";
  }

  // Yes/no "No" → follow-up
  if (question.answer === "no") {
    return "follow-up";
  }

  // Yes/no "Yes" → not in plan
  if (question.answer === "yes") {
    return null;
  }

  // Checklist handling
  if (question.type === "checklist") {
    const allItems = question.checklistItems ?? [];
    if (allItems.length === 0) return null;

    const { checked, na } = parseChecklistAnswer(question.answer);
    const checkedSet = new Set(checked);
    const naSet = new Set(na);
    const hasRemaining = allItems.some(
      (item) => !checkedSet.has(item.id) && !naSet.has(item.id)
    );

    return hasRemaining ? "checklist-gap" : null;
  }

  return null;
}

/**
 * Build a non-judgemental explanation for why an item appears in the plan.
 */
function buildExplanation(state: PlanItemState, question: Question): string {
  switch (state) {
    case "follow-up":
      return "This item appears because the team intentionally answered No";
    case "checklist-gap":
      return "Some checklist practices have not been confirmed yet";
    case "not-assessed":
      return "This question has not been assessed yet";
    case "documented-exception":
      return `Marked as not applicable${question.naReason?.comment ? `: ${question.naReason.comment}` : ""}`;
  }
}

// ─── Item building ─────────────────────────────────────────────

/**
 * Build a PlanItem from a single template question and its answer state.
 * Returns null when the question does not belong in the improvement plan.
 */
export function buildPlanItemFromQuestion(
  templateQuestion: TemplateQuestion,
  ctx: QuestionBuildContext
): PlanItem | null {
  const {
    reviewId,
    subjectId,
    subjectType,
    template,
    pillar,
    answerByQuestionId,
  } = ctx;

  const localAnswer = answerByQuestionId.get(templateQuestion.id);
  const question: Question = {
    id: templateQuestion.id,
    pillar: pillar.slug,
    text: templateQuestion.text,
    type: templateQuestion.type ?? "yes-no",
    riskLevel: templateQuestion.riskLevel,
    checklistItems: templateQuestion.checklistItems,
    answer: safeParse(localAnswer?.answer, null),
    naReason: safeParse(localAnswer?.naReason, undefined),
    itemNAReasons: safeParse(localAnswer?.itemNaReasons, undefined),
    importance: templateQuestion.importance,
    leadingPractices: templateQuestion.leadingPractices.map((p) => p.text),
    helpfulLinks: templateQuestion.helpfulLinks,
  };

  const state = classifyItem(question);
  if (state === null) return null;

  const identity: PlanItemIdentity = {
    reviewId,
    subjectId,
    subjectType,
    templateId: template.templateId,
    templateRevisionId: template.id,
    pillarSlug: pillar.slug,
    questionId: templateQuestion.id,
  };

  const item: PlanItem = {
    identity,
    state,
    severity: question.riskLevel,
    questionText: question.text,
    // The storage id is an opaque composite key; the badge shows the derived
    // slug (REL-1) or nothing at all.
    questionReference: formatQuestionReference(
      pillar.slug,
      templateQuestion.order
    ),
    pillarName: pillar.name,
    templateName: template.name,
    revisionNumber: template.revisionNumber,
    explanation: buildExplanation(state, question),
  };

  // Checklist-specific fields
  if (state === "checklist-gap" && question.type === "checklist") {
    const allItems = question.checklistItems ?? [];
    const { checked, na } = parseChecklistAnswer(question.answer);
    const checkedSet = new Set(checked);
    const naSet = new Set(na);
    const remainingItems = allItems.filter(
      (ci) => !checkedSet.has(ci.id) && !naSet.has(ci.id)
    );
    identity.checklistItemIds = remainingItems.map((ci) => ci.id);
    item.missingChecklistItems = remainingItems.map((ci) => ci.text);
    item.checklistCounts = {
      checked: checked.length,
      na: na.length,
      remaining: remainingItems.length,
    };
  }

  // Documented exception fields
  if (state === "documented-exception") {
    item.naReason = question.naReason;
  }

  // Checklist item N/A reasons for context
  if (
    question.itemNAReasons &&
    Object.keys(question.itemNAReasons).length > 0
  ) {
    item.itemNaReasons = question.itemNAReasons;
  }

  // Learning context
  if (templateQuestion.importance) {
    item.importance = templateQuestion.importance;
  }
  if (templateQuestion.leadingPractices.length > 0) {
    item.leadingPractices = templateQuestion.leadingPractices.map(
      (p) => p.text
    );
  }
  if (templateQuestion.helpfulLinks.length > 0) {
    item.helpfulLinks = templateQuestion.helpfulLinks;
  }

  return item;
}
