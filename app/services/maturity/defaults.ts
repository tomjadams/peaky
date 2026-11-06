/**
 * Configured-default maturity definition (maturity-score/REQ-009, REQ-010;
 * AC-010, AC-049, AC-050, AC-053).
 *
 * When an author retains the configured defaults, the persisted document still
 * spells them out: the configured stage bands, an explicit `equal` allocation per
 * checklist question, every question associated as a whole with stage 1 in
 * authored order, and no guidance. A default draft therefore presents as
 * complete and publishable (AC-049) while the stored document remains
 * self-contained — readers never re-derive defaults from mutable draft state
 * (AC-009).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database. The Revision content
 * input is structural so fixtures, local rows, and server handlers can all
 * feed it without importing the transport models.
 */
import {
  defaultThresholds,
  type MaturityDefinition,
  type ScorableQuestion,
  type StageAssociations,
} from "./definition";

export interface RevisionQuestionShape {
  readonly id: string;
  readonly type?: "yes-no" | "checklist";
  readonly riskLevel: "critical" | "high" | "medium";
  readonly checklistItems?: readonly { readonly id: string }[];
}

export interface RevisionPillarShape {
  readonly id: string;
  readonly questions: readonly RevisionQuestionShape[];
}

export interface RevisionContentShape {
  readonly pillars: readonly RevisionPillarShape[];
}

/**
 * Extracts the scoring-unit shape from a Revision content tree. Pillars and
 * questions must be passed in authored order; that order becomes the
 * deterministic in-stage order of default associations (AC-053).
 */
export function scorableQuestionsFromRevision(
  revision: RevisionContentShape
): ScorableQuestion[] {
  return revision.pillars.flatMap((pillar) =>
    pillar.questions.map((question) => {
      const type = question.type ?? "yes-no";
      return {
        questionId: question.id,
        pillarId: pillar.id,
        severity: question.riskLevel,
        type,
        practiceIds:
          type === "checklist"
            ? (question.checklistItems ?? []).map((item) => item.id)
            : [],
      };
    })
  );
}

function wholeQuestionDefaults(
  questions: readonly ScorableQuestion[]
): StageAssociations {
  const questionStages: Record<string, number> = {};
  const stageOrder: StageAssociations["stageOrder"] = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };
  for (const question of questions) {
    questionStages[question.questionId] = 1;
    stageOrder[1].push({ questionId: question.questionId });
  }
  return { questions: questionStages, practices: {}, stageOrder };
}

/**
 * Builds the configured-default definition for a question set (AC-010).
 * Deterministic: identical question lists always serialize byte-equivalently.
 */
export function buildDefaultMaturityDefinition(
  questions: readonly ScorableQuestion[]
): MaturityDefinition {
  const allocations: Record<string, { mode: "equal" }> = {};
  for (const question of questions) {
    if (question.type === "checklist") {
      allocations[question.questionId] = { mode: "equal" };
    }
  }
  return {
    schemaVersion: 1,
    thresholds: defaultThresholds(),
    allocations,
    associations: wholeQuestionDefaults(questions),
    guidance: { stages: {}, questions: {}, practices: {} },
  };
}
