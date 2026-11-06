import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { ref } from "vue";
import HandoffComposer from "~/components/handoff/HandoffComposer.vue";
import type { HandoffMaturityPreview } from "~/services/maturity/handoffPreview";
import type { HandoffSyncGate } from "~/services/handoff/syncGate";
import {
  clearHandoffPractices,
  reorderHandoffPractice,
  setHandoffPracticeRationale,
} from "~/services/handoff/handoffWrite";
import { draftFor, entityIdOf, selectedRows } from "./fixtures";

vi.mock("~/services/handoff/handoffWrite", () => ({
  clearHandoffPractices: vi.fn().mockResolvedValue([]),
  deselectHandoffPractice: vi.fn().mockResolvedValue([]),
  reorderHandoffPractice: vi.fn().mockResolvedValue([]),
  setHandoffPracticeRationale: vi.fn().mockResolvedValue([]),
  confirmHandoffAssociation: vi.fn(),
  replaceHandoffAssociation: vi.fn(),
}));

const gateRef = ref<HandoffSyncGate>({
  sharedViewCurrent: true,
  draftEditing: { available: true },
  confirmation: { available: true, reason: null },
});
vi.mock("~/composables/handoff/useHandoffSyncGate", () => ({
  useHandoffSyncGate: () => ({ gate: gateRef }),
}));

const writeText = vi.fn<(text: string) => Promise<void>>();
const modalStub = {
  props: ["open", "title"],
  template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /></div>`,
};
const associationStub = { template: `<div>Association form</div>` };
const replaceStub = { template: `<div />` };
const stage = (value: 3 | 4, name: string) => ({ stage: value, name });

function maturityPreview(crossesStage: boolean): HandoffMaturityPreview {
  return {
    kind: "available",
    templateRevisionId: "rev-a",
    selectedCount: 2,
    current: { displayPercentTenths: 49, stage: stage(3, "Defined") },
    projected: {
      displayPercentTenths: 50,
      stage: crossesStage ? stage(4, "Measured") : stage(3, "Defined"),
    },
    delta: { displayPercentagePoints: 1 },
    pointsStillNeeded: crossesStage ? null : { displayPercentagePoints: 0 },
    crossesStage,
  } as HandoffMaturityPreview;
}

function renderComposer(
  ids: string[] = [],
  overrides: {
    active?: boolean;
    maturityPreviews?: HandoffMaturityPreview[];
  } = {}
) {
  const rows = selectedRows(ids);
  return render(HandoffComposer, {
    props: {
      draft: draftFor(rows),
      rows,
      history: [],
      practicePathFor: (reference: { questionId: string }) =>
        `/assessment#question-${reference.questionId}`,
      reviewPath: "/teams/team-1/reviews/review-1",
      active: overrides.active,
      maturityPreviews: overrides.maturityPreviews,
    },
    global: {
      stubs: {
        UModal: modalStub,
        HandoffAssociationForm: associationStub,
        HandoffReplaceModal: replaceStub,
      },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  gateRef.value = {
    sharedViewCurrent: true,
    draftEditing: { available: true },
    confirmation: { available: true, reason: null },
  };
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HandoffComposer", () => {
  it("renders an in-page empty state without completion or a sequence title", () => {
    renderComposer([], { active: true });
    expect(screen.getByRole("heading", { name: "Handoff" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Handoff 1" })).toBeNull();
    expect(screen.getByText("Select a practice to start")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Close handoff" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers completion only while the active handoff contains work", () => {
    renderComposer(["cl-1"], { active: true });
    expect(screen.getByRole("button", { name: "Close handoff" })).toBeDefined();
  });

  it("shows the visible ordered sequence and keeps notes collapsed", () => {
    renderComposer(["cl-1", "q-yn"]);
    const list = screen.getByRole("list", { name: "Selected practices" });
    const items = list.querySelectorAll("li");
    expect(items[0]!.textContent).toContain("Enable branch protection");
    expect(items[1]!.textContent).toContain("Is single sign-on enforced?");
    expect(screen.getAllByText("Add a handoff note")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.getAllByRole("textbox")[0]!.closest("details")?.open).toBe(
      false
    );
  });

  it("labels a full movement bar as reaching the next stage", () => {
    renderComposer(["cl-1", "q-yn"], {
      maturityPreviews: [maturityPreview(true)],
    });

    expect(screen.getByText(/Reached\s+Stage 4/)).toBeDefined();
    expect(
      screen.getByRole("img", { name: /reach Stage 4, Measured/ })
    ).toBeDefined();
  });

  it("does not fill the movement bar for a rounded near-threshold result", () => {
    renderComposer(["cl-1", "q-yn"], {
      maturityPreviews: [maturityPreview(false)],
    });

    expect(screen.getByText(/Toward\s+Stage 4/)).toBeDefined();
    const meter = screen.getByRole("img", { name: /move toward Stage 4/ });
    expect(
      meter.querySelector("[data-movement-fill]")?.getAttribute("style")
    ).toContain("99%");
  });

  it("clears the visible sequence in one action", async () => {
    const view = renderComposer(["cl-1", "q-yn"]);
    await fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    expect(clearHandoffPractices).toHaveBeenCalledWith(
      expect.objectContaining({ rows: expect.any(Array) })
    );
    expect(view.emitted().changed).toHaveLength(1);
  });

  it("copies the visible order immediately after a reorder", async () => {
    renderComposer(["cl-1", "q-yn"]);
    await fireEvent.click(
      screen.getByRole("button", {
        name: /Move "Is single sign-on enforced\?" up/,
      })
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Copy Markdown" })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(reorderHandoffPractice).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: entityIdOf("q-yn"), toIndex: 0 })
    );
    const copied = writeText.mock.calls[0]![0];
    expect(copied.indexOf("Is single sign-on enforced?")).toBeLessThan(
      copied.indexOf("Enable branch protection")
    );
  });

  it("saves an optional handoff note through the existing write path", async () => {
    renderComposer(["cl-1"]);
    const note = screen.getByRole("textbox", {
      name: /Rationale for "Enable branch protection"/,
    });
    await fireEvent.update(note, "Needed before the next release");
    await fireEvent.blur(note);
    expect(setHandoffPracticeRationale).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: entityIdOf("cl-1"),
        rationale: "Needed before the next release",
      })
    );
  });

  it("keeps the composer focused on sequencing rather than source metadata", () => {
    renderComposer(["cl-1"]);

    expect(screen.getByText("Enable branch protection")).toBeDefined();
    expect(screen.queryByText(/Security Review/)).toBeNull();
    expect(screen.queryByRole("link", { name: /assessment/i })).toBeNull();
  });

  it("opens existing-ticket association in a modal", async () => {
    renderComposer(["cl-1"]);
    await fireEvent.click(
      screen.getByRole("button", { name: "Link existing work item" })
    );
    expect(
      screen.getByRole("dialog", { name: "Link existing work item" })
    ).toBeDefined();
  });

  it("keeps local copy available while explaining offline link gating", () => {
    gateRef.value = {
      sharedViewCurrent: false,
      draftEditing: { available: true },
      confirmation: {
        available: false,
        reason: "Reconnect before linking.",
      },
    };
    renderComposer(["cl-1"]);
    expect(screen.getByText("Saved on this device")).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Copy Markdown" })
        .hasAttribute("disabled")
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Link existing work item" })
        .hasAttribute("disabled")
    ).toBe(false);
  });
});
