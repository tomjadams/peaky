/**
 * Atomic handoff confirmation (improvement-plans/REQ-007, REQ-008;
 * AC-028, AC-030, AC-031).
 *
 * Confirmation associates every selected practice with one existing
 * external work item, or identifies every conflict and associates none —
 * never partial success. Before confirming, current associations are
 * re-read for all selected practice identities; if any practice is already
 * associated, the whole confirmation is rejected and every conflicting
 * practice is identified with its current reference (AC-031).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database. The caller persists
 * the returned transitions atomically.
 */
import {
  resolveCurrentAssociation,
  type AssociationTransition,
  type ExternalWorkItemReference,
} from "./association";
import {
  validateExternalReference,
  validatePracticeCount,
  type HandoffLimitViolation,
} from "./limits";
import { practiceEntityId, type PracticeReference } from "./practice";

/** One conflicting practice and its current external reference (AC-031). */
export interface HandoffConfirmationConflict {
  readonly practice: PracticeReference;
  readonly current: ExternalWorkItemReference;
}

export interface ConfirmHandoffInput {
  /** Selected practice identities, in draft order. */
  readonly practices: readonly PracticeReference[];
  /** The full association history to validate against. */
  readonly history: readonly AssociationTransition[];
  /** The one existing work item every practice will reference. */
  readonly reference: ExternalWorkItemReference;
  readonly actorId: string;
  readonly occurredAt: string;
  /** Deterministic ID source for the planned transitions. */
  readonly transitionIdFor: (practiceEntityId: string) => string;
}

export type ConfirmHandoffResult =
  | {
      readonly ok: true;
      readonly transitions: readonly AssociationTransition[];
    }
  | { readonly ok: false; readonly code: "empty_selection" }
  | {
      readonly ok: false;
      readonly code: "duplicate_association";
      readonly conflicts: readonly HandoffConfirmationConflict[];
    }
  | {
      readonly ok: false;
      readonly code: "invalid_reference" | "practice_limit_exceeded";
      readonly violations: readonly HandoffLimitViolation[];
    };

/**
 * Validates a whole-handoff confirmation. On success returns one
 * `associate` transition per selected practice, all pointing at the same
 * external work item (AC-028, AC-030). On any conflict returns every
 * conflicting practice and no transitions (AC-031). HandoffLimits are
 * enforced before any transition is planned: an over-limit reference or a
 * selection beyond the 50-practice maximum rejects atomically with
 * field-addressable violations (AC-039, AC-042). The input history is never
 * mutated.
 */
export function confirmHandoff(
  input: ConfirmHandoffInput
): ConfirmHandoffResult {
  if (input.practices.length === 0) {
    return { ok: false, code: "empty_selection" };
  }

  const countViolations = validatePracticeCount(input.practices.length);
  if (countViolations.length > 0) {
    return {
      ok: false,
      code: "practice_limit_exceeded",
      violations: countViolations,
    };
  }

  const referenceViolations = validateExternalReference(input.reference);
  if (referenceViolations.length > 0) {
    return {
      ok: false,
      code: "invalid_reference",
      violations: referenceViolations,
    };
  }

  const conflicts: HandoffConfirmationConflict[] = [];
  for (const practice of input.practices) {
    const current = resolveCurrentAssociation(
      input.history,
      practiceEntityId(practice)
    );
    if (current?.reference) {
      conflicts.push({ practice, current: current.reference });
    }
  }
  if (conflicts.length > 0) {
    return { ok: false, code: "duplicate_association", conflicts };
  }

  const transitions: AssociationTransition[] = input.practices.map(
    (practice) => {
      const entityId = practiceEntityId(practice);
      return {
        id: input.transitionIdFor(entityId),
        reviewId: practice.reviewId,
        practice,
        action: "associate",
        reference: input.reference,
        priorTransitionId: null,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      };
    }
  );
  return { ok: true, transitions };
}
