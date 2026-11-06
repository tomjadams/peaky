/**
 * Canonical ORR 2026 maturity stages and configured defaults
 * (maturity-score/REQ-013, AC-034; REQ-009, AC-010).
 *
 * Stage names and canonical descriptions are immutable application constants:
 * template authors cannot rename a stage or replace this copy. Authors may only
 * move boundaries within the advanced-threshold contract (AC-012) and attach
 * optional scoring-independent guidance.
 *
 * Pure module: no I/O, no Vue, no Nitro, no database.
 */

export const MATURITY_STAGES = [
  {
    stage: 1,
    name: "Not implemented",
    description: "Practices are absent or not yet repeatable.",
  },
  {
    stage: 2,
    name: "Ad-hoc",
    description: "Practices exist in places but depend on individual effort.",
  },
  {
    stage: 3,
    name: "Defined",
    description: "Shared practices are documented and used consistently.",
  },
  {
    stage: 4,
    name: "Measured",
    description: "Practices are measured and improved using evidence.",
  },
  {
    stage: 5,
    name: "Optimized",
    description: "Practices are continuously improved and embedded.",
  },
] as const;

export type MaturityStageNumber = (typeof MATURITY_STAGES)[number]["stage"];

/** Upper boundary of stages 1–4 in whole percent; stage 5 ends at 100. */
export type StageThresholds = readonly [number, number, number, number];

/** Default bands keep "Not implemented" narrow, then broaden with adoption. */
export const DEFAULT_THRESHOLDS: StageThresholds = [5, 25, 50, 75];

/** Earlier drafts and pinned revisions used equal 20 percent bands. */
export const LEGACY_DEFAULT_THRESHOLDS: StageThresholds = [20, 40, 60, 80];

/** Advanced boundaries stay within 10 points of their configured default (AC-012). */
export const THRESHOLD_TOLERANCE = 10;

/** Every stage spans at least 5 percentage points (AC-012). */
export const MIN_STAGE_WIDTH = 5;

/** Ten-question maximum per scored TemplateRevision (AC-041, AC-042). */
export const MAX_MATURITY_QUESTIONS = 10;

/** Optional stage/question/practice guidance limit in Unicode characters (AC-047). */
export const GUIDANCE_MAX_CHARS = 240;

export function maturityStage(stage: number): (typeof MATURITY_STAGES)[number] {
  const found = MATURITY_STAGES.find((candidate) => candidate.stage === stage);
  if (!found) {
    throw new Error(`Unknown maturity stage: ${stage}`);
  }
  return found;
}
