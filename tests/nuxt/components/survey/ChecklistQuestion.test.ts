import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import ChecklistQuestion from "~/components/survey/ChecklistQuestion.vue";

afterEach(cleanup);

const checklistItems = [
  { id: "practice-1", order: 1, text: "Define service targets" },
  { id: "practice-2", order: 2, text: "Maintain a runbook" },
];
const global = {
  stubs: {
    Icon: true,
    UButton: {
      props: ["variant"],
      template: "<button><slot /></button>",
    },
  },
};

const renderChecklist = (props = {}) =>
  render(ChecklistQuestion, {
    props: {
      checklistItems,
      checkedItems: [],
      isNA: false,
      ...props,
    },
    global,
  });

const practiceRow = (label: string): HTMLElement => {
  const row = screen
    .getByText(label)
    .closest<HTMLElement>("[data-practice-state]");
  expect(row).not.toBeNull();
  return row!;
};

it("renders an untouched checklist as Not assessed", () => {
  renderChecklist();

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
  const view = renderChecklist();
  await fireEvent.click(practiceRow("Define service targets"));
  expect(view.emitted()["update:checked-items"]?.at(-1)).toEqual([
    ["practice-1"],
  ]);

  await view.rerender({
    checkedItems: ["practice-1"],
    hasAnswer: true,
  });

  expect(
    screen.getByText("Unchecked applicable practices count as Not met.")
  ).toBeDefined();
  expect(practiceRow("Define service targets").dataset.practiceState).toBe(
    "met"
  );
  const unmet = practiceRow("Maintain a runbook");
  expect(unmet.dataset.practiceState).toBe("not-met");
  expect(unmet.textContent).toContain("Not met");
});

it("renders every applicable practice in an explicit empty answer as Not met", async () => {
  const view = renderChecklist({
    checkedItems: ["practice-1"],
    hasAnswer: true,
  });
  await fireEvent.click(practiceRow("Define service targets"));
  expect(view.emitted()["update:checked-items"]?.at(-1)).toEqual([[]]);

  await view.rerender({ checkedItems: [], hasAnswer: true });

  for (const item of checklistItems) {
    const row = practiceRow(item.text);
    expect(row.dataset.practiceState).toBe("not-met");
    expect(row.textContent).toContain("Not met");
  }
});

it("keeps whole-question N/A beside the checklist instructions", async () => {
  const view = render(ChecklistQuestion, {
    props: {
      checklistItems,
      checkedItems: [],
      isNA: false,
    },
    global,
  });

  const action = screen.getByRole("button", {
    name: "Not applicable to this question",
  });
  expect(action.getAttribute("aria-pressed")).toBe("false");

  await fireEvent.click(action);
  expect(view.emitted()["na-click"]).toHaveLength(1);
});

it("keeps per-practice and whole-question N/A distinct from Not met", async () => {
  const view = renderChecklist();
  await fireEvent.click(
    screen.getByRole("button", {
      name: "Mark Maintain a runbook as not applicable",
    })
  );
  expect(view.emitted()["item-na-click"]?.at(-1)).toEqual(["practice-2"]);

  await view.rerender({
    hasAnswer: true,
    naItems: ["practice-2"],
  });

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
    screen.getByRole("button", { name: "Not applicable to this question" })
  );
  expect(view.emitted()["na-click"]?.at(-1)).toEqual([]);
  await view.rerender({ isNA: true, naItems: [] });

  expect(screen.getByText("This checklist is marked N/A.")).toBeDefined();
  for (const item of checklistItems) {
    expect(practiceRow(item.text).dataset.practiceState).toBe("not-applicable");
  }
  expect(
    screen
      .getByRole("button", { name: "Not applicable to this question" })
      .getAttribute("aria-pressed")
  ).toBe("true");
});

it("offers an explicit way to clear a recorded checklist answer", async () => {
  const view = render(ChecklistQuestion, {
    props: {
      checklistItems,
      checkedItems: [],
      isNA: false,
      hasAnswer: true,
    },
    global,
  });

  await fireEvent.click(
    screen.getByRole("button", { name: "Clear checklist answer" })
  );

  expect(view.emitted()["clear-answer"]).toHaveLength(1);

  await view.rerender({ hasAnswer: false });
  expect(
    screen.getByText("Unchecked practices are Not assessed.")
  ).toBeDefined();
  for (const item of checklistItems) {
    const row = practiceRow(item.text);
    expect(row.dataset.practiceState).toBe("not-assessed");
    expect(row.textContent).not.toContain("Not met");
  }
  expect(
    screen.queryByRole("button", { name: "Clear checklist answer" })
  ).toBeNull();
});

it("hides Clear answer while the checklist is unanswered", () => {
  render(ChecklistQuestion, {
    props: {
      checklistItems,
      checkedItems: [],
      isNA: false,
      hasAnswer: false,
    },
    global,
  });

  expect(
    screen.queryByRole("button", { name: "Clear checklist answer" })
  ).toBeNull();
});
