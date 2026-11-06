import type { TemplateRevisionDetail, TemplateQuestion } from "~/models";
import { HANDOFF_LIMITS } from "~/services/handoff/limits";

export const CHAR_LIMITS = {
  questionText: 120,
  importance: 1000,
  practice: 200,
  checklistItem: 250,
} as const;

export const MIN_CHECKLIST_ITEMS = 3;

/**
 * Validate leading practices for a single question.
 * Extracted to avoid exceeding max-depth inside validateTemplate.
 */
function validatePractices(
  question: TemplateQuestion,
  questionSlug: string
): string[] {
  const textLength = question.text?.length ?? 0;
  const questionPreview = question.text?.slice(0, 30) ?? "Untitled";
  const suffix = textLength > 30 ? "..." : "";
  const errors: string[] = [];
  for (const [practiceIndex, practice] of question.leadingPractices.entries()) {
    const practiceLength = practice.text?.length ?? 0;
    if (practiceLength > CHAR_LIMITS.practice) {
      errors.push(
        `${questionSlug}: Leading practice #${practiceIndex + 1} too long (${practiceLength}/${CHAR_LIMITS.practice}) - "${questionPreview}${suffix}"`
      );
    }
  }
  return errors;
}

/**
 * Validate the leading practices of a checklist-type question.
 * Extracted to avoid exceeding max-depth inside validateTemplate.
 */
function validateChecklist(
  question: TemplateQuestion,
  questionSlug: string
): string[] {
  const textLength = question.text?.length ?? 0;
  const questionPreview = question.text?.slice(0, 30) ?? "Untitled";
  const suffix = textLength > 30 ? "..." : "";
  const errors: string[] = [];
  const checklistItems = (question.checklistItems ?? []).filter((item) =>
    item.text?.trim()
  );
  if (checklistItems.length < MIN_CHECKLIST_ITEMS) {
    errors.push(
      `${questionSlug}: Checklist requires at least ${MIN_CHECKLIST_ITEMS} leading practices (currently ${checklistItems.length}) - "${questionPreview}${suffix}"`
    );
  }
  for (const [itemIndex, item] of checklistItems.entries()) {
    const itemLength = item.text?.length ?? 0;
    if (itemLength > CHAR_LIMITS.checklistItem) {
      errors.push(
        `${questionSlug}: Leading practice #${itemIndex + 1} too long (${itemLength}/${CHAR_LIMITS.checklistItem}) - "${questionPreview}${suffix}"`
      );
    }
  }
  return errors;
}

/**
 * Validate a single question's text, importance, practices, and checklist.
 * Extracted to reduce complexity and depth of validateTemplate.
 */
function validateQuestion(
  question: TemplateQuestion,
  questionSlug: string
): string[] {
  const textLength = question.text?.length ?? 0;
  const importanceLength = question.importance?.length ?? 0;
  const questionPreview = question.text?.slice(0, 30) ?? "Untitled";
  const suffix = textLength > 30 ? "..." : "";
  const errors: string[] = [];

  if (textLength > CHAR_LIMITS.questionText) {
    errors.push(
      `${questionSlug}: Question text too long (${textLength}/${CHAR_LIMITS.questionText}) - "${questionPreview}${suffix}"`
    );
  }

  if (importanceLength > CHAR_LIMITS.importance) {
    errors.push(
      `${questionSlug}: "Why This Matters" too long (${importanceLength}/${CHAR_LIMITS.importance}) - "${questionPreview}${suffix}"`
    );
  }

  const helpfulLinkCount = question.helpfulLinks?.length ?? 0;
  if (helpfulLinkCount > HANDOFF_LIMITS.helpfulLinksPerPractice) {
    errors.push(
      `${questionSlug}: Helpful links must contain at most ${HANDOFF_LIMITS.helpfulLinksPerPractice} entries (currently ${helpfulLinkCount}) - "${questionPreview}${suffix}"`
    );
  }

  errors.push(...validatePractices(question, questionSlug));

  const questionType = question.type ?? "yes-no";
  if (questionType === "checklist") {
    errors.push(...validateChecklist(question, questionSlug));
  }

  return errors;
}

export class TemplateValidation {
  static readonly CHAR_LIMITS = CHAR_LIMITS;

  getQuestionSlug(pillarSlug: string, order: number): string {
    const prefix = pillarSlug.toUpperCase().slice(0, 3);
    return `${prefix}-${order}`;
  }

  validateTemplate(template: TemplateRevisionDetail | null): string[] {
    const errors: string[] = [];
    if (!template) return errors;

    for (const pillar of template.pillars) {
      for (const [questionIndex, question] of pillar.questions.entries()) {
        const questionNum = questionIndex + 1;
        const questionSlug = this.getQuestionSlug(pillar.slug, questionNum);
        errors.push(...validateQuestion(question, questionSlug));
      }
    }

    return errors;
  }
}

export const templateValidation = new TemplateValidation();
