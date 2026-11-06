/**
 * Explicit maturity entry states (maturity-score/REQ-014; AC-022, AC-042,
 * AC-060) — no-definition, over-limit configuration-error, and no-result,
 * each naming the action that resolves it.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import MaturityEntryStateCard from "~/components/maturity/MaturityEntryStateCard.vue";
import type { WorkspaceMaturityEntry } from "~/models/workspace";
import {
  advisorOverride,
  noDefinitionWorkspace,
  noResultWorkspace,
  overLimitWorkspace,
} from "./fixtures";

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};

const renderState = (
  workspace: ReturnType<typeof noDefinitionWorkspace>,
  index = 0
) =>
  render(MaturityEntryStateCard, {
    props: {
      workspace,
      entry: workspace.maturity[index]! as Exclude<
        WorkspaceMaturityEntry,
        { kind: "result" }
      >,
      assessmentRouteName: "team-review-assessment",
      assessmentParams: { teamId: "team-1", reviewId: "review-1" },
    },
    global: { stubs: { NuxtLink: nuxtLinkStub } },
  });

describe("MaturityEntryStateCard", () => {
  afterEach(() => cleanup());

  it("presents an explicit no-definition state naming the authoring action (AC-060)", () => {
    renderState(noDefinitionWorkspace());
    expect(screen.getByText(/No maturity definition/)).toBeDefined();
    expect(screen.getByText(/revision 1/)).toBeDefined();
    // Never a zero-percent result or an empty stage path.
    expect(screen.queryByText("0%")).toBeNull();
    // The resolving action links to Template Studio authoring.
    const action = screen.getByRole("link", { name: /Template Studio/i });
    expect(action.getAttribute("href")).toContain("/templates/");
  });

  it("presents the over-limit configuration error with its resolving action (AC-042)", () => {
    renderState(overLimitWorkspace());
    expect(screen.getByText(/Maturity configuration error/i)).toBeDefined();
    expect(screen.getByText(/11 questions/)).toBeDefined();
    expect(screen.getByText(/maximum of 10/)).toBeDefined();
    expect(
      screen.getByText(/pin a template revision with at most 10 questions/i)
    ).toBeDefined();
    // No trace, percentage, or stage exists for this Revision.
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("presents a non-positive custom share as a configuration error", () => {
    const workspace = {
      ...overLimitWorkspace(),
      maturity: [
        {
          kind: "configuration-error" as const,
          code: "non-positive-custom-share" as const,
          templateRevisionId: "rev-1",
          questionId: "Q-CL",
          practiceId: "P-ZERO",
          share: 0,
        },
      ],
    };

    renderState(workspace);

    expect(screen.getByText(/custom share of 0%/i)).toBeDefined();
    expect(screen.getByText(/equal weighting/i)).toBeDefined();
  });

  it("presents the no-applicable state explicitly, never as 0% (AC-022)", () => {
    renderState(noResultWorkspace());
    expect(screen.getByText(/No applicable maturity result/)).toBeDefined();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.getByText(/1 of 2 questions answered/)).toBeDefined();
    // The resolving action points at the assessment.
    const action = screen.getByRole("link", { name: /assessment/i });
    expect(action.getAttribute("href")).toContain("team-review-assessment");
    expect(action.getAttribute("href")).toContain("templateRevisionId");
    expect(action.getAttribute("href")).toContain("rev-1");
  });

  it("keeps effectiveResult null on no-result and surfaces override history only (AC-022, AC-031)", () => {
    const workspace = noResultWorkspace([advisorOverride]);
    const entry = workspace.maturity[0]!;
    if (entry.kind !== "no-result") throw new Error("expected no-result");
    expect(entry.effectiveResult).toBeNull();

    renderState(workspace);
    // The override never fabricates a stage when no calculated result exists.
    expect(screen.queryByText(/Stage \d/)).toBeNull();
    expect(screen.queryByText("75%")).toBeNull();
    // History stays discoverable as history.
    expect(screen.getByText(/override history/i)).toBeDefined();
    expect(screen.getByText(/advisor-1/)).toBeDefined();
    expect(screen.getByText(/Evidence verified on site\./)).toBeDefined();
  });
});
