/**
 * Unit tests for workspaceToReviewContext adapter.
 *
 * Validates that workspace projections are correctly adapted
 * into the ReviewContext expected by buildImprovementPlan.
 */

import { describe, it, expect } from "vitest";
import { workspaceToReviewContext } from "~/composables/reviews/useReviewPlanData";
import type { ReviewWorkspace } from "~/models/workspace";

// ─── Minimal workspace fixture builder ───────────────────────

function makeWorkspace(
  overrides: Partial<ReviewWorkspace> = {}
): ReviewWorkspace {
  return {
    review: {
      id: "rev-1",
      name: "Q4 Readiness",
      status: "in-progress",
      templateRevisionIds: ["tmpl-v-1"],
      createdAt: "2025-10-01T00:00:00.000Z",
      updatedAt: "2025-10-15T00:00:00.000Z",
    },
    subject: {
      id: "team-1",
      type: "team",
      name: "Platform Team",
      slug: "platform",
    },
    templateRevisions: [
      {
        id: "tmpl-v-1",
        templateId: "tmpl-1",
        name: "Security Checklist",
        revisionNumber: 1,
        revisionSummary: null,
        position: 0,
      },
    ],
    pillars: [
      {
        id: "tmpl-1:security",
        templateRevisionId: "tmpl-v-1",
        slug: "security",
        name: "Security",
        orderKey: "0001",
        questions: [
          {
            id: "q-1",
            templateRevisionId: "tmpl-v-1",
            pillarId: "tmpl-1:security",
            orderKey: "0001",
            text: "Do you rotate secrets quarterly?",
            type: "yes-no",
            riskLevel: "high",
            importance: "Secrets leakage is a critical risk",
            leadingPractices: [
              { id: "lp-1", order: 0, text: "Use a secrets manager" },
            ],
            helpfulLinks: [
              { title: "AWS Secrets Manager", url: "https://aws.amazon.com" },
            ],
          },
          {
            id: "q-2",
            templateRevisionId: "tmpl-v-1",
            pillarId: "tmpl-1:security",
            orderKey: "0002",
            text: "Is MFA enforced for all users?",
            type: "yes-no",
            riskLevel: "critical",
            importance: "",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
    answers: [
      {
        questionId: "q-1",
        answer: "no",
        updatedAt: "2025-10-10T00:00:00.000Z",
      },
      {
        questionId: "q-2",
        answer: null,
        updatedAt: "2025-10-01T00:00:00.000Z",
      },
    ],
    maturity: [],
    notes: [],
    attachments: [],
    scores: [],
    assessors: [],
    advisors: [],
    capabilities: {
      canEdit: true,
      canPublish: false,
      canDelete: false,
      canAddParticipants: true,
      canExport: true,
    },
    recentHistory: [],
    answerProvenance: {},
    ...overrides,
  };
}

/** Adds a Revision with one pillar/question to a workspace fixture. */
function addRevision(
  workspace: ReviewWorkspace,
  revisionId: string,
  questionId: string,
  position: number
) {
  workspace.review.templateRevisionIds.push(revisionId);
  workspace.templateRevisions.push({
    ...workspace.templateRevisions[0]!,
    id: revisionId,
    templateId: `template:${revisionId}`,
    name: `Template ${revisionId}`,
    position,
  });
  workspace.pillars.push({
    ...workspace.pillars[0]!,
    id: `${revisionId}:pillar`,
    templateRevisionId: revisionId,
    questions: [
      {
        ...workspace.pillars[0]!.questions[0]!,
        id: questionId,
        templateRevisionId: revisionId,
        pillarId: `${revisionId}:pillar`,
      },
    ],
  });
  workspace.answers.push({
    questionId,
    answer: null,
    updatedAt: "2025-10-01T00:00:00.000Z",
  });
  return workspace;
}

// ─── Tests ────────────────────────────────────────────────────

describe("workspaceToReviewContext", () => {
  describe("identity mapping", () => {
    it("maps reviewId from workspace.review.id", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.reviewId).toBe("rev-1");
    });

    it("maps subjectId from workspace.subject.id", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.subjectId).toBe("team-1");
    });

    it("passes through subjectType argument", () => {
      const ctxTeam = workspaceToReviewContext(makeWorkspace(), "team");
      const ctxProduct = workspaceToReviewContext(makeWorkspace(), "product");
      expect(ctxTeam.subjectType).toBe("team");
      expect(ctxProduct.subjectType).toBe("product");
    });
  });

  describe("template mapping", () => {
    it("creates a single TemplateRevisionDetail from the first templateRevision", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.templates).toHaveLength(1);
      expect(ctx.templates[0]?.id).toBe("tmpl-v-1");
      expect(ctx.templates[0]?.templateId).toBe("tmpl-1");
      expect(ctx.templates[0]?.name).toBe("Security Checklist");
      expect(ctx.templates[0]?.revisionNumber).toBe(1);
    });

    it("keeps Pillars partitioned across all selected Revisions", () => {
      const workspace = makeWorkspace();
      workspace.review.templateRevisionIds.push("tmpl-v-2");
      workspace.templateRevisions.push({
        ...workspace.templateRevisions[0]!,
        id: "tmpl-v-2",
        templateId: "tmpl-2",
        name: "Reliability Checklist",
        position: 1,
      });
      workspace.pillars.push({
        ...workspace.pillars[0]!,
        id: "tmpl-2:security",
        templateRevisionId: "tmpl-v-2",
        questions: [
          {
            ...workspace.pillars[0]!.questions[0]!,
            id: "q-3",
            templateRevisionId: "tmpl-v-2",
            pillarId: "tmpl-2:security",
          },
        ],
      });

      const ctx = workspaceToReviewContext(workspace, "team");

      expect(ctx.templates.map((template) => template.id)).toEqual([
        "tmpl-v-1",
        "tmpl-v-2",
      ]);
      expect(ctx.templates[0]?.pillars[0]?.questions).toHaveLength(2);
      expect(ctx.templates[1]?.pillars[0]?.questions[0]?.id).toBe("q-3");
    });

    it("maps all workspace pillars into the template", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.templates[0]?.pillars).toHaveLength(1);
      expect(ctx.templates[0]?.pillars[0]?.slug).toBe("security");
      expect(ctx.templates[0]?.pillars[0]?.questions).toHaveLength(2);
    });

    it("returns no snapshot for a missing templateRevision", () => {
      const ws = makeWorkspace({ templateRevisions: [] });
      const ctx = workspaceToReviewContext(ws, "team");
      expect(ctx.templates).toEqual([]);
    });
  });

  describe("question mapping", () => {
    it("preserves question id, text, type, and riskLevel", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      const q = ctx.templates[0]!.pillars[0]!.questions[0]!;
      expect(q.id).toBe("q-1");
      expect(q.text).toBe("Do you rotate secrets quarterly?");
      expect(q.type).toBe("yes-no");
      expect(q.riskLevel).toBe("high");
    });

    it("defaults riskLevel to 'medium' when undefined", () => {
      const ws = makeWorkspace();
      ws.pillars[0]!.questions[0]!.riskLevel = undefined;
      const ctx = workspaceToReviewContext(ws, "team");
      expect(ctx.templates[0]?.pillars[0]?.questions[0]?.riskLevel).toBe(
        "medium"
      );
    });

    it("maps leadingPractices with generated id and order", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      const q = ctx.templates[0]!.pillars[0]!.questions[0]!;
      expect(q.leadingPractices).toHaveLength(1);
      expect(q.leadingPractices[0]?.text).toBe("Use a secrets manager");
    });

    it("maps helpfulLinks", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      const q = ctx.templates[0]!.pillars[0]!.questions[0]!;
      expect(q.helpfulLinks).toHaveLength(1);
      expect(q.helpfulLinks[0]?.title).toBe("AWS Secrets Manager");
    });
  });

  describe("answer serialization", () => {
    it("serializes string answers to JSON", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.answers[0]?.answer).toBe('"no"');
    });

    it("maps null answers as null", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.answers[1]?.answer).toBeNull();
    });

    it("serializes checklist answers as JSON array string", () => {
      const ws = makeWorkspace();
      ws.answers[0]!.answer = ["item-a", "item-b"] as unknown as string;
      const ctx = workspaceToReviewContext(ws, "team");
      expect(ctx.answers[0]?.answer).toBe('["item-a","item-b"]');
    });

    it("serializes N/A reason as JSON string", () => {
      const ws = makeWorkspace();
      ws.answers[0]!.naReason = {
        reason: "not-in-scope",
        comment: "Legacy",
      } as unknown as string;
      const ctx = workspaceToReviewContext(ws, "team");
      expect(ctx.answers[0]?.naReason).toBe(
        '{"reason":"not-in-scope","comment":"Legacy"}'
      );
    });

    it("maps undefined naReason as null", () => {
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      expect(ctx.answers[0]?.naReason).toBeNull();
    });
  });

  describe("multi-Revision consumption (reviews/AC-029; maturity-score/AC-025, AC-039)", () => {
    it("maps three selected Revisions in selection order, questions partitioned (AC-029)", () => {
      const workspace = makeWorkspace();
      addRevision(workspace, "tmpl-v-2", "q-3", 1);
      addRevision(workspace, "tmpl-v-3", "q-4", 2);

      const ctx = workspaceToReviewContext(workspace, "team");

      expect(ctx.templates.map((template) => template.id)).toEqual([
        "tmpl-v-1",
        "tmpl-v-2",
        "tmpl-v-3",
      ]);
      for (const template of ctx.templates) {
        expect(
          template.pillars.every(
            (pillar) => pillar.templateRevisionId === template.id
          )
        ).toBe(true);
        expect(template.pillars.flatMap((pillar) => pillar.questions)).toEqual(
          template.id === "tmpl-v-1"
            ? expect.arrayContaining([
                expect.objectContaining({ id: "q-1" }),
                expect.objectContaining({ id: "q-2" }),
              ])
            : [
                expect.objectContaining({
                  id: template.id === "tmpl-v-2" ? "q-3" : "q-4",
                }),
              ]
        );
      }
    });

    it("buildImprovementPlan consumes every Revision with no cross-Revision rollup (AC-025, AC-039)", async () => {
      const { buildImprovementPlan, groupExactRollups } =
        await import("~/services/review/ImprovementPlanProjection");
      // An equivalent question id in a second Revision must stay separate:
      // the rollup key is templateRevisionId::questionId.
      const workspace = addRevision(makeWorkspace(), "tmpl-v-2", "q-1", 1);
      const plan = buildImprovementPlan(
        workspaceToReviewContext(workspace, "team")
      );

      const byRevision = new Map<string, number>();
      for (const item of plan.items) {
        const id = item.identity.templateRevisionId;
        byRevision.set(id, (byRevision.get(id) ?? 0) + 1);
      }
      expect(byRevision.get("tmpl-v-1")).toBe(2);
      expect(byRevision.get("tmpl-v-2")).toBe(1);

      const rollups = groupExactRollups(plan.items);
      expect(rollups).toEqual([]);
    });
  });

  describe("end-to-end: buildImprovementPlan integration", () => {
    it("produces follow-up for a 'no' answer and not-assessed for null", async () => {
      const { buildImprovementPlan } =
        await import("~/services/review/ImprovementPlanProjection");
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      const plan = buildImprovementPlan(ctx);

      expect(plan.items).toHaveLength(2);
      const states = plan.items.map((i) => i.state);
      expect(states).toContain("follow-up");
      expect(states).toContain("not-assessed");
    });

    it("summary counts match the items", async () => {
      const { buildImprovementPlan } =
        await import("~/services/review/ImprovementPlanProjection");
      const ctx = workspaceToReviewContext(makeWorkspace(), "team");
      const plan = buildImprovementPlan(ctx);

      expect(plan.summary.followUp).toBe(1);
      expect(plan.summary.notAssessed).toBe(1);
      expect(plan.summary.total).toBe(2);
    });
  });
});
