import { eq } from "drizzle-orm";
import { reviewHandoffPractices } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { practiceReferenceFromEntityId } from "~/services/handoff/practice";
import { handoffPracticeFromRow } from "~/services/handoff/persistence";
import type { HandoffPracticeRecord } from "~/services/handoff/draft";
import { toFieldMap, toReplayEvent, tryUpsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

type PracticeRow = typeof reviewHandoffPractices.$inferSelect;
type SelectionState = HandoffPracticeRecord["selectionState"];

function asSelectionState(value: unknown): SelectionState | undefined {
  return value === "selected" || value === "removed" ? value : undefined;
}

/**
 * Merges a partial field event over the existing row: the server attaches
 * only the fields that won HLC resolution, so untouched fields survive.
 * Returns null when neither the event nor the existing row supplies a
 * required field (an incomplete first write) — a later event carrying the
 * missing fields retries the merge.
 */
function mergedPracticeRow(
  reference: ReturnType<typeof practiceReferenceFromEntityId>,
  fields: Record<string, unknown>,
  prior: PracticeRow | undefined,
  event: PulledEvent
): PracticeRow | null {
  const orderKey = (fields.orderKey ?? prior?.orderKey) as string | undefined;
  const snapshot =
    fields.snapshot !== undefined
      ? JSON.stringify(fields.snapshot)
      : prior?.snapshot;
  const selectionState =
    asSelectionState(fields.selectionState) ?? prior?.selectionState;
  if (!orderKey || !snapshot || !selectionState) return null;
  return {
    id: event.entityId,
    reviewId: reference.reviewId,
    templateRevisionId: reference.templateRevisionId,
    questionId: reference.questionId,
    practiceId: reference.practiceId,
    orderKey,
    snapshot,
    rationale:
      fields.rationale !== undefined
        ? (fields.rationale as string | null)
        : (prior?.rationale ?? null),
    selectionState,
    // Local lifecycle ownership never comes from the sync payload.
    localHandoffId: prior?.localHandoffId ?? null,
    actorId: event.actorId,
    occurredAt:
      ((fields.occurredAt ?? prior?.occurredAt) as string | undefined) ??
      event.time,
    updatedAt: event.time,
  };
}

/**
 * Handles pulled `review_handoff_practice` events (local-first/REQ-011).
 *
 * entityId is the deterministic practice ID
 * "review_handoff_practice:<review>/<revision>/<question>/<practice>".
 * Practice rows use ordinary field-level HLC for order-key, rationale, and
 * selection-state edits; there is no delete operation — removal is a
 * `selectionState` field write.
 */
export const ReviewHandoffPracticeHandler: InboundHandler = {
  entityTypes: ["review_handoff_practice"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") return;

    let reference;
    try {
      reference = practiceReferenceFromEntityId(event.entityId);
    } catch {
      return; // malformed identity — skip, the pull cursor still advances
    }

    const fields = toFieldMap(event.fields);

    await localMutation.replay({
      stateWrite: async (tx) => {
        const prior = (
          await tx
            .select()
            .from(reviewHandoffPractices)
            .where(eq(reviewHandoffPractices.id, event.entityId))
            .limit(1)
        )[0];
        const row = mergedPracticeRow(reference, fields, prior, event);
        if (!row) return;
        // The codec is the structural guard: a corrupt snapshot aborts the
        // write rather than persisting a row the domain could silently
        // misread.
        try {
          handoffPracticeFromRow(row);
        } catch {
          return;
        }

        await tx
          .insert(reviewHandoffPractices)
          .values(row)
          .onConflictDoUpdate({
            target: reviewHandoffPractices.id,
            set: {
              orderKey: row.orderKey,
              snapshot: row.snapshot,
              rationale: row.rationale,
              selectionState: row.selectionState,
              actorId: row.actorId,
              updatedAt: row.updatedAt,
            },
          });
        await tryUpsertFieldVersions(tx, event, "ReviewHandoffPractice");
      },
      event: toReplayEvent(event, "ReviewHandoffPracticeSynced.v1", {
        reviewId: reference.reviewId,
      }),
    });
  },
};
