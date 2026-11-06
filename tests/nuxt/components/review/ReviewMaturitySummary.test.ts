import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import { ref } from "vue";
import ReviewMaturitySummary from "~/components/review/ReviewMaturitySummary.vue";
import ReviewPillarMaturity from "~/components/review/ReviewPillarMaturity.vue";
import {
  multiRevisionWorkspace,
  noDefinitionWorkspace,
  stagePathWorkspace,
} from "../maturity/fixtures";

const actorState = vi.hoisted(() => ({ id: "viewer-1" }));
vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: actorState.id, name: "Viewer", roles: [] }),
  }),
}));

const modalStub = {
  props: ["open", "title"],
  template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>`,
};
const popoverStub = {
  props: ["open"],
  template: `<span><slot /><div role="dialog"><slot name="content" /></div></span>`,
};

function renderSummary(
  workspace = multiRevisionWorkspace(),
  templateRevisionId = "rev-1"
) {
  return render(ReviewMaturitySummary, {
    props: { workspace, templateRevisionId },
    global: { stubs: { UModal: modalStub } },
  });
}

describe("Review Details maturity", () => {
  beforeEach(() => {
    actorState.id = "viewer-1";
  });
  afterEach(cleanup);

  it("renders one inline result for the active template without calculation controls", () => {
    renderSummary();

    expect(
      screen.getByRole("heading", { name: "Maturity estimate", level: 3 })
    ).toBeDefined();
    expect(screen.getByText("100%")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "About Stage 5, Optimized" })
    ).toBeDefined();
    expect(screen.getByText("Settled from all 1 question.")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /calculated|calculation/i })
    ).toBeNull();
    expect(document.body.textContent).not.toContain("Template rev-2");
  });

  it("explains provisional status without exposing score arithmetic", () => {
    renderSummary(stagePathWorkspace());

    expect(
      screen.getByText(
        "Provisional: 1 of 5 questions is unanswered, so this result can change."
      )
    ).toBeDefined();
    expect(document.body.textContent).not.toMatch(/weight|points|share/i);
  });

  it("keeps non-result states concise and action-free", () => {
    renderSummary(noDefinitionWorkspace());

    expect(screen.getByText("Not configured")).toBeDefined();
    expect(screen.queryByRole("link", { name: /assessment/i })).toBeNull();
  });

  it("keeps the advisor override entry quiet and authorized", () => {
    const workspace = stagePathWorkspace();
    workspace.advisors = [
      { id: "viewer-1", name: "Viewer", email: "viewer@example.com" },
    ];
    renderSummary(workspace);

    expect(
      screen.getByRole("button", { name: "Record advisor review" })
    ).toBeDefined();
  });

  it("keeps pillar meaning and one coverage expression in a popover", () => {
    const workspace = stagePathWorkspace();
    const pillar = workspace.pillars[1]!;
    render(ReviewPillarMaturity, {
      props: {
        workspace,
        templateRevisionId: "rev-1",
        pillarSlug: pillar.slug,
      },
      global: { stubs: { UPopover: popoverStub } },
    });

    expect(
      screen.getByRole("button", { name: /About Pillar P-B maturity/i })
    ).toBeDefined();
    const tooltip = screen.getByRole("dialog");
    expect(tooltip.textContent).toContain(
      "Provisional: 1 of 2 questions answered."
    );
    expect(tooltip.textContent).not.toContain("1 unanswered");
  });
});
