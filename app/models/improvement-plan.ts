/**
 * Improvement Plan domain models.
 *
 * Pure TypeScript contracts for the attention-item read model,
 * product contributor aggregation, and cross-review rollups.
 *
 * These types are derived from review/template/answer state —
 * not persisted directly. They support the plan projection
 * and are safe to use outside Vue (workers, tests, SSR).
 */

import type { RiskLevel } from "./template";
import type { NotApplicableReason } from "./question";
import type { CompactMaturityEntry } from "~/services/maturity/compactContext";

// ─── Plan Item States ────────────────────────────────────────

/**
 * Why an item appears in the improvement plan.
 *
 * - follow-up: Yes/no question answered "No"
 * - checklist-gap: Checklist with unchecked, non-N/A items
 * - not-assessed: Question has no answer yet
 * - documented-exception: Question marked N/A (not in primary total)
 */
export type PlanItemState =
  | "follow-up"
  | "checklist-gap"
  | "not-assessed"
  | "documented-exception";

// ─── Plan Item Identity ──────────────────────────────────────

/**
 * Uniquely identifies a plan item within a single review.
 *
 * Combines review, template, pillar, and question identity
 * so items can be traced back to their source without ambiguity.
 */
export interface PlanItemIdentity {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  templateId: string;
  templateRevisionId: string;
  pillarSlug: string;
  questionId: string;
  /** Checklist item IDs that are unchecked and not N/A (only for checklist-gap items). */
  checklistItemIds?: string[];
}

// ─── Plan Item ────────────────────────────────────────────────

/**
 * A single attention item in a review improvement plan.
 *
 * Derived from template questions + answer state — not persisted.
 * Non-judgemental: items explain *why* they appear, not what's wrong.
 */
export interface PlanItem {
  identity: PlanItemIdentity;
  state: PlanItemState;
  severity: RiskLevel;
  questionText: string;
  /**
   * Short display slug for the question (`REL-1`), derived from the pillar
   * slug plus the question's position. `null` when it cannot be derived —
   * surfaces omit the identifier badge rather than fall back to the opaque
   * `identity.questionId` storage key.
   */
  questionReference: string | null;
  pillarName: string;
  templateName: string;
  revisionNumber: number | null;
  /** Why the item appears, phrased neutrally. */
  explanation: string;
  /** Missing checklist practices (only for checklist-gap items). */
  missingChecklistItems?: string[];
  /** Counts for checklist context: checked / na / remaining. */
  checklistCounts?: { checked: number; na: number; remaining: number };
  /** N/A reason preserved for documented-exception items. */
  naReason?: NotApplicableReason;
  /** Per-item N/A reasons for checklist items. */
  itemNaReasons?: Record<string, NotApplicableReason>;
  /** Importance/learning text from the template question. */
  importance?: string;
  /** Leading practice summaries from the template question. */
  leadingPractices?: string[];
  /** Helpful links from the template question. */
  helpfulLinks?: { title: string; url: string }[];
}

// ─── Plan Summary ─────────────────────────────────────────────

/**
 * Aggregate counts for a review improvement plan.
 *
 * The primary total excludes documented exceptions;
 * those are available separately for context review.
 */
export interface PlanSummary {
  /** Yes/no "No" answers needing follow-up. */
  followUp: number;
  /** Checklist questions with unchecked, non-N/A items. */
  checklistGaps: number;
  /** Questions with no answer yet. */
  notAssessed: number;
  /** Questions marked N/A (not in primary total). */
  documentedExceptions: number;
  /** followUp + checklistGaps + notAssessed. */
  total: number;
  /** Items with severity = "critical". */
  critical: number;
  /** Items with severity = "high". */
  high: number;
}

// ─── Product Contributor ─────────────────────────────────────

/**
 * How a review contributes to product readiness.
 */
export type ContributorType = "product-review" | "application" | "team";

/**
 * A single contributor to product readiness.
 *
 * Represents one review discovered through a specific
 * product relationship (product-owned, application-linked,
 * or team-owned).
 */
export interface PlanContributor {
  reviewId: string;
  reviewName: string;
  contributorType: ContributorType;
  /** Application or team name when contributor is not a product-level review. */
  sourceName: string;
  sourceId: string;
  summary: PlanSummary;
  /** Most common pillar among the contributor's attention items. */
  topArea: string | null;
  /**
   * Compact per-Revision maturity context (maturity-score/REQ-014;
   * AC-039, AC-062) — one chip per pinned Revision, never a combined
   * score. Absent when the contributor workspace could not be loaded.
   */
  maturity?: CompactMaturityEntry[];
}

// ─── Rollup ───────────────────────────────────────────────────

/**
 * An exact cross-review rollup for repeated attention items.
 *
 * Items are grouped only when template identity and question
 * identity match exactly — no fuzzy text matching.
 */
export interface PlanRollup {
  /** Composite key: `${templateRevisionId}::${questionId}` */
  rollupKey: string;
  templateId: string;
  templateRevisionId: string;
  revisionNumber: number | null;
  questionId: string;
  /** Short display slug (`REL-1`), or `null` when it cannot be derived. */
  questionReference: string | null;
  questionText: string;
  pillarSlug: string;
  pillarName: string;
  severity: RiskLevel;
  /** All plan items that share this exact identity. */
  items: PlanItem[];
  /** Which contributors contain this item. */
  contributors: Pick<
    PlanContributor,
    "reviewId" | "reviewName" | "sourceName" | "contributorType"
  >[];
}

// ─── Product Plan ─────────────────────────────────────────────

/**
 * Product-level improvement plan aggregating all contributors.
 */
export interface ProductPlan {
  productId: string;
  contributors: PlanContributor[];
  rollups: PlanRollup[];
  summary: PlanSummary;
}

// ─── Plan Filter ──────────────────────────────────────────────

export type PlanStateFilter = PlanItemState | "all";
export type PlanSeverityFilter = RiskLevel | "all";

export interface PlanFilters {
  state: PlanStateFilter;
  severity: PlanSeverityFilter;
  pillar: string | "all";
  template: string | "all";
  search: string;
}

// ─── Improvement Plan (Review-Level) ─────────────────────────

/**
 * Review-level improvement plan.
 *
 * Built by `buildImprovementPlan()` from review metadata,
 * selected template details, and answer state.
 */
export interface ImprovementPlan {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  items: PlanItem[];
  summary: PlanSummary;
}

// ─── Product Contributors API types ──────────────────────────

/**
 * Lightweight contributor summary returned by the contributors endpoint.
 * Used to discover which reviews contribute to a product before loading workspaces.
 */
export interface ProductContributorSummary {
  reviewId: string;
  reviewName: string;
  contributorType: ContributorType;
  sourceName: string;
  sourceId: string;
}

export interface ProductContributorsResponse {
  productId: string;
  productName: string;
  contributors: ProductContributorSummary[];
}
