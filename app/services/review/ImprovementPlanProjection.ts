/**
 * Pure projection functions for the improvement plan read model.
 *
 * Builds PlanItem[], PlanSummary, rollups, and filter/sort helpers
 * from template details + answer state. Pure functions with no I/O,
 * no DB access, no Vue — safe to call from any context including
 * server-side rendering, workers, and unit tests.
 */

import type { TemplateRevisionDetail } from "~/models/template";
import type {
  PlanItem,
  PlanItemIdentity,
  PlanItemState,
  PlanSummary,
  ImprovementPlan,
  PlanFilters,
  PlanRollup,
  PlanContributor,
  ProductPlan,
  ContributorType,
} from "~/models/improvement-plan";
import type { AnswerStateLike } from "./ReviewProjection";
import { buildPlanItemFromQuestion } from "./ImprovementPlanProjection-helpers";

// ─── Assessment deep-link helpers ────────────────────────────

const CONTEXT_ROUTE_CONFIG = {
  team: { routeNamePrefix: "team", paramKey: "teamId" },
  product: { routeNamePrefix: "product", paramKey: "productId" },
  application: { routeNamePrefix: "app", paramKey: "appId" },
};

/**
 * Build the route name for navigating to the assessment page
 * for a given subject type.
 */
export function assessmentRouteName(
  subjectType: "team" | "product" | "application"
): string {
  return `${CONTEXT_ROUTE_CONFIG[subjectType].routeNamePrefix}-review-assessment`;
}

/**
 * Build route params for navigating to the assessment page
 * for a plan item's review context.
 */
export function assessmentRouteParams(
  identity: PlanItemIdentity
): Record<string, string> {
  const paramKey = CONTEXT_ROUTE_CONFIG[identity.subjectType].paramKey;
  return {
    [paramKey]: identity.subjectId,
    reviewId: identity.reviewId,
  };
}

/**
 * Build the URL hash for scrolling to a specific pillar or question
 * in the assessment view.
 */
function assessmentAnchor(pillarSlug: string, questionId?: string): string {
  if (questionId) {
    return `#question-${questionId}`;
  }
  return `#pillar-${pillarSlug}`;
}

/**
 * Build the full navigation target for opening a plan item
 * in the assessment view.
 */
export function assessmentDeepLink(identity: PlanItemIdentity): {
  name: string;
  params: Record<string, string>;
  query: { templateRevisionId: string };
  hash: string;
} {
  return {
    name: assessmentRouteName(identity.subjectType),
    params: assessmentRouteParams(identity),
    query: { templateRevisionId: identity.templateRevisionId },
    hash: assessmentAnchor(identity.pillarSlug, identity.questionId),
  };
}

// ─── ReviewContext ────────────────────────────────────────────

/**
 * Minimal input shape needed to build an improvement plan.
 */
export interface ReviewContext {
  reviewId: string;
  subjectId: string;
  subjectType: "team" | "product" | "application";
  templates: TemplateRevisionDetail[];
  answers: AnswerStateLike[];
}

// ─── Plan building ────────────────────────────────────────────

/**
 * Build a complete improvement plan from review context.
 *
 * Iterates all questions across all templates, overlays answer state,
 * classifies attention items, and computes the summary.
 */
export function buildImprovementPlan(ctx: ReviewContext): ImprovementPlan {
  const answerByQuestionId = new Map(
    ctx.answers.map((a) => [a.questionId, a] as const)
  );

  // Flatten the template→pillar→question hierarchy into a single iterable
  // to avoid triple-nested loops triggering max-depth.
  const allQuestions = ctx.templates.flatMap((template) =>
    template.pillars.flatMap((pillar) =>
      pillar.questions.map((q) => ({ q, pillar, template }))
    )
  );

  const items: PlanItem[] = [];
  for (const { q, pillar, template } of allQuestions) {
    const item = buildPlanItemFromQuestion(q, {
      reviewId: ctx.reviewId,
      subjectId: ctx.subjectId,
      subjectType: ctx.subjectType,
      template,
      pillar,
      answerByQuestionId,
    });
    if (item !== null) items.push(item);
  }

  const summary = buildPlanSummary(items);

  return {
    reviewId: ctx.reviewId,
    subjectId: ctx.subjectId,
    subjectType: ctx.subjectType,
    items,
    summary,
  };
}

// ─── Summary ──────────────────────────────────────────────────

/**
 * Compute aggregate summary counts from a list of plan items.
 */
function buildPlanSummary(items: PlanItem[]): PlanSummary {
  let followUp = 0;
  let checklistGaps = 0;
  let notAssessed = 0;
  let documentedExceptions = 0;
  let critical = 0;
  let high = 0;

  for (const item of items) {
    switch (item.state) {
      case "follow-up":
        followUp++;
        break;
      case "checklist-gap":
        checklistGaps++;
        break;
      case "not-assessed":
        notAssessed++;
        break;
      case "documented-exception":
        documentedExceptions++;
        break;
    }
    // Severity counts exclude documented exceptions
    if (item.state !== "documented-exception") {
      if (item.severity === "critical") critical++;
      else if (item.severity === "high") high++;
    }
  }

  return {
    followUp,
    checklistGaps,
    notAssessed,
    documentedExceptions,
    total: followUp + checklistGaps + notAssessed,
    critical,
    high,
  };
}

// ─── Filtering ─────────────────────────────────────────────────

/**
 * Filter plan items by state, severity, pillar, template, and search text.
 */
export function filterPlanItems(
  items: PlanItem[],
  filters: PlanFilters
): PlanItem[] {
  return items.filter((item) => {
    if (filters.state !== "all" && item.state !== filters.state) return false;

    if (filters.severity !== "all" && item.severity !== filters.severity)
      return false;

    if (
      filters.pillar !== "all" &&
      `${item.identity.templateRevisionId}::${item.identity.pillarSlug}` !==
        filters.pillar
    )
      return false;

    if (
      filters.template !== "all" &&
      item.identity.templateRevisionId !== filters.template
    )
      return false;

    if (filters.search) {
      const query = filters.search.toLowerCase();
      const matchesText = item.questionText.toLowerCase().includes(query);
      const matchesId = item.identity.questionId.toLowerCase().includes(query);
      // The badge shows the derived slug, so "REL-1" has to find its row.
      const matchesReference =
        item.questionReference?.toLowerCase().includes(query) ?? false;
      const matchesPillar = item.pillarName.toLowerCase().includes(query);
      if (!matchesText && !matchesId && !matchesReference && !matchesPillar)
        return false;
    }

    return true;
  });
}

// ─── Sorting ──────────────────────────────────────────────────

/**
 * Severity rank for sorting: lower = higher priority.
 */
const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

/**
 * State rank for sorting at same severity: lower = higher priority.
 * follow-up and checklist-gap are "active" and sort before not-assessed.
 * documented-exceptions sort last.
 */
const STATE_RANK: Record<PlanItemState, number> = {
  "follow-up": 0,
  "checklist-gap": 1,
  "not-assessed": 2,
  "documented-exception": 3,
};

/**
 * Sort plan items by recommended priority:
 * 1. Severity (critical → high → medium)
 * 2. State (follow-up/checklist-gap → not-assessed → documented-exception)
 */
export function sortPlanItems(items: PlanItem[]): PlanItem[] {
  return [...items].toSorted((a, b) => {
    const sevA = SEVERITY_RANK[a.severity] ?? 99;
    const sevB = SEVERITY_RANK[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;

    const stateA = STATE_RANK[a.state];
    const stateB = STATE_RANK[b.state];
    if (stateA !== stateB) return stateA - stateB;

    return 0;
  });
}

// ─── Rollup grouping ──────────────────────────────────────────

/**
 * Group plan items by exact template + question identity for cross-review rollups.
 *
 * Only groups when template identity AND question identity match exactly.
 * Similar text from different templates does NOT group.
 * Single items (no duplicate) do not produce a rollup.
 */
export function groupExactRollups(items: PlanItem[]): PlanRollup[] {
  const groups = new Map<string, PlanItem[]>();

  for (const item of items) {
    const key = `${item.identity.templateRevisionId}::${item.identity.questionId}`;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const rollups: PlanRollup[] = [];

  for (const [key, groupedItems] of groups) {
    // Only create rollups for items that appear 2+ times
    if (groupedItems.length < 2) continue;

    const first = groupedItems[0]!;
    const [templateRevisionId, questionId] = key.split("::");

    const contributors = groupedItems.map((item) => ({
      reviewId: item.identity.reviewId,
      reviewName: item.identity.reviewId,
      sourceName: item.identity.subjectId,
      contributorType: "product-review" as ContributorType,
    }));

    rollups.push({
      rollupKey: key,
      templateId: first.identity.templateId,
      templateRevisionId: templateRevisionId!,
      revisionNumber: first.revisionNumber,
      questionId: questionId!,
      questionReference: first.questionReference,
      questionText: first.questionText,
      pillarSlug: first.identity.pillarSlug,
      pillarName: first.pillarName,
      severity: first.severity,
      items: groupedItems,
      contributors,
    });
  }

  return rollups;
}

// ─── Top area ────────────────────────────────────────────────

/**
 * Return the pillar slug with the most plan items, or null when the list is empty.
 */
export function computeTopArea(items: PlanItem[]): string | null {
  if (items.length === 0) return null;
  const pillarCounts = new Map<string, number>();
  for (const item of items) {
    pillarCounts.set(
      item.identity.pillarSlug,
      (pillarCounts.get(item.identity.pillarSlug) ?? 0) + 1
    );
  }
  return (
    [...pillarCounts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0] ??
    null
  );
}

// ─── Product plan ─────────────────────────────────────────────

/**
 * Build a product-level improvement plan by aggregating contributors.
 *
 * Deduplicates reviews by reviewId across overlapping discovery paths.
 */
export function buildProductPlan(
  productId: string,
  contributors: PlanContributor[],
  allPlanItems: PlanItem[]
): ProductPlan {
  // Deduplicate contributors by reviewId
  const seen = new Set<string>();
  const uniqueContributors = contributors.filter((c) => {
    if (seen.has(c.reviewId)) return false;
    seen.add(c.reviewId);
    return true;
  });

  const contributorByReviewId = new Map(
    uniqueContributors.map((contributor) => [contributor.reviewId, contributor])
  );

  // Build rollups across all plan items
  const rollups = groupExactRollups(allPlanItems).map((rollup) =>
    Object.assign({}, rollup, {
      contributors: rollup.items.map((item) => {
        const contributor = contributorByReviewId.get(item.identity.reviewId);
        return {
          reviewId: item.identity.reviewId,
          reviewName: contributor?.reviewName ?? item.identity.reviewId,
          sourceName: contributor?.sourceName ?? item.identity.subjectId,
          contributorType:
            contributor?.contributorType ??
            (item.identity.subjectType === "application"
              ? "application"
              : item.identity.subjectType === "team"
                ? "team"
                : "product-review"),
        };
      }),
    })
  );

  // Aggregate summary
  const summary: PlanSummary = {
    followUp: 0,
    checklistGaps: 0,
    notAssessed: 0,
    documentedExceptions: 0,
    total: 0,
    critical: 0,
    high: 0,
  };

  for (const contributor of uniqueContributors) {
    summary.followUp += contributor.summary.followUp;
    summary.checklistGaps += contributor.summary.checklistGaps;
    summary.notAssessed += contributor.summary.notAssessed;
    summary.documentedExceptions += contributor.summary.documentedExceptions;
    summary.critical += contributor.summary.critical;
    summary.high += contributor.summary.high;
  }
  summary.total =
    summary.followUp + summary.checklistGaps + summary.notAssessed;

  return {
    productId,
    contributors: uniqueContributors,
    rollups,
    summary,
  };
}
