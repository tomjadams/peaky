/**
 * Pure projection functions for review view models.
 *
 * Builds Pillar[], ReviewTemplate, and Question[] from template + answer state.
 * Pure functions with no I/O, no DB access, no Vue — safe to call from
 * any context including server-side rendering, workers, and unit tests.
 */

import type { Question, ReviewTemplate, QuestionAnswer } from "~/models";
import type { Pillar } from "~/models/pillar";
import type { TemplateRevisionDetail } from "~/models/template";
import { safeParse } from "~/local-db";
import { isQuestionComplete } from "~/services/review/questionCompletion";

/**
 * Parses an answer value that may be stored in two formats:
 * - New format: JSON-encoded string e.g. `'"yes"'` → `"yes"`
 * - Old format: plain string e.g. `"yes"` (stored before the JSON.stringify fix)
 *
 * Using safeParse alone returns null for old-format rows because
 * `JSON.parse("yes")` throws. This function falls back to the raw string
 * for the three simple answer values so existing rows remain readable
 * without requiring a DB migration or data backfill.
 */
export function safeParseAnswer(
  raw: string | null | undefined
): QuestionAnswer | null {
  if (raw == null) return null;
  const parsed = safeParse<QuestionAnswer | null>(raw, null);
  if (parsed !== null) return parsed;
  // Backward-compat: plain "yes"/"no"/"na" stored without JSON encoding
  if (raw === "yes" || raw === "no" || raw === "na")
    return raw as QuestionAnswer;
  return null;
}

export interface AnswerStateLike {
  questionId: string;
  answer: string | null;
  naReason?: string | null;
  itemNaReasons?: string | null;
}

export class ReviewProjection {
  /**
   * Compute per-pillar progress from a template definition and answer rows.
   *
   * @param template - The template definition containing pillar and question structure.
   * @param answers  - Flat list of answer rows; a question counts as answered
   *   only when {@link isQuestionComplete} deems it complete — a checklist
   *   question with some but not all items resolved does not count. Rows for
   *   question IDs outside the pillar are ignored.
   * @returns `Pillar[]` with `progress` (0–100), `totalQuestions`, and
   *   `answeredQuestions` computed for each pillar. Progress is 0 when a pillar
   *   has no questions.
   */
  buildPillars(
    template: TemplateRevisionDetail,
    answers: AnswerStateLike[]
  ): Pillar[] {
    const answerByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer] as const)
    );
    return template.pillars.map((pillar) => {
      const answeredQuestions = pillar.questions.filter((question) => {
        const row = answerByQuestionId.get(question.id);
        if (!row) return false;
        return isQuestionComplete(question, safeParseAnswer(row.answer));
      }).length;
      const totalQuestions = pillar.questions.length;

      return {
        templateRevisionId: template.id,
        key: `${template.id}::${pillar.slug}`,
        slug: pillar.slug,
        name: pillar.name,
        progress:
          totalQuestions > 0
            ? Math.round((answeredQuestions / totalQuestions) * 100)
            : 0,
        totalQuestions,
        answeredQuestions,
      };
    });
  }

  buildTemplateProjection(
    template: TemplateRevisionDetail,
    answers: AnswerStateLike[]
  ): ReviewTemplate {
    const pillars = this.buildPillars(template, answers);
    const totalQuestions = pillars.reduce(
      (sum, pillar) => sum + pillar.totalQuestions,
      0
    );
    const answeredQuestions = pillars.reduce(
      (sum, pillar) => sum + pillar.answeredQuestions,
      0
    );

    return {
      templateId: template.templateId,
      templateRevisionId: template.id,
      templateName: template.name,
      revisionNumber: template.revisionNumber,
      revisionSummary: template.revisionSummary,
      progress:
        totalQuestions > 0
          ? Math.round((answeredQuestions / totalQuestions) * 100)
          : 0,
      pillars,
    };
  }

  /**
   * Project template questions onto a flat `Question[]`, overlaying local answers.
   *
   * The answer overlay step: for each template question, looks up a matching
   * row by `questionId` and replaces `answer`, `naReason`, and `itemNAReasons`
   * with the local values (JSON-parsed). If no local row exists, those fields
   * are `null` / `undefined` (the template defaults).
   *
   * @param template    - Template definition providing question metadata (text,
   *   type, importance, checklistItems, leadingPractices, helpfulLinks).
   * @param answers     - Local answer rows to overlay onto the template shape.
   * @param pillarSlug  - If provided, only questions from that pillar are returned.
   */
  buildQuestionsProjection(
    template: TemplateRevisionDetail,
    answers: AnswerStateLike[],
    pillarSlug?: string
  ): Question[] {
    const answerByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer] as const)
    );
    const pillars = pillarSlug
      ? template.pillars.filter((pillar) => pillar.slug === pillarSlug)
      : template.pillars;

    return pillars.flatMap((pillar) =>
      pillar.questions.map((question) => {
        const localAnswer = answerByQuestionId.get(question.id);

        return {
          id: question.id,
          templateRevisionId: template.id,
          pillar: pillar.slug,
          pillarKey: `${template.id}::${pillar.slug}`,
          text: question.text,
          type: question.type ?? "yes-no",
          riskLevel: question.riskLevel,
          checklistItems: question.checklistItems,
          answer: localAnswer ? safeParseAnswer(localAnswer.answer) : undefined,
          naReason: safeParse(localAnswer?.naReason, undefined),
          itemNAReasons: safeParse(localAnswer?.itemNaReasons, undefined),
          importance: question.importance,
          leadingPractices: question.leadingPractices.map(
            (practice) => practice.text
          ),
          helpfulLinks: question.helpfulLinks,
        } satisfies Question;
      })
    );
  }
}

export const reviewProjection = new ReviewProjection();
