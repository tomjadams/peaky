/**
 * Interactive stage-path projection (maturity-score/REQ-013, REQ-014;
 * AC-036 through AC-038, AC-057, AC-058).
 *
 * Projects the revealed panel for one selected stage of one pinned Revision
 * from the calculation trace and the pinned definition — never from a second
 * calculation. Stage associations decide which practices a stage reveals;
 * they are presentation and attribution only and never change the result
 * (AC-054). Selection semantics:
 *
 * - earlier stage: associated practices with their met/unmet state (AC-036);
 * - current stage: associated unmet practices only (AC-037);
 * - future stage: canonical meaning, optional guidance, and associated
 *   practices as guidance — never a required target (AC-038).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { CalculationTrace, QuestionTrace } from "./calculate";
import type { MaturityDefinition } from "./definition";
import { MATURITY_STAGES, type MaturityStageNumber } from "./stages";
import type { QuestionType } from "~/models/question";
import type { RiskLevel } from "~/models/template";
import { formatQuestionReference } from "~/utils/questionReference";

/** Structural question info the caller indexes from workspace pillars. */
export interface StagePathQuestionInfo {
  readonly questionId: string;
  readonly questionReference: string | null;
  readonly pillarId: string;
  readonly pillarName: string;
  readonly text: string;
  readonly type: QuestionType;
  /** Severity-derived ordering key; defaults to "medium" when absent. */
  readonly severity: RiskLevel;
  readonly practices: readonly { readonly id: string; readonly text: string }[];
}

interface PillarShape {
  readonly id: string;
  readonly slug?: string;
  readonly name: string;
  readonly questions: readonly {
    readonly id: string;
    readonly text: string;
    readonly type?: QuestionType;
    readonly riskLevel?: RiskLevel;
    readonly checklistItems?: readonly {
      readonly id: string;
      readonly text: string;
    }[];
  }[];
}

/** Indexes workspace pillars (already scoped to one Revision) by question id. */
export function indexStagePathQuestions(
  pillars: readonly PillarShape[]
): Map<string, StagePathQuestionInfo> {
  const index = new Map<string, StagePathQuestionInfo>();
  for (const pillar of pillars) {
    for (const [questionIndex, question] of pillar.questions.entries()) {
      const type = question.type === "checklist" ? "checklist" : "yes-no";
      index.set(question.id, {
        questionId: question.id,
        questionReference: pillar.slug
          ? formatQuestionReference(pillar.slug, questionIndex + 1)
          : null,
        pillarId: pillar.id,
        pillarName: pillar.name,
        text: question.text,
        type,
        severity: question.riskLevel ?? "medium",
        practices:
          type === "checklist"
            ? (question.checklistItems ?? []).map((item) => ({
                id: item.id,
                text: item.text,
              }))
            : [],
      });
    }
  }
  return index;
}

export type StagePracticeState = "met" | "unmet" | "not-applicable" | "unknown";

export interface StagePractice {
  readonly questionId: string;
  /** Equals the question id for Yes/No questions (improvement-plans/AC-017). */
  readonly practiceId: string;
  readonly questionText: string;
  readonly practiceText: string;
  readonly pillarId: string;
  readonly pillarName: string;
  readonly state: StagePracticeState;
  /** Severity of the source question, for evidence ordering (AC-037). */
  readonly severity: RiskLevel;
  /** Optional scoring-independent guidance (AC-047). */
  readonly guidance: string | null;
}

export type StagePanelKind = "earlier" | "current" | "future";

export interface StagePanel {
  readonly stage: MaturityStageNumber;
  readonly kind: StagePanelKind;
  readonly name: string;
  readonly description: string;
  /** Optional author-provided stage guidance; null when unset (AC-010). */
  readonly stageGuidance: string | null;
  readonly practices: readonly StagePractice[];
}

/** One practice with its authored absolute stage placement. */
export interface FollowUpStagePractice {
  readonly stage: MaturityStageNumber;
  readonly stageName: string;
  readonly practice: StagePractice;
}

/**
 * Explicit evidence grouped relative to an effective result. The relation is
 * presentation only. It does not alter evidence state, scoring, or handoff
 * eligibility. Unanswered evidence stays separate from explicit gaps.
 */
export interface FollowUpBuckets {
  readonly earlier: readonly FollowUpStagePractice[];
  readonly current: readonly FollowUpStagePractice[];
  readonly later: readonly FollowUpStagePractice[];
  readonly notAssessed: readonly FollowUpStagePractice[];
}

function resolveState(
  question: QuestionTrace | undefined,
  practiceId: string
): StagePracticeState {
  if (!question || question.state === "unanswered") return "unknown";
  if (question.practices !== null) {
    return (
      question.practices.find((practice) => practice.practiceId === practiceId)
        ?.state ?? "unknown"
    );
  }
  if (question.state === "not-applicable") return "not-applicable";
  // Yes/No: a result of 1/1 is met; 0/1 is unmet.
  return question.result !== null && question.result.numerator !== "0"
    ? "met"
    : "unmet";
}

function buildPractice(input: {
  readonly questionId: string;
  readonly practiceId: string;
  readonly question: QuestionTrace | undefined;
  readonly info: StagePathQuestionInfo | undefined;
  readonly definition: MaturityDefinition;
}): StagePractice {
  const { questionId, practiceId, question, info, definition } = input;
  const questionText = info?.text ?? questionId;
  const isWholeQuestion = practiceId === questionId;
  return {
    questionId,
    practiceId,
    questionText,
    practiceText: isWholeQuestion
      ? questionText
      : (info?.practices.find((practice) => practice.id === practiceId)?.text ??
        practiceId),
    pillarId: question?.pillarId ?? info?.pillarId ?? "",
    pillarName: info?.pillarName ?? "",
    state: resolveState(question, practiceId),
    severity: info?.severity ?? "medium",
    guidance:
      definition.guidance.practices[questionId]?.[practiceId] ??
      (isWholeQuestion
        ? (definition.guidance.questions[questionId] ?? null)
        : null),
  };
}

function buildPracticesForStage(input: {
  readonly stage: MaturityStageNumber;
  readonly definition: MaturityDefinition;
  readonly trace: Pick<CalculationTrace, "questions">;
  readonly questions: ReadonlyMap<string, StagePathQuestionInfo>;
}): StagePractice[] {
  const { stage, definition, trace, questions } = input;
  const practices: StagePractice[] = [];
  for (const entry of definition.associations.stageOrder[stage]) {
    const question = trace.questions.find(
      (candidate) => candidate.questionId === entry.questionId
    );
    const info = questions.get(entry.questionId);
    if (entry.practiceId !== undefined) {
      if (info?.type !== "checklist") continue;
      practices.push(
        buildPractice({
          questionId: entry.questionId,
          practiceId: entry.practiceId,
          question,
          info,
          definition,
        })
      );
      continue;
    }
    // Whole-question association: only a current checklist expands to its
    // practices. Hidden checklist content on a retyped Yes/No question stays
    // out of stage and Follow-up projections.
    if (info?.type !== "checklist") {
      practices.push(
        buildPractice({
          questionId: entry.questionId,
          practiceId: entry.questionId,
          question,
          info,
          definition,
        })
      );
      continue;
    }
    const checklistPractices = info.practices.length
      ? info.practices
      : (question?.practices ?? []).map((practice) => ({
          id: practice.practiceId,
          text: practice.practiceId,
        }));
    for (const practice of checklistPractices) {
      practices.push(
        buildPractice({
          questionId: entry.questionId,
          practiceId: practice.id,
          question,
          info,
          definition,
        })
      );
    }
  }
  return practices;
}

/**
 * Projects the panel for one selected stage. The `currentStage` is the
 * effective stage from the workspace entry — the UI never recalculates it.
 */
export function buildStagePanel(input: {
  readonly stage: MaturityStageNumber;
  readonly currentStage: MaturityStageNumber;
  readonly definition: MaturityDefinition;
  readonly trace: CalculationTrace;
  readonly questions: ReadonlyMap<string, StagePathQuestionInfo>;
}): StagePanel {
  const { stage, currentStage, definition } = input;
  const constant = MATURITY_STAGES[stage - 1]!;
  const kind: StagePanelKind =
    stage < currentStage
      ? "earlier"
      : stage === currentStage
        ? "current"
        : "future";
  const practices = buildPracticesForStage(input);

  return {
    stage,
    kind,
    name: constant.name,
    description: constant.description,
    stageGuidance: definition.guidance.stages[stage] ?? null,
    // AC-037: the current stage reveals its associated unmet practices.
    practices:
      kind === "current"
        ? practices.filter((practice) => practice.state === "unmet")
        : practices,
  };
}

/**
 * Projects Follow-ups without changing the score result. Stage placement only
 * assigns the neutral earlier/current/later relation. Explicit unmet evidence
 * remains unmet in every bucket, unanswered evidence remains not assessed,
 * and met or N/A evidence is outside this projection. A no-result calculation
 * has no relative stage groups but still projects its unanswered evidence.
 */
export function buildFollowUpBuckets(input: {
  readonly resultStage: MaturityStageNumber | null;
  readonly definition: MaturityDefinition;
  readonly trace: Pick<CalculationTrace, "questions">;
  readonly questions: ReadonlyMap<string, StagePathQuestionInfo>;
}): FollowUpBuckets {
  const earlier: FollowUpStagePractice[] = [];
  const current: FollowUpStagePractice[] = [];
  const later: FollowUpStagePractice[] = [];
  const notAssessed: FollowUpStagePractice[] = [];

  for (const stage of MATURITY_STAGES) {
    const practices = buildPracticesForStage({ ...input, stage: stage.stage });
    for (const practice of practices) {
      const placed = {
        stage: stage.stage,
        stageName: stage.name,
        practice,
      } satisfies FollowUpStagePractice;
      if (practice.state === "unknown") {
        notAssessed.push(placed);
        continue;
      }
      if (practice.state !== "unmet" || input.resultStage === null) continue;
      const relativeBucket =
        stage.stage < input.resultStage
          ? earlier
          : stage.stage === input.resultStage
            ? current
            : later;
      relativeBucket.push(placed);
    }
  }

  return { earlier, current, later, notAssessed };
}

export type PracticeStateFilter = "all" | "met" | "unmet";

export interface StagePracticeFilters {
  readonly pillarId: string;
  readonly state: PracticeStateFilter;
}

/** AC-057: filters scope to one Revision's revealed practice list. */
export function filterStagePractices(
  practices: readonly StagePractice[],
  filters: StagePracticeFilters
): StagePractice[] {
  return practices.filter(
    (practice) =>
      (filters.pillarId === "all" || practice.pillarId === filters.pillarId) &&
      (filters.state === "all" || practice.state === filters.state)
  );
}

/**
 * AC-058: a stage change can invalidate a state filter. Earlier stages show
 * both states; the current stage reveals unmet practices only; future stages
 * present practices as guidance without a state axis.
 */
export function isStateFilterApplicable(
  kind: StagePanelKind,
  state: PracticeStateFilter
): boolean {
  if (state === "all") return true;
  if (kind === "earlier") return true;
  if (kind === "current") return state === "unmet";
  return false;
}

/** Distinct pillar options of a panel, in revealed order. */
export function stagePillarOptions(
  practices: readonly StagePractice[]
): { label: string; value: string }[] {
  const seen = new Map<string, string>();
  for (const practice of practices) {
    if (!seen.has(practice.pillarId)) {
      seen.set(practice.pillarId, practice.pillarName);
    }
  }
  return [...seen.entries()].map(([value, label]) => ({ label, value }));
}

const SEVERITY_RANK: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

/** Gaps first; unassessed evidence never outranks a known state. */
const STATE_RANK: Record<StagePracticeState, number> = {
  unmet: 0,
  met: 1,
  unknown: 2,
  "not-applicable": 3,
};

/**
 * AC-037: plan evidence orders by severity, then state, with stable
 * question/practice id tiebreaks; returns a new array.
 */
export function orderStageEvidence(
  practices: readonly StagePractice[]
): StagePractice[] {
  return practices.toSorted(
    (left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
      STATE_RANK[left.state] - STATE_RANK[right.state] ||
      left.questionId.localeCompare(right.questionId) ||
      left.practiceId.localeCompare(right.practiceId)
  );
}

/** Live-region announcement for a revealed panel (AC-059). */
export function describeStagePanel(panel: StagePanel): string {
  const base = `Stage ${panel.stage} ${panel.name}`;
  const count = panel.practices.length;
  if (panel.kind === "earlier") {
    const stateCounts: Record<StagePracticeState, number> = {
      met: 0,
      unmet: 0,
      unknown: 0,
      "not-applicable": 0,
    };
    for (const practice of panel.practices) stateCounts[practice.state] += 1;
    const states = [
      stateCounts.met > 0 ? `${stateCounts.met} met` : null,
      stateCounts.unmet > 0 ? `${stateCounts.unmet} unmet` : null,
      stateCounts.unknown > 0 ? `${stateCounts.unknown} not assessed` : null,
      stateCounts["not-applicable"] > 0
        ? `${stateCounts["not-applicable"]} not applicable`
        : null,
    ].filter((state): state is string => state !== null);
    return `${base}. ${count} associated practices${states.length > 0 ? `: ${states.join(", ")}` : ""}.`;
  }
  if (panel.kind === "current") {
    return `${base}, current stage. ${count} unmet practices.`;
  }
  return `${base}. Guidance, not a required target. ${count} associated practices.`;
}
