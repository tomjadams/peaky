/**
 * Local-first progress state composable.
 *
 * Provides reactive access to pillar progress stored in the local database.
 * Progress is computed from answer states for fast local reads.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { withDatabase, nowISO, createUuidV7 } from "~/local-db";
import { events } from "#shared/db/schema";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";

/**
 * Save pillar progress locally.
 * Progress changes are derived from answers, so we write only a local
 * audit event — no outbox entry. Syncing an empty fields payload would
 * waste CPU and network for zero server-side effect (the server derives
 * progress from answer state, not from a progress entity).
 */
export async function saveLocalProgress(
  reviewId: string,
  pillarSlug: string,
  progress: number
): Promise<void> {
  const actor = readPersistedActor();

  if (!reviewId) throw new Error("reviewId is required");
  if (!pillarSlug) throw new Error("pillarSlug is required");

  const now = nowISO();

  await withDatabase(async (db) => {
    // Write a local-only audit event. Progress is derived server-side from
    // answer state, so we intentionally skip the outbox — syncing an empty
    // fields payload wastes CPU and network for zero server-side effect.
    await db.insert(events).values({
      id: createUuidV7(),
      reviewId,
      eventType: "ReviewProgressUpdated.v1",
      actorType: "user",
      actorId: actor.id,
      data: JSON.stringify({ pillarSlug, progress }),
      time: now,
      status: "pending",
    });
  });
}
