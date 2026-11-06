/**
 * Versioned maturity definition: the immutable configuration document stored
 * with each published TemplateRevision (maturity-score/REQ-009, REQ-010,
 * REQ-017).
 * The shared validation contract lives in ./validation and is re-exported here.
 *
 * The definition carries thresholds, checklist allocations, mandatory stage
 * associations, and optional guidance. Question weight is NEVER stored here:
 * it is derived from question severity (AC-033). Guidance and associations are
 * presentation/attribution only and never enter the calculation trace
 * (AC-014, AC-054).
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */
import type { StageThresholds } from "./stages";

export const MATURITY_DEFINITION_SCHEMA_VERSION = 1;

/** The scoring-unit shape the definition is validated and calculated against. */
export interface ScorableQuestion {
  readonly questionId: string;
  readonly pillarId: string;
  readonly severity: "critical" | "high" | "medium";
  readonly type: "yes-no" | "checklist";
  /** Checklist practice ids in authored order; empty for yes-no questions. */
  readonly practiceIds: readonly string[];
}

/** Fixed severity-derived question weights (AC-017, AC-033). */
export const SEVERITY_WEIGHTS = { medium: 1, high: 2, critical: 3 } as const;

export function severityWeight(severity: ScorableQuestion["severity"]): number {
  return SEVERITY_WEIGHTS[severity];
}

export type ChecklistAllocation =
  | { readonly mode: "equal" }
  | {
      readonly mode: "custom";
      readonly shares: Readonly<Record<string, number>>;
    };

export interface StageOrderEntry {
  readonly questionId: string;
  readonly practiceId?: string;
}

/**
 * Exactly one stage association per question, or — when a checklist question
 * distributes practices across stages — exactly one per practice (AC-050).
 * `stageOrder` persists the deterministic in-stage order (AC-053).
 */
export interface StageAssociations {
  readonly questions: Readonly<Record<string, number>>;
  readonly practices: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
  readonly stageOrder: Record<1 | 2 | 3 | 4 | 5, StageOrderEntry[]>;
}

export interface MaturityGuidance {
  readonly stages: Readonly<Record<number, string>>;
  readonly questions: Readonly<Record<string, string>>;
  readonly practices: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

export interface MaturityDefinition {
  readonly schemaVersion: typeof MATURITY_DEFINITION_SCHEMA_VERSION;
  readonly thresholds: StageThresholds;
  /** Keyed by question id; an explicit `equal` entry is the persisted default. */
  readonly allocations: Readonly<Record<string, ChecklistAllocation>>;
  readonly associations: StageAssociations;
  readonly guidance: MaturityGuidance;
}

export { defaultThresholds, validateMaturityDefinition } from "./validation";
export type { DefinitionIssue, DefinitionIssueCode } from "./validation";
