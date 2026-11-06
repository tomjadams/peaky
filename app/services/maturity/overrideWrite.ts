/**
 * Client-side Advisor override write path (maturity-score/REQ-016; AC-030,
 * AC-031, AC-043; local-first/REQ-011).
 *
 * Validates the transition against the local append-only stream, inserts the
 * immutable row, and enqueues the typed `review_maturity_override` outbox
 * entry in one atomic draft mutation (state + outbox + push trigger). The
 * field names mirror the server push contract proven in group 6; the server
 * re-authorizes every transition at the boundary.
 *
 * I/O module: talks to the local database through localMutation only.
 */
import { reviewMaturityOverrides } from "#shared/db/schema";
import { localMutation } from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import { maturityOverrideEntityId } from "~/services/sync/inbound/reviewChildIds";
import { appendOverrideTransition, type OverrideTransition } from "./override";
import { overrideTransitionToRow } from "./overridePersistence";

export interface RecordMaturityOverrideInput {
  /**
   * The local append-only stream; the transition is validated against the
   * current effective override resolved from it (create requires none,
   * supersede/revoke must point at the current one).
   */
  readonly history: readonly OverrideTransition[];
  readonly transition: OverrideTransition;
}

/**
 * Appends one override transition locally and enqueues it for sync. Throws
 * OverrideTransitionError before any write when the transition is invalid.
 */
export async function recordMaturityOverride(
  input: RecordMaturityOverrideInput
): Promise<void> {
  const { history, transition } = input;
  // Pure validation against the resolved current override — a violation
  // writes nothing (no partial state, no outbox row).
  appendOverrideTransition(history, transition);

  const clock = getHLCClock();
  const hlc = () => clock.now();
  const row = overrideTransitionToRow(transition);

  await localMutation.draft({
    stateWrite: async (tx) => {
      // Append-only: rows insert and never update.
      await tx.insert(reviewMaturityOverrides).values(row);
    },
    outbox: {
      entityType: "review_maturity_override",
      entityId: maturityOverrideEntityId(transition.reviewId, transition.id),
      operation: "upsert",
      fields: [
        { name: "action", value: transition.action, hlc: hlc() },
        {
          name: "templateRevisionId",
          value: transition.templateRevisionId,
          hlc: hlc(),
        },
        {
          name: "reviewedPercent",
          value: transition.reviewedResult?.percent ?? null,
          hlc: hlc(),
        },
        {
          name: "reviewedStage",
          value: transition.reviewedResult?.stage ?? null,
          hlc: hlc(),
        },
        { name: "explanation", value: transition.explanation, hlc: hlc() },
        { name: "evidence", value: [...transition.evidence], hlc: hlc() },
        {
          name: "priorTransitionId",
          value: transition.priorTransitionId,
          hlc: hlc(),
        },
        // The inbound handler requires occurredAt — omitting it silently
        // skips the transition on replay (merge-check finding).
        { name: "occurredAt", value: transition.occurredAt, hlc: hlc() },
      ],
    },
  });
}
