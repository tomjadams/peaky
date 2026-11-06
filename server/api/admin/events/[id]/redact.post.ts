/**
 * GDPR right-to-erasure endpoint.
 *
 * Redacts PII from a single event (actorName, any stored free-text content).
 * The event record itself is preserved for audit integrity — only personally
 * identifiable fields are overwritten with a tombstone value.
 *
 * Only admins may trigger this. All redaction actions are themselves auditable
 * via the piiRedactedAt / piiRedactedBy fields written to the event.
 */
import { redactEventPii } from "../../../../data/review-events";
import { getLifecycleActor } from "../../../../utils/lifecycleActor";

export default defineEventHandler(async (event) => {
  const actor = await getLifecycleActor(event);

  if (!actor.roles.includes("admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admins can process GDPR erasure requests",
    });
  }

  const eventId = getRouterParam(event, "id");

  if (!eventId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Event ID is required",
    });
  }

  const redacted = redactEventPii(eventId, actor.id);

  if (!redacted) {
    throw createError({
      statusCode: 404,
      statusMessage: "Event not found",
    });
  }

  return {
    id: redacted.id,
    piiRedactedAt: redacted.piiRedactedAt,
    piiRedactedBy: redacted.piiRedactedBy,
  };
});
