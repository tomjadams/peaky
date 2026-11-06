import { nowISO } from "~/local-db";
import { reviewAttachments } from "#shared/db/schema";
import { eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

export const AttachmentHandler: InboundHandler = {
  entityTypes: ["review_attachment"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx
            .delete(reviewAttachments)
            .where(eq(reviewAttachments.id, event.entityId));
        },
        event: toReplayEvent(event, "AttachmentDeletedSynced.v1"),
      });
      return;
    }

    const fields = toFieldMap(event.fields);
    const reviewId = typeof fields.reviewId === "string" ? fields.reviewId : "";
    if (!reviewId) return;

    const now = nowISO();
    const row = {
      id: event.entityId,
      reviewId,
      scopeType:
        (fields.scopeType as "review" | "pillar" | "question") ?? "review",
      scopeId: typeof fields.scopeId === "string" ? fields.scopeId : reviewId,
      filename: typeof fields.filename === "string" ? fields.filename : "",
      objectKey: typeof fields.objectKey === "string" ? fields.objectKey : "",
      mimeType: typeof fields.mimeType === "string" ? fields.mimeType : null,
      size: typeof fields.size === "number" ? fields.size : null,
      createdBy: event.actorId,
      createdByName: event.actorId,
      createdAt: now,
    };

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewAttachments)
          .values(row)
          .onConflictDoUpdate({
            target: reviewAttachments.id,
            set: {
              filename: row.filename,
              objectKey: row.objectKey,
              mimeType: row.mimeType,
              size: row.size,
            },
          });
        await upsertFieldVersions(tx, event);
      },
      event: toReplayEvent(event, "AttachmentSynced.v1", { reviewId }),
    });
  },
};
