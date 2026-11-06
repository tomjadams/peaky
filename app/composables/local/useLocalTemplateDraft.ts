/**
 * Local-first template draft CRUD composable.
 *
 * Provides reactive access to a single Template and its draft Revision.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { computed, ref } from "vue";
import { and, eq, inArray } from "drizzle-orm";
import type { LifecycleActor } from "~/lifecycle/management";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import {
  createUuidV7,
  firstOrNull,
  generateOrderKey,
  withDatabase,
} from "~/local-db";
import {
  directoryGroups,
  templatePillars,
  templateQuestions,
  templateRevisions,
  templates,
  type TemplateRevisionStatus,
} from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import {
  assertTemplateProvenance,
  initializeDraftRevision,
  initializeTemplate,
  updateDraftRevisionMetadata,
  updateTemplateMetadata,
  TemplateWriteUnavailableError,
} from "~/services/template/TemplateRevisionContracts";
import type {
  ActorId,
  TeamId,
  Template,
  TemplatePillar,
  TemplateRevisionDetail,
  TemplateRevisionId,
} from "~/models/template";
import { buildTemplateRevisionDetail } from "./useLocalTemplateDraft-helpers";
import { requireMutableRevision } from "./templateRevisionWrite";

interface LocalLifecycleOptions {
  actor?: LifecycleActor;
  confirmationName?: string;
}

type Database = Parameters<Parameters<typeof withDatabase>[0]>[0];

async function findDraftRevision(db: Database, id: string) {
  const byRevisionId = await db
    .select()
    .from(templateRevisions)
    .where(
      and(eq(templateRevisions.id, id), eq(templateRevisions.status, "draft"))
    )
    .limit(1);
  if (byRevisionId[0]) return byRevisionId[0];

  const byTemplateId = await db
    .select()
    .from(templateRevisions)
    .where(
      and(
        eq(templateRevisions.templateId, id),
        eq(templateRevisions.status, "draft")
      )
    )
    .limit(1);
  return firstOrNull(byTemplateId);
}

async function fetchDraftStructure(db: Database, revisionId: string) {
  const pillars = await db
    .select()
    .from(templatePillars)
    .where(eq(templatePillars.templateRevisionId, revisionId))
    .orderBy(templatePillars.orderKey);
  const questions = pillars.length
    ? await db
        .select()
        .from(templateQuestions)
        .where(
          inArray(
            templateQuestions.pillarId,
            pillars.map(({ id }) => id)
          )
        )
    : [];
  return { pillars, questions };
}

export async function fetchLocalTemplateRevisionRecordById(
  revisionId: string
): Promise<{
  aggregate: Template;
  ownerTeamId: TeamId;
  template: TemplateRevisionDetail;
} | null> {
  if (!revisionId) return null;

  return withDatabase(async (db) => {
    const revisionRows = await db
      .select()
      .from(templateRevisions)
      .where(eq(templateRevisions.id, revisionId))
      .limit(1);
    const revision = firstOrNull(revisionRows);
    if (!revision) return null;
    const templateRows = await db
      .select()
      .from(templates)
      .where(eq(templates.id, revision.templateId))
      .limit(1);
    const template = firstOrNull(templateRows);
    if (!template) return null;
    const { pillars, questions } = await fetchDraftStructure(db, revision.id);
    return {
      aggregate: { ...template } as Template,
      ownerTeamId: template.ownerTeamId as TeamId,
      template: buildTemplateRevisionDetail(
        template,
        revision,
        pillars,
        questions
      ),
    };
  });
}

export async function fetchLocalTemplateRevisionById(
  revisionId: string
): Promise<TemplateRevisionDetail | null> {
  const record = await fetchLocalTemplateRevisionRecordById(revisionId);
  return record?.template ?? null;
}

export async function fetchLocalTemplateDraftById(
  draftOrTemplateId: string
): Promise<TemplateRevisionDetail | null> {
  const record = await fetchLocalTemplateDraftRecordById(draftOrTemplateId);
  return record?.template ?? null;
}

export async function fetchLocalTemplateDraftRecordById(
  draftOrTemplateId: string
): Promise<{
  aggregate: Template;
  draftId: string;
  ownerTeamId: TeamId;
  template: TemplateRevisionDetail;
} | null> {
  if (!draftOrTemplateId) return null;

  return withDatabase(async (db) => {
    const revision = await findDraftRevision(db, draftOrTemplateId);
    if (!revision) return null;
    const templateRows = await db
      .select()
      .from(templates)
      .where(eq(templates.id, revision.templateId))
      .limit(1);
    const template = firstOrNull(templateRows);
    if (!template) return null;
    const { pillars, questions } = await fetchDraftStructure(db, revision.id);
    return {
      aggregate: { ...template } as Template,
      draftId: revision.id,
      ownerTeamId: template.ownerTeamId as TeamId,
      template: buildTemplateRevisionDetail(
        template,
        revision,
        pillars,
        questions
      ),
    };
  });
}

export function useLocalTemplateDraft(draftId: string) {
  const draft = ref<typeof templateRevisions.$inferSelect | null>(null);
  const templateAggregate = ref<typeof templates.$inferSelect | null>(null);
  const pillarsData = ref<(typeof templatePillars.$inferSelect)[]>([]);
  const questionsData = ref<(typeof templateQuestions.$inferSelect)[]>([]);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!draftId) {
      draft.value = null;
      templateAggregate.value = null;
      pillarsData.value = [];
      questionsData.value = [];
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      await withDatabase(async (db) => {
        draft.value = await findDraftRevision(db, draftId);
        if (!draft.value) return;
        const templateRows = await db
          .select()
          .from(templates)
          .where(eq(templates.id, draft.value.templateId))
          .limit(1);
        templateAggregate.value = firstOrNull(templateRows);
        const { pillars, questions } = await fetchDraftStructure(
          db,
          draft.value.id
        );
        pillarsData.value = pillars;
        questionsData.value = questions;
      });
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause));
    } finally {
      isLoading.value = false;
    }
  }

  refresh();

  const template = computed<TemplateRevisionDetail | null>(() => {
    if (!templateAggregate.value || !draft.value) return null;
    return buildTemplateRevisionDetail(
      templateAggregate.value,
      draft.value,
      pillarsData.value,
      questionsData.value
    );
  });

  return { template, draft, error, isLoading, refresh };
}

export interface CreateLocalTemplateDraftInput {
  name: string;
  description?: string;
  ownerTeamId: TeamId;
  actorId: ActorId;
  maturityDefinition?: string | null;
  pillars?: TemplatePillar[];
}

export async function createLocalTemplateDraft(
  input: CreateLocalTemplateDraftInput
): Promise<TemplateRevisionId> {
  if (!input.name) throw new Error("name is required");
  assertTemplateProvenance({
    ownerTeamId: input.ownerTeamId,
    createdByActorId: input.actorId,
    updatedByActorId: input.actorId,
  });
  const templateId = createUuidV7();
  const revisionId = createUuidV7();

  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const [ownerTeam] = await tx
        .select({ id: directoryGroups.id })
        .from(directoryGroups)
        .where(eq(directoryGroups.id, input.ownerTeamId))
        .limit(1);
      if (ownerTeam?.id !== input.ownerTeamId) {
        throw new Error(
          "Owner Team is absent from the persisted directory snapshot"
        );
      }

      const template = initializeTemplate({
        id: templateId,
        name: input.name,
        description: input.description ?? "",
        ownerTeamId: input.ownerTeamId,
        actorId: input.actorId,
        now,
      });
      const revision = Object.assign(
        initializeDraftRevision({
          id: revisionId,
          templateId,
          name: input.name,
          description: input.description ?? "",
          actorId: input.actorId,
          now,
        }),
        input.maturityDefinition === undefined
          ? {}
          : { maturityDefinition: input.maturityDefinition }
      );
      await tx.insert(templates).values(template);
      await tx.insert(templateRevisions).values(revision);
      for (const [pillarIndex, pillar] of (input.pillars ?? []).entries()) {
        await tx.insert(templatePillars).values({
          id: pillar.id,
          templateRevisionId: revisionId,
          slug: pillar.slug,
          name: pillar.name,
          description: pillar.description ?? "",
          orderKey: generateOrderKey(pillarIndex + 1),
          createdAt: now,
          updatedAt: now,
        });
        for (const [questionIndex, question] of pillar.questions.entries()) {
          await tx.insert(templateQuestions).values({
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
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    },
  });

  return revisionId;
}

export async function updateLocalTemplateDraft(
  draftId: string,
  updates: Partial<{
    name: string;
    description: string;
    status: TemplateRevisionStatus;
  }>,
  options: LocalLifecycleOptions = {}
): Promise<void> {
  if (!draftId) throw new Error("draftId is required");
  if (
    ["status", "revisionNumber", "publishedAt", "publishedByActorId"].some(
      (field) => Object.hasOwn(updates, field)
    )
  ) {
    throw new TemplateWriteUnavailableError();
  }

  if (updates.name === undefined && updates.description === undefined) return;
  const actorId = (options.actor ?? readPersistedActor()).id;

  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const existing = await requireMutableRevision(tx, draftId);
      const nextTemplate = updateTemplateMetadata(
        existing.template,
        updates,
        actorId,
        now
      );
      const nextRevision = updateDraftRevisionMetadata(
        existing.revision,
        updates,
        actorId,
        now
      );
      await tx
        .update(templates)
        .set({
          name: nextTemplate.name,
          description: nextTemplate.description,
          updatedByActorId: nextTemplate.updatedByActorId,
          updatedAt: nextTemplate.updatedAt,
        })
        .where(eq(templates.id, nextTemplate.id));
      await tx
        .update(templateRevisions)
        .set({
          name: nextRevision.name,
          description: nextRevision.description,
          updatedByActorId: nextRevision.updatedByActorId,
          updatedAt: nextRevision.updatedAt,
        })
        .where(eq(templateRevisions.id, nextRevision.id));
    },
  });
}

export async function deleteLocalTemplateDraft(
  draftId: string,
  _options: LocalLifecycleOptions = {}
): Promise<void> {
  if (!draftId) throw new Error("draftId is required");
  throw new TemplateWriteUnavailableError();
}
