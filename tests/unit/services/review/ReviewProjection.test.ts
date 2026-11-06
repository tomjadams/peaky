import { expect, it } from "vitest";
import { ReviewProjection } from "~/services/review/ReviewProjection";
import type { TemplateRevisionDetail } from "~/models/template";
import type { AnswerStateLike } from "~/services/review/ReviewProjection";

const projection = new ReviewProjection();

function makeTemplate(
  overrides: Partial<TemplateRevisionDetail> = {}
): TemplateRevisionDetail {
  return {
    id: "revision-1",
    templateId: "tpl-1",
    name: "Security Review",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    description: "",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: "actor-system",
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
    publishedAt: "2026-08-20T10:00:00Z",
    pillars: [
      {
        id: "pillar-security",
        templateRevisionId: "revision-1",
        slug: "security",
        name: "Security",
        order: 1,
        questions: [
          {
            id: "q-1",
            order: 1,
            text: "Is auth configured?",
            riskLevel: "high",
            importance: "high",
            leadingPractices: [],
            helpfulLinks: [],
          },
          {
            id: "q-2",
            order: 2,
            text: "Is encryption enabled?",
            riskLevel: "critical",
            importance: "critical",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: "pillar-reliability",
        templateRevisionId: "revision-1",
        slug: "reliability",
        name: "Reliability",
        order: 2,
        questions: [
          {
            id: "q-3",
            order: 1,
            text: "Are health checks in place?",
            riskLevel: "medium",
            importance: "medium",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

it("buildTemplateProjection returns correct structure from template + answers", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [{ questionId: "q-1", answer: '"yes"' }];

  const result = projection.buildTemplateProjection(template, answers);

  expect(result.templateId).toBe("tpl-1");
  expect(result.templateRevisionId).toBe("revision-1");
  expect(result.templateName).toBe("Security Review");
  expect(result.revisionNumber).toBe(1);
  expect(result.pillars).toHaveLength(2);
});

it("buildPillars groups questions by pillar correctly", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [
    { questionId: "q-1", answer: '"yes"' },
    { questionId: "q-2", answer: '"no"' },
  ];

  const pillars = projection.buildPillars(template, answers);

  expect(pillars).toHaveLength(2);
  expect(pillars[0]!.slug).toBe("security");
  expect(pillars[0]!.totalQuestions).toBe(2);
  expect(pillars[0]!.answeredQuestions).toBe(2);
  expect(pillars[1]!.slug).toBe("reliability");
  expect(pillars[1]!.totalQuestions).toBe(1);
  expect(pillars[1]!.answeredQuestions).toBe(0);
});

it("buildQuestionsProjection returns flat list of question projections with answer state", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [{ questionId: "q-1", answer: '"yes"' }];

  const questions = projection.buildQuestionsProjection(template, answers);

  expect(questions).toHaveLength(3);
  expect(questions[0]!.id).toBe("q-1");
  expect(questions[0]!.answer).toBe("yes");
  expect(questions[0]!.riskLevel).toBe("high");
  expect(questions[1]!.id).toBe("q-2");
  expect(questions[1]!.answer).toBeUndefined();
  expect(questions[1]!.riskLevel).toBe("critical");
});

it("buildQuestionsProjection filters by pillarSlug when provided", () => {
  const template = makeTemplate();
  const questions = projection.buildQuestionsProjection(
    template,
    [],
    "reliability"
  );

  expect(questions).toHaveLength(1);
  expect(questions[0]!.pillar).toBe("reliability");
});

it("progress calculation: 0 answers → 0%", () => {
  const template = makeTemplate();
  const result = projection.buildTemplateProjection(template, []);

  expect(result.progress).toBe(0);
  result.pillars.forEach((pillar) => {
    expect(pillar.progress).toBe(0);
    expect(pillar.answeredQuestions).toBe(0);
  });
});

it("progress calculation: all answered → 100%", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [
    { questionId: "q-1", answer: '"yes"' },
    { questionId: "q-2", answer: '"no"' },
    { questionId: "q-3", answer: '"yes"' },
  ];

  const result = projection.buildTemplateProjection(template, answers);

  expect(result.progress).toBe(100);
  expect(result.pillars[0]!.progress).toBe(100);
  expect(result.pillars[1]!.progress).toBe(100);
});

it("progress calculation: partial answers → correct %", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [
    { questionId: "q-1", answer: '"yes"' },
    // q-2 unanswered
    { questionId: "q-3", answer: '"no"' },
  ];

  const result = projection.buildTemplateProjection(template, answers);

  // security: 1/2 = 50%, reliability: 1/1 = 100%, overall: 2/3 = 67%
  expect(result.pillars[0]!.progress).toBe(50);
  expect(result.pillars[1]!.progress).toBe(100);
  expect(result.progress).toBe(67);
});

it("null answers do not count as answered", () => {
  const template = makeTemplate();
  const answers: AnswerStateLike[] = [
    { questionId: "q-1", answer: null },
    { questionId: "q-2", answer: '"yes"' },
  ];

  const pillars = projection.buildPillars(template, answers);

  expect(pillars[0]!.answeredQuestions).toBe(1);
});

it("handles empty template (no pillars) gracefully", () => {
  const template = makeTemplate({ pillars: [] });

  const result = projection.buildTemplateProjection(template, []);

  expect(result.progress).toBe(0);
  expect(result.pillars).toHaveLength(0);
});

it("handles empty answers gracefully without throwing", () => {
  const template = makeTemplate();

  expect(() => projection.buildQuestionsProjection(template, [])).not.toThrow();
  const questions = projection.buildQuestionsProjection(template, []);
  expect(questions.every((q) => q.answer === undefined)).toBe(true);
});
