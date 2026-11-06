import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import QuestionRow from "~/components/assessment/QuestionRow.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}) => {
  return render(QuestionRow, {
    props: {
      questionId: "REL-1",
      questionLabel: "REL-1",
      questionText: "Is the service deployed?",
      answer: null,
      ...props,
    },
    global: {
      stubs: {
        Icon: true,
        AssessmentAnswerToggle: {
          template: '<div data-testid="answer-toggle"><slot /></div>',
          props: ["modelValue", "legend", "disabled"],
          emits: ["update:modelValue", "na-click"],
        },
      },
    },
  });
};

const checklistItems = [
  { id: "targets", order: 1, text: "Define service targets" },
  { id: "runbook", order: 2, text: "Maintain a runbook" },
];

const expandChecklist = async () => {
  await fireEvent.click(
    screen.getByRole("button", { name: /items complete expand/i })
  );
};

const practiceRow = (label: string): HTMLElement => {
  const row = screen
    .getByText(label)
    .closest<HTMLElement>("[data-practice-state]");
  expect(row).not.toBeNull();
  return row!;
};

describe("QuestionRow", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("displays the question ID", () => {
      renderComponent({ questionId: "SEC-3", questionLabel: "SEC-3" });
      expect(screen.getByText("SEC-3")).toBeDefined();
    });

    it("keeps the opaque ID in the anchor while displaying the human-facing reference", () => {
      const questionId = "019fae01-9409-704f-9516-fee7a55a848c";
      const { container } = renderComponent({
        questionId,
        questionLabel: "REL-1",
      });

      expect(screen.getByText("REL-1")).toBeDefined();
      expect(screen.queryByText(questionId)).toBeNull();
      expect(container.querySelector("article")?.getAttribute("id")).toBe(
        `question-${questionId}`
      );
    });

    it("uses the display reference in the checklist answer legend", async () => {
      renderComponent({
        questionId: "019fae01-9409-704f-9516-fee7a55a848c",
        questionLabel: "REL-1",
        questionType: "checklist",
      });

      await fireEvent.click(
        screen.getByRole("button", { name: /0 of 0 items complete expand/i })
      );
      expect(screen.getByText("Answer for question REL-1")).toBeDefined();
    });

    it("displays the question text", () => {
      renderComponent({ questionText: "Does the service have monitoring?" });
      expect(
        screen.getByText("Does the service have monitoring?")
      ).toBeDefined();
    });

    it("has an info button", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /show information/i })
      ).toBeDefined();
    });

    it("renders an untouched checklist as Not assessed", async () => {
      renderComponent({
        questionType: "checklist",
        checklistItems,
        answer: null,
      });

      await expandChecklist();

      expect(
        screen.getByText("Unchecked practices are Not assessed.")
      ).toBeDefined();
      for (const item of checklistItems) {
        const row = practiceRow(item.text);
        expect(row.dataset.practiceState).toBe("not-assessed");
        expect(row.textContent).not.toContain("Not met");
      }
    });

    it("renders unchecked practices in a partial answer as Not met", async () => {
      const view = renderComponent({
        questionType: "checklist",
        checklistItems,
        answer: null,
      });
      await expandChecklist();
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Define service targets" })
      );
      expect(view.emitted()["update:answer"]?.at(-1)).toEqual([
        { checked: ["targets"], na: [] },
      ]);

      await view.rerender({ answer: { checked: ["targets"], na: [] } });

      expect(
        screen.getByText("Unchecked applicable practices count as Not met.")
      ).toBeDefined();
      expect(practiceRow("Define service targets").dataset.practiceState).toBe(
        "met"
      );
      expect(
        (
          screen.getByRole("checkbox", {
            name: "Define service targets",
          }) as HTMLInputElement
        ).checked
      ).toBe(true);
      const unmet = practiceRow("Maintain a runbook");
      expect(unmet.dataset.practiceState).toBe("not-met");
      expect(unmet.textContent).toContain("Not met");
    });

    it("renders every applicable practice in an explicit empty answer as Not met", async () => {
      const view = renderComponent({
        questionType: "checklist",
        checklistItems,
        answer: { checked: ["targets"], na: [] },
      });
      await expandChecklist();
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "Define service targets" })
      );
      expect(view.emitted()["update:answer"]?.at(-1)).toEqual([
        { checked: [], na: [] },
      ]);

      await view.rerender({ answer: { checked: [], na: [] } });

      for (const item of checklistItems) {
        const row = practiceRow(item.text);
        expect(row.dataset.practiceState).toBe("not-met");
        expect(row.textContent).toContain("Not met");
      }
    });

    it("keeps per-practice and whole-checklist N/A distinct from Not met", async () => {
      const view = renderComponent({
        questionType: "checklist",
        checklistItems,
        answer: null,
      });
      await expandChecklist();
      await fireEvent.click(
        screen.getByRole("button", {
          name: "Mark Maintain a runbook as not applicable",
        })
      );
      expect(view.emitted()["item-na-click"]?.at(-1)).toEqual(["runbook"]);

      await view.rerender({ answer: { checked: [], na: ["runbook"] } });

      expect(practiceRow("Maintain a runbook").dataset.practiceState).toBe(
        "not-applicable"
      );
      expect(practiceRow("Maintain a runbook").textContent).not.toContain(
        "Not met"
      );
      expect(
        screen
          .getByRole("button", {
            name: "Mark Maintain a runbook as not applicable",
          })
          .getAttribute("aria-pressed")
      ).toBe("true");

      await fireEvent.click(
        screen.getByRole("button", { name: "Mark entire checklist N/A" })
      );
      expect(view.emitted()["na-click"]?.at(-1)).toEqual([]);
      await view.rerender({ answer: "na" });

      expect(screen.getByText("This checklist is marked N/A.")).toBeDefined();
      for (const item of checklistItems) {
        expect(practiceRow(item.text).dataset.practiceState).toBe(
          "not-applicable"
        );
      }
      expect(
        screen
          .getByRole("button", { name: "Mark entire checklist N/A" })
          .getAttribute("aria-pressed")
      ).toBe("true");
    });
  });

  describe("events", () => {
    it("emits info-click when info button is clicked", async () => {
      const { emitted } = renderComponent();
      const infoButton = screen.getByRole("button", {
        name: /show information/i,
      });
      await fireEvent.click(infoButton);
      expect(emitted()["info-click"]).toBeTruthy();
    });

    it("keeps an interacted checklist explicitly empty after its last check is cleared", async () => {
      const view = renderComponent({
        questionType: "checklist",
        checklistItems: [{ id: "slo", text: "SLOs are defined" }],
        answer: null,
      });
      await fireEvent.click(
        screen.getByRole("button", { name: /0 of 1 items complete expand/i })
      );
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "SLOs are defined" })
      );
      expect(view.emitted()["update:answer"]?.[0]).toEqual([
        { checked: ["slo"], na: [] },
      ]);

      await view.rerender({ answer: { checked: ["slo"], na: [] } });
      await fireEvent.click(
        screen.getByRole("checkbox", { name: "SLOs are defined" })
      );

      expect(view.emitted()["update:answer"]?.[1]).toEqual([
        { checked: [], na: [] },
      ]);
    });

    it("clears an explicit checklist answer only through the clear action", async () => {
      const view = renderComponent({
        questionType: "checklist",
        checklistItems: [{ id: "slo", text: "SLOs are defined" }],
        answer: { checked: [], na: [] },
      });
      await fireEvent.click(
        screen.getByRole("button", { name: /0 of 1 items complete expand/i })
      );
      const clear = screen.getByRole("button", {
        name: "Clear answer for this checklist",
      });

      await fireEvent.click(clear);

      expect(view.emitted()["update:answer"]?.at(-1)).toEqual([null]);
      await view.rerender({ answer: null });
      expect(
        screen.getByText("Unchecked practices are Not assessed.")
      ).toBeDefined();
      expect(practiceRow("SLOs are defined").dataset.practiceState).toBe(
        "not-assessed"
      );
      expect(practiceRow("SLOs are defined").textContent).not.toContain(
        "Not met"
      );
      expect(
        screen.queryByRole("button", {
          name: "Clear answer for this checklist",
        })
      ).toBeNull();
    });

    it("does not offer Clear answer for an unanswered checklist", async () => {
      renderComponent({
        questionType: "checklist",
        checklistItems: [{ id: "slo", text: "SLOs are defined" }],
        answer: null,
      });
      await fireEvent.click(
        screen.getByRole("button", { name: /0 of 1 items complete expand/i })
      );

      expect(
        screen.queryByRole("button", {
          name: "Clear answer for this checklist",
        })
      ).toBeNull();
    });
  });

  describe("accessibility", () => {
    it("keeps whole-checklist N/A inside the expanded controls", async () => {
      renderComponent({
        questionType: "checklist",
        checklistItems: [{ id: "slo", text: "SLOs are defined" }],
        answer: [],
      });

      expect(
        screen.queryByRole("button", { name: "Mark entire checklist N/A" })
      ).toBeNull();

      await fireEvent.click(
        screen.getByRole("button", { name: /0 of 1 items complete expand/i })
      );
      expect(
        screen.getByRole("button", { name: "Mark entire checklist N/A" })
      ).toBeTruthy();
    });

    it("uses native checkboxes for checklist answers", async () => {
      const { emitted } = renderComponent({
        questionType: "checklist",
        checklistItems: [{ id: "slo", text: "SLOs are defined" }],
        answer: [],
      });
      const expander = screen.getByRole("button", {
        name: /0 of 1 items complete expand/i,
      });
      expect(expander.getAttribute("aria-expanded")).toBe("false");
      expect(expander.getAttribute("aria-controls")).toBe(
        "checklist-items-REL-1"
      );

      await fireEvent.click(expander);
      expect(expander.getAttribute("aria-expanded")).toBe("true");
      const checkbox = screen.getByRole("checkbox", {
        name: "SLOs are defined",
      });

      checkbox.focus();
      await fireEvent.click(checkbox);

      expect(emitted()["update:answer"]?.[0]).toEqual([
        { checked: ["slo"], na: [] },
      ]);
    });

    it.each(["yes-no", "checklist"] as const)(
      "makes the %s question target programmatically focusable",
      (questionType) => {
        const { container } = renderComponent({
          questionId: "REL-1",
          questionType,
        });
        const article = container.querySelector("article");
        expect(article?.getAttribute("id")).toBe("question-REL-1");
        expect(article?.getAttribute("tabindex")).toBe("-1");
      }
    );
  });
});
