import { eq, inArray } from "drizzle-orm";
import type {
  TemplatePillar,
  TemplateQuestion,
  TemplateRevisionDetail,
} from "~/models";
import { generateOrderKey } from "~/local-db";
import {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
} from "#shared/db/schema";
import {
  localMutation,
  type MutationTransaction,
} from "~/services/local-mutation";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import { requireMutableRevision } from "~/composables/local/templateRevisionWrite";
import { TemplateWriteUnavailableError } from "~/services/template/TemplateRevisionContracts";
import {
  templatePersistence,
  type MarkdownImportConflict,
} from "~/services/template/TemplatePersistence";

export type { MarkdownImportConflict };

type PillarRow = typeof templatePillars.$inferSelect;
type QuestionRow = typeof templateQuestions.$inferSelect;

function buildQuestionValues(
  pillarId: string,
  question: TemplateQuestion,
  index: number
) {
  return {
    pillarId,
    orderKey: generateOrderKey(index + 1),
    type: question.type ?? "yes-no",
    text: question.text,
    riskLevel: question.riskLevel,
    importance: question.importance,
    checklistItems: JSON.stringify(question.checklistItems ?? []),
    leadingPractices: JSON.stringify(question.leadingPractices),
    helpfulLinks: JSON.stringify(question.helpfulLinks),
  };
}

function hasPillarChanged(
  existing: PillarRow,
  pillar: TemplatePillar,
  orderKey: string,
  description: string
): boolean {
  return (
    existing.slug !== pillar.slug ||
    existing.name !== pillar.name ||
    (existing.description ?? "") !== description ||
    existing.orderKey !== orderKey
  );
}

function hasQuestionChanged(
  existing: QuestionRow,
  values: ReturnType<typeof buildQuestionValues>
): boolean {
  return (
    existing.pillarId !== values.pillarId ||
    existing.orderKey !== values.orderKey ||
    existing.type !== values.type ||
    existing.text !== values.text ||
    existing.riskLevel !== values.riskLevel ||
    existing.importance !== values.importance ||
    (existing.checklistItems ?? "[]") !== values.checklistItems ||
    (existing.leadingPractices ?? "[]") !== values.leadingPractices ||
    (existing.helpfulLinks ?? "[]") !== values.helpfulLinks
  );
}

interface UpsertQuestionInput {
  tx: MutationTransaction;
  pillarId: string;
  question: TemplateQuestion;
  index: number;
  existing: QuestionRow | undefined;
  now: string;
}

async function upsertQuestion({
  tx,
  pillarId,
  question,
  index,
  existing,
  now,
}: UpsertQuestionInput): Promise<void> {
  const values = buildQuestionValues(pillarId, question, index);
  if (!existing) {
    await tx.insert(templateQuestions).values({
      id: question.id,
      ...values,
      createdAt: now,
      updatedAt: now,
    });
  } else if (hasQuestionChanged(existing, values)) {
    await tx
      .update(templateQuestions)
      .set({ ...values, updatedAt: now })
      .where(eq(templateQuestions.id, question.id));
  }
}

interface UpsertPillarInput {
  tx: MutationTransaction;
  draftId: string;
  pillar: TemplatePillar;
  index: number;
  existing: PillarRow | undefined;
  questionsById: ReadonlyMap<string, QuestionRow>;
  now: string;
}

async function upsertPillar({
  tx,
  draftId,
  pillar,
  index,
  existing,
  questionsById,
  now,
}: UpsertPillarInput): Promise<void> {
  const orderKey = generateOrderKey(index + 1);
  const description = pillar.description ?? "";
  if (!existing) {
    await tx.insert(templatePillars).values({
      id: pillar.id,
      templateRevisionId: draftId,
      slug: pillar.slug,
      name: pillar.name,
      description,
      orderKey,
      createdAt: now,
      updatedAt: now,
    });
  } else if (hasPillarChanged(existing, pillar, orderKey, description)) {
    await tx
      .update(templatePillars)
      .set({
        slug: pillar.slug,
        name: pillar.name,
        description,
        orderKey,
        updatedAt: now,
      })
      .where(eq(templatePillars.id, pillar.id));
  }

  for (const [questionIndex, question] of pillar.questions.entries()) {
    await upsertQuestion({
      tx,
      pillarId: pillar.id,
      question,
      index: questionIndex,
      existing: questionsById.get(question.id),
      now,
    });
  }
}

async function deleteRemovedStructure(
  tx: MutationTransaction,
  existingPillars: PillarRow[],
  existingQuestions: QuestionRow[],
  nextPillars: TemplatePillar[]
): Promise<void> {
  const nextPillarIds = new Set(nextPillars.map(({ id }) => id));
  const nextQuestionIds = new Set(
    nextPillars.flatMap((pillar) => pillar.questions.map(({ id }) => id))
  );
  for (const question of existingQuestions) {
    if (!nextQuestionIds.has(question.id)) {
      await tx
        .delete(templateQuestions)
        .where(eq(templateQuestions.id, question.id));
    }
  }
  for (const pillar of existingPillars) {
    if (!nextPillarIds.has(pillar.id)) {
      await tx.delete(templatePillars).where(eq(templatePillars.id, pillar.id));
    }
  }
}

async function reconcileDraftStructure(
  tx: MutationTransaction,
  draftId: string,
  pillars: TemplatePillar[],
  now: string
): Promise<void> {
  const existingPillars = await tx
    .select()
    .from(templatePillars)
    .where(eq(templatePillars.templateRevisionId, draftId));
  const existingQuestions = existingPillars.length
    ? await tx
        .select()
        .from(templateQuestions)
        .where(
          inArray(
            templateQuestions.pillarId,
            existingPillars.map(({ id }) => id)
          )
        )
    : [];

  const pillarsById = new Map(
    existingPillars.map((pillar) => [pillar.id, pillar])
  );
  const questionsById = new Map(
    existingQuestions.map((question) => [question.id, question])
  );
  for (const [pillarIndex, pillar] of pillars.entries()) {
    await upsertPillar({
      tx,
      draftId,
      pillar,
      index: pillarIndex,
      existing: pillarsById.get(pillar.id),
      questionsById,
      now,
    });
  }

  await deleteRemovedStructure(tx, existingPillars, existingQuestions, pillars);
}

export async function saveLocalTemplateDraft(
  template: TemplateRevisionDetail,
  draftId: string | null
): Promise<string> {
  if (!draftId) throw new TemplateWriteUnavailableError();
  const actorId = readPersistedActor().id;

  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevision(tx, draftId);
      if (
        aggregate.template.name !== template.name ||
        aggregate.template.description !== template.description
      ) {
        await tx
          .update(templates)
          .set({
            name: template.name,
            description: template.description,
            updatedByActorId: actorId,
            updatedAt: now,
          })
          .where(eq(templates.id, aggregate.template.id));
      }
      // The serialized maturity definition rides the same atomic local write
      // as template content (maturity-score/AC-063). undefined leaves the
      // column untouched so maturity-agnostic flows never clobber it; null is
      // the explicit no-definition state (AC-060).
      const revisionValues: Record<string, unknown> = {
        name: template.name,
        description: template.description,
        updatedByActorId: actorId,
        updatedAt: now,
      };
      if (template.maturityDefinition !== undefined) {
        revisionValues.maturityDefinition = template.maturityDefinition;
      }
      await tx
        .update(templateRevisions)
        .set(revisionValues)
        .where(eq(templateRevisions.id, draftId));

      await reconcileDraftStructure(tx, draftId, template.pillars, now);
    },
  });

  return draftId;
}

type TemplateDraftMetadata = Pick<
  TemplateRevisionDetail,
  "name" | "description"
>;

export async function saveTemplateDraftMetadata(
  metadata: TemplateDraftMetadata,
  draftId: string | null
): Promise<string> {
  return templatePersistence.saveDraftMetadata(metadata, draftId);
}

export async function importTemplateMarkdown(
  draftId: string,
  template: Partial<TemplateRevisionDetail>
): Promise<MarkdownImportConflict[]> {
  return templatePersistence.importFromMarkdown(draftId, template);
}

export async function resolveTemplateImportConflict(
  draftId: string,
  conflict: MarkdownImportConflict,
  resolution: "keep_local" | "keep_imported" | "merged"
): Promise<void> {
  return templatePersistence.resolveImportConflict(
    draftId,
    conflict,
    resolution
  );
}
