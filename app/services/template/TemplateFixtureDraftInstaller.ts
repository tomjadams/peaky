import type { MutationTransaction } from "~/services/local-mutation";
import { safeParse } from "~/local-db";
import type { Entitlement } from "~/services/entitlement/EntitlementService";
import {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
} from "#shared/db/schema";
import {
  templateFixtureDrafts,
  templates as fixtureCatalog,
} from "../../../server/data/templates";

function orderKey(position: number): string {
  return String(position).padStart(4, "0");
}

export async function writeTemplateFixtureDrafts(
  tx: MutationTransaction
): Promise<void> {
  for (const draft of templateFixtureDrafts) {
    const catalogEntry = fixtureCatalog.find(
      (entry) => entry.template.id === draft.templateId
    );
    if (!catalogEntry) {
      throw new Error(`Missing fixture Template ${draft.templateId}`);
    }
    await tx
      .insert(templates)
      .values(catalogEntry.template)
      .onConflictDoNothing();
    await tx
      .insert(templateRevisions)
      .values({
        id: draft.id,
        templateId: draft.templateId,
        name: draft.name,
        description: draft.description,
        status: draft.status,
        revisionNumber: draft.revisionNumber,
        revisionSummary: draft.revisionSummary,
        createdByActorId: draft.createdByActorId,
        updatedByActorId: draft.updatedByActorId,
        publishedByActorId: draft.publishedByActorId,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        publishedAt: draft.publishedAt,
        maturityDefinition: draft.maturityDefinition ?? null,
      })
      .onConflictDoNothing();
    for (const pillar of draft.pillars) {
      await tx
        .insert(templatePillars)
        .values({
          id: pillar.id,
          templateRevisionId: draft.id,
          slug: pillar.slug,
          name: pillar.name,
          description: pillar.description ?? "",
          orderKey: orderKey(pillar.order),
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        })
        .onConflictDoNothing();
      for (const question of pillar.questions) {
        await tx
          .insert(templateQuestions)
          .values({
            id: question.id,
            pillarId: pillar.id,
            orderKey: orderKey(question.order),
            text: question.text,
            type: question.type ?? "yes-no",
            riskLevel: question.riskLevel,
            importance: question.importance,
            checklistItems: JSON.stringify(question.checklistItems ?? []),
            leadingPractices: JSON.stringify(question.leadingPractices),
            helpfulLinks: JSON.stringify(question.helpfulLinks),
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt,
          })
          .onConflictDoNothing();
      }
    }
  }
}

export async function installTemplateFixtureDrafts(): Promise<void> {
  const { localMutation } = await import("~/services/local-mutation");
  await localMutation.localOnly({ stateWrite: writeTemplateFixtureDrafts });
}

export async function grantTemplateFixtureDraftAccess(
  actorId: string
): Promise<void> {
  const { EntitlementService } =
    await import("~/services/entitlement/EntitlementService");
  const service = new EntitlementService();
  const snapshot = await service.getSnapshot(actorId);
  const entitlements = snapshot
    ? safeParse<Record<string, Entitlement>>(snapshot.entitlements, {})
    : {};

  for (const draft of templateFixtureDrafts) {
    entitlements[`template:${draft.templateId}`] = {
      canEdit: true,
      canView: true,
    };
  }

  await service.saveSnapshot(actorId, entitlements);
}
