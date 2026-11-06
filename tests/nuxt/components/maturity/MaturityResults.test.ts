/**
 * Maturity results section (maturity-score/REQ-014; AC-025, AC-039, AC-062).
 *
 * One clearly separated card per pinned Revision, never a combined score,
 * with a return path to the Review when rendered outside Review Details.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import { ref } from "vue";
import MaturityResults from "~/components/maturity/MaturityResults.vue";
import { multiRevisionWorkspace, noDefinitionWorkspace } from "./fixtures";

const actorState = vi.hoisted(() => ({ id: "viewer-1" }));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: actorState.id, name: "Viewer", roles: [] }),
  }),
}));

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

const renderSection = (
  workspace: ReturnType<typeof multiRevisionWorkspace>,
  reviewLink: object | null = null
) =>
  render(MaturityResults, {
    props: {
      workspace,
      assessmentRouteName: "team-review-assessment",
      assessmentParams: { teamId: "team-1", reviewId: "review-1" },
      reviewLink,
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
          props: ["open", "title"],
          template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>`,
        },
      },
    },
  });

describe("MaturityResults", () => {
  beforeEach(() => {
    actorState.id = "viewer-1";
  });
  afterEach(() => cleanup());

  it("renders one clearly separated card per pinned Revision and never a combined score (AC-025, AC-039)", () => {
    renderSection(multiRevisionWorkspace());

    const section = screen.getByRole("region", { name: /maturity/i });
    const cards = within(section).getAllByRole("article");
    expect(cards).toHaveLength(2);

    const first = within(cards[0]!);
    expect(first.getByText("Template rev-1")).toBeDefined();
    expect(first.getAllByText("100%").length).toBeGreaterThan(0);

    const second = within(cards[1]!);
    expect(second.getByText("Template rev-2")).toBeDefined();
    expect(second.getAllByText("0%").length).toBeGreaterThan(0);
    for (const link of second.getAllByRole("link")) {
      expect(link.getAttribute("href")).toContain("templateRevisionId");
      expect(link.getAttribute("href")).toContain("rev-2");
    }

    // No surface shows a combined review maturity.
    expect(section.textContent).not.toMatch(/combined/i);
    expect(section.textContent).not.toMatch(/overall maturity/i);
  });

  it("dispatches non-result entries to their explicit state cards (AC-060)", () => {
    renderSection(noDefinitionWorkspace());
    expect(screen.getByText(/No maturity definition/)).toBeDefined();
  });

  it("does not invent override authority for an actor absent from the persisted advisor list", () => {
    renderSection(multiRevisionWorkspace());

    expect(
      screen.queryByRole("button", { name: /Record reviewed maturity/i })
    ).toBeNull();
  });

  it("offers the override control only to an Advisor returned by the workspace", () => {
    actorState.id = "viewer-1";
    const workspace = multiRevisionWorkspace();
    workspace.advisors = [
      { id: "viewer-1", name: "Viewer", email: "viewer@example.com" },
    ];

    renderSection(workspace);

    expect(
      screen.getAllByRole("button", { name: /Record reviewed maturity/i })
    ).toHaveLength(2);
  });

  it("offers a return path to the review when rendered outside Review Details (AC-062)", () => {
    renderSection(multiRevisionWorkspace(), {
      name: "team-review-details",
      params: { teamId: "team-1", reviewId: "review-1" },
    });
    const back = screen.getByRole("link", { name: /Back to review/i });
    expect(back.getAttribute("href")).toContain("team-review-details");
  });
});
