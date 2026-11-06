/**
 * Factory for creating typed domain events.
 *
 * Handles ID generation, timestamps, actor resolution, AND entityType
 * lookup from the central catalog. All domain operations should create
 * events via this factory.
 */

import { createUuidV7, nowISO } from "~/local-db";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import type {
  DomainEvent,
  DomainEventEnvelope,
} from "~/services/events/DomainEvent";
import { getCatalogEntityType } from "~/services/events/schemas";

type EventCreationOptions = {
  reviewId?: string;
  source?: DomainEventEnvelope["source"];
  actorId?: string;
  actorType?: DomainEventEnvelope["actorType"];
  time?: string;
};

/**
 * Create a typed domain event with all envelope fields auto-resolved.
 *
 * Auto-resolved fields (caller need not supply):
 * - `id`          — UUIDv7
 * - `time`        — current ISO timestamp (override via `options.time`)
 * - `specversion` — always `"1.0"`
 * - `actorId`     — read from localStorage via `readPersistedActor()`
 * - `actorType`   — defaults to `"user"`
 * - `source`      — defaults to `"peaky.client"`
 * - `entityType`  — looked up from `EVENT_CATALOG` via the `type` argument
 *
 * Caller must supply: `type`, `entityId`, and `data`.
 * Pass `options.reviewId` to set the top-level `reviewId` extension for cross-entity correlation.
 *
 * **No more parallel `entityType` argument**: the catalog entry for `type`
 * carries the entityType, so call sites can't drift from the registry. A
 * literal-string typo at the call site is no longer a possibility — to
 * change which entityType an event belongs to, edit the catalog.
 *
 * @param type       - Versioned event type name (e.g. `"ReviewAnswerRecorded.v1"`)
 * @param entityId   - Stable ID of the target entity
 * @param data       - Typed payload, narrowed from `type`
 * @param options    - Optional overrides for actor, source, timestamp, and reviewId
 */
export function createEvent<T extends DomainEvent>(
  type: T["type"],
  entityId: string,
  data: Extract<DomainEvent, { type: T["type"] }>["data"],
  options: EventCreationOptions = {}
): T {
  const actor = readPersistedActor();

  return {
    id: createUuidV7(),
    type,
    specversion: "1.0",
    source: options.source ?? "peaky.client",
    actorId: options.actorId ?? actor.id,
    actorType: options.actorType ?? "user",
    entityType: getCatalogEntityType(type),
    entityId,
    data,
    time: options.time ?? nowISO(),
    ...(options.reviewId !== undefined ? { reviewId: options.reviewId } : {}),
  } as unknown as T;
}
