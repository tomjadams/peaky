import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/vue";
import type { Template, TemplateQuestion } from "~/models";
import GuidedDraftingRoom from "~/components/template-studio/GuidedDraftingRoom.vue";
import {
  lastSavedAt,
  saveStatus,
  templateAggregate,
} from "~/composables/templates/studio/useTemplateStudio-state";

const sortable = vi.hoisted(() => ({
  create: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("sortablejs", () => ({
  default: { create: sortable.create },
}));

const yesNoQuestion: TemplateQuestion = {
  id: "question-yes-no",
  order: 1,
  type: "yes-no",
  text: "Are service-level objectives defined?",
  riskLevel: "high",
  importance: "Clear objectives support incident decisions.",
  checklistItems: [],
  leadingPractices: [
    { id: "practice-yes-no", order: 1, text: "Owners review targets." },
  ],
  helpfulLinks: [
    {
      id: "link-1",
      title: "Service-level guidance",
      url: "https://example.com",
    },
  ],
};

const templateAggregateFixture: Template = {
  id: "template-1",
  name: "Operational Readiness",
  description: "",
  status: "active",
  ownerTeamId: "team-platform",
  createdByActorId: "actor-1",
  updatedByActorId: "actor-1",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T08:00:00.000Z",
};

const checklistQuestion: TemplateQuestion = {
  ...structuredClone(yesNoQuestion),
  id: "question-checklist",
  type: "checklist",
  checklistItems: [
    { id: "practice-latency", order: 1, text: "Latency is measured." },
    { id: "practice-errors", order: 2, text: "Errors are measured." },
  ],
  leadingPractices: [],
};

function renderRoom(
  question: TemplateQuestion,
  options: { open?: boolean; requestedSectionId?: string } = {}
) {
  return render(GuidedDraftingRoom, {
    props: {
      open: options.open ?? true,
      question,
      questionSlug: "REL-01",
      hasPreviousQuestion: false,
      hasNextQuestion: false,
      requestedSectionId: options.requestedSectionId,
    },
    global: {
      stubs: {
        Icon: true,
        InlineMarkdown: true,
        TemplateStudioRichTextEditor: true,
      },
    },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  saveStatus.value = "idle";
  lastSavedAt.value = null;
  templateAggregate.value = null;
});

it("includes a complete yes-no Follow-up placement step", async () => {
  renderRoom(yesNoQuestion);

  await fireEvent.click(
    screen.getByTestId("guided-waypoint-follow-up-placement")
  );

  expect(
    await screen.findByRole("heading", { name: "Follow-up placement" })
  ).toBeTruthy();
  expect(screen.getByText("High · weight 2")).toBeTruthy();
  expect(
    screen.getByText(
      "Choose the stage whose definition best fits this item. Placement is not priority or timing."
    )
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", {
      name: "Follow-up placement for this question",
    })
  ).toBeTruthy();
});

it("uses the local-draft save label from the studio header", () => {
  saveStatus.value = "saved";
  lastSavedAt.value = new Date("2026-08-20T09:00:00.000Z");
  templateAggregate.value = templateAggregateFixture;

  renderRoom(yesNoQuestion);

  expect(screen.getByText("Saved locally")).toBeTruthy();
  expect(screen.queryByText("Saved", { exact: true })).toBeNull();
});

it("opens normal sessions on Question type even when a later section is empty", async () => {
  const incompleteQuestion = {
    ...yesNoQuestion,
    leadingPractices: [],
    helpfulLinks: [],
  };
  const view = renderRoom(incompleteQuestion, { open: false });

  await view.rerender({
    open: true,
    question: incompleteQuestion,
    questionSlug: "REL-01",
    hasPreviousQuestion: false,
    hasNextQuestion: false,
  });

  expect(
    await screen.findByRole("heading", { name: "Question type" })
  ).toBeTruthy();
  const currentWaypoints = screen
    .getAllByTestId(/^guided-waypoint-/)
    .filter((waypoint) => waypoint.getAttribute("aria-current") === "step");
  expect(currentWaypoints).toEqual([
    screen.getByTestId("guided-waypoint-type"),
  ]);
});

it("closes from an ordinary Escape dispatched outside the room subtree", async () => {
  const view = renderRoom(yesNoQuestion);

  await fireEvent.keyDown(window, { key: "Escape" });

  expect(view.emitted().close).toHaveLength(1);
});

it("lets a portalled placement menu consume Escape before closing the room", async () => {
  const view = renderRoom(yesNoQuestion, {
    open: false,
    requestedSectionId: "follow-up-placement",
  });
  await view.rerender({
    open: true,
    question: yesNoQuestion,
    questionSlug: "REL-01",
    hasPreviousQuestion: false,
    hasNextQuestion: false,
    requestedSectionId: "follow-up-placement",
  });
  expect(
    await screen.findByRole("combobox", {
      name: "Follow-up placement for this question",
    })
  ).toBeTruthy();
  const portalledMenu = document.createElement("div");
  portalledMenu.dataset.dismissableLayer = "";
  document.body.append(portalledMenu);

  await fireEvent.keyDown(window, { key: "Escape" });

  expect(view.emitted().close).toBeUndefined();

  portalledMenu.remove();
  await fireEvent.keyDown(window, { key: "Escape" });
  expect(view.emitted().close).toHaveLength(1);
});

it("uses a requested final waypoint for one open session only", async () => {
  const view = renderRoom(yesNoQuestion, {
    open: false,
    requestedSectionId: "follow-up-placement",
  });
  const closedProps = {
    open: false,
    question: yesNoQuestion,
    questionSlug: "REL-01",
    hasPreviousQuestion: false,
    hasNextQuestion: false,
    requestedSectionId: "follow-up-placement",
  };

  await view.rerender({ ...closedProps, open: true });

  expect(
    await screen.findByRole("heading", { name: "Follow-up placement" })
  ).toBeTruthy();
  const placement = screen.getByRole("combobox", {
    name: "Follow-up placement for this question",
  });
  await waitFor(() => expect(document.activeElement).toBe(placement));

  await fireEvent.click(screen.getByTestId("guided-waypoint-resources"));
  await waitFor(() =>
    expect(
      screen
        .getByTestId("guided-waypoint-resources")
        .getAttribute("aria-current")
    ).toBe("step")
  );
  expect(
    screen
      .getAllByTestId(/^guided-waypoint-/)
      .filter((waypoint) => waypoint.getAttribute("aria-current") === "step")
  ).toHaveLength(1);

  await view.rerender(closedProps);
  await view.rerender({ ...closedProps, open: true });

  expect(
    await screen.findByRole("heading", { name: "Question type" })
  ).toBeTruthy();
  expect(
    screen.getByTestId("guided-waypoint-type").getAttribute("aria-current")
  ).toBe("step");
});

it("includes bulk and per-practice placement controls for checklists", async () => {
  renderRoom(checklistQuestion);

  await fireEvent.click(
    screen.getByTestId("guided-waypoint-follow-up-placement")
  );
  await screen.findByRole("heading", { name: "Follow-up placement" });

  expect(
    screen.getByRole("combobox", { name: "Set all Follow-up placements" })
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", {
      name: "Follow-up placement for Latency is measured.",
    })
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", {
      name: "Follow-up placement for Errors are measured.",
    })
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Choose the stage whose definition best fits this item. Placement is not priority or timing."
    )
  ).toBeTruthy();
  expect(screen.getByTestId("guided-room-body").className).toContain(
    "grid-cols-1"
  );
  const placementTable = screen.getByTestId("guided-placement-table");
  expect(placementTable.className).not.toMatch(/\brounded/);
  expect(placementTable.className).not.toMatch(/\bborder\b/);
  for (const row of screen.getAllByTestId("guided-placement-row")) {
    expect(row.className).toContain("lg:grid-cols-[minmax(0,1fr)_15rem]");
  }
  expect(document.querySelector(".rail-line")).toBeNull();
});

it("keeps arrow navigation on the waypoint rail and moves waypoint focus", async () => {
  renderRoom(yesNoQuestion);

  const typeWaypoint = screen.getByTestId("guided-waypoint-type");
  const previewButton = screen.getByTestId("guided-room-preview");
  expect(typeWaypoint.getAttribute("aria-current")).toBe("step");

  previewButton.focus();
  await fireEvent.keyDown(previewButton, { key: "ArrowRight" });
  expect(typeWaypoint.getAttribute("aria-current")).toBe("step");

  typeWaypoint.focus();
  await fireEvent.keyDown(typeWaypoint, { key: "ArrowRight" });
  const questionWaypoint = screen.getByTestId("guided-waypoint-question");
  expect(questionWaypoint.getAttribute("aria-current")).toBe("step");
  expect(document.activeElement).toBe(questionWaypoint);
});

it("focuses the new section heading after Next and exposes a real section count", async () => {
  renderRoom(yesNoQuestion);

  expect(screen.getByText("Section 1 of 6")).toBeTruthy();
  await fireEvent.click(screen.getByTestId("guided-nav-next"));

  const heading = await screen.findByRole("heading", { name: "Question" });
  await waitFor(() => expect(document.activeElement).toBe(heading));
  expect(heading.getAttribute("tabindex")).toBe("-1");
  expect(screen.getByText("Section 2 of 6")).toBeTruthy();
});
