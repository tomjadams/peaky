/**
 * Synchronized handoff draft domain (improvement-plans/REQ-005, REQ-006;
 * AC-015, AC-020, AC-021, AC-023, AC-025, AC-026, AC-027).
 *
 * The handoff draft is NOT an entity (design Decision 3): it is derived on
 * read from the set of selected `review_handoff_practice` rows. Each row
 * carries a deterministic entity ID, an order key, an immutable practice
 * snapshot captured at selection time, an optional rationale, and a
 * selection state. Removal marks a row removed — the row and its context
 * survive, so cancelling a preview never destroys the draft (AC-023) and
 * re-selection restores it. Rationale and order-key edits are ordinary
 * field-level HLC writes; selection converges through the deterministic
 * entity ID.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import { generateOrderKey } from "~/local-db";
import {
  assertWithinHandoffLimits,
  validateEvidenceIdentifiers,
  validateHelpfulLinks,
  validateRationale,
} from "./limits";
import {
  practiceEntityId,
  type PracticeEvidenceState,
  type PracticeReference,
} from "./practice";
import type { SelectablePractice } from "./projection";

export const HANDOFF_SELECTION_STATES = ["selected", "removed"] as const;
export type HandoffSelectionState = (typeof HANDOFF_SELECTION_STATES)[number];

/**
 * Immutable snapshot of the practice context captured at selection time
 * (AC-021). Bounded by HandoffLimits at the domain boundary
 * (improvement-plans/REQ-011).
 */
export interface PracticeSnapshot {
  /** Practice text at selection time. */
  readonly title: string;
  readonly questionText: string;
  readonly pillarName: string;
  readonly templateName: string;
  readonly revisionNumber: number | null;
  readonly evidenceState: PracticeEvidenceState;
  readonly leadingPractices: readonly string[];
  readonly helpfulLinks: readonly { title: string; url: string }[];
  /** Evidence identifiers carried with the handoff (bounded, REQ-011). */
  readonly evidenceIdentifiers: readonly string[];
}

/**
 * One `review_handoff_practice` row: order key, practice snapshot,
 * rationale, and selection state (design Decision 3).
 */
export interface HandoffPracticeRecord {
  /** Deterministic entity ID derived from the practice tuple. */
  readonly id: string;
  readonly reference: PracticeReference;
  readonly orderKey: string;
  readonly snapshot: PracticeSnapshot;
  readonly rationale: string | null;
  readonly selectionState: HandoffSelectionState;
  /** Device-local lifecycle owner. This field is never synchronized. */
  readonly localHandoffId: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly updatedAt: string;
}

/** One practice in the derived draft, with its 1-based position. */
export interface OrderedDraftPractice {
  readonly record: HandoffPracticeRecord;
  readonly position: number;
  readonly total: number;
}

/**
 * The derived handoff draft. An empty selection is an explicit state naming
 * the action that adds practices (AC-027), never an empty list. The label
 * is derived from the review and the selected-practice count (AC-026) —
 * there is no editable title (AC-025).
 */
export type HandoffDraft =
  | {
      readonly kind: "empty";
      readonly reviewId: string;
      /** Names the action that adds practices (AC-027). */
      readonly action: string;
    }
  | {
      readonly kind: "ready";
      readonly reviewId: string;
      readonly label: string;
      readonly practices: readonly OrderedDraftPractice[];
    };

/**
 * The derived, non-editable draft label: review plus selected-practice
 * count (AC-026). Never persisted as a title and never included in any
 * provider payload.
 */
export function handoffDraftLabel(
  reviewName: string,
  selectedCount: number
): string {
  const noun = selectedCount === 1 ? "practice" : "practices";
  return `${reviewName} — ${selectedCount} selected ${noun}`;
}

function selectedInOrder(
  rows: readonly HandoffPracticeRecord[]
): HandoffPracticeRecord[] {
  return rows
    .filter((row) => row.selectionState === "selected")
    .toSorted((left, right) =>
      left.orderKey < right.orderKey
        ? -1
        : left.orderKey > right.orderKey
          ? 1
          : 0
    );
}

/**
 * Derives the handoff draft from the practice rows of one Review. Pure:
 * the input rows are never mutated, so deriving (or previewing) a draft can
 * never delete it (AC-023).
 */
export function deriveHandoffDraft(
  rows: readonly HandoffPracticeRecord[],
  review: { reviewId: string; reviewName: string }
): HandoffDraft {
  const selected = selectedInOrder(rows);
  if (selected.length === 0) {
    return {
      kind: "empty",
      reviewId: review.reviewId,
      action: "Select practices from the improvement plan",
    };
  }
  return {
    kind: "ready",
    reviewId: review.reviewId,
    label: handoffDraftLabel(review.reviewName, selected.length),
    practices: selected.map((record, index) => ({
      record,
      position: index + 1,
      total: selected.length,
    })),
  };
}

/** Input for selecting a projected practice into the draft. */
export interface SelectPracticeInput {
  readonly existing: readonly HandoffPracticeRecord[];
  readonly practice: SelectablePractice;
  readonly rationale?: string | null;
  readonly evidenceIdentifiers?: readonly string[];
  /** Device-local owner assigned by the lifecycle-aware write path. */
  readonly localHandoffId?: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
}

/**
 * Selects a practice into the draft (AC-015: independently of its
 * siblings). Appends a new row with a deterministic entity ID, or flips a
 * previously removed row back to selected while keeping its snapshot and
 * rationale (AC-023). Copy-on-write: the input array is never mutated.
 */
export function selectPractice(
  input: SelectPracticeInput
): HandoffPracticeRecord[] {
  const { existing, practice, actorId, occurredAt } = input;
  // HandoffLimits at the domain boundary (REQ-011): snapshot collections
  // and the rationale are validated atomically before any row is written;
  // nothing is truncated or dropped.
  assertWithinHandoffLimits([
    ...validateHelpfulLinks(practice.helpfulLinks),
    ...validateEvidenceIdentifiers(input.evidenceIdentifiers ?? []),
    ...(input.rationale ? validateRationale(input.rationale) : []),
  ]);
  const id = practiceEntityId(practice.reference);
  const prior = existing.find((row) => row.id === id);
  if (prior) {
    if (prior.selectionState === "selected") return [...existing];
    return existing.map((row) =>
      row.id === id
        ? { ...row, selectionState: "selected" as const, updatedAt: occurredAt }
        : row
    );
  }
  const record: HandoffPracticeRecord = {
    id,
    reference: practice.reference,
    orderKey: generateOrderKey(selectedInOrder(existing).length + 1),
    snapshot: {
      title: practice.title,
      questionText: practice.questionText,
      pillarName: practice.pillarName,
      templateName: practice.templateName,
      revisionNumber: practice.revisionNumber,
      evidenceState: practice.evidence.state,
      leadingPractices: practice.leadingPractices,
      helpfulLinks: practice.helpfulLinks,
      evidenceIdentifiers: input.evidenceIdentifiers ?? [],
    },
    rationale: input.rationale ?? null,
    selectionState: "selected",
    localHandoffId: input.localHandoffId ?? null,
    actorId,
    occurredAt,
    updatedAt: occurredAt,
  };
  return [...existing, record];
}

/**
 * Removes a practice from the draft by marking its row removed. The row —
 * with its snapshot and rationale — is retained (AC-023).
 */
export function removePractice(
  rows: readonly HandoffPracticeRecord[],
  entityId: string,
  updatedAt = ""
): HandoffPracticeRecord[] {
  return rows.map((row) =>
    row.id === entityId && row.selectionState === "selected"
      ? { ...row, selectionState: "removed" as const, updatedAt }
      : row
  );
}

/**
 * Edits a selected practice's rationale in place (field-level HLC write).
 */
export function setRationale(
  rows: readonly HandoffPracticeRecord[],
  entityId: string,
  rationale: string,
  updatedAt = ""
): HandoffPracticeRecord[] {
  // Over-limit rationale is rejected atomically — never truncated (AC-039).
  assertWithinHandoffLimits(validateRationale(rationale));
  return rows.map((row) =>
    row.id === entityId ? { ...row, rationale, updatedAt } : row
  );
}

/**
 * Moves a selected practice to a new 0-based position within the draft and
 * reassigns order keys over the selected rows. Copy-on-write; unselected
 * rows keep their keys.
 */
export function reorderPractice(
  rows: readonly HandoffPracticeRecord[],
  entityId: string,
  toIndex: number,
  updatedAt = ""
): HandoffPracticeRecord[] {
  const selected = selectedInOrder(rows);
  const fromIndex = selected.findIndex((row) => row.id === entityId);
  if (fromIndex === -1) return [...rows];
  const clamped = Math.max(0, Math.min(toIndex, selected.length - 1));
  const reordered = [...selected];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(clamped, 0, moved!);
  const keyById = new Map(
    reordered.map((row, index) => [row.id, generateOrderKey(index + 1)])
  );
  return rows.map((row) => {
    const orderKey = keyById.get(row.id);
    return orderKey === undefined || orderKey === row.orderKey
      ? row
      : { ...row, orderKey, updatedAt };
  });
}
