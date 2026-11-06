import { withDatabase, firstOrNull, nowISO, eq, and } from "~/local-db";
import { reviewNoteState, type NoteScope } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import { createEvent } from "~/services/events/createEvent";
import type {
  ReviewNoteRecorded,
  ReviewNoteDeleted,
} from "~/services/events/DomainEvent";

export type NoteRow = typeof reviewNoteState.$inferSelect;

export class NoteMutations {
  async save(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string,
    content: string
  ): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");
    if (!scopeType) throw new Error("scopeType is required");
    if (!scopeId) throw new Error("scopeId is required");

    const id = `${reviewId}:${scopeType}:${scopeId}`;
    const now = nowISO();

    const event = createEvent<ReviewNoteRecorded>(
      "ReviewNoteRecorded.v1",
      id,
      {
        scopeType,
        scopeId,
        content,
      },
      { reviewId }
    );

    const clock = getHLCClock();
    const contentHlc = clock.now();

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewNoteState)
          .values({ id, reviewId, scopeType, scopeId, content, updatedAt: now })
          .onConflictDoUpdate({
            target: reviewNoteState.id,
            set: { content, updatedAt: now },
          });
      },
      event,
      outbox: {
        entityType: "review_note",
        entityId: id,
        operation: "upsert",
        // Only content is mutable. Identity (reviewId, scopeType, scopeId)
        // is encoded in the composite entity ID and parsed by the handler.
        fields: [{ name: "content", value: content, hlc: contentHlc }],
      },
    });
  }

  async delete(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string
  ): Promise<void> {
    if (!reviewId) throw new Error("reviewId is required");
    if (!scopeType) throw new Error("scopeType is required");
    if (!scopeId) throw new Error("scopeId is required");

    const id = `${reviewId}:${scopeType}:${scopeId}`;

    const event = createEvent<ReviewNoteDeleted>(
      "ReviewNoteDeleted.v1",
      id,
      {
        scopeType,
        scopeId,
      },
      { reviewId }
    );

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .delete(reviewNoteState)
          .where(
            and(
              eq(reviewNoteState.reviewId, reviewId),
              eq(reviewNoteState.scopeType, scopeType),
              eq(reviewNoteState.scopeId, scopeId)
            )
          );
      },
      event,
      outbox: {
        entityType: "review_note",
        entityId: id,
        operation: "delete",
        fields: [],
      },
    });
  }

  async seed(input: {
    reviewId: string;
    scopeType: NoteScope;
    scopeId: string;
    content: string;
    updatedAt: string;
  }): Promise<void> {
    if (!input.content.trim()) {
      return;
    }

    const id = `${input.reviewId}:${input.scopeType}:${input.scopeId}`;

    await withDatabase(async (db) => {
      const existing = await db
        .select()
        .from(reviewNoteState)
        .where(
          and(
            eq(reviewNoteState.reviewId, input.reviewId),
            eq(reviewNoteState.scopeType, input.scopeType),
            eq(reviewNoteState.scopeId, input.scopeId)
          )
        )
        .limit(1);

      const existingRow = firstOrNull(existing);

      if (existingRow) {
        return;
      }

      await db.insert(reviewNoteState).values({
        id,
        reviewId: input.reviewId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        content: input.content,
        updatedAt: input.updatedAt,
      });
    });
  }

  async fetchByScope(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string
  ): Promise<NoteRow | null> {
    if (!reviewId || !scopeType || !scopeId) {
      return null;
    }

    return withDatabase(async (db) => {
      const result = await db
        .select()
        .from(reviewNoteState)
        .where(
          and(
            eq(reviewNoteState.reviewId, reviewId),
            eq(reviewNoteState.scopeType, scopeType),
            eq(reviewNoteState.scopeId, scopeId)
          )
        )
        .limit(1);

      return firstOrNull(result);
    });
  }
}

export const noteMutations = new NoteMutations();
