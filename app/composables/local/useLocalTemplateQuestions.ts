/**
 * Local-first Template draft Question operations.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { and, desc, eq } from "drizzle-orm";
import { createUuidV7, generateOrderKey } from "~/local-db";
import { templateQuestions, type RiskLevel } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getDefaultLifecycleActor } from "~/lifecycle/management";
import type { HelpfulLink, ChecklistItem } from "~/models/question";
import {
  requireMutableRevision,
  requireMutableRevisionForPillar,
  requireMutableRevisionForQuestion,
  touchRevisionUpdater,
} from "./templateRevisionWrite";

export async function addLocalQuestion(
  draftId: string,
  pillarId: string,
  input: {
    text: string;
    type?: "yes-no" | "checklist";
    riskLevel?: RiskLevel;
    importance?: string;
  }
): Promise<string> {
  if (!draftId) throw new Error("draftId is required");
  if (!pillarId) throw new Error("pillarId is required");
  if (!input.text) throw new Error("text is required");

  const id = createUuidV7();
  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      await requireMutableRevision(tx, draftId);
      const aggregate = await requireMutableRevisionForPillar(tx, pillarId);
      if (!aggregate || aggregate.revision.id !== draftId) {
        throw new Error("Pillar does not belong to the draft Revision");
      }
      const existingQuestions = await tx
        .select({ orderKey: templateQuestions.orderKey })
        .from(templateQuestions)
        .where(eq(templateQuestions.pillarId, pillarId))
        .orderBy(desc(templateQuestions.orderKey))
        .limit(1);
      const maxOrder = existingQuestions[0]
        ? Number.parseInt(existingQuestions[0].orderKey, 10)
        : 0;
      await tx.insert(templateQuestions).values({
        id,
        pillarId,
        orderKey: generateOrderKey((Number.isNaN(maxOrder) ? 0 : maxOrder) + 1),
        type: input.type ?? "yes-no",
        text: input.text,
        riskLevel: input.riskLevel ?? "medium",
        importance: input.importance ?? "",
        checklistItems: "[]",
        leadingPractices: "[]",
        helpfulLinks: "[]",
        createdAt: now,
        updatedAt: now,
      });
      await touchRevisionUpdater(tx, draftId, actorId, now);
    },
  });
  return id;
}

export async function updateLocalQuestion(
  questionId: string,
  updates: Partial<{
    text: string;
    type: "yes-no" | "checklist";
    riskLevel: RiskLevel;
    importance: string;
    checklistItems: ChecklistItem[];
    leadingPractices: Array<{ id: string; order: number; text: string }>;
    helpfulLinks: HelpfulLink[];
  }>
): Promise<void> {
  if (!questionId) throw new Error("questionId is required");
  if (Object.values(updates).every((value) => value === undefined)) return;

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevisionForQuestion(tx, questionId);
      if (!aggregate) return;
      const updateData: Partial<typeof templateQuestions.$inferInsert> = {
        updatedAt: now,
      };
      if (updates.text !== undefined) updateData.text = updates.text;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.riskLevel !== undefined) {
        updateData.riskLevel = updates.riskLevel;
      }
      if (updates.importance !== undefined) {
        updateData.importance = updates.importance;
      }
      if (updates.checklistItems !== undefined) {
        updateData.checklistItems = JSON.stringify(updates.checklistItems);
      }
      if (updates.leadingPractices !== undefined) {
        updateData.leadingPractices = JSON.stringify(updates.leadingPractices);
      }
      if (updates.helpfulLinks !== undefined) {
        updateData.helpfulLinks = JSON.stringify(updates.helpfulLinks);
      }
      await tx
        .update(templateQuestions)
        .set(updateData)
        .where(eq(templateQuestions.id, questionId));
      await touchRevisionUpdater(tx, aggregate.revision.id, actorId, now);
    },
  });
}

export async function deleteLocalQuestion(questionId: string): Promise<void> {
  if (!questionId) throw new Error("questionId is required");

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevisionForQuestion(tx, questionId);
      if (!aggregate) return;
      await tx
        .delete(templateQuestions)
        .where(eq(templateQuestions.id, questionId));
      await touchRevisionUpdater(tx, aggregate.revision.id, actorId, now);
    },
  });
}

export async function reorderLocalQuestions(
  draftId: string,
  pillarId: string,
  questionIds: string[]
): Promise<void> {
  if (!draftId) throw new Error("draftId is required");
  if (!pillarId) throw new Error("pillarId is required");
  if (!questionIds.length) throw new Error("questionIds is required");
  if (questionIds.some((id) => !id)) {
    throw new Error("questionIds contains an empty entry");
  }

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevisionForPillar(tx, pillarId);
      if (!aggregate || aggregate.revision.id !== draftId) {
        throw new Error("Pillar does not belong to the draft Revision");
      }
      for (const [index, questionId] of questionIds.entries()) {
        await tx
          .update(templateQuestions)
          .set({ orderKey: generateOrderKey(index + 1), updatedAt: now })
          .where(
            and(
              eq(templateQuestions.id, questionId),
              eq(templateQuestions.pillarId, pillarId)
            )
          );
      }
      await touchRevisionUpdater(tx, draftId, actorId, now);
    },
  });
}
