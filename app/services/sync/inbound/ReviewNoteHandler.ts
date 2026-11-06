import { nowISO } from "~/local-db";
import { reviewNoteState } from "#shared/db/schema";
import { eq } from "drizzle-orm";
import { localMutation } from "~/services/local-mutation";
import { toFieldMap, toReplayEvent, upsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

export const ReviewNoteHandler: InboundHandler = {
  entityTypes: ["review_note"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") {
      await localMutation.replay({
        stateWrite: async (tx) => {
          await tx
            .delete(reviewNoteState)
            .where(eq(reviewNoteState.id, event.entityId));
        },
        event: toReplayEvent(event, "ReviewNoteDeletedSynced.v1"),
      });
      return;
    }

    // Identity (reviewId, scopeType, scopeId) is parsed from the composite
    // entity ID "reviewId:scopeType:scopeId", not from the field map.
    // Only mutable data (content) travels as a field — see NoteMutations.save().
    const parts = event.entityId.split(":");
    if (parts.length < 3) return;

    const reviewId = parts[0]!;
    if (!reviewId) return;

    const scopeTypeRaw = parts[1]!;
    const scopeId = parts.slice(2).join(":") || reviewId;

    const allowedScopeTypes = new Set<"review" | "pillar" | "question">([
      "review",
      "pillar",
      "question",
    ]);
    const scopeType = allowedScopeTypes.has(
      scopeTypeRaw as "review" | "pillar" | "question"
    )
      ? (scopeTypeRaw as "review" | "pillar" | "question")
      : "review";

    // Only content is mutable — everything else is identity from the entity ID.
    const fields = toFieldMap(event.fields);
    const content = typeof fields.content === "string" ? fields.content : "";

    const now = nowISO();
    const row = {
      id: event.entityId,
      reviewId,
      scopeType,
      scopeId,
      content,
      updatedAt: now,
    };

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewNoteState)
          .values(row)
          .onConflictDoUpdate({
            target: reviewNoteState.id,
            set: {
              content: row.content,
              updatedAt: row.updatedAt,
            },
          });
        await upsertFieldVersions(tx, event);
      },
      event: toReplayEvent(event, "ReviewNoteSynced.v1", { reviewId }),
    });
  },
};
