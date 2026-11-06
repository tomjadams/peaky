import { reviewMaturityOverrides } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import {
  OVERRIDE_ACTIONS,
  type OverrideAction,
} from "~/services/maturity/override";
import { overrideTransitionFromRow } from "~/services/maturity/overridePersistence";
import { parseTypedReviewChildEntityId } from "./reviewChildIds";
import { toFieldMap, toReplayEvent, tryUpsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

type OverrideRow = typeof reviewMaturityOverrides.$inferSelect;

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

/**
 * Builds the transition row for one pulled event, or null when the event is
 * malformed (unknown action, missing Revision key) or violates a stored
 * invariant — such events are skipped so the pull cursor still advances
 * past them.
 */
function buildOverrideRow(
  reviewId: string,
  transitionId: string,
  fields: Record<string, unknown>,
  event: PulledEvent
): OverrideRow | null {
  const { action, templateRevisionId, occurredAt } = fields;
  if (
    typeof action !== "string" ||
    !OVERRIDE_ACTIONS.includes(action as never) ||
    typeof templateRevisionId !== "string" ||
    typeof occurredAt !== "string"
  ) {
    return null;
  }
  const evidence = Array.isArray(fields.evidence)
    ? (fields.evidence as unknown[]).filter(
        (entry): entry is string => typeof entry === "string"
      )
    : [];

  const row: OverrideRow = {
    id: transitionId,
    reviewId,
    templateRevisionId, // opaque — passed through, never parsed
    action: action as OverrideAction,
    reviewedPercent: optionalNumber(fields.reviewedPercent),
    reviewedStage: optionalNumber(fields.reviewedStage),
    explanation: optionalString(fields.explanation),
    evidence: JSON.stringify(evidence),
    priorTransitionId: optionalString(fields.priorTransitionId),
    actorId: event.actorId,
    occurredAt,
  };
  // The codec enforces the stored invariants (reviewed value present and in
  // range on create/supersede, absent on revoke) — a violating event is
  // skipped, never silently misread.
  try {
    overrideTransitionFromRow(row);
  } catch {
    return null;
  }
  return row;
}

/**
 * Handles pulled `review_maturity_override` events (maturity-score/REQ-016;
 * local-first/REQ-011; AC-018).
 *
 * entityId is "review_maturity_override:<review>/<transitionId>". The
 * transition stream is append-only: rows insert with ON CONFLICT DO NOTHING
 * keyed by the stable transition ID, so a replayed event can never duplicate
 * history, and the effective override resolves on read as the latest
 * non-revoked transition — never a mutable pointer.
 */
export const ReviewMaturityOverrideHandler: InboundHandler = {
  entityTypes: ["review_maturity_override"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") return;

    const parsed = parseTypedReviewChildEntityId(
      "review_maturity_override",
      event.entityId
    );
    const transitionId = parsed?.unitSegments[0];
    if (!parsed || !transitionId) return;

    const row = buildOverrideRow(
      parsed.reviewId,
      transitionId,
      toFieldMap(event.fields),
      event
    );
    if (!row) return;

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewMaturityOverrides)
          .values(row)
          .onConflictDoNothing();
        await tryUpsertFieldVersions(tx, event, "ReviewMaturityOverride");
      },
      event: toReplayEvent(event, "ReviewMaturityOverrideSynced.v1", {
        reviewId: parsed.reviewId,
      }),
    });
  },
};
