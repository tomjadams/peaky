import { localMutation } from "~/services/local-mutation";
import { applyFieldVersionWrite, toFieldMap, toReplayEvent } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

/**
 * Handles `field_version` entity events — direct field_versions table writes
 * (no intermediate state table; field_version IS the state).
 *
 * entityId format: "<entityType>:<entityId>:<fieldName>"
 *
 * Each pulled event creates a new version row. The `eventId` column provides
 * idempotency — the same event pulled twice is a no-op.
 */
export const FieldVersionHandler: InboundHandler = {
  entityTypes: ["field_version"],

  async handle(event: PulledEvent): Promise<void> {
    // Field versions are append-only audit records, not deletable entities.
    // Explicitly ignore delete operations rather than relying on the empty-
    // fields early-return below, so a future change to default values cannot
    // accidentally make a delete event replay as a field version upsert.
    if (event.operation === "delete") return;

    const fields = toFieldMap(event.fields);
    const row = {
      eventId: event.id,
      entityType:
        typeof fields.entityType === "string" ? fields.entityType : "",
      entityId: typeof fields.entityId === "string" ? fields.entityId : "",
      fieldName: typeof fields.fieldName === "string" ? fields.fieldName : "",
      value: typeof fields.value === "string" ? fields.value : null,
      hlc:
        typeof fields.hlc === "string"
          ? fields.hlc
          : eventTimeToFallbackHlc(event.time, event.actorId),
      actorId: event.actorId,
      updatedAt: event.time,
    };
    if (!row.entityType || !row.entityId || !row.fieldName) return;

    await localMutation.replay({
      stateWrite: async (tx) => {
        await applyFieldVersionWrite(tx, row);
      },
      event: toReplayEvent(event, "FieldVersionSynced.v1"),
    });
  },
};

function eventTimeToFallbackHlc(time: string, actorId: string): string {
  const ms = Date.parse(time);
  return `${Number.isFinite(ms) ? ms : 0}:0000:${actorId}`;
}
