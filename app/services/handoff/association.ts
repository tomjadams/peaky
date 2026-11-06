/**
 * Append-only handoff association stream (improvement-plans/REQ-007,
 * REQ-008, REQ-010; AC-028 through AC-033).
 *
 * `review_handoff_association` holds one row per association transition:
 * provider, external ID, HTTPS URL, and a pointer to the prior transition.
 * The current association is the latest non-revoked transition for a
 * practice, resolved on read — never a mutable pointer (design Decision 3).
 * Replacement appends a new transition and keeps the previous reference in
 * immutable history (AC-032). Concurrent clients append distinct
 * transitions and resolve the same latest transition, so no losing-value
 * recovery affordance is required.
 *
 * Peaky never owns provider content: the reference carries no
 * provider-observed status, and no transition ever triggers an outbound
 * provider message (AC-037).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import { assertWithinHandoffLimits, validateExternalReference } from "./limits";
import { practiceEntityId, type PracticeReference } from "./practice";

/**
 * External work-item reference carried by association transitions.
 * Provider-neutral: a provider name, the provider's external ticket ID, and
 * an HTTPS URL to the existing item. Peaky never edits the ticket
 * (AC-028) and stores no provider-observed status.
 */
export interface ExternalWorkItemReference {
  readonly provider: string;
  readonly externalId: string;
  readonly url: string;
}

export function externalWorkItemReferenceFromUrl(
  value: string
): ExternalWorkItemReference {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid work item URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("The work item URL must start with https://.");
  }

  const jiraMatch = url.pathname.match(/\/browse\/([^/]+)\/?$/i);
  const gitlabMatch = url.pathname.match(/\/(?:-\/)?issues\/([^/]+)\/?$/i);
  const pathId = url.pathname
    .split("/")
    .findLast((segment) => segment.length > 0);
  const encodedId = jiraMatch?.[1] ?? gitlabMatch?.[1] ?? pathId ?? "";
  let externalId: string;
  try {
    externalId = decodeURIComponent(encodedId);
  } catch {
    throw new Error("The work item URL contains an invalid ID.");
  }
  if (!externalId) {
    throw new Error("The work item URL must include its ID in the path.");
  }

  const hostname = url.hostname.toLowerCase();
  let provider = url.hostname;
  if (jiraMatch) provider = "Jira";
  else if (gitlabMatch || hostname.includes("gitlab")) provider = "GitLab";
  else if (hostname.includes("youtrack")) provider = "YouTrack";

  return { provider, externalId, url: url.toString() };
}

export const ASSOCIATION_ACTIONS = ["associate", "replace", "revoke"] as const;
export type AssociationAction = (typeof ASSOCIATION_ACTIONS)[number];

/**
 * One immutable association transition. `reference` is null on revoke;
 * `priorTransitionId` links a replacing or revoking transition to the
 * transition it supersedes.
 */
export interface AssociationTransition {
  readonly id: string;
  readonly reviewId: string;
  /** Practice identity tuple; the row entity scope is its deterministic ID. */
  readonly practice: PracticeReference;
  readonly action: AssociationAction;
  /** Present on associate/replace; null on revoke. */
  readonly reference: ExternalWorkItemReference | null;
  readonly priorTransitionId: string | null;
  readonly actorId: string;
  /** RFC3339 timestamp of the transition. */
  readonly occurredAt: string;
}

export type AssociationTransitionErrorCode =
  | "invalid_action"
  | "missing_reference"
  | "unexpected_reference"
  | "unexpected_prior_transition"
  | "associate_requires_no_current_association"
  | "transition_requires_current_association"
  | "stale_prior_transition";

export class AssociationTransitionError extends Error {
  readonly code: AssociationTransitionErrorCode;

  constructor(code: AssociationTransitionErrorCode, message: string) {
    super(message);
    this.name = "AssociationTransitionError";
    this.code = code;
  }
}

/**
 * Validates a transition against the current association for its practice.
 * Throws AssociationTransitionError on any violation; a valid transition is
 * safe to append to the stream.
 */
export function validateAssociationTransition(
  transition: AssociationTransition,
  current: AssociationTransition | null
): void {
  if (!ASSOCIATION_ACTIONS.includes(transition.action)) {
    throw new AssociationTransitionError(
      "invalid_action",
      `Unknown association action ${JSON.stringify(transition.action)}.`
    );
  }
  // HandoffLimits at the domain boundary (REQ-011; AC-039): the reference
  // is validated atomically — never truncated to fit.
  if (transition.reference !== null) {
    assertWithinHandoffLimits(validateExternalReference(transition.reference));
  }

  if (transition.action === "associate") {
    if (transition.priorTransitionId !== null) {
      throw new AssociationTransitionError(
        "unexpected_prior_transition",
        "An associate transition points at no prior transition."
      );
    }
    if (current !== null) {
      throw new AssociationTransitionError(
        "associate_requires_no_current_association",
        "A current association exists; replace or revoke it instead."
      );
    }
    if (transition.reference === null) {
      throw new AssociationTransitionError(
        "missing_reference",
        "An associate transition must carry the external work-item reference."
      );
    }
    return;
  }

  // replace | revoke — both supersede the current association.
  if (current === null) {
    throw new AssociationTransitionError(
      "transition_requires_current_association",
      `Cannot ${transition.action}: no current association exists.`
    );
  }
  if (transition.priorTransitionId !== current.id) {
    throw new AssociationTransitionError(
      "stale_prior_transition",
      `A ${transition.action} transition must point at the current association ${current.id}.`
    );
  }
  if (transition.action === "revoke") {
    if (transition.reference !== null) {
      throw new AssociationTransitionError(
        "unexpected_reference",
        "A revoke transition carries no reference."
      );
    }
    return;
  }
  if (transition.reference === null) {
    throw new AssociationTransitionError(
      "missing_reference",
      "A replace transition must carry the new external work-item reference."
    );
  }
}

function compareStreamOrder(
  left: AssociationTransition,
  right: AssociationTransition
): number {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt < right.occurredAt ? -1 : 1;
  }
  // Concurrent appends converge deterministically by transition id.
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/**
 * Returns the transition stream for one practice in deterministic stream
 * order. Scoping uses the deterministic entity ID, so exact tuple identity
 * (including an unparsed `templateRevisionId`) is preserved.
 */
export function associationHistoryForPractice(
  history: readonly AssociationTransition[],
  practiceEntity: string
): AssociationTransition[] {
  return history
    .filter(
      (transition) => practiceEntityId(transition.practice) === practiceEntity
    )
    .toSorted(compareStreamOrder);
}

/**
 * Resolves the current association: the latest non-revoked transition for
 * the practice. Returns null when the stream is empty or its latest
 * transition is a revocation. Every client resolves the same value from the
 * same history, so append-only streams need no conflict recovery.
 */
export function resolveCurrentAssociation(
  history: readonly AssociationTransition[],
  practiceEntity: string
): AssociationTransition | null {
  const scoped = associationHistoryForPractice(history, practiceEntity);
  const latest = scoped.at(-1);
  if (!latest || latest.action === "revoke") {
    return null;
  }
  return latest;
}

/**
 * Validates a transition against the current association and returns a new
 * history with it appended. The input array is never mutated
 * (copy-on-write); prior transitions stay immutable history (AC-032).
 */
export function appendAssociationTransition(
  history: readonly AssociationTransition[],
  transition: AssociationTransition
): AssociationTransition[] {
  const current = resolveCurrentAssociation(
    history,
    practiceEntityId(transition.practice)
  );
  validateAssociationTransition(transition, current);
  return [...history, transition];
}
