import type { TemplateRevisionDetail } from "~/models";
import {
  templateValidation,
  CHAR_LIMITS,
} from "~/services/template/TemplateValidation";

/** Character limits for template validation (must match QuestionCard.vue). */
export { CHAR_LIMITS };

/** Validates template content against character limits and required fields. */
export function useTemplatesValidation() {
  return {
    validateTemplate: (template: TemplateRevisionDetail | null) =>
      templateValidation.validateTemplate(template),
    getQuestionSlug: (pillarSlug: string, order: number) =>
      templateValidation.getQuestionSlug(pillarSlug, order),
    CHAR_LIMITS,
  };
}
