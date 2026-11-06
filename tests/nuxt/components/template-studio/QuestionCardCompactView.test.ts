import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import QuestionCardCompactView from "~/components/template-studio/QuestionCardCompactView.vue";
import type { TemplateQuestion } from "~/models";

const sortable = vi.hoisted(() => ({
  create: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("sortablejs", () => ({
  default: { create: sortable.create },
}));

let resizeCallback: ResizeObserverCallback | undefined;

class ResizeObserverStub implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  disconnect() {}
  observe() {}
  unobserve() {}
}

const question: TemplateQuestion = {
  id: "question-1",
  order: 1,
  type: "checklist",
  text: "Are service-level objectives defined?",
  riskLevel: "medium",
  importance: "Clear objectives support incident decisions.",
  checklistItems: [
    {
      id: "practice-1",
      order: 1,
      text: "Targets have documented technical and business rationale.",
    },
  ],
  leadingPractices: [],
  helpfulLinks: [],
};

beforeEach(() => {
  resizeCallback = undefined;
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("remeasures practice rows when the compact editor width changes", () => {
  render(QuestionCardCompactView, {
    props: { question },
    global: {
      stubs: {
        Icon: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });

  const textarea = screen.getByPlaceholderText("Add a leading practice...");
  Object.defineProperty(textarea, "scrollHeight", {
    configurable: true,
    value: 26,
  });

  expect(resizeCallback).toBeDefined();
  resizeCallback?.(
    [
      {
        contentRect: { width: 800 },
        target: textarea,
      } as unknown as ResizeObserverEntry,
    ],
    {} as ResizeObserver
  );
  expect(textarea.style.height).toBe("26px");
});

it("keeps readonly checklist rows inert while allowing the card to close", async () => {
  const view = render(QuestionCardCompactView, {
    props: { question, readonly: true },
    global: {
      stubs: {
        Icon: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });

  await fireEvent.keyDown(
    screen.getByPlaceholderText("Add a leading practice..."),
    { key: "Enter" }
  );

  expect(view.emitted()["add-checklist-item"]).toBeUndefined();
  expect(
    (screen.getByRole("button", { name: "Done" }) as HTMLButtonElement).disabled
  ).toBe(false);
});

it("uses open hairline rows for editable checklist practices", () => {
  render(QuestionCardCompactView, {
    props: { question },
    global: {
      stubs: {
        Icon: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });

  const row = screen.getByTestId("compact-practice-row");
  expect(row.className).toContain("border-b");
  expect(row.className).not.toMatch(/\brounded/);
  expect(row.className).not.toMatch(/\bshadow/);
  expect(row.className).not.toContain("bg-elevated");
  expect(row.className).toContain("grid-cols-[0.875rem_minmax(0,1fr)_1.25rem]");
  expect(row.className).toContain(
    "lg:grid-cols-[0.875rem_minmax(0,1fr)_15rem_1.25rem]"
  );
  expect(
    screen.getByPlaceholderText("Add a leading practice...").className
  ).toContain("min-h-11");
  expect(
    screen.getByRole("button", { name: "Delete practice" }).className
  ).toContain("size-11");
});

it("keeps checklist placement concrete and explains it once", () => {
  render(QuestionCardCompactView, {
    props: { question },
    global: {
      stubs: {
        Icon: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });

  expect(screen.getByText("Medium · weight 1")).toBeTruthy();
  expect(
    screen.getAllByText(
      "Choose the stage whose definition best fits this item. Placement is not priority or timing."
    )
  ).toHaveLength(1);
  expect(
    screen
      .getByRole("combobox", { name: "Set all Follow-up placements" })
      .getAttribute("aria-expanded")
  ).toBe("false");
  expect(
    screen
      .getByRole("combobox", {
        name: "Follow-up placement for Targets have documented technical and business rationale.",
      })
      .getAttribute("aria-expanded")
  ).toBe("false");
  expect(screen.getByText("Follow-up placement")).toBeTruthy();
  expect(screen.queryByText("Appears at stage")).toBeNull();
});

it("offers the complete question placement control for yes-no questions", () => {
  const yesNoQuestion: TemplateQuestion = {
    ...structuredClone(question),
    type: "yes-no",
    riskLevel: "critical",
    checklistItems: [],
    leadingPractices: [
      { id: "practice-yes-no", order: 1, text: "Owners review targets." },
    ],
  };
  render(QuestionCardCompactView, {
    props: { question: yesNoQuestion },
    global: {
      stubs: {
        Icon: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });

  expect(screen.getByText("Critical · weight 3")).toBeTruthy();
  expect(
    screen.getAllByText(
      "Choose the stage whose definition best fits this item. Placement is not priority or timing."
    )
  ).toHaveLength(1);
  expect(
    screen
      .getByRole("combobox", {
        name: "Follow-up placement for this question",
      })
      .getAttribute("aria-expanded")
  ).toBe("false");
  expect(screen.queryByText("Where this appears")).toBeNull();
});
