/**
 * Per-Revision maturity derivation for the flat review workspace
 * (reviews/REQ-006, AC-029, AC-030, AC-031; maturity-score/REQ-014, REQ-015;
 * AC-025, AC-042, AC-060).
 *
 * One maturity entry per pinned TemplateRevision, sitting beside the shipped
 * templateRevisions[]/pillars[] collections — Pillars are never restructured
 * under Revisions (design Decision 4). Every entry derives purely and
 * synchronously from data already in the workspace: the pinned definition
 * document stored on the Revision snapshot, that Revision's questions, and
 * current answers. Calculated maturity is never persisted; it is derived on
 * read. `templateRevisionId` is an opaque string, compared exactly and never
 * parsed, and no cross-Revision or combined score is produced (AC-025,
 * AC-039).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database. Inputs are structural
 * so fixtures, transport models, and server handlers can all feed them.
 */
import {
  isChecklistAnswer,
  isChecklistWithNAAnswer,
  type QuestionAnswer,
} from "~/models/question";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";
import {
  calculateMaturity,
  describeStage,
  type AnswerValue,
  type CalculationTrace,
  type Coverage,
  type MaturityCalculation,
  type QuestionTrace,
  type ResolvedStage,
} from "./calculate";
import {
  overrideHistoryForRevision,
  resolveEffectiveOverride,
  type OverrideTransition,
} from "./override";
import {
  scorableQuestionsFromRevision,
  type RevisionContentShape,
} from "./defaults";
import { decodeMaturityDefinition } from "./persistence";
import { buildPillarBreakdown, type PillarBreakdownRow } from "./projections";
import {
  deserializeRatio,
  exactRatio,
  serializeRatio,
  toWholePercent,
  type SerializedRatio,
} from "./ratio";
import type { StageThresholds } from "./stages";

// === Structural input shapes (satisfied by the workspace transport models) ===

export interface WorkspaceRevisionShape {
  readonly id: string;
  /** Selection position; entry order follows it (never array order). */
  readonly position: number;
  /** Serialized pinned definition; null/absent is the no-definition state. */
  readonly maturityDefinition?: string | null;
}

export interface WorkspaceQuestionShape {
  readonly id: string;
  readonly templateRevisionId: string;
  readonly pillarId: string;
  readonly type: "yes-no" | "checklist";
  /** Missing risk level defaults to medium, matching the plan adapter. */
  readonly riskLevel?: "critical" | "high" | "medium";
  readonly checklistItems?: readonly { readonly id: string }[];
}

export interface WorkspacePillarShape {
  readonly id: string;
  readonly templateRevisionId: string;
  readonly questions: readonly WorkspaceQuestionShape[];
}

export interface WorkspaceAnswerShape {
  readonly questionId: string;
  readonly answer: QuestionAnswer;
}

export interface WorkspaceMaturityInput {
  /** Owning Review id — scopes override resolution exactly. */
  readonly reviewId?: string;
  readonly templateRevisions: readonly WorkspaceRevisionShape[];
  readonly pillars: readonly WorkspacePillarShape[];
  readonly answers: readonly WorkspaceAnswerShape[];
  /**
   * Append-only Advisor override transitions for this Review
   * (maturity-score/REQ-016). Resolved on read; never persisted as a
   * mutable pointer.
   */
  readonly overrides?: readonly OverrideTransition[];
}

// === Entry types ===

/**
 * Provenance of the effective Advisor-reviewed result (AC-030): the actor,
 * explanation, evidence, and time of the transition that resolved current.
 */
export interface WorkspaceMaturityOverrideProvenance {
  readonly transitionId: string;
  readonly actorId: string;
  readonly explanation: string;
  readonly evidence: readonly string[];
  readonly occurredAt: string;
}

/**
 * The effective maturity result (maturity-score/REQ-016; AC-027, AC-030,
 * AC-031). Without an override the calculated result is effective
 * (`source: "calculated"`). With a current authorized, non-revoked override
 * the reviewed value is effective (`source: "override"`) and carries its
 * provenance; the calculated result always stays available on the trace.
 */
export type WorkspaceMaturityEffectiveResult = {
  /** Exact unrounded effective result (AC-024, AC-035). */
  readonly result: SerializedRatio;
  readonly displayPercent: number;
  readonly stage: ResolvedStage;
} & (
  | { readonly source: "calculated"; readonly override: null }
  | {
      readonly source: "override";
      readonly override: WorkspaceMaturityOverrideProvenance;
    }
);

export interface WorkspaceMaturityResult {
  readonly kind: "result";
  readonly templateRevisionId: string;
  readonly trace: CalculationTrace;
  /** Explanatory breakdown projected from the trace (AC-026, REQ-015). */
  readonly pillars: readonly PillarBreakdownRow[];
  readonly coverage: Coverage;
  readonly effectiveResult: WorkspaceMaturityEffectiveResult;
  /**
   * The complete append-only override stream for this Revision in stream
   * order (AC-031); empty when no Advisor has recorded a transition.
   */
  readonly overrideHistory: readonly OverrideTransition[];
}

export interface WorkspaceMaturityNoResult {
  readonly kind: "no-result";
  readonly reason: "no-scored-applicable-answer";
  readonly templateRevisionId: string;
  readonly thresholds: StageThresholds;
  readonly questions: readonly QuestionTrace[];
  readonly coverage: Coverage;
  /** No calculated result exists to be effective (AC-022). */
  readonly effectiveResult: null;
  /**
   * Recorded override transitions remain readable even though no calculated
   * result exists to override (AC-022); the UI surfaces them as history only
   * and never fabricates a stage from them.
   */
  readonly overrideHistory: readonly OverrideTransition[];
}

/** Invalid pinned configuration — no trace, result, or stage. */
export type WorkspaceMaturityConfigurationError = Extract<
  MaturityCalculation,
  { readonly kind: "configuration-error" }
>;

/** AC-060: explicit no-definition state — never a 0% result or empty stage. */
export interface WorkspaceMaturityNoDefinition {
  readonly kind: "no-definition";
  readonly templateRevisionId: string;
}

export type WorkspaceMaturityEntry =
  | WorkspaceMaturityResult
  | WorkspaceMaturityNoResult
  | WorkspaceMaturityConfigurationError
  | WorkspaceMaturityNoDefinition;

// === Answer mapping ===

/**
 * Maps a stored workspace answer to the domain input. Legacy checklist
 * answers (`string[]`) predate per-practice N/A and normalize to
 * `{ checked, na: [] }` (AC-020); no new semantics are invented.
 */
export function workspaceAnswerToValue(answer: QuestionAnswer): AnswerValue {
  if (isChecklistAnswer(answer)) {
    return { checked: answer, na: [] };
  }
  if (isChecklistWithNAAnswer(answer)) {
    return { checked: answer.checked, na: answer.na };
  }
  return answer;
}

// === Derivation ===

function revisionQuestions(
  revision: WorkspaceRevisionShape,
  pillars: readonly WorkspacePillarShape[]
): RevisionContentShape {
  return {
    pillars: pillars
      .filter((pillar) => pillar.templateRevisionId === revision.id)
      .map((pillar) => ({
        id: pillar.id,
        questions: pillar.questions.map((question) => ({
          id: question.id,
          type: question.type,
          riskLevel: question.riskLevel ?? "medium",
          checklistItems: question.checklistItems,
        })),
      })),
  };
}

/**
 * Resolves the effective result for one Revision. The latest authorized,
 * non-revoked override transition wins (AC-030); without one, the calculated
 * result is effective. Overrides never alter the calculation trace — the
 * trace above is computed before this resolution and stays identical either
 * way (REQ-016).
 */
function resolveEffectiveResult(
  trace: CalculationTrace,
  current: OverrideTransition | null
): WorkspaceMaturityEffectiveResult {
  if (current?.reviewedResult) {
    const { percent, stage } = current.reviewedResult;
    return {
      source: "override",
      result: serializeRatio(exactRatio(percent, 100)),
      displayPercent: percent,
      stage: describeStage(stage, trace.thresholds),
      override: {
        transitionId: current.id,
        actorId: current.actorId,
        explanation: current.explanation ?? "",
        evidence: current.evidence,
        occurredAt: current.occurredAt,
      },
    };
  }
  return {
    source: "calculated",
    result: trace.result,
    displayPercent: toWholePercent(deserializeRatio(trace.result)),
    stage: trace.stage,
    override: null,
  };
}

/** Shared per-workspace derivation context passed to each Revision entry. */
interface DerivationContext {
  readonly pillars: readonly WorkspacePillarShape[];
  readonly answerByQuestionId: ReadonlyMap<string, QuestionAnswer>;
  readonly reviewId: string;
  readonly overrides: readonly OverrideTransition[];
}

function deriveRevisionEntry(
  revision: WorkspaceRevisionShape,
  context: DerivationContext
): WorkspaceMaturityEntry {
  const { pillars, answerByQuestionId, reviewId, overrides } = context;
  const templateRevisionId = revision.id;
  const definition = decodeMaturityDefinition(revision.maturityDefinition);
  if (definition === null) {
    return { kind: "no-definition", templateRevisionId };
  }

  const questions = scorableQuestionsFromRevision(
    revisionQuestions(revision, pillars)
  );
  const answers: Record<string, AnswerValue> = {};
  for (const question of questions) {
    answers[question.questionId] = normalizeQuestionAnswer(
      question,
      answerByQuestionId.get(question.questionId) ?? null
    );
  }

  const calculation = calculateMaturity({
    templateRevisionId,
    definition,
    questions,
    answers,
  });
  switch (calculation.kind) {
    case "configuration-error":
      // AC-031: scoped to this Revision; siblings derive independently.
      return calculation;
    case "no-result":
      // No calculated result exists to be effective (AC-022); any recorded
      // override history remains readable through the override stream.
      return {
        ...calculation,
        effectiveResult: null,
        overrideHistory: overrideHistoryForRevision(
          overrides,
          reviewId,
          templateRevisionId
        ),
      };
    case "result": {
      const { trace } = calculation;
      return {
        kind: "result",
        templateRevisionId,
        trace,
        pillars: buildPillarBreakdown(trace),
        coverage: trace.coverage,
        effectiveResult: resolveEffectiveResult(
          trace,
          resolveEffectiveOverride(overrides, reviewId, templateRevisionId)
        ),
        overrideHistory: overrideHistoryForRevision(
          overrides,
          reviewId,
          templateRevisionId
        ),
      };
    }
  }
}

/**
 * Derives one maturity entry per selected Revision in selection position
 * order. Pure and synchronous: callers pass data the workspace already holds.
 */
export function deriveWorkspaceMaturity(
  input: WorkspaceMaturityInput
): WorkspaceMaturityEntry[] {
  const context: DerivationContext = {
    pillars: input.pillars,
    answerByQuestionId: new Map(
      input.answers.map((answer) => [answer.questionId, answer.answer] as const)
    ),
    reviewId: input.reviewId ?? "",
    overrides: input.overrides ?? [],
  };
  return input.templateRevisions
    .toSorted((left, right) => left.position - right.position)
    .map((revision) => deriveRevisionEntry(revision, context));
}
