/**
 * Local-first Template draft Pillar operations.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { and, desc, eq } from "drizzle-orm";
import { createUuidV7, generateOrderKey } from "~/local-db";
import { templatePillars } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getDefaultLifecycleActor } from "~/lifecycle/management";
import {
  requireMutableRevision,
  requireMutableRevisionForPillar,
  touchRevisionUpdater,
} from "./templateRevisionWrite";

export async function addLocalPillar(
  draftId: string,
  name: string,
  slug: string,
  description?: string
): Promise<string> {
  if (!draftId) throw new Error("draftId is required");
  if (!name) throw new Error("name is required");
  if (!slug) throw new Error("slug is required");

  const id = createUuidV7();
  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      await requireMutableRevision(tx, draftId);
      const existingPillars = await tx
        .select({ orderKey: templatePillars.orderKey })
        .from(templatePillars)
        .where(eq(templatePillars.templateRevisionId, draftId))
        .orderBy(desc(templatePillars.orderKey))
        .limit(1);
      const maxOrder = existingPillars[0]
        ? Number.parseInt(existingPillars[0].orderKey, 10)
        : 0;
      await tx.insert(templatePillars).values({
        id,
        templateRevisionId: draftId,
        slug,
        name,
        description: description ?? "",
        orderKey: generateOrderKey((Number.isNaN(maxOrder) ? 0 : maxOrder) + 1),
        createdAt: now,
        updatedAt: now,
      });
      await touchRevisionUpdater(tx, draftId, actorId, now);
    },
  });
  return id;
}

export async function updateLocalPillar(
  pillarId: string,
  updates: Partial<{ name: string; description: string }>
): Promise<void> {
  if (!pillarId) throw new Error("pillarId is required");
  if (updates.name === undefined && updates.description === undefined) return;

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevisionForPillar(tx, pillarId);
      if (!aggregate) return;
      const updateData: Partial<typeof templatePillars.$inferInsert> = {
        updatedAt: now,
      };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }
      await tx
        .update(templatePillars)
        .set(updateData)
        .where(eq(templatePillars.id, pillarId));
      await touchRevisionUpdater(tx, aggregate.revision.id, actorId, now);
    },
  });
}

export async function deleteLocalPillar(pillarId: string): Promise<void> {
  if (!pillarId) throw new Error("pillarId is required");

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const aggregate = await requireMutableRevisionForPillar(tx, pillarId);
      if (!aggregate) return;
      await tx.delete(templatePillars).where(eq(templatePillars.id, pillarId));
      await touchRevisionUpdater(tx, aggregate.revision.id, actorId, now);
    },
  });
}

export async function reorderLocalPillars(
  draftId: string,
  pillarIds: string[]
): Promise<void> {
  if (!draftId) throw new Error("draftId is required");
  if (!pillarIds.length) throw new Error("pillarIds is required");
  if (pillarIds.some((id) => !id)) {
    throw new Error("pillarIds contains an empty entry");
  }

  const actorId = getDefaultLifecycleActor().id;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      await requireMutableRevision(tx, draftId);
      for (const [index, pillarId] of pillarIds.entries()) {
        await tx
          .update(templatePillars)
          .set({ orderKey: generateOrderKey(index + 1), updatedAt: now })
          .where(
            and(
              eq(templatePillars.id, pillarId),
              eq(templatePillars.templateRevisionId, draftId)
            )
          );
      }
      await touchRevisionUpdater(tx, draftId, actorId, now);
    },
  });
}
