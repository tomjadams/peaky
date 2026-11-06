import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "~/models/question";

const fixtures = vi.hoisted(() => ({ questions: [] as Question[] }));

vi.mock("~/composables/assessment/useAssessmentFetch", async () => {
  const { ref } = await import("vue");
  return {
    useAssessmentFetch: () => ({
      review: ref({
        name: "Review",
        templates: [
          {
            templateRevisionId: "revision-1",
            pillars: [
              {
                slug: "reliability",
                name: "Reliability",
                totalQuestions: fixtures.questions.length,
                answeredQuestions: 0,
                progress: 0,
              },
            ],
          },
        ],
      }),
      questionsData: ref({
        reviewId: "review-1",
        pillar: "reliability",
        questions: fixtures.questions,
      }),
      pending: ref(false),
      error: ref(null),
      refresh: vi.fn(),
    }),
  };
});

vi.mock("~/composables/assessment/useAssessmentMutate", async () => {
  const { ref } = await import("vue");
  return {
    useAssessmentMutate: () => ({
      saving: ref(false),
      saveAnswer: vi.fn(),
      saveProgress: vi.fn(),
      createMilestone: vi.fn(),
    }),
  };
});

vi.mock("~/ui/useTemplateSelector", async () => {
  const { ref } = await import("vue");
  return {
    useTemplateSelector: () => ({
      activeTemplateRevisionId: ref("revision-1"),
      activePillarSlug: ref("reliability"),
      setActiveTemplateRevision: vi.fn(),
      setActivePillar: vi.fn(),
    }),
  };
});

const baseQuestion = {
  templateRevisionId: "revision-1",
  pillar: "reliability",
  text: "Question",
  riskLevel: "medium" as const,
};

describe("useAssessment answer normalization", () => {
  beforeEach(() => {
    fixtures.questions = [
      {
        ...baseQuestion,
        id: "checklist-empty",
        type: "checklist",
        checklistItems: [{ id: "practice-1", order: 1, text: "Practice one" }],
        answer: { checked: [], na: [] },
      },
      {
        ...baseQuestion,
        id: "checklist-stale-scalar",
        type: "checklist",
        checklistItems: [{ id: "practice-2", order: 1, text: "Practice two" }],
        answer: "yes",
      },
      {
        ...baseQuestion,
        id: "yes-no-stale-checklist",
        type: "yes-no",
        checklistItems: [
          { id: "practice-stale", order: 1, text: "Stale practice" },
        ],
        answer: { checked: [], na: [] },
      },
    ];
  });

  it("preserves explicit empty while hiding type-incompatible persisted data", async () => {
    const { useAssessment } =
      await import("~/composables/assessment/useAssessment");
    const assessment = useAssessment("review-1");

    expect(
      assessment.questions.value.map((question) => [
        question.id,
        question.answer,
      ])
    ).toEqual([
      ["checklist-empty", { checked: [], na: [] }],
      ["checklist-stale-scalar", null],
      ["yes-no-stale-checklist", null],
    ]);
    expect(assessment.answeredCount.value).toBe(1);
  });
});
