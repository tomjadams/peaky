import { nowISO } from "~/local-db";
import { reviews } from "#shared/db/schema";
import { eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

export const ReviewHandler: InboundHandler = {
  entityTypes: ["review"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx.delete(reviews).where(eq(reviews.id, event.entityId));
        },
        event: toReplayEvent(event, "ReviewDeletedSynced.v1"),
      });
      return;
    }

    const fields = toFieldMap(event.fields);
    const now = nowISO();
    const row = {
      id: event.entityId,
      subjectId: typeof fields.subjectId === "string" ? fields.subjectId : "",
      name: typeof fields.name === "string" ? fields.name : event.entityId,
      status:
        (fields.status as "draft" | "in-progress" | "completed" | "archived") ??
        "draft",
      createdAt: now,
      updatedAt: now,
    };
    if (!row.subjectId) return;

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviews)
          .values(row)
          .onConflictDoUpdate({
            target: reviews.id,
            set: {
              name: row.name,
              status: row.status,
              updatedAt: row.updatedAt,
            },
          });
        await upsertFieldVersions(tx, event);
      },
      event: toReplayEvent(event, "ReviewSynced.v1"),
    });
  },
};
