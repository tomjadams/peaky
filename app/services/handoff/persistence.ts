/**
 * Row codecs for the handoff tables (improvement-plans/REQ-006, REQ-007).
 *
 * Maps between SQLite/PostgreSQL rows (snake_case, JSON text) and the
 * domain models. `review_handoff_practices` rows are ordinary upserted
 * state (order key, rationale, selection state move by field-level HLC);
 * `review_handoff_associations` rows are append-only and are inserted and
 * read, never updated, so there is no update codec.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import {
  practiceEntityId,
  practiceReferenceFromEntityId,
  type PracticeReference,
} from "./practice";
import type { HandoffPracticeRecord, PracticeSnapshot } from "./draft";
import {
  ASSOCIATION_ACTIONS,
  type AssociationTransition,
  type ExternalWorkItemReference,
} from "./association";

export class HandoffRowDecodeError extends Error {
  readonly code = "handoff_row_decode_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "HandoffRowDecodeError";
  }
}

// ─── review_handoff_practices ───────────────────────────────

/** Structural row shape satisfied by the Drizzle reviewHandoffPractices row. */
export interface HandoffPracticeRowShape {
  readonly id: string;
  readonly reviewId: string;
  readonly templateRevisionId: string;
  readonly questionId: string;
  readonly practiceId: string;
  readonly orderKey: string;
  readonly snapshot: string;
  readonly rationale: string | null;
  readonly selectionState: string;
  readonly localHandoffId: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly updatedAt: string;
}

/** Decodes the stored snapshot JSON; throws on any structural violation. */
export function decodePracticeSnapshot(raw: string): PracticeSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HandoffRowDecodeError("Practice snapshot is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HandoffRowDecodeError("Practice snapshot is not an object.");
  }
  const snapshot = parsed as Record<string, unknown>;
  if (
    typeof snapshot.title !== "string" ||
    typeof snapshot.questionText !== "string" ||
    typeof snapshot.pillarName !== "string" ||
    typeof snapshot.templateName !== "string" ||
    (snapshot.evidenceState !== "met" && snapshot.evidenceState !== "unmet") ||
    !Array.isArray(snapshot.leadingPractices) ||
    !Array.isArray(snapshot.helpfulLinks) ||
    !Array.isArray(snapshot.evidenceIdentifiers)
  ) {
    throw new HandoffRowDecodeError(
      "Practice snapshot is missing required fields."
    );
  }
  return snapshot as unknown as PracticeSnapshot;
}

/** Serializes a practice snapshot as JSON text. */
export function encodePracticeSnapshot(snapshot: PracticeSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Maps a stored row to the domain record. The stored identity tuple must
 * derive the row's deterministic ID; a mismatch means a corrupt row and is
 * never silently misread.
 */
export function handoffPracticeFromRow(
  row: HandoffPracticeRowShape
): HandoffPracticeRecord {
  const reference: PracticeReference = {
    reviewId: row.reviewId,
    templateRevisionId: row.templateRevisionId,
    questionId: row.questionId,
    practiceId: row.practiceId,
  };
  if (practiceEntityId(reference) !== row.id) {
    throw new HandoffRowDecodeError(
      `Practice row ${row.id} does not match its identity tuple.`
    );
  }
  if (row.selectionState !== "selected" && row.selectionState !== "removed") {
    throw new HandoffRowDecodeError(
      `Practice row ${row.id} has unknown selection state.`
    );
  }
  return {
    id: row.id,
    reference,
    orderKey: row.orderKey,
    snapshot: decodePracticeSnapshot(row.snapshot),
    rationale: row.rationale,
    selectionState: row.selectionState,
    localHandoffId: row.localHandoffId,
    actorId: row.actorId,
    occurredAt: row.occurredAt,
    updatedAt: row.updatedAt,
  };
}

/** Upsert shape for one practice row (field-level HLC writes). */
export function handoffPracticeToRow(record: HandoffPracticeRecord): {
  id: string;
  reviewId: string;
  templateRevisionId: string;
  questionId: string;
  practiceId: string;
  orderKey: string;
  snapshot: string;
  rationale: string | null;
  selectionState: HandoffPracticeRecord["selectionState"];
  localHandoffId: string | null;
  actorId: string;
  occurredAt: string;
  updatedAt: string;
} {
  return {
    id: record.id,
    reviewId: record.reference.reviewId,
    templateRevisionId: record.reference.templateRevisionId,
    questionId: record.reference.questionId,
    practiceId: record.reference.practiceId,
    orderKey: record.orderKey,
    snapshot: encodePracticeSnapshot(record.snapshot),
    rationale: record.rationale,
    selectionState: record.selectionState,
    localHandoffId: record.localHandoffId,
    actorId: record.actorId,
    occurredAt: record.occurredAt,
    updatedAt: record.updatedAt,
  };
}

// ─── review_handoff_associations ────────────────────────────

/** Structural row shape satisfied by the reviewHandoffAssociations row. */
export interface HandoffAssociationRowShape {
  readonly id: string;
  readonly reviewId: string;
  readonly practiceEntityId: string;
  readonly action: string;
  readonly provider: string | null;
  readonly externalId: string | null;
  readonly url: string | null;
  readonly priorTransitionId: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
}

/**
 * Maps a stored row to the domain transition. The practice tuple is
 * recovered from the deterministic entity ID; rows that violate the stored
 * invariants the CHECK constraints enforce are never silently misread.
 */
export function associationTransitionFromRow(
  row: HandoffAssociationRowShape
): AssociationTransition {
  if (!ASSOCIATION_ACTIONS.includes(row.action as never)) {
    throw new HandoffRowDecodeError(
      `Association row ${row.id} has unknown action ${JSON.stringify(row.action)}.`
    );
  }
  const action = row.action as AssociationTransition["action"];
  const carried: (string | null)[] = [row.provider, row.externalId, row.url];
  if (action === "revoke" && carried.some((value) => value !== null)) {
    throw new HandoffRowDecodeError(
      `Association row ${row.id} (revoke) carries a reference.`
    );
  }
  if (action !== "revoke" && carried.some((value) => value === null)) {
    throw new HandoffRowDecodeError(
      `Association row ${row.id} (${action}) is missing its reference.`
    );
  }
  let practice: PracticeReference;
  try {
    practice = practiceReferenceFromEntityId(row.practiceEntityId);
  } catch {
    throw new HandoffRowDecodeError(
      `Association row ${row.id} carries a malformed practice entity ID.`
    );
  }
  const reference: ExternalWorkItemReference | null =
    action === "revoke"
      ? null
      : { provider: row.provider!, externalId: row.externalId!, url: row.url! };
  return {
    id: row.id,
    reviewId: row.reviewId,
    practice,
    action,
    reference,
    priorTransitionId: row.priorTransitionId,
    actorId: row.actorId,
    occurredAt: row.occurredAt,
  };
}

/** Insert shape for one transition; the stream has no update path. */
export function associationTransitionToRow(transition: AssociationTransition): {
  id: string;
  reviewId: string;
  practiceEntityId: string;
  action: AssociationTransition["action"];
  provider: string | null;
  externalId: string | null;
  url: string | null;
  priorTransitionId: string | null;
  actorId: string;
  occurredAt: string;
} {
  return {
    id: transition.id,
    reviewId: transition.reviewId,
    practiceEntityId: practiceEntityId(transition.practice),
    action: transition.action,
    provider: transition.reference?.provider ?? null,
    externalId: transition.reference?.externalId ?? null,
    url: transition.reference?.url ?? null,
    priorTransitionId: transition.priorTransitionId,
    actorId: transition.actorId,
    occurredAt: transition.occurredAt,
  };
}
