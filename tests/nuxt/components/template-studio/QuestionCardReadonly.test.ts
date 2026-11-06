import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import QuestionCard from "~/components/template-studio/QuestionCard.vue";
import type { TemplateQuestion } from "~/models";

const question: TemplateQuestion = {
  id: "question-1",
  order: 1,
  type: "yes-no",
  text: "How mature is your reliability definition?",
  riskLevel: "medium",
  importance: "Why this matters",
  leadingPractices: [],
  helpfulLinks: [],
};

afterEach(cleanup);

it("keeps the collapsed Question row while suppressing readonly mutations", async () => {
  const view = render(QuestionCard, {
    props: {
      question,
      questionSlug: "REL-1",
      isExpanded: false,
      readonly: true,
    } as never,
    global: {
      stubs: {
        Icon: true,
        InlineMarkdown: {
          props: ["text"],
          template: "<span>{{ text }}</span>",
        },
        UTooltip: {
          props: ["text"],
          template: "<div :data-tooltip='text'><slot /></div>",
        },
        UCollapsible: { template: "<div><slot name='content' /></div>" },
        TemplateStudioRiskLevelDropdown: {
          props: ["modelValue", "disabled"],
          emits: ["update:modelValue"],
          template:
            "<button aria-label='Risk level' :disabled='disabled' @click='$emit(\"update:modelValue\", \"critical\")'>{{ modelValue }}</button>",
        },
        TemplateStudioGuidedDraftingRoom: true,
        TemplateStudioQuestionCardCompactView: true,
      },
    },
  });

  expect(screen.getByTestId("question-card")).toBeTruthy();
  expect(screen.getByText("REL-1")).toBeTruthy();
  expect(
    screen.getByText("How mature is your reliability definition?")
  ).toBeTruthy();
  expect(
    view.container.querySelector('[data-tooltip="Drag to reorder"]')
  ).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Risk level" }) as HTMLButtonElement)
      .disabled
  ).toBe(true);

  await fireEvent.click(screen.getByRole("button", { name: "Risk level" }));
  expect(view.emitted()["update:riskLevel"]).toBeUndefined();
});

it("labels the expanded state as read-only instead of relying on disabled controls", async () => {
  const view = render(QuestionCard, {
    props: {
      question,
      questionSlug: "REL-1",
      isExpanded: true,
      readonly: true,
      readonlyReason: "Published revisions cannot be changed.",
    } as never,
    global: {
      stubs: {
        Icon: true,
        InlineMarkdown: {
          props: ["text"],
          template: "<span>{{ text }}</span>",
        },
        TemplateStudioRiskLevelDropdown: true,
        TemplateStudioGuidedDraftingRoom: true,
        TemplateStudioQuestionCardCompactView: true,
      },
    },
  });

  expect(screen.getByText("Read-only")).toBeTruthy();
  expect(
    screen.getByText("Published revisions cannot be changed.")
  ).toBeTruthy();
  expect(view.container.querySelector('[role="status"]')).toBeTruthy();
});
