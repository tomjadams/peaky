import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import ProductPlanRollups from "~/components/product/ProductPlanRollups.vue";
import type {
  PlanContributor,
  PlanItem,
  PlanRollup,
} from "~/models/improvement-plan";
import type { CompactMaturityEntry } from "~/services/maturity/compactContext";

const stubs = {
  NuxtLink: {
    props: ["to"],
    template: `<a :href="JSON.stringify(to)"><slot /></a>`,
  },
  UButton: { template: `<button type="button"><slot /></button>` },
  UDropdownMenu: { template: `<div><slot /></div>` },
  UTooltip: { template: `<span><slot /></span>` },
  InlineMarkdown: {
    props: ["text"],
    template: `<span>{{ text }}</span>`,
  },
  Icon: { template: `<i aria-hidden="true" />` },
  UIcon: { template: `<i aria-hidden="true" />` },
};

const summary = {
  followUp: 1,
  checklistGaps: 0,
  notAssessed: 0,
  documentedExceptions: 0,
  total: 1,
  critical: 1,
  high: 0,
};

const maturityEntry = (
  over: Partial<CompactMaturityEntry> = {}
): CompactMaturityEntry => ({
  templateRevisionId: "rev-1",
  label: "Operational Readiness Review · Revision 1",
  kind: "result",
  stage: 2,
  stageName: "Ad-hoc",
  displayPercent: 38,
  coverage: { answered: 3, unanswered: 1, total: 4 },
  provisional: true,
  advisorReviewed: false,
  ...over,
});

const makeContributor = (
  reviewId: string,
  over: Partial<PlanContributor> = {}
): PlanContributor => ({
  reviewId,
  reviewName: `Review ${reviewId}`,
  contributorType: "team",
  sourceName: "Payments Scalability",
  sourceId: "team-1",
  summary,
  topArea: "Reliability",
  maturity: [maturityEntry()],
  ...over,
});

const makeItem = (reviewId: string, questionId: string): PlanItem => ({
  identity: {
    reviewId,
    subjectId: "team-1",
    subjectType: "team",
    templateId: "tpl-1",
    templateRevisionId: "rev-1",
    pillarSlug: "reliability",
    questionId,
  },
  state: "follow-up",
  severity: "critical",
  questionText: `Question text for ${questionId}`,
  questionReference: "REL-1",
  pillarName: "Reliability",
  templateName: "ORR",
  revisionNumber: 1,
  explanation: "Answered No",
});

const makeRollup = (
  questionId: string,
  reviewIds: readonly string[]
): PlanRollup => ({
  rollupKey: `rev-1::${questionId}`,
  templateId: "tpl-1",
  templateRevisionId: "rev-1",
  revisionNumber: 1,
  questionId,
  questionReference: "REL-1",
  questionText: `Question text for ${questionId}`,
  pillarSlug: "reliability",
  pillarName: "Reliability",
  severity: "critical",
  items: reviewIds.map((reviewId) => makeItem(reviewId, questionId)),
  contributors: reviewIds.map((reviewId) => ({
    reviewId,
    reviewName: `Review ${reviewId}`,
    sourceName: "Payments Scalability",
    contributorType: "team" as const,
  })),
});

const renderRollups = (
  rollups: PlanRollup[],
  contributors: PlanContributor[] = [
    ...new Map(
      rollups
        .flatMap((rollup) => rollup.items)
        .map(
          (item) =>
            [
              item.identity.reviewId,
              makeContributor(item.identity.reviewId),
            ] as const
        )
    ).values(),
  ]
) =>
  render(ProductPlanRollups, {
    props: { rollups, contributors },
    global: { stubs },
  });

describe("ProductPlanRollups", () => {
  afterEach(cleanup);

  it("ranks repeated items by contributing-review count", () => {
    renderRollups([
      makeRollup("q-few", ["r-1", "r-2"]),
      makeRollup("q-many", ["r-1", "r-2", "r-3"]),
    ]);

    const rows = document.querySelectorAll(".plan-section-card__question");
    expect(rows[0]?.textContent).toContain("Question text for q-many");
    expect(rows[1]?.textContent).toContain("Question text for q-few");
    expect(screen.getByText("Repeated in 3 reviews")).toBeTruthy();
  });

  it("keeps an assessment link for each contributing review", () => {
    renderRollups([makeRollup("q-1", ["r-1", "r-2"])]);

    const links = screen.getAllByRole("link", { name: /Review r-1/ });
    const href = links[0]!.getAttribute("href") ?? "";
    expect(href).toContain("templateRevisionId");
    expect(href).toContain("rev-1");
    expect(href).toContain("#question-q-1");
  });

  it("gives the learning control a keyboard-accessible name", () => {
    const rollup = makeRollup("q-1", ["r-1", "r-2"]);
    rollup.items[0]!.importance = "Retries can amplify an outage.";
    renderRollups([rollup]);

    expect(
      screen.getByRole("button", { name: "Why this question matters" })
    ).toBeTruthy();
  });

  it("attaches visible per-Revision result context to each source Review", () => {
    renderRollups([makeRollup("q-1", ["r-1", "r-2"])]);

    for (const reviewId of ["r-1", "r-2"]) {
      const source = screen.getByRole("listitem", {
        name: `Review ${reviewId} source`,
      });
      const line = within(source).getByRole("link", {
        name: /Operational Readiness Review · Revision 1/,
      });
      expect(
        within(source).getByText("Operational Readiness Review · Revision 1")
      ).toBeTruthy();
      expect(line.textContent).toContain("38%");
      expect(line.textContent).toContain("Stage 2 · Ad-hoc");
      expect(line.textContent).toContain("3/4 answered");
      expect(line.textContent).toContain("Provisional");
      expect(line.getAttribute("href")).toContain("team-review-plan");
    }
  });

  it("shows only the repeated item's Revision and preserves an explicit no-result", () => {
    renderRollups(
      [makeRollup("q-1", ["r-1", "r-2"])],
      [
        makeContributor("r-1", {
          maturity: [
            maturityEntry(),
            maturityEntry({
              templateRevisionId: "rev-2",
              label: "Security Baseline · Revision 3",
              displayPercent: 82,
              stage: 5,
              stageName: "Optimizing",
              coverage: { answered: 5, unanswered: 0, total: 5 },
              provisional: false,
            }),
          ],
        }),
        makeContributor("r-2", {
          maturity: [
            maturityEntry({
              kind: "no-result",
              stage: null,
              stageName: null,
              displayPercent: null,
              coverage: { answered: 0, unanswered: 4, total: 4 },
              provisional: false,
            }),
          ],
        }),
      ]
    );

    const firstSource = screen.getByRole("listitem", {
      name: "Review r-1 source",
    });
    const secondSource = screen.getByRole("listitem", {
      name: "Review r-2 source",
    });
    expect(firstSource.textContent).toContain("38%");
    expect(firstSource.textContent).not.toContain("Security Baseline");
    expect(firstSource.textContent).not.toContain("82%");
    expect(secondSource.textContent).toContain("No applicable result");
    expect(secondSource.textContent).toContain("0/4 answered");
    expect(secondSource.textContent).not.toContain("0%");
  });

  it("does not imply a combined maturity score", () => {
    const { container } = renderRollups([makeRollup("q-1", ["r-1", "r-2"])]);

    expect(container.textContent).not.toMatch(/overall maturity/i);
    expect(container.textContent).not.toMatch(/combined score/i);
    expect(container.textContent).not.toMatch(
      /team maturity|product maturity/i
    );
  });
});
