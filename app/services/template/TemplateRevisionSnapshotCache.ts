import type { TemplateRevisionDetailResponse } from "~/models";
import { generateOrderKey } from "~/local-db";
import { fetchTemplateAuthoringDetail } from "~/composables/templates/domain/useTemplateCatalog";
import { fetchLocalTemplateDrafts } from "~/composables/local/useLocalTemplateDrafts";
import { localMutation } from "~/services/local-mutation";
import {
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
} from "#shared/db/schema";

export async function cachePublishedTemplateRevisions(
  revisionIds: string[]
): Promise<TemplateRevisionDetailResponse[]> {
  // Local draft revisions never pass through here: they already live in the
  // local database (a draft has no server route to fetch from), and a
  // draft-backed review reads the live draft — that mutability is the point
  // of trying a template before publishing freezes it.
  const localDraftIds = new Set(
    (await fetchLocalTemplateDrafts())
      .map((entry) => entry.draftRevision?.id)
      .filter((id): id is string => Boolean(id))
  );
  const uniqueIds = [...new Set(revisionIds)].filter(
    (id) => !localDraftIds.has(id)
  );
  const details = await Promise.all(
    uniqueIds.map((revisionId) => fetchTemplateAuthoringDetail(revisionId))
  );
  for (const [index, detail] of details.entries()) {
    const revision = detail.revision;
    if (
      !revision ||
      revision.id !== uniqueIds[index] ||
      revision.status !== "published" ||
      detail.template.status !== "active"
    ) {
      throw new Error(
        "Only current published Revisions of active Templates can be selected"
      );
    }
  }

  await persistPublishedTemplateRevisions(details);
  return details;
}

export async function persistPublishedTemplateRevisions(
  details: TemplateRevisionDetailResponse[]
): Promise<void> {
  await localMutation.localOnly({
    stateWrite: async (tx) => {
      for (const { template, revision } of details) {
        if (!revision) continue;
        await tx.insert(templates).values(template).onConflictDoNothing();
        await tx
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
            // Pinned published definition snapshot (maturity-score/AC-009);
            // onConflictDoNothing keeps the first pinned document immutable.
            maturityDefinition: revision.maturityDefinition ?? null,
          })
          .onConflictDoNothing();
        for (const [pillarIndex, pillar] of revision.pillars.entries()) {
          await tx
            .insert(templatePillars)
            .values({
              id: pillar.id,
              templateRevisionId: revision.id,
              slug: pillar.slug,
              name: pillar.name,
              description: pillar.description ?? "",
              orderKey: generateOrderKey(pillarIndex + 1),
              createdAt: revision.createdAt,
              updatedAt: revision.updatedAt,
            })
            .onConflictDoNothing();
          for (const [questionIndex, question] of pillar.questions.entries()) {
            await tx
              .insert(templateQuestions)
              .values({
                id: question.id,
                pillarId: pillar.id,
                orderKey: generateOrderKey(questionIndex + 1),
                type: question.type ?? "yes-no",
                text: question.text,
                riskLevel: question.riskLevel,
                importance: question.importance,
                checklistItems: JSON.stringify(question.checklistItems ?? []),
                leadingPractices: JSON.stringify(question.leadingPractices),
                helpfulLinks: JSON.stringify(question.helpfulLinks),
                createdAt: revision.createdAt,
                updatedAt: revision.updatedAt,
              })
              .onConflictDoNothing();
          }
        }
      }
    },
  });
}
