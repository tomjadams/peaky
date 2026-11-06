/**
 * Client-side handoff write path (improvement-plans/REQ-006 through
 * REQ-008, REQ-011; local-first/REQ-011, REQ-012).
 *
 * The outbound half of the handoff sync contract, following the group-9
 * `overrideWrite` pattern: every mutation runs the pure domain operation
 * first (a violation writes nothing — no partial state, no outbox row),
 * then applies the local SQLite write and the typed outbox enqueue in one
 * atomic draft mutation. The server re-validates limits and re-authorizes
 * every write at the sync boundary.
 *
 * Practice rows move by ordinary field-level HLC, so outbox entries carry
 * only the changed fields; the association stream is append-only, so a
 * confirmation or replacement enqueues the full transition field set.
 * Confirmation and replacement claim shared uniqueness, so both assert the
 * degraded-sync gate before planning any transition (design Decision 6).
 *
 * I/O module: talks to the local database through localMutation only.
 */
// Formal model: formal_verification/handoff/single_active_handoff_lifecycle.fizz
import {
  reviewHandoffAssociations,
  reviewHandoffPractices,
} from "#shared/db/schema";
import {
  localMutation,
  type FieldValue,
  type MutationTransaction,
  type OutboxEntry,
} from "~/services/local-mutation";
import { getHLCClock } from "~/services/sync/syncClock";
import { handoffAssociationEntityId } from "~/services/sync/inbound/reviewChildIds";
import {
  appendAssociationTransition,
  type AssociationTransition,
} from "./association";
import {
  confirmHandoff,
  type ConfirmHandoffInput,
  type ConfirmHandoffResult,
} from "./confirmation";
import {
  removePractice,
  reorderPractice,
  selectPractice,
  setRationale,
  type HandoffPracticeRecord,
  type SelectPracticeInput,
} from "./draft";
import { practiceEntityId, type PracticeReference } from "./practice";
import {
  ensureLocalHandoffForSelection,
  planLocalHandoffSelection,
} from "./localLifecycle";
import {
  associationTransitionToRow,
  handoffPracticeToRow,
} from "./persistence";
import { assertConfirmationAvailable, type HandoffSyncGate } from "./syncGate";

/** Mutable practice-row fields, in push-contract order. */
const PRACTICE_FIELD_ORDER = [
  "orderKey",
  "snapshot",
  "rationale",
  "selectionState",
  "occurredAt",
] as const;
type PracticeFieldName = (typeof PRACTICE_FIELD_ORDER)[number];

function practiceFieldValue(
  record: HandoffPracticeRecord,
  name: PracticeFieldName
): unknown {
  // The snapshot travels as a structured value so the server validates its
  // bounded collections; the local row stores it as JSON text.
  return name === "snapshot" ? record.snapshot : record[name];
}

function practiceOutbox(
  record: HandoffPracticeRecord,
  changed: readonly PracticeFieldName[]
): OutboxEntry {
  const hlc = getHLCClock();
  const fields: FieldValue[] = changed.map((name) => ({
    name,
    value: practiceFieldValue(record, name),
    hlc: hlc.now(),
  }));
  return {
    entityType: "review_handoff_practice",
    entityId: record.id,
    operation: "upsert",
    fields,
  };
}

/** Upserts one practice row (select/deselect restore, rationale, reorder). */
async function upsertPracticeRow(
  tx: MutationTransaction,
  record: HandoffPracticeRecord,
  options?: { readonly claimLocalOwnership?: boolean }
): Promise<void> {
  const row = handoffPracticeToRow(record);
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
        ...(options?.claimLocalOwnership
          ? { localHandoffId: row.localHandoffId }
          : {}),
        actorId: row.actorId,
        updatedAt: row.updatedAt,
      },
    });
}

/**
 * Finds the rows whose mutable fields changed between two revisions of the
 * draft. Identity is the deterministic row id; removed-then-reselected rows
 * surface through their selection state.
 */
function changedRows(
  before: readonly HandoffPracticeRecord[],
  after: readonly HandoffPracticeRecord[]
): { record: HandoffPracticeRecord; changed: PracticeFieldName[] }[] {
  const priorById = new Map(before.map((row) => [row.id, row] as const));
  const changed: {
    record: HandoffPracticeRecord;
    changed: PracticeFieldName[];
  }[] = [];
  for (const record of after) {
    const prior = priorById.get(record.id);
    if (!prior) {
      changed.push({ record, changed: [...PRACTICE_FIELD_ORDER] });
      continue;
    }
    const fields = PRACTICE_FIELD_ORDER.filter((name) => {
      if (name === "snapshot") return false; // snapshots are immutable
      return prior[name] !== record[name];
    });
    if (fields.length > 0) changed.push({ record, changed: fields });
  }
  return changed;
}

/** Writes one changed practice row and enqueues its changed fields. */
async function writePracticeChange(
  before: readonly HandoffPracticeRecord[],
  after: readonly HandoffPracticeRecord[]
): Promise<void> {
  const changed = changedRows(before, after);
  if (changed.length === 0) return;
  if (changed.length === 1) {
    const { record, changed: fields } = changed[0]!;
    await localMutation.draft({
      stateWrite: (tx) => upsertPracticeRow(tx, record),
      outbox: practiceOutbox(record, fields),
    });
    return;
  }
  // Reorder touches several rows; the batch keeps the gesture atomic.
  await localMutation.draftBatch({
    stateWrite: async (tx) => {
      for (const { record } of changed) {
        await upsertPracticeRow(tx, record);
      }
    },
    outbox: changed.map(({ record, changed: fields }) =>
      practiceOutbox(record, fields)
    ),
  });
}

/**
 * Selects a projected practice into the active local handoff, creating the
 * next sequence with the practice write when none is active. Local ownership
 * never enters the synchronized field list.
 */
export async function selectHandoffPractice(
  input: SelectPracticeInput
): Promise<HandoffPracticeRecord[]> {
  const validated = selectPractice(input);
  const practiceId = practiceEntityId(input.practice.reference);
  const existingSelected = input.existing.find(
    (row) => row.id === practiceId && row.selectionState === "selected"
  );
  if (existingSelected?.localHandoffId) return validated;
  const plan = await planLocalHandoffSelection({
    reviewId: input.practice.reference.reviewId,
    practiceEntityId: practiceId,
    createdAt: input.occurredAt,
    createdBy: input.actorId,
  });
  const existingTarget = input.existing.find((row) => row.id === practiceId);
  const existingWithOwner = input.existing.map((row) =>
    row.id === practiceId ? { ...row, localHandoffId: plan.handoff.id } : row
  );
  const next = selectPractice({
    ...input,
    existing: existingWithOwner,
    localHandoffId: plan.handoff.id,
  });
  const selected = next.find((row) => row.id === practiceId);
  if (!selected) return next;

  const practiceChange = changedRows(input.existing, next).find(
    ({ record }) => record.id === practiceId
  );
  const ownershipChanged = existingTarget?.localHandoffId !== plan.handoff.id;
  if (!practiceChange && !ownershipChanged) return next;

  const stateWrite = async (tx: MutationTransaction) => {
    await ensureLocalHandoffForSelection(tx, plan);
    await upsertPracticeRow(tx, selected, { claimLocalOwnership: true });
  };
  if (!practiceChange) {
    await localMutation.localOnly({ stateWrite });
    return next;
  }
  await localMutation.draft({
    stateWrite,
    outbox: practiceOutbox(selected, practiceChange.changed),
  });
  return next;
}

/** Marks a selected practice removed; the row and its context survive. */
export async function deselectHandoffPractice(input: {
  readonly rows: readonly HandoffPracticeRecord[];
  readonly entityId: string;
  readonly updatedAt: string;
}): Promise<HandoffPracticeRecord[]> {
  const next = removePractice(input.rows, input.entityId, input.updatedAt);
  await writePracticeChange(input.rows, next);
  return next;
}

export async function clearHandoffPractices(input: {
  readonly rows: readonly HandoffPracticeRecord[];
  readonly updatedAt: string;
}): Promise<HandoffPracticeRecord[]> {
  const next = input.rows.map((row) =>
    row.selectionState === "selected"
      ? {
          ...row,
          selectionState: "removed" as const,
          updatedAt: input.updatedAt,
        }
      : row
  );
  await writePracticeChange(input.rows, next);
  return next;
}

/**
 * Edits a selected practice's rationale. Over-limit input is rejected
 * atomically — never truncated (improvement-plans/AC-039).
 */
export async function setHandoffPracticeRationale(input: {
  readonly rows: readonly HandoffPracticeRecord[];
  readonly entityId: string;
  readonly rationale: string;
  readonly updatedAt: string;
}): Promise<HandoffPracticeRecord[]> {
  const next = setRationale(
    input.rows,
    input.entityId,
    input.rationale,
    input.updatedAt
  );
  await writePracticeChange(input.rows, next);
  return next;
}

/** Moves a selected practice to a new 0-based position in the draft. */
export async function reorderHandoffPractice(input: {
  readonly rows: readonly HandoffPracticeRecord[];
  readonly entityId: string;
  readonly toIndex: number;
  readonly updatedAt: string;
}): Promise<HandoffPracticeRecord[]> {
  const next = reorderPractice(
    input.rows,
    input.entityId,
    input.toIndex,
    input.updatedAt
  );
  await writePracticeChange(input.rows, next);
  return next;
}

function associationOutbox(transition: AssociationTransition): OutboxEntry {
  const hlc = getHLCClock();
  const fields: FieldValue[] = [
    {
      name: "practiceEntityId",
      value: practiceEntityId(transition.practice),
      hlc: hlc.now(),
    },
    { name: "action", value: transition.action, hlc: hlc.now() },
    {
      name: "priorTransitionId",
      value: transition.priorTransitionId,
      hlc: hlc.now(),
    },
    {
      name: "provider",
      value: transition.reference?.provider ?? null,
      hlc: hlc.now(),
    },
    {
      name: "externalId",
      value: transition.reference?.externalId ?? null,
      hlc: hlc.now(),
    },
    { name: "url", value: transition.reference?.url ?? null, hlc: hlc.now() },
    { name: "occurredAt", value: transition.occurredAt, hlc: hlc.now() },
  ];
  return {
    entityType: "review_handoff_association",
    entityId: handoffAssociationEntityId(transition.reviewId, transition.id),
    operation: "upsert",
    fields,
  };
}

async function insertAssociationRow(
  tx: MutationTransaction,
  transition: AssociationTransition
): Promise<void> {
  // Append-only: transitions insert and never update; a stable transition
  // ID replayed locally cannot duplicate history.
  await tx
    .insert(reviewHandoffAssociations)
    .values(associationTransitionToRow(transition))
    .onConflictDoNothing();
}

export interface ConfirmHandoffAssociationInput extends Omit<
  ConfirmHandoffInput,
  "practices" | "history"
> {
  /** Selected practice identities, in draft order. */
  readonly practices: readonly PracticeReference[];
  readonly history: readonly AssociationTransition[];
  /** Degraded-sync gate; confirmation requires a current shared view. */
  readonly gate: HandoffSyncGate;
}

/**
 * Confirms the whole handoff against one existing external work item.
 * Returns the domain result unchanged: on conflicts or limit violations no
 * transition is planned and nothing is written (AC-031, AC-039). On success
 * every associate transition is inserted and enqueued in one atomic batch.
 */
export async function confirmHandoffAssociation(
  input: ConfirmHandoffAssociationInput
): Promise<ConfirmHandoffResult> {
  assertConfirmationAvailable(input.gate);
  const result = confirmHandoff(input);
  if (!result.ok) return result;

  const transitions = result.transitions;
  await localMutation.draftBatch({
    stateWrite: async (tx) => {
      for (const transition of transitions) {
        await insertAssociationRow(tx, transition);
      }
    },
    outbox: transitions.map(associationOutbox),
  });
  return result;
}

/**
 * Appends one association transition (replace or revoke) against the local
 * stream. Throws AssociationTransitionError or HandoffLimitError before any
 * write when the transition is invalid; prior transitions stay immutable
 * history (AC-032).
 */
export async function replaceHandoffAssociation(input: {
  readonly history: readonly AssociationTransition[];
  readonly transition: AssociationTransition;
  readonly gate: HandoffSyncGate;
}): Promise<AssociationTransition[]> {
  assertConfirmationAvailable(input.gate);
  const next = appendAssociationTransition(input.history, input.transition);
  await localMutation.draft({
    stateWrite: (tx) => insertAssociationRow(tx, input.transition),
    outbox: associationOutbox(input.transition),
  });
  return next;
}
