/**
 * Unit tests for product contributor aggregation.
 *
 * Tests buildProductPlan with different contributor scenarios:
 * product-only, application, team, deduplication, and empty.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildProductPlan,
  buildImprovementPlan,
} from "~/services/review/ImprovementPlanProjection";
import {
  makePlanItem,
  makePlanContributor,
  resetFixtureIds,
  makeTeamReviewContext,
  makeProductReviewContext,
  makeApplicationReviewContext,
} from "./improvementPlanFixtures";
import type { PlanContributor } from "~/models/improvement-plan";

describe("buildProductPlan — contributor aggregation", () => {
  beforeEach(() => resetFixtureIds());

  describe("product with no contributors", () => {
    it("returns empty summary when there are no contributors", () => {
      const plan = buildProductPlan("prod-1", [], []);
      expect(plan.productId).toBe("prod-1");
      expect(plan.contributors).toHaveLength(0);
      expect(plan.summary.total).toBe(0);
      expect(plan.rollups).toHaveLength(0);
    });
  });

  describe("product-only reviews", () => {
    it("aggregates a single product-level review contributor", () => {
      const contributor = makePlanContributor({
        reviewId: "rev-product-1",
        reviewName: "Launch Readiness",
        contributorType: "product-review",
        sourceName: "Checkout Experience",
        summary: {
          followUp: 3,
          checklistGaps: 1,
          notAssessed: 2,
          documentedExceptions: 0,
          total: 6,
          critical: 1,
          high: 2,
        },
      });
      const items = [
        makePlanItem({ state: "follow-up", severity: "critical" }),
        makePlanItem({ state: "follow-up", severity: "high" }),
        makePlanItem({ state: "follow-up", severity: "medium" }),
        makePlanItem({ state: "checklist-gap", severity: "high" }),
        makePlanItem({ state: "not-assessed", severity: "medium" }),
        makePlanItem({ state: "not-assessed", severity: "medium" }),
      ];

      const plan = buildProductPlan("prod-1", [contributor], items);

      expect(plan.contributors).toHaveLength(1);
      expect(plan.summary.followUp).toBe(3);
      expect(plan.summary.checklistGaps).toBe(1);
      expect(plan.summary.notAssessed).toBe(2);
      expect(plan.summary.total).toBe(6);
    });
  });

  describe("application contributors", () => {
    it("correctly categorises application contributor types", () => {
      const contributor = makePlanContributor({
        reviewId: "rev-app-1",
        contributorType: "application",
        sourceName: "Checkout API",
        sourceId: "app-checkout",
      });

      const plan = buildProductPlan("prod-1", [contributor], []);

      expect(plan.contributors[0]?.contributorType).toBe("application");
      expect(plan.contributors[0]?.sourceName).toBe("Checkout API");
    });
  });

  describe("team contributors", () => {
    it("correctly categorises team contributor types", () => {
      const contributor = makePlanContributor({
        reviewId: "rev-team-1",
        contributorType: "team",
        sourceName: "Payments Team",
        sourceId: "team-payments",
      });

      const plan = buildProductPlan("prod-1", [contributor], []);

      expect(plan.contributors[0]?.contributorType).toBe("team");
      expect(plan.contributors[0]?.sourceName).toBe("Payments Team");
    });
  });

  describe("duplicate review de-duplication", () => {
    it("deduplicates contributors discovered via multiple paths", () => {
      // Same review ID registered as both product-review and team contributor
      const contributors: PlanContributor[] = [
        makePlanContributor({
          reviewId: "rev-shared",
          contributorType: "product-review",
          sourceName: "Product review A",
        }),
        makePlanContributor({
          reviewId: "rev-shared", // same reviewId
          contributorType: "team",
          sourceName: "Team B",
        }),
        makePlanContributor({
          reviewId: "rev-unique",
          contributorType: "application",
          sourceName: "App C",
        }),
      ];

      const plan = buildProductPlan("prod-1", contributors, []);

      // buildProductPlan deduplicates by reviewId → 2 unique reviews
      expect(plan.contributors).toHaveLength(2);
      const reviewIds = plan.contributors.map((c) => c.reviewId);
      expect(reviewIds).toContain("rev-shared");
      expect(reviewIds).toContain("rev-unique");
    });

    it("keeps the first occurrence when deduplicating", () => {
      const contributors: PlanContributor[] = [
        makePlanContributor({
          reviewId: "rev-dup",
          contributorType: "product-review",
          sourceName: "First",
        }),
        makePlanContributor({
          reviewId: "rev-dup",
          contributorType: "team",
          sourceName: "Second",
        }),
      ];

      const plan = buildProductPlan("prod-1", contributors, []);

      expect(plan.contributors[0]?.sourceName).toBe("First");
      expect(plan.contributors[0]?.contributorType).toBe("product-review");
    });
  });

  describe("summary aggregation", () => {
    it("sums follow-up counts across multiple unique contributors", () => {
      const contributors: PlanContributor[] = [
        makePlanContributor({
          reviewId: "rev-1",
          summary: {
            followUp: 3,
            checklistGaps: 0,
            notAssessed: 1,
            documentedExceptions: 0,
            total: 4,
            critical: 1,
            high: 0,
          },
        }),
        makePlanContributor({
          reviewId: "rev-2",
          summary: {
            followUp: 2,
            checklistGaps: 1,
            notAssessed: 0,
            documentedExceptions: 0,
            total: 3,
            critical: 0,
            high: 2,
          },
        }),
      ];

      const plan = buildProductPlan("prod-1", contributors, []);

      expect(plan.summary.followUp).toBe(5);
      expect(plan.summary.checklistGaps).toBe(1);
      expect(plan.summary.notAssessed).toBe(1);
      expect(plan.summary.total).toBe(7);
      expect(plan.summary.critical).toBe(1);
      expect(plan.summary.high).toBe(2);
    });

    it("excludes duplicate contributor summaries from aggregation", () => {
      const contributors: PlanContributor[] = [
        makePlanContributor({
          reviewId: "rev-dup",
          summary: {
            followUp: 5,
            checklistGaps: 0,
            notAssessed: 0,
            documentedExceptions: 0,
            total: 5,
            critical: 0,
            high: 0,
          },
        }),
        makePlanContributor({
          reviewId: "rev-dup", // duplicate — should not be double-counted
          summary: {
            followUp: 5,
            checklistGaps: 0,
            notAssessed: 0,
            documentedExceptions: 0,
            total: 5,
            critical: 0,
            high: 0,
          },
        }),
      ];

      const plan = buildProductPlan("prod-1", contributors, []);

      // Only counts once, not twice
      expect(plan.summary.followUp).toBe(5);
      expect(plan.summary.total).toBe(5);
    });
  });

  describe("exact repeated-item rollups", () => {
    it("groups items with identical templateId + questionId", () => {
      // Two items from different reviews with same template and question
      const items = [
        makePlanItem({
          state: "follow-up",
          identity: {
            reviewId: "rev-1",
            subjectId: "team-1",
            subjectType: "team",
            templateId: "tpl-shared",
            questionId: "q-001",
            pillarSlug: "security",
          },
        }),
        makePlanItem({
          state: "not-assessed",
          identity: {
            reviewId: "rev-2",
            subjectId: "app-1",
            subjectType: "application",
            templateId: "tpl-shared",
            questionId: "q-001", // same question in same template
            pillarSlug: "security",
          },
        }),
      ];

      const contributors = [
        makePlanContributor({ reviewId: "rev-1", sourceName: "Platform Team" }),
        makePlanContributor({ reviewId: "rev-2", sourceName: "Checkout API" }),
      ];

      const plan = buildProductPlan("prod-1", contributors, items);

      expect(plan.rollups).toHaveLength(1);
      expect(plan.rollups[0]?.questionId).toBe("q-001");
      expect(plan.rollups[0]?.items).toHaveLength(2);
      expect(plan.rollups[0]?.contributors).toEqual([
        expect.objectContaining({
          reviewId: "rev-1",
          sourceName: "Platform Team",
        }),
        expect.objectContaining({
          reviewId: "rev-2",
          sourceName: "Checkout API",
        }),
      ]);
    });

    it("does not group items with the same text from different Revisions", () => {
      const items = [
        makePlanItem({
          identity: {
            reviewId: "rev-1",
            subjectId: "team-1",
            subjectType: "team",
            templateId: "tpl-A",
            templateRevisionId: "revision-A",
            questionId: "q-001",
            pillarSlug: "security",
          },
          questionText: "Same question text",
        }),
        makePlanItem({
          identity: {
            reviewId: "rev-2",
            subjectId: "team-2",
            subjectType: "team",
            templateId: "tpl-B", // different template
            templateRevisionId: "revision-B",
            questionId: "q-001",
            pillarSlug: "security",
          },
          questionText: "Same question text", // same text but different template
        }),
      ];

      const plan = buildProductPlan("prod-1", [], items);

      // Different template IDs → no rollup
      expect(plan.rollups).toHaveLength(0);
    });
  });

  describe("end-to-end: full contributor scenario", () => {
    it("builds a complete product plan from mixed contributor types", () => {
      const ctx1 = makeProductReviewContext({ reviewId: "rev-product" });
      const ctx2 = makeApplicationReviewContext({ reviewId: "rev-app" });
      const ctx3 = makeTeamReviewContext({ reviewId: "rev-team" });

      const plan1 = buildImprovementPlan(ctx1);
      const plan2 = buildImprovementPlan(ctx2);
      const plan3 = buildImprovementPlan(ctx3);

      const contributors = [
        {
          reviewId: plan1.reviewId,
          reviewName: "Launch Readiness",
          contributorType: "product-review" as const,
          sourceName: "Checkout Experience",
          sourceId: "prod-1",
          summary: plan1.summary,
          topArea: null,
        },
        {
          reviewId: plan2.reviewId,
          reviewName: "Checkout API Review",
          contributorType: "application" as const,
          sourceName: "Checkout API",
          sourceId: "app-checkout",
          summary: plan2.summary,
          topArea: null,
        },
        {
          reviewId: plan3.reviewId,
          reviewName: "Platform Team Review",
          contributorType: "team" as const,
          sourceName: "Platform Team",
          sourceId: "team-platform",
          summary: plan3.summary,
          topArea: null,
        },
      ];

      const allItems = [...plan1.items, ...plan2.items, ...plan3.items];
      const productPlan = buildProductPlan("prod-1", contributors, allItems);

      expect(productPlan.contributors).toHaveLength(3);
      expect(productPlan.summary.total).toBe(
        plan1.summary.total + plan2.summary.total + plan3.summary.total
      );
    });
  });
});
