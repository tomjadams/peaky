/**
 * Unit tests for plan filter and sort logic used by review plan pages.
 *
 * Tests filterPlanItems and sortPlanItems to verify that the filter bar
 * and view mode logic in the plan pages produce correct results.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  filterPlanItems,
  sortPlanItems,
} from "~/services/review/ImprovementPlanProjection";
import { makePlanItem, resetFixtureIds } from "./improvementPlanFixtures";
import type { PlanFilters } from "~/models/improvement-plan";

const ALL_FILTERS: PlanFilters = {
  state: "all",
  severity: "all",
  pillar: "all",
  template: "all",
  search: "",
};

describe("filterPlanItems", () => {
  beforeEach(() => resetFixtureIds());

  it("returns all items when all filters are 'all'", () => {
    const items = [
      makePlanItem({ state: "follow-up", severity: "critical" }),
      makePlanItem({ state: "not-assessed", severity: "medium" }),
    ];
    expect(filterPlanItems(items, ALL_FILTERS)).toHaveLength(2);
  });

  describe("state filter", () => {
    it("filters to follow-up items only", () => {
      const items = [
        makePlanItem({ state: "follow-up" }),
        makePlanItem({ state: "not-assessed" }),
        makePlanItem({ state: "checklist-gap" }),
      ];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        state: "follow-up",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.state).toBe("follow-up");
    });

    it("filters to documented-exception items", () => {
      const items = [
        makePlanItem({ state: "follow-up" }),
        makePlanItem({ state: "documented-exception" }),
      ];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        state: "documented-exception",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.state).toBe("documented-exception");
    });
  });

  describe("severity filter", () => {
    it("filters to critical items only", () => {
      const items = [
        makePlanItem({ severity: "critical" }),
        makePlanItem({ severity: "high" }),
        makePlanItem({ severity: "medium" }),
      ];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        severity: "critical",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.severity).toBe("critical");
    });
  });

  describe("pillar filter", () => {
    it("filters by exact Revision Pillar identity", () => {
      const item1 = makePlanItem({});
      const item2 = makePlanItem({});
      item1.identity.pillarSlug = "security";
      item2.identity.pillarSlug = "reliability";

      const result = filterPlanItems([item1, item2], {
        ...ALL_FILTERS,
        pillar: "revision-1::security",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.identity.pillarSlug).toBe("security");
    });
  });

  describe("search filter", () => {
    it("matches on question text (case insensitive)", () => {
      const items = [
        makePlanItem({ questionText: "Have you performed a failover test?" }),
        makePlanItem({ questionText: "Do you rotate secrets quarterly?" }),
      ];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        search: "failover",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.questionText).toContain("failover");
    });

    it("returns empty when no items match search", () => {
      const items = [makePlanItem({ questionText: "Do you rotate secrets?" })];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        search: "quantum computing",
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("combined filters", () => {
    it("applies multiple filters conjunctively", () => {
      const items = [
        makePlanItem({ state: "follow-up", severity: "critical" }),
        makePlanItem({ state: "follow-up", severity: "medium" }),
        makePlanItem({ state: "not-assessed", severity: "critical" }),
      ];
      const result = filterPlanItems(items, {
        ...ALL_FILTERS,
        state: "follow-up",
        severity: "critical",
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.state).toBe("follow-up");
      expect(result[0]?.severity).toBe("critical");
    });
  });
});

describe("sortPlanItems", () => {
  beforeEach(() => resetFixtureIds());

  it("sorts critical before high before medium", () => {
    const items = [
      makePlanItem({ state: "follow-up", severity: "medium" }),
      makePlanItem({ state: "follow-up", severity: "critical" }),
      makePlanItem({ state: "follow-up", severity: "high" }),
    ];
    const sorted = sortPlanItems(items);
    expect(sorted[0]?.severity).toBe("critical");
    expect(sorted[1]?.severity).toBe("high");
    expect(sorted[2]?.severity).toBe("medium");
  });

  it("sorts follow-up before checklist-gap before not-assessed at same severity", () => {
    const items = [
      makePlanItem({ state: "not-assessed", severity: "high" }),
      makePlanItem({ state: "checklist-gap", severity: "high" }),
      makePlanItem({ state: "follow-up", severity: "high" }),
    ];
    const sorted = sortPlanItems(items);
    expect(sorted[0]?.state).toBe("follow-up");
    expect(sorted[1]?.state).toBe("checklist-gap");
    expect(sorted[2]?.state).toBe("not-assessed");
  });

  it("puts documented-exceptions last within same severity", () => {
    const items = [
      makePlanItem({ state: "documented-exception", severity: "medium" }),
      makePlanItem({ state: "not-assessed", severity: "medium" }),
    ];
    const sorted = sortPlanItems(items);
    expect(sorted[0]?.state).toBe("not-assessed");
    expect(sorted[1]?.state).toBe("documented-exception");
  });

  it("does not mutate the original array", () => {
    const items = [
      makePlanItem({ state: "not-assessed", severity: "medium" }),
      makePlanItem({ state: "follow-up", severity: "critical" }),
    ];
    const original = [...items];
    sortPlanItems(items);
    expect(items[0]?.state).toBe(original[0]?.state);
    expect(items[1]?.state).toBe(original[1]?.state);
  });
});
