/**
 * Unit tests for improvement plan projection / read model.
 *
 * Run: pnpm vitest tests/unit/services/review/ImprovementPlanProjection.test.ts
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { NotApplicableReason } from "~/models/question";
import {
  resetFixtureIds,
  makeTemplateRevisionDetail,
  makeTemplatePillar,
  makeTemplateQuestion,
  makeChecklistTemplateQuestion,
  makeYesAnswer,
  makeNoAnswer,
  makeNAAnswer,
  makeUnanswered,
  makeChecklistAnswer,
  makeChecklistAnswerWithItemNA,
  makeTeamReviewContext,
  makePlanItem,
} from "./improvementPlanFixtures";
import {
  assessmentDeepLink,
  assessmentRouteName,
  assessmentRouteParams,
  buildImprovementPlan,
} from "~/services/review/ImprovementPlanProjection";

beforeEach(() => {
  resetFixtureIds();
});

describe("assessment route helpers", () => {
  it("uses concrete route names for each review context", () => {
    expect(assessmentRouteName("team")).toBe("team-review-assessment");
    expect(assessmentRouteName("product")).toBe("product-review-assessment");
    expect(assessmentRouteName("application")).toBe("app-review-assessment");
  });

  it("uses the matching subject param key for deep links", () => {
    const identity = makePlanItem({
      identity: {
        reviewId: "review-1",
        subjectId: "team-1",
        subjectType: "team",
        templateId: "template-1",
        templateRevisionId: "revision-1",
        pillarSlug: "security",
        questionId: "question-1",
      },
    }).identity;

    expect(assessmentRouteParams(identity)).toEqual({
      teamId: "team-1",
      reviewId: "review-1",
    });
    expect(assessmentDeepLink(identity)).toMatchObject({
      name: "team-review-assessment",
      query: { templateRevisionId: "revision-1" },
      hash: "#question-question-1",
    });
  });
});

describe("attention-item classification", () => {
  it("yes/no question answered No → follow-up item", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeTemplateQuestion({
              id: "q-1",
              riskLevel: "high",
              text: "Is auth configured?",
            }),
          ],
        }),
      ],
    });
    const answers = [makeNoAnswer("q-1")];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.state).toBe("follow-up");
    expect(plan.items[0]!.identity.questionId).toBe("q-1");
    expect(plan.items[0]!.severity).toBe("high");
  });

  it("yes/no question answered Yes → not in plan", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [makeTemplateQuestion({ id: "q-1", riskLevel: "high" })],
        }),
      ],
    });
    const answers = [makeYesAnswer("q-1")];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(0);
  });

  it("unanswered question → not-assessed item", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [makeTemplateQuestion({ id: "q-1", riskLevel: "medium" })],
        }),
      ],
    });
    const answers = [makeUnanswered("q-1")];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.state).toBe("not-assessed");
  });

  it("question marked N/A → documented-exception item", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [makeTemplateQuestion({ id: "q-1", riskLevel: "medium" })],
        }),
      ],
    });
    const reason: NotApplicableReason = {
      reason: "not-in-scope",
      comment: "Legacy service",
    };
    const answers = [makeNAAnswer("q-1", reason)];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.state).toBe("documented-exception");
    expect(plan.items[0]!.naReason).toEqual(reason);
  });

  it("checklist with partial answers → checklist-gap item", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeChecklistTemplateQuestion(
              [
                { id: "cl-1", text: "Practice A" },
                { id: "cl-2", text: "Practice B" },
                { id: "cl-3", text: "Practice C" },
              ],
              { id: "q-1", riskLevel: "critical" }
            ),
          ],
        }),
      ],
    });
    // Practice A checked, Practice B and C not
    const answers = [makeChecklistAnswer("q-1", ["cl-1"])];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.state).toBe("checklist-gap");
    expect(plan.items[0]!.checklistCounts).toEqual({
      checked: 1,
      na: 0,
      remaining: 2,
    });
    expect(plan.items[0]!.missingChecklistItems).toEqual([
      "Practice B",
      "Practice C",
    ]);
  });

  it("checklist with some items N/A → checklist-gap for remaining unchecked non-NA", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeChecklistTemplateQuestion(
              [
                { id: "cl-1", text: "Practice A" },
                { id: "cl-2", text: "Practice B" },
                { id: "cl-3", text: "Practice C" },
              ],
              { id: "q-1", riskLevel: "high" }
            ),
          ],
        }),
      ],
    });
    const itemNAReason: NotApplicableReason = { reason: "legacy-system" };
    const answers = [
      makeChecklistAnswerWithItemNA("q-1", ["cl-1"], ["cl-2"], {
        "cl-2": itemNAReason,
      }),
    ];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]!.state).toBe("checklist-gap");
    expect(plan.items[0]!.checklistCounts).toEqual({
      checked: 1,
      na: 1,
      remaining: 1,
    });
    // Only Practice C is missing (B is N/A)
    expect(plan.items[0]!.missingChecklistItems).toEqual(["Practice C"]);
  });

  it("fully accounted checklist (all checked or N/A) → not in plan", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeChecklistTemplateQuestion(
              [
                { id: "cl-1", text: "Practice A" },
                { id: "cl-2", text: "Practice B" },
              ],
              { id: "q-1" }
            ),
          ],
        }),
      ],
    });
    const itemNAReason: NotApplicableReason = { reason: "other" };
    const answers = [
      makeChecklistAnswerWithItemNA("q-1", ["cl-1"], ["cl-2"], {
        "cl-2": itemNAReason,
      }),
    ];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(0);
  });

  it("empty review (no answers) → all questions are not-assessed", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeTemplateQuestion({ id: "q-1", riskLevel: "critical" }),
            makeTemplateQuestion({ id: "q-2", riskLevel: "high" }),
          ],
        }),
      ],
    });
    const ctx = makeTeamReviewContext({ templates: [template], answers: [] });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(2);
    expect(plan.items.every((item) => item.state === "not-assessed")).toBe(
      true
    );
  });

  it("mixed answer states produce correct classifications across multiple items", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          name: "Security",
          questions: [
            makeTemplateQuestion({
              id: "q-1",
              riskLevel: "critical",
              text: "Is auth configured?",
            }),
            makeTemplateQuestion({
              id: "q-2",
              riskLevel: "high",
              text: "Is encryption enabled?",
            }),
            makeTemplateQuestion({
              id: "q-3",
              riskLevel: "medium",
              text: "Are logs reviewed?",
            }),
          ],
        }),
      ],
    });
    const answers = [
      makeNoAnswer("q-1"), // follow-up
      makeYesAnswer("q-2"), // not in plan
      makeUnanswered("q-3"), // not-assessed
    ];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.items).toHaveLength(2);
    const states = plan.items.map((item) => item.state);
    expect(states).toContain("follow-up");
    expect(states).toContain("not-assessed");
    expect(states).not.toContain("checklist-gap");
  });
});

describe("plan summary counts", () => {
  it("counts follow-up, checklist gaps, not assessed, and documented exceptions", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          name: "Security",
          questions: [
            makeTemplateQuestion({ id: "q-1", riskLevel: "critical" }),
            makeTemplateQuestion({ id: "q-2", riskLevel: "high" }),
            makeTemplateQuestion({ id: "q-3", riskLevel: "medium" }),
            makeChecklistTemplateQuestion(
              [
                { id: "cl-1", text: "A" },
                { id: "cl-2", text: "B" },
              ],
              { id: "q-4", riskLevel: "medium" }
            ),
          ],
        }),
      ],
    });
    const answers = [
      makeNoAnswer("q-1"), // follow-up
      makeUnanswered("q-2"), // not-assessed
      makeNAAnswer("q-3"), // documented-exception
      makeChecklistAnswer("q-4", ["cl-1"]), // checklist-gap (cl-2 unchecked)
    ];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);
    const summary = plan.summary;

    expect(summary.followUp).toBe(1);
    expect(summary.checklistGaps).toBe(1);
    expect(summary.notAssessed).toBe(1);
    expect(summary.documentedExceptions).toBe(1);
  });

  it("primary total = followUp + checklistGaps + notAssessed (excludes documented exceptions)", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeTemplateQuestion({ id: "q-1", riskLevel: "high" }),
            makeTemplateQuestion({ id: "q-2" }),
          ],
        }),
      ],
    });
    const answers = [makeNoAnswer("q-1"), makeNAAnswer("q-2")];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.summary.total).toBe(1); // only the follow-up
    expect(plan.summary.documentedExceptions).toBe(1);
  });

  it("counts critical and high severity items", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeTemplateQuestion({ id: "q-1", riskLevel: "critical" }),
            makeTemplateQuestion({ id: "q-2", riskLevel: "high" }),
            makeTemplateQuestion({ id: "q-3", riskLevel: "medium" }),
          ],
        }),
      ],
    });
    const answers = [
      makeNoAnswer("q-1"),
      makeNoAnswer("q-2"),
      makeNoAnswer("q-3"),
    ];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.summary.critical).toBe(1);
    expect(plan.summary.high).toBe(1);
  });

  it("empty review → all zeros", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [makeTemplateQuestion({ id: "q-1" })],
        }),
      ],
    });
    const ctx = makeTeamReviewContext({ templates: [template], answers: [] });

    const plan = buildImprovementPlan(ctx);

    // No answers means all questions are not-assessed, not empty plan
    expect(plan.summary.notAssessed).toBe(1);
    expect(plan.summary.total).toBe(1);
  });

  it("all questions answered Yes → zero summary", () => {
    const template = makeTemplateRevisionDetail({
      pillars: [
        makeTemplatePillar({
          slug: "security",
          questions: [
            makeTemplateQuestion({ id: "q-1" }),
            makeTemplateQuestion({ id: "q-2" }),
          ],
        }),
      ],
    });
    const answers = [makeYesAnswer("q-1"), makeYesAnswer("q-2")];
    const ctx = makeTeamReviewContext({ templates: [template], answers });

    const plan = buildImprovementPlan(ctx);

    expect(plan.summary.total).toBe(0);
    expect(plan.summary.followUp).toBe(0);
    expect(plan.summary.checklistGaps).toBe(0);
    expect(plan.summary.notAssessed).toBe(0);
    expect(plan.summary.documentedExceptions).toBe(0);
  });
});
