import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import {
  withDatabase,
  firstOrNull,
  createUuidV7,
  nowISO,
  eq,
  and,
} from "~/local-db";
import { reviewAttachments } from "#shared/db/schema";
import type { NoteScope } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import { createEvent } from "~/services/events/createEvent";
import type {
  ReviewAttachmentUploaded,
  ReviewAttachmentDeleted,
} from "~/services/events/DomainEvent";
import type { PillarAttachment } from "~/models";

type ReviewAttachmentRow = typeof reviewAttachments.$inferSelect;

function toPillarAttachment(row: ReviewAttachmentRow): PillarAttachment {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.mimeType ?? "application/octet-stream",
    sizeBytes: row.size ?? 0,
    objectKey: row.objectKey,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
  };
}

export class AttachmentMutations {
  async fetchForScope(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string
  ): Promise<PillarAttachment[]> {
    if (!reviewId || !scopeId) {
      return [];
    }

    const rows = await withDatabase(async (db) => {
      return db
        .select()
        .from(reviewAttachments)
        .where(
          and(
            eq(reviewAttachments.reviewId, reviewId),
            eq(reviewAttachments.scopeType, scopeType),
            eq(reviewAttachments.scopeId, scopeId)
          )
        );
    });

    return rows.map(toPillarAttachment);
  }

  async seed(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string,
    attachments: PillarAttachment[]
  ): Promise<void> {
    if (attachments.length === 0) {
      return;
    }

    await withDatabase(async (db) => {
      for (const attachment of attachments) {
        const existing = await db
          .select()
          .from(reviewAttachments)
          .where(eq(reviewAttachments.id, attachment.id))
          .limit(1);

        if (firstOrNull(existing)) {
          continue;
        }

        await db.insert(reviewAttachments).values({
          id: attachment.id,
          reviewId,
          scopeType,
          scopeId,
          filename: attachment.filename,
          objectKey: attachment.objectKey,
          mimeType: attachment.contentType,
          size: attachment.sizeBytes,
          createdBy: attachment.createdBy,
          createdByName: attachment.createdByName,
          createdAt: attachment.createdAt,
        });
      }
    });
  }

  async create(
    reviewId: string,
    scopeType: NoteScope,
    scopeId: string,
    file: Pick<File, "name" | "type" | "size">
  ): Promise<PillarAttachment> {
    if (!reviewId) throw new Error("reviewId is required");
    if (!scopeType) throw new Error("scopeType is required");
    if (!scopeId) throw new Error("scopeId is required");

    const actor = readPersistedActor();
    const id = createUuidV7();
    const now = nowISO();

    const attachment = {
      id,
      reviewId,
      scopeType,
      scopeId,
      filename: file.name,
      objectKey: `reviews/${reviewId}/${scopeType}/${scopeId}/${id}/${file.name}`,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdBy: actor.id,
      createdByName: actor.name,
      createdAt: now,
    };

    const event = createEvent<ReviewAttachmentUploaded>(
      "ReviewAttachmentUploaded.v1",
      id,
      {
        attachmentId: id,
        scopeType,
        scopeId,
        filename: file.name,
        mimeType: attachment.mimeType,
        fileSize: attachment.size,
      },
      { reviewId }
    );

    const clock = getHLCClock();
    // One HLC for the entire creation — attachments are write-once, so all
    // fields are set atomically and share a single logical timestamp.
    // If a conflict ever occurs, all fields win or lose together.
    const hlc = clock.now();

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx.insert(reviewAttachments).values(attachment);
      },
      event,
      outbox: {
        entityType: "review_attachment",
        entityId: id,
        operation: "upsert",
        fields: [
          { name: "reviewId", value: reviewId, hlc },
          { name: "scopeType", value: scopeType, hlc },
          { name: "scopeId", value: scopeId, hlc },
          { name: "filename", value: attachment.filename, hlc },
          { name: "objectKey", value: attachment.objectKey, hlc },
          { name: "mimeType", value: attachment.mimeType, hlc },
          { name: "size", value: attachment.size, hlc },
        ],
      },
    });

    return toPillarAttachment(attachment);
  }

  async delete(reviewId: string, attachmentId: string): Promise<boolean> {
    if (!reviewId) throw new Error("reviewId is required");
    if (!attachmentId) throw new Error("attachmentId is required");

    const existingRows = await withDatabase(async (db) => {
      return db
        .select()
        .from(reviewAttachments)
        .where(
          and(
            eq(reviewAttachments.reviewId, reviewId),
            eq(reviewAttachments.id, attachmentId)
          )
        )
        .limit(1);
    });

    const existing = firstOrNull(existingRows);
    if (!existing) {
      return false;
    }

    const event = createEvent<ReviewAttachmentDeleted>(
      "ReviewAttachmentDeleted.v1",
      attachmentId,
      {
        attachmentId,
        scopeType: existing.scopeType,
        scopeId: existing.scopeId,
        filename: existing.filename,
        mimeType: existing.mimeType ?? "application/octet-stream",
        fileSize: existing.size ?? 0,
      },
      { reviewId }
    );

    await localMutation.commit({
      stateWrite: async (tx) => {
        await tx
          .delete(reviewAttachments)
          .where(eq(reviewAttachments.id, attachmentId));
      },
      event,
      outbox: {
        entityType: "review_attachment",
        entityId: attachmentId,
        operation: "delete",
        fields: [],
      },
    });

    return true;
  }
}

export const attachmentMutations = new AttachmentMutations();
