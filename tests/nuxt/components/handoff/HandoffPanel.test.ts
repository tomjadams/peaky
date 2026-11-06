/**
 * Handoff panel on the review Improvement Plan (improvement-plans/REQ-005,
 * REQ-006, REQ-009, REQ-011, REQ-012; AC-015 through AC-020, AC-025
 * through AC-027, AC-036, AC-039, AC-042).
 *
 * Provider-neutral selectable practice rows: independent selection across
 * pinned Revisions, pinned-Revision and evidence context, assessment deep
 * links, current external references, the always-visible draft entry point,
 * and the 50-practice maximum. Negative assertions prove no provider
 * creation semantics, no Jira-specific labels, no editable draft title,
 * and no third evidence state appear.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { ref } from "vue";
import HandoffPanel from "~/components/handoff/HandoffPanel.vue";
import { HandoffLimitError } from "~/services/handoff/limits";
import {
  deselectHandoffPractice,
  selectHandoffPractice,
} from "~/services/handoff/handoffWrite";
import {
  associateTransition,
  entityIdOf,
  makeHandoffContext,
  manyPracticesContext,
  REVIEW_NAME,
  selectFromContext,
  selectedRows,
} from "./fixtures";

vi.mock("~/services/handoff/handoffWrite", () => ({
  selectHandoffPractice: vi.fn().mockResolvedValue([]),
  deselectHandoffPractice: vi.fn().mockResolvedValue([]),
  setHandoffPracticeRationale: vi.fn().mockResolvedValue([]),
  reorderHandoffPractice: vi.fn().mockResolvedValue([]),
  confirmHandoffAssociation: vi.fn(),
  replaceHandoffAssociation: vi.fn(),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: "actor-1", name: "Advisor One", roles: [] }),
  }),
}));

vi.mock("~/composables/handoff/useHandoffSyncGate", () => ({
  useHandoffSyncGate: () => ({
    gate: ref({
      sharedViewCurrent: true,
      draftEditing: { available: true },
      confirmation: { available: true, reason: null },
    }),
  }),
}));

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};

const renderPanel = (
  overrides: {
    rows?: ReturnType<typeof selectedRows>;
    history?: ReturnType<typeof associateTransition>[];
    context?: ReturnType<typeof makeHandoffContext>;
    showSelectionList?: boolean;
    selectionRevisionId?: string;
    writeAvailable?: boolean;
    writeUnavailableReason?: string;
  } = {}
) =>
  render(HandoffPanel, {
    props: {
      reviewContext: overrides.context ?? makeHandoffContext(),
      reviewName: REVIEW_NAME,
      rows: overrides.rows ?? [],
      history: overrides.history ?? [],
      practicePathFor: () => "/teams/team-1/reviews/review-1/assessment",
      ...(overrides.showSelectionList === undefined
        ? {}
        : { showSelectionList: overrides.showSelectionList }),
      ...(overrides.selectionRevisionId === undefined
        ? {}
        : { selectionRevisionId: overrides.selectionRevisionId }),
      ...(overrides.writeAvailable === undefined
        ? {}
        : { writeAvailable: overrides.writeAvailable }),
      ...(overrides.writeUnavailableReason === undefined
        ? {}
        : { writeUnavailableReason: overrides.writeUnavailableReason }),
    },
    global: {
      stubs: {
        HandoffComposer: {
          props: ["draft"],
          template: `<section aria-label="Handoff composer">{{ draft.kind }}</section>`,
        },
        NuxtLink: nuxtLinkStub,
      },
    },
  });

const select = vi.mocked(selectHandoffPractice);
const deselect = vi.mocked(deselectHandoffPractice);

describe("HandoffPanel", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("projects each unmet checklist practice as an independently selectable row (AC-015)", async () => {
    renderPanel();
    const first = screen.getByRole("checkbox", {
      name: /Enable branch protection/,
    });
    const sibling = screen.getByRole("checkbox", {
      name: /Scan dependencies/,
    });
    // The met checklist item is not projected.
    expect(
      screen.queryByRole("checkbox", { name: /Require pull request reviews/ })
    ).toBeNull();

    await fireEvent.click(first);
    expect(select).toHaveBeenCalledOnce();
    const input = select.mock.calls[0]![0] as {
      practice: { entityId: string };
      actorId: string;
    };
    // Selecting one practice never selects or blocks a sibling (AC-015).
    expect(input.practice.entityId).toBe(entityIdOf("cl-1"));
    expect(input.actorId).toBe("actor-1");
    expect((sibling as HTMLButtonElement).disabled).toBe(false);
  });

  it("projects a negative Yes/No question as one practice (AC-016)", () => {
    renderPanel();
    expect(
      screen.getByRole("checkbox", { name: /Is single sign-on enforced\?/ })
    ).toBeDefined();
  });

  it("spans pinned revisions with visible revision identity, never a rollup (AC-017, AC-020)", () => {
    renderPanel();
    expect(
      screen.getByRole("checkbox", { name: /Add health-check endpoints/ })
    ).toBeDefined();
    // Every row identifies its pinned template revision.
    expect(screen.getAllByText("Security Review · revision 1")).toHaveLength(3);
    expect(screen.getByText("Reliability Review · revision 2")).toBeDefined();
  });

  it("shows binary evidence state with provenance; N/A is excluded (AC-018, AC-019)", () => {
    renderPanel();
    // Evidence is exactly met or unmet — the projection only carries unmet
    // practices, each with answer provenance; no third state exists.
    expect(screen.getAllByText("Unmet").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Answered No")).toBeDefined();
    expect(screen.getAllByText("Checklist item not checked")).toHaveLength(3);
    expect(screen.queryByText(/legacy VPN/)).toBeNull();
    expect(screen.queryByText(/needs validation/i)).toBeNull();
  });

  it("links every practice to its source assessment question (AC-018)", () => {
    renderPanel();
    const link = screen.getByRole("link", {
      name: /Open "Enable branch protection" in the assessment/,
    });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("templateRevisionId");
    expect(href).toContain("rev-a");
    expect(href).toContain("#question-q-cl");
  });

  it("displays the current external reference of an associated practice (AC-018)", () => {
    renderPanel({ history: [associateTransition("cl-1")] });
    expect(screen.getByText(/Linked to GitLab GL-42/)).toBeDefined();
    const link = screen.getByRole("link", { name: /GL-42/ });
    expect(link.getAttribute("href")).toBe(
      "https://gitlab.example.com/issues/42"
    );
  });

  it("renders the handoff composer in page without a fixed narrow overlay", () => {
    renderPanel({ rows: selectedRows(["cl-1"]) });

    expect(document.querySelector(".handoff-panel__mobile")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Handoff composer" })
    ).toBeDefined();
  });

  it("keeps the empty and ready draft states in the in-page composer", async () => {
    const { rerender } = renderPanel();
    const composer = screen.getByRole("region", { name: "Handoff composer" });
    expect(composer.textContent).toContain("empty");

    await rerender({ rows: selectedRows(["cl-1", "rl-1"]) });
    expect(composer.textContent).toContain("ready");
    expect(screen.queryByRole("textbox", { name: /title/i })).toBeNull();
  });

  it("deselects a selected practice through the write path (AC-023)", async () => {
    const rows = selectedRows(["cl-1"]);
    renderPanel({ rows });
    // Reka UI renders the checkbox as a button with aria-checked state.
    const checkbox = screen.getByRole("checkbox", {
      name: /Enable branch protection/,
    });
    expect(checkbox.getAttribute("aria-checked")).toBe("true");

    await fireEvent.click(checkbox);
    expect(deselect).toHaveBeenCalledOnce();
    expect(deselect.mock.calls[0]![0]).toMatchObject({
      entityId: entityIdOf("cl-1"),
    });
  });

  it("prevents selecting a 51st practice (AC-042)", () => {
    const context = manyPracticesContext(51);
    // Fifty already selected through the domain — the 51st stays blocked.
    renderPanel({ context, rows: selectFromContext(context, 50) });

    const fiftyFirst = screen.getByRole("checkbox", {
      name: /Add "Practice 51" to handoff/,
    }) as HTMLInputElement;
    // aria-disabled keeps the limit-reached control focusable and announced
    // while the write guard blocks the selection (AC-042).
    expect(fiftyFirst.getAttribute("aria-disabled")).toBe("true");
  });

  it("surfaces field-addressable limit errors when a selection is rejected (AC-039)", async () => {
    select.mockRejectedValueOnce(
      new HandoffLimitError([
        {
          field: "helpfulLinks",
          code: "collection_limit_exceeded",
          limit: 10,
          actual: 11,
        },
      ])
    );
    renderPanel();
    await fireEvent.click(
      screen.getByRole("checkbox", { name: /Enable branch protection/ })
    );
    await nextTick();

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("helpfulLinks");
    expect(alert.textContent).toContain("10");
    expect(alert.textContent).toContain("11");
  });

  it("gates fallback selection beside the handoff action until the review is local", async () => {
    renderPanel({
      writeAvailable: false,
      writeUnavailableReason:
        "Reload Follow-ups to prepare this review for offline changes.",
    });

    const checkbox = screen.getByRole("checkbox", {
      name: /Enable branch protection/,
    });
    expect(checkbox.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain(
      "Reload Follow-ups"
    );

    await fireEvent.click(checkbox);
    expect(select).not.toHaveBeenCalled();
  });

  it("never renders provider-creation or provider-specific semantics (AC-029, AC-030, AC-036)", () => {
    renderPanel({ rows: selectedRows(["cl-1"]) });
    const section = screen.getByRole("region", { name: /handoff/i });
    for (const forbidden of [
      /jira/i,
      /epic/i,
      /child issue/i,
      /one ticket per practice/i,
      /create (a )?(new )?(ticket|issue|work item)/i,
      /needs validation/i,
    ]) {
      expect(section.textContent).not.toMatch(forbidden);
    }
  });

  it("scopes a no-result fallback list to one pinned Revision", () => {
    renderPanel({ selectionRevisionId: "rev-b" });

    expect(
      screen.getByRole("checkbox", { name: /Add health-check endpoints/ })
    ).toBeDefined();
    expect(
      screen.queryByRole("checkbox", { name: /Enable branch protection/ })
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: /Scan dependencies/ })
    ).toBeNull();
  });

  it("omits the fallback practice list when evidence rows carry selection (maturity-score/AC-067)", () => {
    renderPanel({ showSelectionList: false });

    expect(
      screen.getByRole("region", { name: "Handoff composer" })
    ).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Needs attention" })
    ).toBeNull();
  });
});
