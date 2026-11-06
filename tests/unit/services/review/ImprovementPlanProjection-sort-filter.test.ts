/**
 * Unit tests for improvement plan projection / read model.
 *
 * Run: pnpm vitest tests/unit/services/review/ImprovementPlanProjection.test.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { PlanItem, PlanFilters } from "~/models/improvement-plan";
import { resetFixtureIds, makePlanItem } from "./improvementPlanFixtures";
import {
  filterPlanItems,
  sortPlanItems,
  groupExactRollups,
} from "~/services/review/ImprovementPlanProjection";

beforeEach(() => {
  resetFixtureIds();
});

describe("recommended sorting", () => {
  it("sorts critical before high, high before medium", () => {
    const items: PlanItem[] = [
      makePlanItem({
        severity: "medium",
        state: "follow-up",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-m",
        },
      }),
      makePlanItem({
        severity: "critical",
        state: "follow-up",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-c",
        },
      }),
      makePlanItem({
        severity: "high",
        state: "follow-up",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-h",
        },
      }),
    ];

    const sorted = sortPlanItems(items);

    expect(sorted.map((i) => i.severity)).toEqual([
      "critical",
      "high",
      "medium",
    ]);
  });

  it("at same severity, follow-up and checklist-gap appear before not-assessed", () => {
    const items: PlanItem[] = [
      makePlanItem({
        severity: "high",
        state: "not-assessed",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-na",
        },
      }),
      makePlanItem({
        severity: "high",
        state: "checklist-gap",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-cg",
        },
      }),
      makePlanItem({
        severity: "high",
        state: "follow-up",
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "p",
          questionId: "q-fu",
        },
      }),
    ];

    const sorted = sortPlanItems(items);

    const states = sorted.map((i) => i.state);
    // follow-up and checklist-gap before not-assessed
    expect(states.indexOf("not-assessed")).toBeGreaterThan(
      states.indexOf("follow-up")
    );
    expect(states.indexOf("not-assessed")).toBeGreaterThan(
      states.indexOf("checklist-gap")
    );
  });

  it("has no score or priority field in its contract", () => {
    const item = makePlanItem();
    expect(item).not.toHaveProperty("score");
    expect(item).not.toHaveProperty("priority");
  });
});

describe("exact rollup grouping", () => {
  it("groups items from same template/question across reviews", () => {
    const items: PlanItem[] = [
      makePlanItem({
        identity: {
          reviewId: "review-1",
          subjectId: "team-1",
          subjectType: "team",
          templateId: "tpl-1",
          pillarSlug: "security",
          questionId: "q-1",
        },
        questionText: "Is auth configured?",
        severity: "critical",
      }),
      makePlanItem({
        identity: {
          reviewId: "review-2",
          subjectId: "team-2",
          subjectType: "team",
          templateId: "tpl-1",
          pillarSlug: "security",
          questionId: "q-1",
        },
        questionText: "Is auth configured?",
        severity: "critical",
      }),
    ];

    const rollups = groupExactRollups(items);

    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.items).toHaveLength(2);
    expect(rollups[0]!.rollupKey).toBe("revision-1::q-1");
  });

  it("does not group similar text from different templates", () => {
    const items: PlanItem[] = [
      makePlanItem({
        identity: {
          reviewId: "review-1",
          subjectId: "team-1",
          subjectType: "team",
          templateId: "tpl-1",
          pillarSlug: "security",
          questionId: "q-1",
        },
        questionText: "Is auth configured?",
        pillarName: "Security",
      }),
      makePlanItem({
        identity: {
          reviewId: "review-2",
          subjectId: "team-2",
          subjectType: "team",
          templateId: "tpl-2",
          pillarSlug: "security",
          questionId: "q-99",
        },
        questionText: "Is auth configured?", // Same text but different template/question
        pillarName: "Security",
      }),
    ];

    const rollups = groupExactRollups(items);

    // Should NOT group — different template and question identity
    // Neither appears twice, so no rollups produced
    expect(rollups).toHaveLength(0);
  });

  it("does not group the same Question identity across different Revisions", () => {
    const items = [
      makePlanItem({
        identity: {
          reviewId: "review-1",
          templateId: "tpl-1",
          templateRevisionId: "revision-1",
          questionId: "q-1",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "review-2",
          templateId: "tpl-1",
          templateRevisionId: "revision-2",
          questionId: "q-1",
        },
      }),
    ];

    expect(groupExactRollups(items)).toEqual([]);
  });

  it("does not group different questions from same template", () => {
    const items: PlanItem[] = [
      makePlanItem({
        identity: {
          reviewId: "review-1",
          subjectId: "team-1",
          subjectType: "team",
          templateId: "tpl-1",
          pillarSlug: "security",
          questionId: "q-1",
        },
        questionText: "Is auth configured?",
      }),
      makePlanItem({
        identity: {
          reviewId: "review-1",
          subjectId: "team-1",
          subjectType: "team",
          templateId: "tpl-1",
          pillarSlug: "security",
          questionId: "q-2",
        },
        questionText: "Is encryption enabled?",
      }),
    ];

    const rollups = groupExactRollups(items);

    // Different question IDs — no rollups (neither appears twice)
    expect(rollups).toHaveLength(0);
  });
});

describe("plan filters", () => {
  const items: PlanItem[] = [
    makePlanItem({
      state: "follow-up",
      severity: "critical",
      pillarName: "Security",
      templateName: "Security Review",
      questionText: "Is auth configured?",
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "tpl-1",
        templateRevisionId: "revision-1",
        pillarSlug: "security",
        questionId: "q-1",
      },
    }),
    makePlanItem({
      state: "checklist-gap",
      severity: "high",
      pillarName: "Security",
      templateName: "Security Review",
      questionText: "Are practices followed?",
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "tpl-1",
        templateRevisionId: "revision-1",
        pillarSlug: "security",
        questionId: "q-2",
      },
    }),
    makePlanItem({
      state: "not-assessed",
      severity: "medium",
      pillarName: "Reliability",
      templateName: "Reliability Review",
      questionText: "Are health checks in place?",
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "tpl-2",
        templateRevisionId: "revision-2",
        pillarSlug: "reliability",
        questionId: "q-3",
      },
    }),
    makePlanItem({
      state: "documented-exception",
      severity: "medium",
      pillarName: "Reliability",
      templateName: "Reliability Review",
      questionText: "Are backups tested?",
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "tpl-2",
        templateRevisionId: "revision-2",
        pillarSlug: "reliability",
        questionId: "q-4",
      },
    }),
  ];

  it("filters by state", () => {
    const filters: PlanFilters = {
      state: "follow-up",
      severity: "all",
      pillar: "all",
      template: "all",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.state).toBe("follow-up");
  });

  it("filters by severity", () => {
    const filters: PlanFilters = {
      state: "all",
      severity: "critical",
      pillar: "all",
      template: "all",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.severity).toBe("critical");
  });

  it("filters by pillar", () => {
    const filters: PlanFilters = {
      state: "all",
      severity: "all",
      pillar: "revision-1::security",
      template: "all",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(2);
    expect(filtered.every((i) => i.identity.pillarSlug === "security")).toBe(
      true
    );
  });

  it("filters by template", () => {
    const filters: PlanFilters = {
      state: "all",
      severity: "all",
      pillar: "all",
      template: "revision-2",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(2);
    expect(filtered.every((i) => i.identity.templateId === "tpl-2")).toBe(true);
  });

  it("filters by search text (case-insensitive)", () => {
    const filters: PlanFilters = {
      state: "all",
      severity: "all",
      pillar: "all",
      template: "all",
      search: "auth",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.questionText).toContain("auth");
  });

  it("all filters combined", () => {
    const filters: PlanFilters = {
      state: "follow-up",
      severity: "critical",
      pillar: "revision-1::security",
      template: "revision-1",
      search: "auth",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(1);
  });

  it("returns empty when no items match", () => {
    const filters: PlanFilters = {
      state: "follow-up",
      severity: "medium",
      pillar: "reliability",
      template: "revision-1",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(0);
  });

  it("'all' passes everything through", () => {
    const filters: PlanFilters = {
      state: "all",
      severity: "all",
      pillar: "all",
      template: "all",
      search: "",
    };
    const filtered = filterPlanItems(items, filters);

    expect(filtered).toHaveLength(items.length);
  });
});
