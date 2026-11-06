/**
 * Unit tests for usePlanItemSections pure helper functions.
 *
 * These helpers are shared by both the review-level plan table view
 * and the product rollup components — regressions here affect both.
 *
 * Run: pnpm vitest tests/unit/services/review/usePlanItemSections.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeSeverity,
  sectionDescription,
  severityAccentClass,
  itemKey,
  canLearnWhy,
} from "~/composables/review/usePlanItemSections";
import { computeTopArea } from "~/services/review/ImprovementPlanProjection";
import { makePlanItem, resetFixtureIds } from "./improvementPlanFixtures";

beforeEach(() => resetFixtureIds());

// ─── normalizeSeverity ─────────────────────────────────────────

describe("normalizeSeverity", () => {
  it("passes through valid severity values unchanged", () => {
    expect(normalizeSeverity("critical")).toBe("critical");
    expect(normalizeSeverity("high")).toBe("high");
    expect(normalizeSeverity("medium")).toBe("medium");
  });

  it("falls back to 'medium' for unrecognised values", () => {
    expect(normalizeSeverity("low")).toBe("medium");
    expect(normalizeSeverity("")).toBe("medium");
    expect(normalizeSeverity("unknown")).toBe("medium");
  });
});

// ─── sectionDescription ───────────────────────────────────────

describe("sectionDescription", () => {
  it("returns a specific message for critical severity", () => {
    expect(sectionDescription("critical")).toContain("highest");
  });

  it("returns a specific message for high severity", () => {
    expect(sectionDescription("high")).toContain("readiness");
  });

  it("returns a default message for medium and unrecognised severities", () => {
    const medium = sectionDescription("medium");
    expect(medium).toBeTruthy();
    expect(sectionDescription("unknown")).toBe(medium);
  });
});

// ─── severityAccentClass ──────────────────────────────────────

describe("severityAccentClass", () => {
  it("returns an error class for critical severity", () => {
    expect(severityAccentClass("critical")).toContain("error");
  });

  it("returns a warning class for high severity", () => {
    expect(severityAccentClass("high")).toContain("warning");
  });

  it("returns a distinct class for medium and falls back consistently", () => {
    const medium = severityAccentClass("medium");
    expect(medium).toBeTruthy();
    expect(severityAccentClass("unknown")).toBe(medium);
  });

  it("returns different values for each standard severity", () => {
    const classes = ["critical", "high", "medium"].map(severityAccentClass);
    const unique = new Set(classes);
    expect(unique.size).toBe(3);
  });
});

// ─── itemKey ─────────────────────────────────────────────────

describe("itemKey", () => {
  it("includes Review, Revision, and Question identity in the key", () => {
    const item = makePlanItem({
      identity: {
        reviewId: "rev-1",
        subjectId: "team-1",
        subjectType: "team",
        templateId: "tpl-1",
        templateRevisionId: "revision-1",
        pillarSlug: "security",
        questionId: "q-1",
      },
    });
    const key = itemKey(item);
    expect(key).toContain("rev-1");
    expect(key).toContain("revision-1");
    expect(key).toContain("q-1");
  });

  it("produces different keys for items with different questionIds", () => {
    const a = makePlanItem({
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "t",
        pillarSlug: "p",
        questionId: "q-1",
      },
    });
    const b = makePlanItem({
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "t",
        pillarSlug: "p",
        questionId: "q-2",
      },
    });
    expect(itemKey(a)).not.toBe(itemKey(b));
  });

  it("includes checklistItemIds in the key when present", () => {
    const item = makePlanItem({
      identity: {
        reviewId: "r",
        subjectId: "s",
        subjectType: "team",
        templateId: "t",
        pillarSlug: "p",
        questionId: "q-1",
        checklistItemIds: ["cl-1", "cl-2"],
      },
    });
    expect(itemKey(item)).toContain("cl-1");
    expect(itemKey(item)).toContain("cl-2");
  });

  it("produces the same key for the same item each time (stable)", () => {
    const item = makePlanItem();
    expect(itemKey(item)).toBe(itemKey(item));
  });
});

// ─── canLearnWhy ─────────────────────────────────────────────

describe("canLearnWhy", () => {
  it("returns false when item has no importance, practices, or links", () => {
    const item = makePlanItem({
      importance: undefined,
      leadingPractices: undefined,
      helpfulLinks: undefined,
    });
    expect(canLearnWhy(item)).toBe(false);
  });

  it("returns true when item has importance text", () => {
    const item = makePlanItem({
      importance: "Secrets rotation reduces blast radius",
    });
    expect(canLearnWhy(item)).toBe(true);
  });

  it("returns true when item has at least one leading practice", () => {
    const item = makePlanItem({
      importance: undefined,
      leadingPractices: ["Use a secrets manager"],
    });
    expect(canLearnWhy(item)).toBe(true);
  });

  it("returns true when item has at least one helpful link", () => {
    const item = makePlanItem({
      importance: undefined,
      leadingPractices: [],
      helpfulLinks: [{ title: "AWS Docs", url: "https://aws.amazon.com" }],
    });
    expect(canLearnWhy(item)).toBe(true);
  });

  it("returns false when practices and links are empty arrays", () => {
    const item = makePlanItem({
      importance: undefined,
      leadingPractices: [],
      helpfulLinks: [],
    });
    expect(canLearnWhy(item)).toBe(false);
  });
});

// ─── computeTopArea ──────────────────────────────────────────

describe("computeTopArea", () => {
  it("returns null for an empty items list", () => {
    expect(computeTopArea([])).toBeNull();
  });

  it("returns the only pillar when all items share one pillar", () => {
    const items = [
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-1",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-2",
        },
      }),
    ];
    expect(computeTopArea(items)).toBe("security");
  });

  it("returns the pillar with the most items", () => {
    const items = [
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-1",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-2",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "reliability",
          questionId: "q-3",
        },
      }),
    ];
    expect(computeTopArea(items)).toBe("security");
  });

  it("returns a single pillar when only one item exists", () => {
    const items = [
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "reliability",
          questionId: "q-1",
        },
      }),
    ];
    expect(computeTopArea(items)).toBe("reliability");
  });

  it("is deterministic: multiple calls with the same input return the same result", () => {
    const items = [
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-1",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "reliability",
          questionId: "q-2",
        },
      }),
      makePlanItem({
        identity: {
          reviewId: "r",
          subjectId: "s",
          subjectType: "team",
          templateId: "t",
          pillarSlug: "security",
          questionId: "q-3",
        },
      }),
    ];
    expect(computeTopArea(items)).toBe(computeTopArea(items));
  });
});
