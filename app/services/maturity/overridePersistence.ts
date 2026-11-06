/**
 * Row codec for the append-only Advisor override stream
 * (maturity-score/REQ-016).
 *
 * Maps between `review_maturity_overrides` rows (snake_case, JSON evidence
 * text) and the domain OverrideTransition. The stream is append-only: rows
 * are inserted and read, never updated, so there is no update codec.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { OverrideTransition } from "./override";

export class OverrideRowDecodeError extends Error {
  readonly code = "override_row_decode_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "OverrideRowDecodeError";
  }
}

/** Structural row shape satisfied by the Drizzle reviewMaturityOverrides row. */
export interface OverrideRowShape {
  readonly id: string;
  readonly reviewId: string;
  readonly templateRevisionId: string;
  readonly action: string;
  readonly reviewedPercent: number | null;
  readonly reviewedStage: number | null;
  readonly explanation: string | null;
  readonly evidence: string | null;
  readonly priorTransitionId: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
}

/** Serializes evidence identifiers as a JSON array. */
export function serializeOverrideEvidence(evidence: readonly string[]): string {
  return JSON.stringify(evidence);
}

/** Decodes the stored evidence array; NULL/empty decodes to no evidence. */
export function decodeOverrideEvidence(raw: string | null): string[] {
  if (raw === null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OverrideRowDecodeError("Override evidence is not valid JSON.");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string")
  ) {
    throw new OverrideRowDecodeError(
      "Override evidence is not a string array."
    );
  }
  return parsed;
}

/**
 * Maps a stored row to the domain transition. Throws OverrideRowDecodeError
 * when the row violates the stored invariants the CHECK constraints enforce,
 * so a corrupt row can never be silently misread.
 */
export function overrideTransitionFromRow(
  row: OverrideRowShape
): OverrideTransition {
  const evidence = decodeOverrideEvidence(row.evidence);
  const base = {
    id: row.id,
    reviewId: row.reviewId,
    templateRevisionId: row.templateRevisionId,
    actorId: row.actorId,
    occurredAt: row.occurredAt,
    priorTransitionId: row.priorTransitionId,
    explanation: row.explanation,
    evidence,
  };
  if (row.action === "revoke") {
    return { ...base, action: "revoke", reviewedResult: null };
  }
  if (row.action === "create" || row.action === "supersede") {
    if (row.reviewedPercent === null || row.reviewedStage === null) {
      throw new OverrideRowDecodeError(
        `Override row ${row.id} (${row.action}) is missing its reviewed value.`
      );
    }
    const stage = row.reviewedStage;
    if (stage < 1 || stage > 5) {
      throw new OverrideRowDecodeError(
        `Override row ${row.id} carries an out-of-range reviewed stage.`
      );
    }
    return {
      ...base,
      action: row.action,
      reviewedResult: {
        percent: row.reviewedPercent,
        stage: stage as 1 | 2 | 3 | 4 | 5,
      },
    };
  }
  throw new OverrideRowDecodeError(
    `Override row ${row.id} has unknown action ${JSON.stringify(row.action)}.`
  );
}

/** Insert shape for one transition; the append-only stream has no update path. */
export function overrideTransitionToRow(transition: OverrideTransition): {
  id: string;
  reviewId: string;
  templateRevisionId: string;
  action: OverrideTransition["action"];
  reviewedPercent: number | null;
  reviewedStage: number | null;
  explanation: string | null;
  evidence: string;
  priorTransitionId: string | null;
  actorId: string;
  occurredAt: string;
} {
  return {
    id: transition.id,
    reviewId: transition.reviewId,
    templateRevisionId: transition.templateRevisionId,
    action: transition.action,
    reviewedPercent: transition.reviewedResult?.percent ?? null,
    reviewedStage: transition.reviewedResult?.stage ?? null,
    explanation: transition.explanation,
    evidence: serializeOverrideEvidence(transition.evidence),
    priorTransitionId: transition.priorTransitionId,
    actorId: transition.actorId,
    occurredAt: transition.occurredAt,
  };
}
