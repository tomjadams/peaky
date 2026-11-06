/**
 * Pure parsing and building helpers for useLocalTemplateDraft.
 *
 * Extracted to keep useLocalTemplateDraft.ts under the max-lines threshold.
 * None of these functions use reactive state — they are pure data transformers.
 */

import { safeParse } from "~/local-db";
import type {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
  RiskLevel,
} from "#shared/db/schema";
import type {
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
} from "~/models/template";
import type { HelpfulLink, ChecklistItem } from "~/models/question";

export function parseQuestion(
  row: typeof templateQuestions.$inferSelect
): TemplateQuestion {
  return {
    id: row.id,
    order: Number.parseInt(row.orderKey, 10) || 0,
    type: row.type,
    text: row.text,
    riskLevel: row.riskLevel as RiskLevel,
    importance: row.importance ?? "",
    checklistItems: safeParse<ChecklistItem[]>(row.checklistItems, []),
    leadingPractices: safeParse<
      Array<{ id: string; order: number; text: string }>
    >(row.leadingPractices, []),
    helpfulLinks: safeParse<HelpfulLink[]>(row.helpfulLinks, []),
  };
}

export function parsePillar(
  row: typeof templatePillars.$inferSelect,
  questions: (typeof templateQuestions.$inferSelect)[]
): TemplatePillar {
  return {
    id: row.id,
    templateRevisionId: row.templateRevisionId,
    slug: row.slug,
    name: row.name,
    description: row.description || undefined,
    order: Number.parseInt(row.orderKey, 10) || 0,
    questions: questions
      .filter((question) => question.pillarId === row.id)
      .toSorted((a, b) => a.orderKey.localeCompare(b.orderKey))
      .map(parseQuestion),
  };
}

export function buildTemplateRevisionDetail(
  template: typeof templates.$inferSelect,
  revision: typeof templateRevisions.$inferSelect,
  pillarsData: (typeof templatePillars.$inferSelect)[],
  questionsData: (typeof templateQuestions.$inferSelect)[]
): TemplateRevisionDetail {
  return {
    id: revision.id,
    templateId: template.id,
    name: revision.name,
    description: revision.description,
    status: revision.status,
    revisionNumber: revision.revisionNumber,
    revisionSummary: revision.revisionSummary,
    createdByActorId: revision.createdByActorId,
    updatedByActorId: revision.updatedByActorId,
    publishedByActorId: revision.publishedByActorId,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
    publishedAt: revision.publishedAt,
    maturityDefinition: revision.maturityDefinition ?? null,
    pillars: pillarsData.map((pillar) => parsePillar(pillar, questionsData)),
  };
}
