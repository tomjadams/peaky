/**
 * Compact per-Review result context for team and product Follow-ups
 * (maturity-score/REQ-014; AC-039, AC-056, AC-062).
 *
 * Flat lines summarize each pinned Revision's effective stage beside the
 * contributing Review and link back to that Review's Follow-ups page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import MaturityCompactContext from "~/components/maturity/MaturityCompactContext.vue";
import { compactMaturityEntries } from "~/services/maturity/compactContext";
import {
  advisorOverride,
  multiRevisionWorkspace,
  noDefinitionWorkspace,
  noResultWorkspace,
  stagePathWorkspace,
} from "./fixtures";

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};

const planRoute = {
  name: "team-review-plan",
  params: { teamId: "team-1", reviewId: "review-1" },
};

const renderCompact = (workspace: ReturnType<typeof stagePathWorkspace>) =>
  render(MaturityCompactContext, {
    props: { entries: compactMaturityEntries(workspace), to: planRoute },
    global: { stubs: { NuxtLink: nuxtLinkStub } },
  });

describe("MaturityCompactContext", () => {
  afterEach(() => cleanup());

  it("shows visible Revision identity, stage, whole percentage, and Review return path (AC-039)", () => {
    const workspace = stagePathWorkspace();
    const [entry] = compactMaturityEntries(workspace);
    renderCompact(workspace);

    const line = screen.getByRole("link", { name: /Template rev-1/ });
    expect(entry).toBeDefined();
    expect(within(line).getByText(entry!.label)).toBeTruthy();
    expect(line.textContent).toContain("25%");
    expect(line.textContent).toContain("Stage 2 · Ad-hoc");
    expect(line.getAttribute("href")).toContain("team-review-plan");
  });

  it("qualifies a stage below full coverage as provisional (AC-056)", () => {
    renderCompact(stagePathWorkspace());
    expect(screen.getByText(/provisional/i)).toBeDefined();
  });

  it("marks an Advisor-reviewed value (AC-030)", () => {
    renderCompact(stagePathWorkspace([advisorOverride]));
    const chip = screen.getByRole("link", { name: /Template rev-1/ });
    expect(chip.textContent).toContain("75%");
    expect(chip.textContent).toMatch(/advisor reviewed/i);
  });

  it("keeps each pinned Revision on its own line, never a combined score (AC-025)", () => {
    const { container } = renderCompact(multiRevisionWorkspace());
    const first = screen.getByRole("link", { name: /Template rev-1/ });
    const second = screen.getByRole("link", { name: /Template rev-2/ });

    expect(within(first).getByText("Template rev-1 · Revision 1")).toBeTruthy();
    expect(first.textContent).toContain("100%");
    expect(first.textContent).not.toContain("Template rev-2");
    expect(
      within(second).getByText("Template rev-2 · Revision 1")
    ).toBeTruthy();
    expect(second.textContent).toContain("0%");
    expect(second.textContent).not.toContain("Template rev-1");
    expect(first.getAttribute("href")).toContain(
      '"templateRevisionId":"rev-1"'
    );
    expect(second.getAttribute("href")).toContain(
      '"templateRevisionId":"rev-2"'
    );
    expect(container.textContent).not.toMatch(/combined|overall score/i);
  });

  it("renders a visible no-result state without fabricating zero percent (AC-060)", () => {
    const workspace = noResultWorkspace();
    const [entry] = compactMaturityEntries(workspace);
    renderCompact(workspace);

    const line = screen.getByRole("link", { name: /Template rev-1/ });
    expect(entry).toBeDefined();
    expect(within(line).getByText(entry!.label)).toBeTruthy();
    expect(line.textContent).toContain("No applicable result");
    expect(line.textContent).not.toContain("0%");
  });

  it("renders a compact no-definition state (AC-060)", () => {
    renderCompact(noDefinitionWorkspace());
    expect(screen.getByText(/No maturity definition/)).toBeDefined();
  });

  it("shows answer coverage beside the stage (AC-068)", () => {
    const workspace = stagePathWorkspace();
    renderCompact(workspace);
    const [entry] = compactMaturityEntries(workspace);
    const chip = screen.getByRole("link", { name: /Template rev-1/ });
    expect(entry?.coverage).toBeTruthy();
    expect(chip.textContent).toContain(
      `${entry?.coverage?.answered}/${entry?.coverage?.total} answered`
    );
  });
});
