import { eq } from "drizzle-orm";
import {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
} from "~/local-db";
import type {
  ReviewWorkspaceMaterializerTransaction,
  ValidatedSnapshot,
} from "./ReviewWorkspaceMaterializer";

function sameIds(
  actual: readonly { readonly id: string }[],
  expected: ReadonlySet<string>
): boolean {
  return (
    actual.length === expected.size &&
    actual.every((row) => expected.has(row.id))
  );
}

async function persistRevision(
  transaction: ReviewWorkspaceMaterializerTransaction,
  snapshot: ValidatedSnapshot
): Promise<void> {
  const { template, revision } = snapshot;
  await transaction.insert(templates).values(template).onConflictDoNothing();
  const persistedTemplates = await transaction
    .select({ id: templates.id, ownerTeamId: templates.ownerTeamId })
    .from(templates)
    .where(eq(templates.id, template.id))
    .limit(1);
  if (persistedTemplates[0]?.ownerTeamId !== template.ownerTeamId) {
    throw new Error(`Template ${template.id} conflicts with local data.`);
  }

  await transaction
    .insert(templateRevisions)
    .values({
      id: revision.id,
      templateId: revision.templateId,
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
    })
    .onConflictDoNothing();

  const persistedRevisions = await transaction
    .select({
      id: templateRevisions.id,
      templateId: templateRevisions.templateId,
      name: templateRevisions.name,
      status: templateRevisions.status,
      revisionNumber: templateRevisions.revisionNumber,
      maturityDefinition: templateRevisions.maturityDefinition,
    })
    .from(templateRevisions)
    .where(eq(templateRevisions.id, revision.id))
    .limit(1);
  const persistedRevision = persistedRevisions[0];
  if (
    !persistedRevision ||
    persistedRevision.templateId !== revision.templateId ||
    persistedRevision.name !== revision.name ||
    persistedRevision.status === "draft" ||
    persistedRevision.revisionNumber !== revision.revisionNumber
  ) {
    throw new Error(
      `Template revision ${revision.id} conflicts with local data.`
    );
  }

  const expectedDefinition = revision.maturityDefinition ?? null;
  if (persistedRevision.maturityDefinition === expectedDefinition) return;
  if (
    persistedRevision.maturityDefinition !== null ||
    expectedDefinition === null
  ) {
    throw new Error(
      `Template revision ${revision.id} has a conflicting maturity definition.`
    );
  }
  await transaction
    .update(templateRevisions)
    .set({ maturityDefinition: expectedDefinition })
    .where(eq(templateRevisions.id, revision.id));
}

async function persistQuestion(
  transaction: ReviewWorkspaceMaterializerTransaction,
  snapshot: ValidatedSnapshot,
  pillarId: string,
  question: ValidatedSnapshot["revision"]["pillars"][number]["questions"][number]
): Promise<void> {
  const { revision } = snapshot;
  const questionOrder = String(question.order).padStart(4, "0");
  await transaction
    .insert(templateQuestions)
    .values({
      id: question.id,
      pillarId,
      orderKey: questionOrder,
      text: question.text,
      type: question.type ?? "yes-no",
      riskLevel: question.riskLevel,
      importance: question.importance,
      checklistItems: JSON.stringify(question.checklistItems ?? []),
      leadingPractices: JSON.stringify(question.leadingPractices ?? []),
      helpfulLinks: JSON.stringify(question.helpfulLinks ?? []),
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    })
    .onConflictDoNothing();

  const persistedQuestionRows = await transaction
    .select({
      id: templateQuestions.id,
      pillarId: templateQuestions.pillarId,
      orderKey: templateQuestions.orderKey,
      type: templateQuestions.type,
    })
    .from(templateQuestions)
    .where(eq(templateQuestions.id, question.id))
    .limit(1);
  const persistedQuestion = persistedQuestionRows[0];
  if (
    !persistedQuestion ||
    persistedQuestion.pillarId !== pillarId ||
    persistedQuestion.orderKey !== questionOrder ||
    persistedQuestion.type !== (question.type ?? "yes-no")
  ) {
    throw new Error(`Question ${question.id} conflicts with local data.`);
  }
}

async function persistPillar(
  transaction: ReviewWorkspaceMaterializerTransaction,
  snapshot: ValidatedSnapshot,
  pillar: ValidatedSnapshot["revision"]["pillars"][number]
): Promise<void> {
  const { revision } = snapshot;
  const pillarOrder = String(pillar.order).padStart(4, "0");
  await transaction
    .insert(templatePillars)
    .values({
      id: pillar.id,
      templateRevisionId: revision.id,
      slug: pillar.slug,
      name: pillar.name,
      description: pillar.description ?? null,
      orderKey: pillarOrder,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
    })
    .onConflictDoNothing();

  const persistedPillarRows = await transaction
    .select({
      id: templatePillars.id,
      templateRevisionId: templatePillars.templateRevisionId,
      slug: templatePillars.slug,
      orderKey: templatePillars.orderKey,
    })
    .from(templatePillars)
    .where(eq(templatePillars.id, pillar.id))
    .limit(1);
  const persistedPillar = persistedPillarRows[0];
  if (
    !persistedPillar ||
    persistedPillar.templateRevisionId !== revision.id ||
    persistedPillar.slug !== pillar.slug ||
    persistedPillar.orderKey !== pillarOrder
  ) {
    throw new Error(`Pillar ${pillar.id} conflicts with local data.`);
  }

  for (const question of pillar.questions) {
    await persistQuestion(transaction, snapshot, pillar.id, question);
  }
  const persistedQuestions = await transaction
    .select({ id: templateQuestions.id })
    .from(templateQuestions)
    .where(eq(templateQuestions.pillarId, pillar.id));
  if (
    !sameIds(
      persistedQuestions,
      new Set(pillar.questions.map((question) => question.id))
    )
  ) {
    throw new Error(`Pillar ${pillar.id} has an incomplete question set.`);
  }
}

async function persistSnapshot(
  transaction: ReviewWorkspaceMaterializerTransaction,
  snapshot: ValidatedSnapshot
): Promise<void> {
  await persistRevision(transaction, snapshot);
  for (const pillar of snapshot.revision.pillars) {
    await persistPillar(transaction, snapshot, pillar);
  }
  const persistedPillars = await transaction
    .select({ id: templatePillars.id })
    .from(templatePillars)
    .where(eq(templatePillars.templateRevisionId, snapshot.revision.id));
  if (
    !sameIds(
      persistedPillars,
      new Set(snapshot.revision.pillars.map((pillar) => pillar.id))
    )
  ) {
    throw new Error(
      `Template revision ${snapshot.revision.id} has an incomplete pillar set.`
    );
  }
}

export async function persistRevisionSnapshots(
  transaction: ReviewWorkspaceMaterializerTransaction,
  snapshots: readonly ValidatedSnapshot[]
): Promise<void> {
  for (const snapshot of snapshots) {
    await persistSnapshot(transaction, snapshot);
  }
}
