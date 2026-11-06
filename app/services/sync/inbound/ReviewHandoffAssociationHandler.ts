import { reviewHandoffAssociations } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { practiceReferenceFromEntityId } from "~/services/handoff/practice";
import {
  ASSOCIATION_ACTIONS,
  type AssociationAction,
  type ExternalWorkItemReference,
} from "~/services/handoff/association";
import { associationTransitionFromRow } from "~/services/handoff/persistence";
import { parseTypedReviewChildEntityId } from "./reviewChildIds";
import { toFieldMap, toReplayEvent, tryUpsertFieldVersions } from "./helpers";
import type { InboundHandler, PulledEvent } from "./types";

type AssociationRow = typeof reviewHandoffAssociations.$inferSelect;

function associationReference(
  action: string,
  fields: Record<string, unknown>
): ExternalWorkItemReference | null | "invalid" {
  const { provider, externalId, url } = fields;
  const carriesReference = [provider, externalId, url].some(
    (value) => value !== null && value !== undefined
  );
  // A revoke transition carries no reference — one that does violates the
  // stored invariant and is skipped rather than silently stripped.
  if (action === "revoke") return carriesReference ? "invalid" : null;
  if (
    typeof provider === "string" &&
    typeof externalId === "string" &&
    typeof url === "string"
  ) {
    return { provider, externalId, url };
  }
  return null;
}

/**
 * Builds the transition row for one pulled event, or null when the event is
 * malformed (unknown action, unparseable practice identity, missing fields)
 * or violates a stored invariant — such events are skipped so the pull
 * cursor still advances past them.
 */
function buildAssociationRow(
  reviewId: string,
  transitionId: string,
  fields: Record<string, unknown>,
  event: PulledEvent
): AssociationRow | null {
  const { action, practiceEntityId, occurredAt, priorTransitionId } = fields;
  if (
    typeof action !== "string" ||
    !ASSOCIATION_ACTIONS.includes(action as never) ||
    typeof practiceEntityId !== "string" ||
    typeof occurredAt !== "string"
  ) {
    return null;
  }
  try {
    practiceReferenceFromEntityId(practiceEntityId);
  } catch {
    return null;
  }
  const reference = associationReference(action, fields);
  if (reference === "invalid") return null;

  const row: AssociationRow = {
    id: transitionId,
    reviewId,
    practiceEntityId,
    action: action as AssociationAction,
    provider: reference?.provider ?? null,
    externalId: reference?.externalId ?? null,
    url: reference?.url ?? null,
    priorTransitionId:
      typeof priorTransitionId === "string" ? priorTransitionId : null,
    actorId: event.actorId,
    occurredAt,
  };
  // The codec enforces the remaining stored invariants (associate/replace
  // carry a complete reference) — a violating event is skipped, never
  // silently misread.
  try {
    associationTransitionFromRow(row);
  } catch {
    return null;
  }
  return row;
}

/**
 * Handles pulled `review_handoff_association` events (local-first/REQ-011;
 * AC-018).
 *
 * entityId is "review_handoff_association:<review>/<transitionId>". The
 * stream is append-only: transitions insert with ON CONFLICT DO NOTHING, so
 * a replayed stable transition ID can never duplicate history, and prior
 * transitions are never updated or deleted on inbound — the current
 * association resolves on read as the latest non-revoked transition.
 */
export const ReviewHandoffAssociationHandler: InboundHandler = {
  entityTypes: ["review_handoff_association"],

  async handle(event: PulledEvent): Promise<void> {
    if (event.operation === "delete") return;

    const parsed = parseTypedReviewChildEntityId(
      "review_handoff_association",
      event.entityId
    );
    const transitionId = parsed?.unitSegments[0];
    if (!parsed || !transitionId) return;

    const row = buildAssociationRow(
      parsed.reviewId,
      transitionId,
      toFieldMap(event.fields),
      event
    );
    if (!row) return;

    await localMutation.replay({
      stateWrite: async (tx) => {
        await tx
          .insert(reviewHandoffAssociations)
          .values(row)
          .onConflictDoNothing();
        await tryUpsertFieldVersions(tx, event, "ReviewHandoffAssociation");
      },
      event: toReplayEvent(event, "ReviewHandoffAssociationSynced.v1", {
        reviewId: parsed.reviewId,
      }),
    });
  },
};
