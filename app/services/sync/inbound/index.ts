import { ReviewAnswerHandler } from "./ReviewAnswerHandler";
import { ReviewNoteHandler } from "./ReviewNoteHandler";
import { AttachmentHandler } from "./AttachmentHandler";
import { ReviewHandler } from "./ReviewHandler";
import { TeamHandler } from "./TeamHandler";
import { ProductHandler } from "./ProductHandler";
import { FieldVersionHandler } from "./FieldVersionHandler";
import { ReviewHandoffPracticeHandler } from "./ReviewHandoffPracticeHandler";
import { ReviewHandoffAssociationHandler } from "./ReviewHandoffAssociationHandler";
import { ReviewMaturityOverrideHandler } from "./ReviewMaturityOverrideHandler";
import type { InboundHandler, PulledEvent } from "./types";

export type { PulledEvent } from "./types";

const ALL_HANDLERS: InboundHandler[] = [
  ReviewAnswerHandler,
  ReviewNoteHandler,
  AttachmentHandler,
  ReviewHandler,
  TeamHandler,
  ProductHandler,
  FieldVersionHandler,
  ReviewHandoffPracticeHandler,
  ReviewHandoffAssociationHandler,
  ReviewMaturityOverrideHandler,
];

const handlerMap = new Map<string, InboundHandler>();
for (const handler of ALL_HANDLERS) {
  for (const entityType of handler.entityTypes) {
    handlerMap.set(entityType, handler);
  }
}

/**
 * Dispatch a single pulled event to the appropriate inbound handler.
 * Unknown entity types are silently skipped (forward-compatibility).
 * Unknown operations are logged and skipped so a single bad event does not
 * block the pull cursor from advancing.
 */
export async function dispatchInboundEvent(event: PulledEvent): Promise<void> {
  const handler = handlerMap.get(event.entityType);
  if (!handler) return;
  if (event.operation !== "upsert" && event.operation !== "delete") {
    console.warn(
      `[sync] dispatchInboundEvent: skipping event ${event.id} with unsupported operation '${event.operation}' for entityType '${event.entityType}'`
    );
    return;
  }
  await handler.handle(event);
}
