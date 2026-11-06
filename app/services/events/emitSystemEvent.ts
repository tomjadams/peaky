/**
 * System event emitter for non-mutation contexts.
 *
 * Use this when no `stateWrite` and no `local_outbox` row are required —
 * e.g. DB lifecycle (`LocalDbReady.v1`), sync cycles (`SyncCycleSucceeded.v1`),
 * OPFS measurement (`OpfsStorageMeasured.v1`), recreate-DB
 * (`LocalDbRecreated.v1`).
 *
 * Emits to the `events` table directly with the catalog-derived status:
 * - `local: true` in the catalog → row inserted with `status: "local"`.
 * - otherwise → `status: "pending"`, eligible for the future event push.
 *
 * Imports `getDatabase` from `~/local-db/client` (file, not barrel) so this
 * helper can be called from `app/local-db/migrations.ts` without creating a
 * circular import via the `~/local-db` barrel.
 */

import { createUuidV7 } from "#shared/id";
import { events } from "#shared/db/schema";
// Imported from `~/local-db/client` (file path) — DO NOT change to the
// `~/local-db` barrel. The barrel re-exports through this module's callers
// (e.g. `app/local-db/migrations.ts`) and would reintroduce the circular
// import path documented in the module header above.
import { getDatabase } from "~/local-db/client";
import type {
  DomainEvent,
  DomainEventEnvelope,
} from "~/services/events/DomainEvent";
import {
  getCatalogEntityType,
  isLocalCatalogEvent,
} from "~/services/events/schemas";

export interface EmitSystemEventOptions<T extends DomainEvent> {
  /** Versioned event type name, e.g. `"LocalDbReady.v1"`. */
  type: T["type"];
  /** Stable ID of the target entity. */
  entityId: string;
  /** Typed payload; shape is enforced by the generic `T`. */
  data: T["data"];
  /** Cross-entity correlation key. */
  reviewId?: string;
  /** Browser session identifier. */
  clientId?: string;
  /** URL pointing to the JSON Schema for `data`. */
  dataschema?: string;
  /** Source attribution. Defaults to `"peaky.system"`. */
  source?: DomainEventEnvelope["source"];
  /** Actor ID. Defaults to `"system"`. */
  actorId?: string;
  /** Actor type. Defaults to `"system"`. */
  actorType?: DomainEventEnvelope["actorType"];
  /** ISO 8601 timestamp. Defaults to current time. */
  time?: string;
}

/**
 * Emit a system event, returning the generated event ID.
 *
 * Failures are silently swallowed — system events are diagnostic, not
 * critical, and the caller's primary work (bootstrap, sync, etc.) must
 * not regress when the events table is somehow unavailable. Returns
 * `null` in that case so callers can branch if needed.
 */
export async function emitSystemEvent<T extends DomainEvent>(
  options: EmitSystemEventOptions<T>
): Promise<{ eventId: string } | null> {
  try {
    const db = await getDatabase();
    const id = createUuidV7();
    const time = options.time ?? new Date().toISOString();

    await db.insert(events).values({
      id,
      specversion: "1.0",
      dataschema: options.dataschema ?? null,
      reviewId: options.reviewId ?? null,
      eventType: options.type,
      actorType: options.actorType ?? "system",
      actorId: options.actorId ?? "system",
      clientId: options.clientId ?? null,
      data: JSON.stringify(options.data),
      time,
      status: isLocalCatalogEvent(options.type) ? "local" : "pending",
      source: options.source ?? "peaky.system",
      entityType: getCatalogEntityType(options.type),
      entityId: options.entityId,
    });

    return { eventId: id };
  } catch {
    return null;
  }
}
