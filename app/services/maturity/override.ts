/**
 * Append-only Advisor override history (maturity-score/REQ-016; AC-030,
 * AC-031, AC-043).
 *
 * A maturity override is a user-authored decision, stored as an append-only
 * stream of transitions keyed by Review and `templateRevisionId`. A
 * superseding or revoking transition points at the prior one; the effective
 * override is the latest authorized non-revoked transition. Prior transitions
 * and their actors are immutable history — the stream is never mutated or
 * deleted, and the current value is always resolved on read from the stream,
 * never stored as a mutable pointer.
 *
 * Resolution is deterministic for every consumer: transitions order by
 * (occurredAt, id), so concurrent appends from different clients converge on
 * the same current value (AC-031). `templateRevisionId` is an opaque string,
 * compared exactly and never parsed. Override data never enters the
 * calculation input, so recording or editing an override cannot alter the
 * calculation trace.
 *
 * Authorization (any current Advisor may create, supersede, or revoke) is
 * enforced at the server boundary — see authorization/REQ-008. This module
 * models the stream itself.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { MaturityStageNumber } from "./stages";

export const OVERRIDE_ACTIONS = ["create", "supersede", "revoke"] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

/** The reviewed value an Advisor assigns; independent of the pinned thresholds. */
export interface OverrideReviewedResult {
  /** Whole percent 0–100. */
  readonly percent: number;
  readonly stage: MaturityStageNumber;
}

/**
 * One immutable override transition. `reviewedResult`, `explanation`, and
 * `evidence` carry the provenance AC-030 requires alongside the calculated
 * result; `priorTransitionId` links a superseding or revoking transition to
 * the transition it replaces.
 */
export interface OverrideTransition {
  readonly id: string;
  readonly reviewId: string;
  /** Opaque identifier — compared exactly, never parsed (AC-009). */
  readonly templateRevisionId: string;
  readonly action: OverrideAction;
  readonly actorId: string;
  /** RFC3339 timestamp of the transition. */
  readonly occurredAt: string;
  /** The transition this one replaces; null on create. */
  readonly priorTransitionId: string | null;
  /** Present on create/supersede; null on revoke. */
  readonly reviewedResult: OverrideReviewedResult | null;
  readonly explanation: string | null;
  /** Evidence identifiers; at least one on create/supersede. */
  readonly evidence: readonly string[];
}

export type OverrideTransitionErrorCode =
  | "invalid_action"
  | "invalid_reviewed_result"
  | "missing_reviewed_result"
  | "unexpected_reviewed_result"
  | "missing_explanation"
  | "missing_evidence"
  | "unexpected_prior_transition"
  | "create_requires_no_current_override"
  | "transition_requires_current_override"
  | "stale_prior_transition";

export class OverrideTransitionError extends Error {
  readonly code: OverrideTransitionErrorCode;

  constructor(code: OverrideTransitionErrorCode, message: string) {
    super(message);
    this.name = "OverrideTransitionError";
    this.code = code;
  }
}

function isValidReviewedResult(value: OverrideReviewedResult): boolean {
  return (
    Number.isInteger(value.percent) &&
    value.percent >= 0 &&
    value.percent <= 100 &&
    Number.isInteger(value.stage) &&
    value.stage >= 1 &&
    value.stage <= 5
  );
}

function assertCarriesReviewedValue(transition: OverrideTransition): void {
  if (transition.reviewedResult === null) {
    throw new OverrideTransitionError(
      "missing_reviewed_result",
      `Override transition ${transition.id} (${transition.action}) must carry a reviewed result.`
    );
  }
  if (!isValidReviewedResult(transition.reviewedResult)) {
    throw new OverrideTransitionError(
      "invalid_reviewed_result",
      `Override transition ${transition.id} carries an out-of-range reviewed result.`
    );
  }
  if (transition.evidence.length === 0) {
    throw new OverrideTransitionError(
      "missing_evidence",
      `Override transition ${transition.id} (${transition.action}) must name at least one evidence identifier.`
    );
  }
}

/**
 * Validates a transition against the current effective override for its
 * (Review, Revision) scope. Throws OverrideTransitionError on any violation;
 * a valid transition is safe to append to the stream.
 */
export function validateOverrideTransition(
  transition: OverrideTransition,
  current: OverrideTransition | null
): void {
  if (!OVERRIDE_ACTIONS.includes(transition.action)) {
    throw new OverrideTransitionError(
      "invalid_action",
      `Unknown override action ${JSON.stringify(transition.action)}.`
    );
  }
  if (!transition.explanation || transition.explanation.trim() === "") {
    throw new OverrideTransitionError(
      "missing_explanation",
      `Override transition ${transition.id} must carry an explanation.`
    );
  }

  if (transition.action === "create") {
    if (transition.priorTransitionId !== null) {
      throw new OverrideTransitionError(
        "unexpected_prior_transition",
        "A create transition points at no prior transition."
      );
    }
    if (current !== null) {
      throw new OverrideTransitionError(
        "create_requires_no_current_override",
        "A current override exists; supersede or revoke it instead."
      );
    }
    assertCarriesReviewedValue(transition);
    return;
  }

  // supersede | revoke — both replace the current effective override.
  if (current === null) {
    throw new OverrideTransitionError(
      "transition_requires_current_override",
      `Cannot ${transition.action}: no current override exists.`
    );
  }
  if (transition.priorTransitionId !== current.id) {
    throw new OverrideTransitionError(
      "stale_prior_transition",
      `A ${transition.action} transition must point at the current override ${current.id}.`
    );
  }
  if (transition.action === "revoke") {
    if (transition.reviewedResult !== null) {
      throw new OverrideTransitionError(
        "unexpected_reviewed_result",
        "A revoke transition carries no reviewed result."
      );
    }
    return;
  }
  assertCarriesReviewedValue(transition);
}

function compareStreamOrder(
  left: OverrideTransition,
  right: OverrideTransition
): number {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt < right.occurredAt ? -1 : 1;
  }
  // Concurrent appends converge deterministically by transition id.
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Returns the transition stream for one (Review, Revision) scope in
 * deterministic stream order. Ids are compared exactly — a prefix-colliding
 * `templateRevisionId` never leaks into the scope.
 */
export function overrideHistoryForRevision(
  history: readonly OverrideTransition[],
  reviewId: string,
  templateRevisionId: string
): OverrideTransition[] {
  return history
    .filter(
      (transition) =>
        transition.reviewId === reviewId &&
        transition.templateRevisionId === templateRevisionId
    )
    .toSorted(compareStreamOrder);
}

/**
 * Resolves the effective override: the latest authorized non-revoked
 * transition. Returns null when the stream is empty or its latest transition
 * is a revocation. Every consumer resolves the same value from the same
 * history (AC-031).
 */
export function resolveEffectiveOverride(
  history: readonly OverrideTransition[],
  reviewId: string,
  templateRevisionId: string
): OverrideTransition | null {
  const scoped = overrideHistoryForRevision(
    history,
    reviewId,
    templateRevisionId
  );
  const latest = scoped.at(-1);
  if (!latest || latest.action === "revoke") {
    return null;
  }
  return latest;
}

/**
 * Validates a transition against the current effective override and returns
 * a new history with it appended. The input array is never mutated
 * (copy-on-write); prior transitions stay immutable (AC-043).
 */
export function appendOverrideTransition(
  history: readonly OverrideTransition[],
  transition: OverrideTransition
): OverrideTransition[] {
  const current = resolveEffectiveOverride(
    history,
    transition.reviewId,
    transition.templateRevisionId
  );
  validateOverrideTransition(transition, current);
  return [...history, transition];
}
