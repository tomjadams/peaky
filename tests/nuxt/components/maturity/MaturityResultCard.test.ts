/**
 * Rich maturity result card (maturity-score/REQ-013 through REQ-016;
 * AC-023 through AC-031, AC-035, AC-039, AC-056, AC-062).
 *
 * One card per pinned Revision: effective stage, whole percentage, coverage,
 * provisional qualifier below full coverage, pillar breakdown, persistent
 * override indicator with the calculated value still discoverable, and the
 * interpretation context (revision number + opaque ID).
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import MaturityResultCard from "~/components/maturity/MaturityResultCard.vue";
import {
  advisorOverride,
  fullCoverageWorkspace,
  resultEntry,
  stagePathWorkspace,
} from "./fixtures";

const nuxtLinkStub = {
  props: ["to"],
  template: `<a :href="JSON.stringify(to)"><slot /></a>`,
};

const selectStub = {
  inheritAttrs: false,
  props: ["modelValue", "items", "ariaLabel"],
  emits: ["update:modelValue"],
  template: `<select :aria-label="ariaLabel" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value">{{ item.label }}</option></select>`,
};

const renderCard = (
  workspace: ReturnType<typeof stagePathWorkspace>,
  canOverride = false
) =>
  render(MaturityResultCard, {
    props: {
      workspace,
      entry: resultEntry(workspace),
      assessmentRouteName: "team-review-assessment",
      assessmentParams: { teamId: "team-1", reviewId: "review-1" },
      canOverride,
    },
    global: {
      stubs: {
        NuxtLink: nuxtLinkStub,
        USelect: selectStub,
        USlideover: {
          props: ["open", "title"],
          template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /></div>`,
        },
        UModal: {
          props: ["open"],
          template: `<div v-if="open" role="dialog"><slot name="body" /><slot name="footer" /></div>`,
        },
      },
    },
  });

describe("MaturityResultCard", () => {
  afterEach(() => cleanup());

  it("shows effective stage, whole percentage, and coverage (AC-023, AC-035)", () => {
    renderCard(stagePathWorkspace());
    // 1/4 = 25% resolves to Stage 2 Ad-hoc.
    expect(screen.getAllByText("Ad-hoc").length).toBeGreaterThan(0);
    expect(screen.getByText("25%")).toBeDefined();
    expect(screen.getByText(/4 of 5 questions answered/)).toBeDefined();
  });

  it("identifies the pinned revision by number and a constrained opaque identifier (AC-027)", () => {
    const rendered = renderCard(stagePathWorkspace());
    expect(screen.getByText("Template rev-1")).toBeDefined();
    expect(screen.getByText(/revision 1/)).toBeDefined();
    const identity = screen.getByText("rev-1");
    expect(identity.className).toContain("overflow-x-auto");
    expect(identity.className).toContain("max-w-full");
    expect(rendered.container.querySelector("article")?.className).not.toMatch(
      /rounded|shadow|bg-elevated/
    );
    // Interpretation context: review scope and status travel with the result.
    expect(screen.getByText(/in-progress/)).toBeDefined();
  });

  it("qualifies the stage as provisional below full coverage (AC-056)", () => {
    renderCard(stagePathWorkspace());
    expect(screen.getAllByText("Provisional").length).toBeGreaterThan(0);
  });

  it("removes the provisional qualifier at full coverage (AC-056)", () => {
    renderCard(fullCoverageWorkspace());
    expect(screen.queryByText("Provisional")).toBeNull();
  });

  it("shows the pillar breakdown with percentage, stage, and coverage (AC-026)", () => {
    renderCard(stagePathWorkspace());
    // P-A: 2/7 displays 29%, Stage 2. P-B: 1/6 displays 17%, Stage 1.
    const breakdownRegion = screen.getByRole("region", {
      name: /pillar breakdown/i,
    });
    const breakdown = within(breakdownRegion);
    expect(breakdown.getByText("Pillar P-A")).toBeDefined();
    expect(breakdown.getByText("29%")).toBeDefined();
    expect(breakdown.getByText("Pillar P-B")).toBeDefined();
    expect(breakdown.getByText("17%")).toBeDefined();
    expect(breakdown.getByText(/1 unanswered/)).toBeDefined();
    const localScroll = breakdownRegion.querySelector(
      "[data-pillar-breakdown-scroll]"
    );
    expect(localScroll?.className).toContain("overflow-x-auto");
    expect(localScroll?.className).toContain("max-w-full");
  });

  it("shows the Advisor-reviewed value as effective while the calculated value stays discoverable (AC-030, AC-031)", () => {
    renderCard(stagePathWorkspace([advisorOverride]));
    // Effective override: 75% → stage 4 Measured, with a persistent indicator.
    expect(screen.getByText("75%")).toBeDefined();
    expect(screen.getByText("Measured")).toBeDefined();
    expect(screen.getAllByText(/Advisor reviewed/i).length).toBeGreaterThan(0);
    // The calculated result stays discoverable next to the override.
    expect(screen.getByText(/Calculated: 25%/)).toBeDefined();
    // Provenance: actor and time remain available.
    expect(screen.getByText(/advisor-1/)).toBeDefined();
  });

  it("scopes every assessment question link to its pinned Revision", () => {
    renderCard(stagePathWorkspace());

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toContain("templateRevisionId");
      expect(link.getAttribute("href")).toContain("rev-1");
    }
  });

  it("offers the calculation explanation and — for Advisors — the override action (AC-028, AC-062)", () => {
    renderCard(stagePathWorkspace(), true);
    expect(
      screen.getByRole("button", { name: /How is this calculated/i })
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Record reviewed maturity/i })
    ).toBeDefined();
  });

  it("hides the override action from non-Advisors (AC-030)", () => {
    renderCard(stagePathWorkspace(), false);
    expect(
      screen.queryByRole("button", { name: /Record reviewed maturity/i })
    ).toBeNull();
  });
});
