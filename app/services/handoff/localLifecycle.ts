/* oxlint-disable max-lines -- local lifecycle rules and atomic writes stay together */
// Formal model: formal_verification/handoff/single_active_handoff_lifecycle.fizz
import { and, eq, inArray } from "drizzle-orm";
import {
  localReviewHandoffs,
  reviewAnswerState,
  reviewHandoffPractices,
} from "#shared/db/schema";
import { withDatabase } from "~/local-db";
import {
  localMutation,
  type MutationTransaction,
} from "~/services/local-mutation";
import { isChecklistAnswer, isChecklistWithNAAnswer } from "~/models/question";
import type { HandoffPracticeRecord } from "./draft";
import { handoffPracticeFromRow } from "./persistence";

const LOCAL_HANDOFF_ID_PREFIX = "review_handoff:";

export const LOCAL_HANDOFF_STATUSES = ["active", "completed"] as const;
export type LocalHandoffStatus = (typeof LOCAL_HANDOFF_STATUSES)[number];

export const LOCAL_HANDOFF_COMPLETION_MODES = ["auto", "manual"] as const;
export type LocalHandoffCompletionMode =
  (typeof LOCAL_HANDOFF_COMPLETION_MODES)[number];

export interface LocalReviewHandoffRecord {
  readonly id: string;
  readonly reviewId: string;
  readonly sequence: number;
  readonly status: LocalHandoffStatus;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly completedAt: string | null;
  readonly completionMode: LocalHandoffCompletionMode | null;
  readonly completedBy: string | null;
  readonly note: string | null;
  /** Empty while active, then frozen from the current selection at completion. */
  readonly selectedPracticeIds: readonly string[];
  readonly unresolvedCount: number | null;
}

export interface LocalHandoffAnalytics {
  readonly id: string;
  readonly reviewId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly completedAt: string | null;
  readonly completionMode: LocalHandoffCompletionMode | null;
  readonly completedBy: string | null;
  readonly note: string | null;
  /** Wall-clock duration in milliseconds. */
  readonly durationMs: number | null;
  readonly unresolvedCount: number | null;
  readonly selectedPracticeIds: readonly string[];
}

export interface LocalHandoffRowShape {
  readonly id: string;
  readonly reviewId: string;
  readonly sequence: number;
  readonly status: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly completedAt: string | null;
  readonly completionMode: string | null;
  readonly completedBy: string | null;
  readonly note: string | null;
  readonly selectedPracticeIds: string;
  readonly unresolvedCount: number | null;
}

export type LocalHandoffLifecycleErrorCode =
  | "invalid_handoff_id"
  | "invalid_handoff_record"
  | "multiple_active_handoffs"
  | "practice_owned_by_completed_handoff"
  | "practice_owned_by_another_handoff"
  | "stale_handoff_selection";

export class LocalHandoffLifecycleError extends Error {
  constructor(
    readonly code: LocalHandoffLifecycleErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LocalHandoffLifecycleError";
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      `${field} must not be empty.`
    );
  }
}

function assertSequence(sequence: number): void {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      "Handoff sequence must be a positive integer."
    );
  }
}

function assertTimestamp(value: string, field: string): void {
  if (value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      `${field} must be a valid timestamp.`
    );
  }
}

/** Builds the deterministic device-local handoff ID. */
export function localHandoffId(reviewId: string, sequence: number): string {
  assertNonEmpty(reviewId, "reviewId");
  assertSequence(sequence);
  return `${LOCAL_HANDOFF_ID_PREFIX}${reviewId}/${sequence}`;
}

/** Decodes and validates a deterministic device-local handoff ID. */
export function localHandoffReferenceFromId(id: string): {
  reviewId: string;
  sequence: number;
} {
  if (!id.startsWith(LOCAL_HANDOFF_ID_PREFIX)) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_id",
      `Not a local handoff ID: ${id}`
    );
  }
  const body = id.slice(LOCAL_HANDOFF_ID_PREFIX.length);
  const separator = body.lastIndexOf("/");
  const reviewId = body.slice(0, separator);
  const rawSequence = body.slice(separator + 1);
  const sequence = Number(rawSequence);
  if (
    separator < 1 ||
    rawSequence === "" ||
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    localHandoffId(reviewId, sequence) !== id
  ) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_id",
      `Malformed local handoff ID: ${id}`
    );
  }
  return { reviewId, sequence };
}

function decodeSelectedPracticeIds(raw: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      "Selected practice IDs are not valid JSON."
    );
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(parsed).size !== parsed.length
  ) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      "Selected practice IDs must be a unique string array."
    );
  }
  return parsed as string[];
}

function activeCompletionFieldsAreEmpty(
  record: LocalReviewHandoffRecord
): boolean {
  return [
    record.completedAt,
    record.completionMode,
    record.completedBy,
    record.note,
    record.unresolvedCount,
  ].every((value) => value === null);
}

function completedFieldsAreValid(record: LocalReviewHandoffRecord): boolean {
  if (!record.completedAt || Number.isNaN(Date.parse(record.completedAt))) {
    return false;
  }
  if (
    !LOCAL_HANDOFF_COMPLETION_MODES.includes(record.completionMode as never)
  ) {
    return false;
  }
  if (!record.completedBy || record.completedAt < record.createdAt)
    return false;
  return (
    Number.isInteger(record.unresolvedCount) &&
    record.unresolvedCount !== null &&
    record.unresolvedCount >= 0 &&
    record.unresolvedCount <= record.selectedPracticeIds.length
  );
}

function completionNoteIsValid(record: LocalReviewHandoffRecord): boolean {
  if (record.note !== null) {
    if (record.note.trim().length === 0 || record.note.length > 2000)
      return false;
  }
  if (record.completionMode === "auto") return record.note === null;
  return record.unresolvedCount === 0 || record.note !== null;
}

function automaticCompletionIsResolved(
  record: LocalReviewHandoffRecord
): boolean {
  if (record.completionMode !== "auto") return true;
  return record.selectedPracticeIds.length > 0 && record.unresolvedCount === 0;
}

function assertCompletionShape(record: LocalReviewHandoffRecord): void {
  if (record.status === "active") {
    if (!activeCompletionFieldsAreEmpty(record)) {
      throw new LocalHandoffLifecycleError(
        "invalid_handoff_record",
        "An active handoff cannot carry completion fields."
      );
    }
    return;
  }
  if (
    !completedFieldsAreValid(record) ||
    !completionNoteIsValid(record) ||
    !automaticCompletionIsResolved(record)
  ) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      "A completed handoff is missing valid completion fields."
    );
  }
}

/** Decodes a local lifecycle row and checks its cross-field invariants. */
export function localHandoffFromRow(
  row: LocalHandoffRowShape
): LocalReviewHandoffRecord {
  if (!LOCAL_HANDOFF_STATUSES.includes(row.status as never)) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      `Unknown local handoff status: ${row.status}`
    );
  }
  const reference = localHandoffReferenceFromId(row.id);
  if (
    reference.reviewId !== row.reviewId ||
    reference.sequence !== row.sequence
  ) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      `Local handoff ${row.id} does not match its review and sequence.`
    );
  }
  assertTimestamp(row.createdAt, "createdAt");
  assertNonEmpty(row.createdBy, "createdBy");
  const record: LocalReviewHandoffRecord = {
    id: row.id,
    reviewId: row.reviewId,
    sequence: row.sequence,
    status: row.status as LocalHandoffStatus,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    completedAt: row.completedAt,
    completionMode: row.completionMode as LocalHandoffCompletionMode | null,
    completedBy: row.completedBy,
    note: row.note,
    selectedPracticeIds: decodeSelectedPracticeIds(row.selectedPracticeIds),
    unresolvedCount: row.unresolvedCount,
  };
  assertCompletionShape(record);
  return record;
}

export function localHandoffToRow(record: LocalReviewHandoffRecord): {
  id: string;
  reviewId: string;
  sequence: number;
  status: LocalHandoffStatus;
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
  completionMode: LocalHandoffCompletionMode | null;
  completedBy: string | null;
  note: string | null;
  selectedPracticeIds: string;
  unresolvedCount: number | null;
} {
  if (localHandoffId(record.reviewId, record.sequence) !== record.id) {
    throw new LocalHandoffLifecycleError(
      "invalid_handoff_record",
      `Local handoff ${record.id} does not match its review and sequence.`
    );
  }
  assertTimestamp(record.createdAt, "createdAt");
  assertNonEmpty(record.createdBy, "createdBy");
  const selectedPracticeIds = JSON.stringify(record.selectedPracticeIds);
  decodeSelectedPracticeIds(selectedPracticeIds);
  assertCompletionShape(record);
  return {
    ...record,
    selectedPracticeIds,
  };
}

/** Resolves the sole active handoff for a review. */
export function resolveActiveLocalHandoff(
  handoffs: readonly LocalReviewHandoffRecord[],
  reviewId: string
): LocalReviewHandoffRecord | null {
  const active = handoffs.filter(
    (handoff) => handoff.reviewId === reviewId && handoff.status === "active"
  );
  if (active.length > 1) {
    throw new LocalHandoffLifecycleError(
      "multiple_active_handoffs",
      `Review ${reviewId} has more than one active local handoff.`
    );
  }
  return active[0] ?? null;
}

export function nextLocalHandoffSequence(
  handoffs: readonly LocalReviewHandoffRecord[],
  reviewId: string
): number {
  return (
    handoffs.reduce(
      (maximum, handoff) =>
        handoff.reviewId === reviewId
          ? Math.max(maximum, handoff.sequence)
          : maximum,
      0
    ) + 1
  );
}

export interface ActiveOrNextLocalHandoff {
  readonly handoff: LocalReviewHandoffRecord;
  readonly isNew: boolean;
}

/** Returns the active sequence, or plans the next sequence without writing it. */
export function resolveActiveOrNextLocalHandoff(input: {
  readonly handoffs: readonly LocalReviewHandoffRecord[];
  readonly reviewId: string;
  readonly createdAt: string;
  readonly createdBy: string;
}): ActiveOrNextLocalHandoff {
  const active = resolveActiveLocalHandoff(input.handoffs, input.reviewId);
  if (active) return { handoff: active, isNew: false };

  const sequence = nextLocalHandoffSequence(input.handoffs, input.reviewId);
  const handoff: LocalReviewHandoffRecord = {
    id: localHandoffId(input.reviewId, sequence),
    reviewId: input.reviewId,
    sequence,
    status: "active",
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    completedAt: null,
    completionMode: null,
    completedBy: null,
    note: null,
    selectedPracticeIds: [],
    unresolvedCount: null,
  };
  localHandoffToRow(handoff);
  return { handoff, isNew: true };
}

export type SelectedPracticeResolutionState =
  | "met"
  | "not-applicable"
  | "unresolved";

export interface CurrentHandoffAnswer {
  readonly questionId: string;
  /** A decoded answer or the JSON text stored in review_answer_state. */
  readonly answer: unknown;
  readonly naReason?: unknown;
  readonly itemNaReasons?: unknown;
}

export interface SelectedPracticeResolution {
  readonly practiceId: string;
  readonly state: SelectedPracticeResolutionState;
}

export interface SelectedPracticeResolutionSummary {
  readonly practices: readonly SelectedPracticeResolution[];
  readonly selectedPracticeIds: readonly string[];
  readonly unresolvedPracticeIds: readonly string[];
  readonly unresolvedCount: number;
  readonly canCompleteAutomatically: boolean;
}

function decodeStoredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function hasItemNaReason(value: unknown, practiceId: string): boolean {
  const decoded = decodeStoredValue(value);
  return (
    typeof decoded === "object" &&
    decoded !== null &&
    !Array.isArray(decoded) &&
    Object.hasOwn(decoded, practiceId)
  );
}

function resolvePracticeState(
  practice: HandoffPracticeRecord,
  answer: CurrentHandoffAnswer | undefined
): SelectedPracticeResolutionState {
  const value = decodeStoredValue(answer?.answer);
  if (value === "na") return "not-applicable";

  // Yes/No practices reuse the question ID as their practice ID.
  if (practice.reference.practiceId === practice.reference.questionId) {
    return value === "yes" ? "met" : "unresolved";
  }

  if (hasItemNaReason(answer?.itemNaReasons, practice.reference.practiceId)) {
    return "not-applicable";
  }
  if (isChecklistWithNAAnswer(value)) {
    if (value.na.includes(practice.reference.practiceId)) {
      return "not-applicable";
    }
    return value.checked.includes(practice.reference.practiceId)
      ? "met"
      : "unresolved";
  }
  if (isChecklistAnswer(value)) {
    return value.includes(practice.reference.practiceId) ? "met" : "unresolved";
  }
  return "unresolved";
}

/** Resolves the active selection against current answers, in draft order. */
export function resolveSelectedHandoffPractices(
  rows: readonly HandoffPracticeRecord[],
  answers: readonly CurrentHandoffAnswer[]
): SelectedPracticeResolutionSummary {
  const answerByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer] as const)
  );
  const selected = rows
    .filter((row) => row.selectionState === "selected")
    .toSorted((left, right) => left.orderKey.localeCompare(right.orderKey));
  const practices = selected.map((practice) => ({
    practiceId: practice.id,
    state: resolvePracticeState(
      practice,
      answerByQuestionId.get(practice.reference.questionId)
    ),
  }));
  const unresolvedPracticeIds = practices
    .filter((practice) => practice.state === "unresolved")
    .map((practice) => practice.practiceId);
  return {
    practices,
    selectedPracticeIds: practices.map((practice) => practice.practiceId),
    unresolvedPracticeIds,
    unresolvedCount: unresolvedPracticeIds.length,
    canCompleteAutomatically:
      practices.length > 0 && unresolvedPracticeIds.length === 0,
  };
}

export function projectLocalHandoffAnalytics(
  handoff: LocalReviewHandoffRecord
): LocalHandoffAnalytics {
  const durationMs = handoff.completedAt
    ? Math.max(
        0,
        Date.parse(handoff.completedAt) - Date.parse(handoff.createdAt)
      )
    : null;
  return {
    id: handoff.id,
    reviewId: handoff.reviewId,
    sequence: handoff.sequence,
    createdAt: handoff.createdAt,
    createdBy: handoff.createdBy,
    completedAt: handoff.completedAt,
    completionMode: handoff.completionMode,
    completedBy: handoff.completedBy,
    note: handoff.note,
    durationMs,
    unresolvedCount: handoff.unresolvedCount,
    selectedPracticeIds: [...handoff.selectedPracticeIds],
  };
}

export interface LocalHandoffSelectionPlan extends ActiveOrNextLocalHandoff {
  readonly practiceEntityId: string;
}

/** Reads ownership before a local selection and rejects completed ownership. */
export async function planLocalHandoffSelection(input: {
  readonly reviewId: string;
  readonly practiceEntityId: string;
  readonly createdAt: string;
  readonly createdBy: string;
}): Promise<LocalHandoffSelectionPlan> {
  const [handoffRows, practiceRows] = await withDatabase(async (db) =>
    Promise.all([
      db
        .select()
        .from(localReviewHandoffs)
        .where(eq(localReviewHandoffs.reviewId, input.reviewId)),
      db
        .select({ localHandoffId: reviewHandoffPractices.localHandoffId })
        .from(reviewHandoffPractices)
        .where(eq(reviewHandoffPractices.id, input.practiceEntityId))
        .limit(1),
    ])
  );
  const handoffs = handoffRows.map(localHandoffFromRow);
  const ownerId = practiceRows[0]?.localHandoffId ?? null;
  if (ownerId) {
    const owner = handoffs.find((handoff) => handoff.id === ownerId);
    if (!owner) {
      throw new LocalHandoffLifecycleError(
        "practice_owned_by_another_handoff",
        `Practice ${input.practiceEntityId} has an unknown local handoff owner.`
      );
    }
    if (owner.status === "completed") {
      throw new LocalHandoffLifecycleError(
        "practice_owned_by_completed_handoff",
        `Practice ${input.practiceEntityId} already belongs to completed handoff ${owner.id}.`
      );
    }
    const active = resolveActiveLocalHandoff(handoffs, input.reviewId);
    if (active?.id !== owner.id) {
      throw new LocalHandoffLifecycleError(
        "practice_owned_by_another_handoff",
        `Practice ${input.practiceEntityId} does not belong to the active handoff.`
      );
    }
    return {
      handoff: owner,
      isNew: false,
      practiceEntityId: input.practiceEntityId,
    };
  }

  return {
    ...resolveActiveOrNextLocalHandoff({
      handoffs,
      reviewId: input.reviewId,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
    }),
    practiceEntityId: input.practiceEntityId,
  };
}

/**
 * Rechecks a selection plan inside its state-write transaction and creates the
 * planned handoff there when the review still has no active sequence.
 */
export async function ensureLocalHandoffForSelection(
  tx: MutationTransaction,
  plan: LocalHandoffSelectionPlan
): Promise<void> {
  const handoffs = (
    await tx
      .select()
      .from(localReviewHandoffs)
      .where(eq(localReviewHandoffs.reviewId, plan.handoff.reviewId))
  ).map(localHandoffFromRow);
  const practice = (
    await tx
      .select({ localHandoffId: reviewHandoffPractices.localHandoffId })
      .from(reviewHandoffPractices)
      .where(eq(reviewHandoffPractices.id, plan.practiceEntityId))
      .limit(1)
  )[0];
  const ownerId = practice?.localHandoffId ?? null;
  if (ownerId && ownerId !== plan.handoff.id) {
    const owner = handoffs.find((handoff) => handoff.id === ownerId);
    throw new LocalHandoffLifecycleError(
      owner?.status === "completed"
        ? "practice_owned_by_completed_handoff"
        : "practice_owned_by_another_handoff",
      `Practice ${plan.practiceEntityId} already belongs to ${ownerId}.`
    );
  }

  const active = resolveActiveLocalHandoff(handoffs, plan.handoff.reviewId);
  if (active) {
    if (active.id !== plan.handoff.id) {
      throw new LocalHandoffLifecycleError(
        "stale_handoff_selection",
        `Active handoff changed from ${plan.handoff.id} to ${active.id}.`
      );
    }
    return;
  }

  if (
    handoffs.some((handoff) => handoff.id === plan.handoff.id) ||
    nextLocalHandoffSequence(handoffs, plan.handoff.reviewId) !==
      plan.handoff.sequence
  ) {
    throw new LocalHandoffLifecycleError(
      "stale_handoff_selection",
      `Handoff ${plan.handoff.id} is no longer the next active sequence.`
    );
  }
  await tx.insert(localReviewHandoffs).values(localHandoffToRow(plan.handoff));
}

interface CompletionContext {
  readonly handoff: LocalReviewHandoffRecord | null;
  readonly resolution: SelectedPracticeResolutionSummary;
}

const EMPTY_RESOLUTION: SelectedPracticeResolutionSummary = {
  practices: [],
  selectedPracticeIds: [],
  unresolvedPracticeIds: [],
  unresolvedCount: 0,
  canCompleteAutomatically: false,
};

async function readCompletionContext(
  tx: MutationTransaction,
  reviewId: string
): Promise<CompletionContext> {
  const handoffs = (
    await tx
      .select()
      .from(localReviewHandoffs)
      .where(eq(localReviewHandoffs.reviewId, reviewId))
  ).map(localHandoffFromRow);
  const handoff = resolveActiveLocalHandoff(handoffs, reviewId);
  if (!handoff) return { handoff: null, resolution: EMPTY_RESOLUTION };

  const [practiceRows, answers] = await Promise.all([
    tx
      .select()
      .from(reviewHandoffPractices)
      .where(
        and(
          eq(reviewHandoffPractices.reviewId, reviewId),
          eq(reviewHandoffPractices.localHandoffId, handoff.id)
        )
      ),
    tx
      .select({
        questionId: reviewAnswerState.questionId,
        answer: reviewAnswerState.answer,
        naReason: reviewAnswerState.naReason,
        itemNaReasons: reviewAnswerState.itemNaReasons,
      })
      .from(reviewAnswerState)
      .where(eq(reviewAnswerState.reviewId, reviewId)),
  ]);
  return {
    handoff,
    resolution: resolveSelectedHandoffPractices(
      practiceRows.map(handoffPracticeFromRow),
      answers
    ),
  };
}

function completedHandoff(input: {
  readonly active: LocalReviewHandoffRecord;
  readonly resolution: SelectedPracticeResolutionSummary;
  readonly completedAt: string;
  readonly completedBy: string;
  readonly mode: LocalHandoffCompletionMode;
  readonly note: string | null;
}): LocalReviewHandoffRecord {
  const completed: LocalReviewHandoffRecord = {
    ...input.active,
    status: "completed",
    completedAt: input.completedAt,
    completionMode: input.mode,
    completedBy: input.completedBy,
    note: input.note,
    selectedPracticeIds: [...input.resolution.selectedPracticeIds],
    unresolvedCount: input.resolution.unresolvedCount,
  };
  localHandoffToRow(completed);
  return completed;
}

async function persistCompletion(
  tx: MutationTransaction,
  handoff: LocalReviewHandoffRecord
): Promise<void> {
  const row = localHandoffToRow(handoff);
  await tx
    .update(localReviewHandoffs)
    .set({
      status: row.status,
      completedAt: row.completedAt,
      completionMode: row.completionMode,
      completedBy: row.completedBy,
      note: row.note,
      selectedPracticeIds: row.selectedPracticeIds,
      unresolvedCount: row.unresolvedCount,
    })
    .where(
      and(
        eq(localReviewHandoffs.id, row.id),
        eq(localReviewHandoffs.status, "active")
      )
    );
}

async function releaseUnresolvedPractices(
  tx: MutationTransaction,
  handoffId: string,
  practiceIds: readonly string[]
): Promise<void> {
  if (practiceIds.length === 0) return;
  await tx
    .update(reviewHandoffPractices)
    .set({ localHandoffId: null })
    .where(
      and(
        eq(reviewHandoffPractices.localHandoffId, handoffId),
        inArray(reviewHandoffPractices.id, [...practiceIds])
      )
    );
}

export interface CompleteLocalHandoffInput {
  readonly reviewId: string;
  readonly completedBy: string;
  readonly completedAt?: string;
}

/** Completes an active handoff regardless of its unresolved selection count. */
export async function completeLocalHandoffManually(
  input: CompleteLocalHandoffInput & { readonly note?: string | null }
): Promise<LocalReviewHandoffRecord | null> {
  assertNonEmpty(input.completedBy, "completedBy");
  let completed: LocalReviewHandoffRecord | null = null;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const context = await readCompletionContext(tx, input.reviewId);
      if (!context.handoff) return;
      completed = completedHandoff({
        active: context.handoff,
        resolution: context.resolution,
        completedAt: input.completedAt ?? now,
        completedBy: input.completedBy,
        mode: "manual",
        note: input.note?.trim() || null,
      });
      await persistCompletion(tx, completed);
      await releaseUnresolvedPractices(
        tx,
        context.handoff.id,
        context.resolution.unresolvedPracticeIds
      );
    },
  });
  return completed;
}

export interface LocalHandoffAutomaticEvaluation extends CompletionContext {
  readonly eligible: boolean;
}

/** Reads whether the current active selection is eligible for auto completion. */
export async function evaluateLocalHandoffAutomatically(
  reviewId: string
): Promise<LocalHandoffAutomaticEvaluation> {
  const context = await withDatabase((db) =>
    db.transaction((tx) => readCompletionContext(tx, reviewId))
  );
  return {
    ...context,
    eligible: context.resolution.canCompleteAutomatically,
  };
}

/** Atomically re-evaluates and completes an eligible active handoff. */
export async function completeLocalHandoffAutomatically(
  input: CompleteLocalHandoffInput
): Promise<LocalReviewHandoffRecord | null> {
  assertNonEmpty(input.completedBy, "completedBy");
  let completed: LocalReviewHandoffRecord | null = null;
  await localMutation.localOnly({
    stateWrite: async (tx, { now }) => {
      const context = await readCompletionContext(tx, input.reviewId);
      if (!context.handoff || !context.resolution.canCompleteAutomatically) {
        return;
      }
      completed = completedHandoff({
        active: context.handoff,
        resolution: context.resolution,
        completedAt: input.completedAt ?? now,
        completedBy: input.completedBy,
        mode: "auto",
        note: null,
      });
      await persistCompletion(tx, completed);
    },
  });
  return completed;
}

export async function reopenLatestLocalHandoff(
  reviewId: string
): Promise<LocalReviewHandoffRecord | null> {
  let reopened: LocalReviewHandoffRecord | null = null;
  await localMutation.localOnly({
    stateWrite: async (tx) => {
      const handoffs = (
        await tx
          .select()
          .from(localReviewHandoffs)
          .where(eq(localReviewHandoffs.reviewId, reviewId))
      ).map(localHandoffFromRow);
      if (resolveActiveLocalHandoff(handoffs, reviewId)) return;
      const latest = handoffs.toSorted(
        (left, right) => right.sequence - left.sequence
      )[0];
      if (
        !latest ||
        latest.status !== "completed" ||
        latest.completionMode !== "manual"
      ) {
        return;
      }

      const active: LocalReviewHandoffRecord = {
        ...latest,
        status: "active",
        completedAt: null,
        completionMode: null,
        completedBy: null,
        note: null,
        selectedPracticeIds: [],
        unresolvedCount: null,
      };
      localHandoffToRow(active);
      await tx
        .update(localReviewHandoffs)
        .set({
          status: "active",
          completedAt: null,
          completionMode: null,
          completedBy: null,
          note: null,
          selectedPracticeIds: "[]",
          unresolvedCount: null,
        })
        .where(
          and(
            eq(localReviewHandoffs.id, latest.id),
            eq(localReviewHandoffs.status, "completed")
          )
        );
      if (latest.selectedPracticeIds.length > 0) {
        await tx
          .update(reviewHandoffPractices)
          .set({ localHandoffId: latest.id })
          .where(
            inArray(reviewHandoffPractices.id, [...latest.selectedPracticeIds])
          );
      }
      reopened = active;
    },
  });
  return reopened;
}
