/**
 * Transactional Unit of Work for local-first mutations.
 *
 * Four write paths — each runs atomically in a single SQLite transaction:
 *
 *   localOnly() → state write                  (local-only domain, no transport)
 *   draft()     → state write + outbox         (auto-save, NO audit event)
 *   commit()    → state write + outbox + event  (checkpoint, status='pending')
 *   replay()    → state write + event           (server pull, status='synced', no outbox)
 *
 * Loop prevention: replay() sets status='synced', source='peaky.sync'.
 * The push pipeline filters WHERE status = 'pending', so replayed events
 * are never re-pushed.
 *
 * Formal model: formal_verification/sync/local_mutation_atomicity.fizz —
 * changing what commit() writes, or the order it writes in, requires updating
 * that spec (`make verify/sync/local_mutation_atomicity`).
 */

import { and, eq } from "drizzle-orm";
import {
  getDatabase,
  isLocalDatabaseReady,
  waitForLocalDbReady,
  createUuidV7,
  withWriteTransaction,
} from "~/local-db";
import { events, localOutbox } from "#shared/db/schema";
import type {
  DomainEvent,
  DomainEventEnvelope,
} from "~/services/events/DomainEvent";
import { isLocalCatalogEvent } from "~/services/events/schemas";
import { triggerPush } from "~/services/sync/pushTrigger";

type DrizzleDb = Awaited<ReturnType<typeof getDatabase>>;

export type MutationTransaction = Parameters<
  Parameters<DrizzleDb["transaction"]>[0]
>[0];

/** A single field with its HLC stamp — the unit pushed to the server. */
export interface FieldValue {
  name: string;
  value: unknown;
  hlc: string; // wire format: "wallclock:counter:actorId"
}

/** Outbox descriptor for the local_outbox row. */
export interface OutboxEntry {
  entityType: string;
  entityId: string;
  operation: "upsert" | "delete";
  fields: FieldValue[];
}

export interface LocalOnlyWriteContext {
  now: string;
}

export interface DraftWriteContext {
  outboxId: string;
  now: string;
}

export interface CommitOptions<E extends DomainEvent> {
  stateWrite: (tx: MutationTransaction) => Promise<void>;
  event: E;
  outbox: OutboxEntry;
}

export interface ReplayOptions {
  stateWrite: (tx: MutationTransaction) => Promise<void>;
  event: DomainEventEnvelope;
}

export class LocalMutation {
  /**
   * State-only path for explicitly local domains. Writes no event or outbox row
   * and does not trigger push.
   */
  async localOnly(options: {
    stateWrite: (
      tx: MutationTransaction,
      context: LocalOnlyWriteContext
    ) => Promise<void>;
  }): Promise<void> {
    await this.#ensureReady();
    const db = await getDatabase();
    const now = new Date().toISOString();

    await withWriteTransaction(db, async (tx) => {
      await options.stateWrite(tx, { now });
    });
  }

  /**
   * Auto-save path. Writes state + outbox. No audit event — granular changes
   * are tracked server-side in field_versions with HLC timestamps.
   */
  async draft(options: {
    stateWrite: (
      tx: MutationTransaction,
      context: DraftWriteContext
    ) => Promise<void>;
    outbox: OutboxEntry;
  }): Promise<void> {
    await this.#ensureReady();
    const db = await getDatabase();
    const outboxId = createUuidV7();
    const now = new Date().toISOString();

    await withWriteTransaction(db, async (tx) => {
      await options.stateWrite(tx, { outboxId, now });

      // Clean up old failed entries for the same entity — they're superseded
      // by this new write and would otherwise show a stale conflict badge.
      await tx
        .delete(localOutbox)
        .where(
          and(
            eq(localOutbox.entityId, options.outbox.entityId),
            eq(localOutbox.status, "failed")
          )
        );

      await tx.insert(localOutbox).values({
        id: outboxId,
        entityType: options.outbox.entityType,
        entityId: options.outbox.entityId,
        operation: options.outbox.operation,
        fields: JSON.stringify(options.outbox.fields),
        createdAt: now,
        updatedAt: now,
        status: "pending",
        retryCount: 0,
      });
    });

    triggerPush();
  }

  /**
   * Batch auto-save path. Like draft() but inserts multiple outbox entries
   * in a single transaction. Used when one user gesture produces N entity
   * updates that must be atomic (e.g., reordering pillars/questions).
   */
  async draftBatch(options: {
    stateWrite: (
      tx: MutationTransaction,
      context: { outboxIds: string[]; now: string }
    ) => Promise<void>;
    outbox: OutboxEntry[];
  }): Promise<void> {
    await this.#ensureReady();
    const db = await getDatabase();
    const now = new Date().toISOString();
    const outboxIds = options.outbox.map(() => createUuidV7());

    await withWriteTransaction(db, async (tx) => {
      await options.stateWrite(tx, { outboxIds, now });

      for (const [index, entry] of options.outbox.entries()) {
        // Clean up old failed entries for the same entity — superseded.
        await tx
          .delete(localOutbox)
          .where(
            and(
              eq(localOutbox.entityId, entry.entityId),
              eq(localOutbox.status, "failed")
            )
          );

        await tx.insert(localOutbox).values({
          id: outboxIds[index]!,
          entityType: entry.entityType,
          entityId: entry.entityId,
          operation: entry.operation,
          fields: JSON.stringify(entry.fields),
          createdAt: now,
          updatedAt: now,
          status: "pending",
          retryCount: 0,
        });
      }
    });

    triggerPush();
  }

  /**
   * Checkpoint/milestone path. Writes state + outbox + audit event.
   * Event status defaults to 'pending' (eligible for event push).
   *
   * @returns `{ eventId }` — generated event ID for correlation.
   */
  /**
   * Shared event-row insertion used by both commit() and replay().
   *
   * @param idempotent - When true, uses ON CONFLICT DO NOTHING so replaying
   *   the same server event twice (e.g. after a cursor reset) doesn't block
   *   the state write. commit() always uses false (duplicate client events
   *   are a bug and should surface).
   */
  async #insertEvent(opts: {
    tx: MutationTransaction;
    event: DomainEventEnvelope;
    status: "pending" | "local" | "synced";
    source: "peaky.client" | "peaky.sync" | "peaky.system";
    idempotent?: boolean;
  }): Promise<void> {
    const { tx, event, status, source, idempotent = false } = opts;
    const stmt = tx.insert(events).values({
      id: event.id,
      specversion: event.specversion,
      dataschema: event.dataschema ?? null,
      reviewId: event.reviewId ?? null,
      eventType: event.type,
      actorType: event.actorType,
      actorId: event.actorId,
      clientId: event.clientId ?? null,
      data: JSON.stringify(event.data),
      time: event.time,
      status,
      source,
      entityType: event.entityType,
      entityId: event.entityId,
    });
    await (idempotent ? stmt.onConflictDoNothing() : stmt);
  }

  async commit<E extends DomainEvent>(
    options: CommitOptions<E>
  ): Promise<{ eventId: string }> {
    const { stateWrite, event, outbox } = options;
    await this.#ensureReady();
    const db = await getDatabase();
    const outboxId = createUuidV7();

    await withWriteTransaction(db, async (tx) => {
      await stateWrite(tx);

      await this.#insertEvent({
        tx,
        event,
        status: isLocalCatalogEvent(event.type) ? "local" : "pending",
        source: event.source,
      });

      await tx.insert(localOutbox).values({
        id: outboxId,
        actorId: event.actorId,
        entityType: outbox.entityType,
        entityId: outbox.entityId,
        operation: outbox.operation,
        fields: JSON.stringify(outbox.fields),
        createdAt: event.time,
        updatedAt: event.time,
        status: "pending",
        retryCount: 0,
      });
    });

    return { eventId: event.id };
  }

  /**
   * Server-pull path. Writes state + audit event (status='synced',
   * source='peaky.sync'). No outbox entry — prevents re-push loop.
   *
   * @returns `{ eventId }` — generated event ID for correlation.
   */
  async replay(options: ReplayOptions): Promise<{ eventId: string }> {
    const { stateWrite, event } = options;
    await this.#ensureReady();
    const db = await getDatabase();

    await withWriteTransaction(db, async (tx) => {
      await stateWrite(tx);
      // Server-originated: status='synced' so push pipeline skips it.
      // source='peaky.sync' so UI can distinguish server events.
      // idempotent=true: same server event ID arriving twice (e.g. after a
      // cursor reset) must not block the state write — skip the duplicate row.
      await this.#insertEvent({
        tx,
        event,
        status: "synced",
        source: "peaky.sync",
        idempotent: true,
      });
    });

    return { eventId: event.id };
  }

  async #ensureReady(): Promise<void> {
    if (!isLocalDatabaseReady()) {
      const ready = waitForLocalDbReady();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Local database is not ready after 5s — mutation aborted"
              )
            ),
          5000
        )
      );
      await Promise.race([ready, timeout]);
      if (!isLocalDatabaseReady()) {
        throw new Error(
          "Local database is not ready after 5s — mutation aborted"
        );
      }
    }
  }
}

export const localMutation = new LocalMutation();
