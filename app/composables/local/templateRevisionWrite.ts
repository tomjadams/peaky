import { eq } from "drizzle-orm";
import {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
} from "#shared/db/schema";
import type { MutationTransaction } from "~/services/local-mutation";
import { assertDraftRevisionMutable } from "~/services/template/TemplateRevisionContracts";

export async function requireMutableRevision(
  tx: MutationTransaction,
  revisionId: string
) {
  const revisionRows = await tx
    .select()
    .from(templateRevisions)
    .where(eq(templateRevisions.id, revisionId))
    .limit(1);
  const revision = revisionRows[0];
  if (!revision) throw new Error("Template draft not found");
  assertDraftRevisionMutable(revision.status);

  const templateRows = await tx
    .select()
    .from(templates)
    .where(eq(templates.id, revision.templateId))
    .limit(1);
  const template = templateRows[0];
  if (!template) throw new Error("Template not found");
  if (template.status === "archived") {
    throw new Error("Archived Template draft is immutable");
  }
  return { revision, template };
}

export async function requireMutableRevisionForPillar(
  tx: MutationTransaction,
  pillarId: string
) {
  const pillarRows = await tx
    .select()
    .from(templatePillars)
    .where(eq(templatePillars.id, pillarId))
    .limit(1);
  const pillar = pillarRows[0];
  if (!pillar) return null;
  const aggregate = await requireMutableRevision(tx, pillar.templateRevisionId);
  return { pillar, ...aggregate };
}

export async function requireMutableRevisionForQuestion(
  tx: MutationTransaction,
  questionId: string
) {
  const questionRows = await tx
    .select()
    .from(templateQuestions)
    .where(eq(templateQuestions.id, questionId))
    .limit(1);
  const question = questionRows[0];
  if (!question) return null;
  const aggregate = await requireMutableRevisionForPillar(
    tx,
    question.pillarId
  );
  return aggregate ? { question, ...aggregate } : null;
}

export async function touchRevisionUpdater(
  tx: MutationTransaction,
  revisionId: string,
  actorId: string,
  now: string
): Promise<void> {
  await tx
    .update(templateRevisions)
    .set({ updatedByActorId: actorId, updatedAt: now })
    .where(eq(templateRevisions.id, revisionId));
}
