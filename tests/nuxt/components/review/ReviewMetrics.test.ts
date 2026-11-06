import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import ReviewMetrics from "~/components/review/ReviewMetrics.vue";

const statBlockStub = {
  props: ["label", "value", "tone", "subLabel"],
  template: `<section :aria-label="label" :data-tone="tone"><span>{{ value }}</span><span>{{ subLabel }}</span></section>`,
};

const statStripStub = { template: `<div><slot /></div>` };
const nuxtLinkStub = {
  props: ["to"],
  template: `<a href="/follow-ups"><slot /></a>`,
};

function renderMetrics() {
  return render(ReviewMetrics, {
    props: {
      overallProgress: 50,
      actionsNeeded: null,
      attentionLoading: true,
      answeredQuestions: 6,
      totalQuestions: 12,
      updatedAt: "2026-09-12T10:00:00.000Z",
      planRoute: "/follow-ups",
    },
    global: {
      stubs: {
        ClientOnly: { template: `<div><slot /></div>` },
        NuxtLink: nuxtLinkStub,
        StatBlock: statBlockStub,
        StatStrip: statStripStub,
      },
    },
  });
}

describe("ReviewMetrics Needs attention state", () => {
  afterEach(cleanup);

  it("stays neutral while the follow-up plan loads, then shows the plan count", async () => {
    const rendered = renderMetrics();
    const attention = screen.getByRole("region", { name: "Needs attention" });

    expect(attention.textContent).toContain("—");
    expect(attention.textContent).not.toContain("Loading follow-ups");
    expect(attention.dataset.tone).toBe("default");

    await rendered.rerender({
      overallProgress: 50,
      actionsNeeded: 16,
      attentionLoading: false,
      answeredQuestions: 6,
      totalQuestions: 12,
      updatedAt: "2026-09-12T10:00:00.000Z",
      planRoute: "/follow-ups",
    });

    expect(attention.textContent).toContain("16");
    expect(attention.textContent).not.toContain("follow-up");
    expect(attention.textContent).not.toContain("not assessed");
    expect(attention.dataset.tone).toBe("attention");
  });
});
