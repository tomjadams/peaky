/**
 * Shared acceptance vectors for the pure maturity domain (maturity-score/REQ-011
 * through REQ-015). One canonical fixture set consumed by calculation unit tests,
 * definition-validation tests, trace-stability tests, and later by workspace,
 * component, and browser tests so every layer asserts the same numbers.
 *
 * Expected values are exact integer ratios (RED phase: the domain modules they
 * import do not exist yet).
 */
import type {
  MaturityDefinition,
  ScorableQuestion,
  StageAssociations,
} from "~/services/maturity/definition";
import type { AnswerValue } from "~/services/maturity/calculate";
import { LEGACY_DEFAULT_THRESHOLDS } from "~/services/maturity/stages";

export interface VectorQuestion extends ScorableQuestion {
  answer?: AnswerValue;
}

export interface CalculationVector {
  /** Vector identifier citing the requirements it proves. */
  id: string;
  cites: readonly string[];
  definition: MaturityDefinition;
  questions: readonly VectorQuestion[];
  expect:
    | {
        kind: "result";
        /** Reduced exact template result ratio, e.g. ["71", "84"]. */
        result: readonly [string, string];
        stage: 1 | 2 | 3 | 4 | 5;
        displayPercent: number;
        coverage: { answered: number; unanswered: number; total: number };
        /** Per-question earned and available points as reduced exact ratios. */
        questionPoints: Readonly<
          Record<
            string,
            {
              earned: readonly [string, string];
              available: readonly [string, string];
            }
          >
        >;
        questionWeights?: Readonly<Record<string, number>>;
        pillars?: Readonly<
          Record<
            string,
            {
              result: readonly [string, string] | null;
              stage: number | null;
              answered: number;
              unanswered: number;
            }
          >
        >;
        /** Set when whole-percent display crosses a stage boundary the exact ratio does not. */
        boundaryStraddle?: { boundary: number };
      }
    | {
        kind: "no-result";
        coverage: { answered: number; unanswered: number; total: number };
      }
    | { kind: "configuration-error"; questionCount: number };
}

export interface DefinitionVector {
  id: string;
  cites: readonly string[];
  definition: MaturityDefinition;
  questions: readonly ScorableQuestion[];
  expect:
    | { ok: true }
    | { ok: false; issues: ReadonlyArray<{ code: string; path: string }> };
}

interface AssociationSpec {
  id: string;
  stage: number;
  practices?: ReadonlyArray<{ id: string; stage: number }>;
}

/** Builds a consistent StageAssociations value (maps plus deterministic in-stage order). */
export function associate(
  specs: readonly AssociationSpec[]
): StageAssociations {
  const questionStages: Record<string, number> = {};
  const practiceStages: Record<string, Record<string, number>> = {};
  const order = new Map<
    number,
    Array<{ questionId: string; practiceId?: string }>
  >();
  for (const spec of specs) {
    if (!spec.practices) {
      questionStages[spec.id] = spec.stage;
      const list = order.get(spec.stage) ?? [];
      list.push({ questionId: spec.id });
      order.set(spec.stage, list);
      continue;
    }
    const perPractice: Record<string, number> = {};
    for (const practice of spec.practices) {
      perPractice[practice.id] = practice.stage;
      const list = order.get(practice.stage) ?? [];
      list.push({ questionId: spec.id, practiceId: practice.id });
      order.set(practice.stage, list);
    }
    practiceStages[spec.id] = perPractice;
  }
  const stageOrder: StageAssociations["stageOrder"] = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };
  for (const [stage, entries] of order) {
    stageOrder[stage as 1 | 2 | 3 | 4 | 5] = entries;
  }
  return { questions: questionStages, practices: practiceStages, stageOrder };
}

interface DefinitionOverrides {
  thresholds?: MaturityDefinition["thresholds"];
  allocations?: MaturityDefinition["allocations"];
  associations?: StageAssociations;
  guidance?: MaturityDefinition["guidance"];
}

/** Definition with configured defaults (AC-010): equal bands, explicit equal shares, no guidance. */
export function makeDefinition(
  questions: readonly ScorableQuestion[],
  associations: StageAssociations,
  overrides: DefinitionOverrides = {}
): MaturityDefinition {
  const allocations: Record<string, { mode: "equal" }> = {};
  for (const question of questions) {
    if (question.type === "checklist") {
      allocations[question.questionId] = { mode: "equal" };
    }
  }
  return {
    schemaVersion: 1,
    thresholds: overrides.thresholds ?? [...LEGACY_DEFAULT_THRESHOLDS],
    allocations: overrides.allocations ?? allocations,
    associations: overrides.associations ?? associations,
    guidance: overrides.guidance ?? {
      stages: {},
      questions: {},
      practices: {},
    },
  };
}

const TEMPLATE_REVISION_ID = "01932b3c-7d00-7000-8000-00000000a001";
export const VECTOR_REVISION_ID = TEMPLATE_REVISION_ID;
