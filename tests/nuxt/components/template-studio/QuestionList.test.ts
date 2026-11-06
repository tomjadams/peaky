import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import QuestionList from "~/components/template-studio/QuestionList.vue";
import type { TemplatePillar } from "~/models";

const pillar: TemplatePillar = {
  id: "pillar-1",
  templateRevisionId: "revision-1",
  slug: "reliability",
  name: "Reliability & Resilience",
  description: "Pillar description",
  order: 1,
  questions: [
    {
      id: "question-1",
      order: 1,
      type: "yes-no",
      text: "How mature is your reliability definition?",
      riskLevel: "medium",
      importance: "Long-form importance that belongs inside the collapsed card",
      leadingPractices: [{ id: "practice-1", order: 1, text: "Practice" }],
      helpfulLinks: [],
    },
  ],
};

afterEach(cleanup);

it("preserves the existing collapsed Question-card composition when read-only", () => {
  render(QuestionList, {
    props: {
      pillar,
      expandedQuestionId: null,
      getQuestionSlug: () => "REL-1",
      readonly: true,
    },
    global: {
      stubs: {
        Icon: true,
        TransitionGroup: { template: "<div><slot /></div>" },
        TemplateStudioQuestionCard: {
          props: ["question", "questionSlug", "isExpanded", "readonly"],
          template:
            "<article data-testid='question-card' :data-readonly='readonly' :data-expanded='isExpanded'>{{ questionSlug }} {{ question.text }}</article>",
        },
        TemplateStudioRichTextEditor: {
          props: ["readonly"],
          template:
            "<div data-testid='pillar-description' :data-readonly='readonly' />",
        },
      },
    },
  });

  const card = screen.getByTestId("question-card");
  expect(card.getAttribute("data-readonly")).toBe("true");
  expect(card.getAttribute("data-expanded")).toBe("false");
  expect(card.textContent).toContain("REL-1");
  expect(
    screen.queryByText(
      "Long-form importance that belongs inside the collapsed card"
    )
  ).toBeNull();
  expect(
    screen.getByTestId("pillar-description").getAttribute("data-readonly")
  ).toBe("true");
  expect(screen.queryByPlaceholderText("Add a question...")).toBeNull();
});

it("prevents adding an eleventh scored question (AC-041)", () => {
  render(QuestionList, {
    props: {
      pillar,
      expandedQuestionId: null,
      getQuestionSlug: () => "REL-1",
      questionLimitReached: true,
    },
    global: {
      stubs: {
        Icon: true,
        TransitionGroup: { template: "<div><slot /></div>" },
        TemplateStudioQuestionCard: {
          props: ["question"],
          template: "<article />",
        },
        TemplateStudioRichTextEditor: { template: "<div />" },
      },
    },
  });

  const input = screen.getByPlaceholderText(
    "Add a question..."
  ) as HTMLInputElement;
  expect(input.disabled).toBe(true);
  expect(screen.getByText(/at most 10 questions/i)).toBeTruthy();
});
