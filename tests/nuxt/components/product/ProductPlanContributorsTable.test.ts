import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/vue";
import ProductPlanContributorsTable from "~/components/product/ProductPlanContributorsTable.vue";
import type { PlanContributor } from "~/models/improvement-plan";
import type { CompactMaturityEntry } from "~/services/maturity/compactContext";

const stubs = {
  NuxtLink: {
    props: ["to"],
    template: `<a :href="JSON.stringify(to)"><slot /></a>`,
  },
  Icon: { template: `<i aria-hidden="true" />` },
  UIcon: { template: `<i aria-hidden="true" />` },
};

const summary = {
  followUp: 2,
  checklistGaps: 1,
  notAssessed: 3,
  documentedExceptions: 0,
  total: 6,
  critical: 1,
  high: 1,
};

const maturityEntry = (
  over: Partial<CompactMaturityEntry> = {}
): CompactMaturityEntry => ({
  templateRevisionId: "orr-revision-2",
  label: "Operational Readiness Review · Revision 2",
  kind: "result",
  stage: 3,
  stageName: "Defined",
  displayPercent: 47,
  coverage: { answered: 7, unanswered: 2, total: 9 },
  provisional: true,
  advisorReviewed: false,
  ...over,
});

const contributor = (over: Partial<PlanContributor> = {}): PlanContributor => ({
  reviewId: "r-1",
  reviewName: "2026 Operational Readiness Review",
  contributorType: "team",
  sourceName: "Payments Scalability",
  sourceId: "payments-scalability",
  summary,
  topArea: null,
  maturity: [maturityEntry()],
  ...over,
});

const renderTable = (contributors: PlanContributor[]) =>
  render(ProductPlanContributorsTable, {
    props: { contributors, productId: "product-1" },
    global: { stubs },
  });

describe("ProductPlanContributorsTable", () => {
  afterEach(cleanup);

  it("links each contributor to its review plan by type", () => {
    renderTable([
      contributor(),
      contributor({
        reviewId: "r-2",
        reviewName: "Application drill",
        contributorType: "application",
        sourceId: "app-9",
      }),
      contributor({
        reviewId: "r-3",
        reviewName: "Product review",
        contributorType: "product-review",
        sourceId: "product-1",
      }),
    ]);

    expect(
      screen
        .getByRole("link", { name: "2026 Operational Readiness Review" })
        .getAttribute("href")
    ).toContain("team-review-plan");
    expect(
      screen
        .getByRole("link", { name: "Application drill" })
        .getAttribute("href")
    ).toContain("app-review-plan");
    expect(
      screen.getByRole("link", { name: "Product review" }).getAttribute("href")
    ).toContain("product-review-plan");
  });

  it("shows answer-derived attention counts", () => {
    renderTable([contributor()]);

    expect(screen.getByText("Contributor")).toBeTruthy();
    expect(screen.getAllByText("Not assessed")).not.toHaveLength(0);
    expect(screen.getAllByText("3")).toHaveLength(2);
  });

  it("shows each Review's visible Revision, result, coverage, and return link", () => {
    renderTable([contributor()]);

    const line = screen.getByRole("link", {
      name: /Operational Readiness Review · Revision 2/,
    });
    expect(
      screen.getByText("Operational Readiness Review · Revision 2")
    ).toBeTruthy();
    expect(line.textContent).toContain("47%");
    expect(line.textContent).toContain("Stage 3 · Defined");
    expect(line.textContent).toContain("7/9 answered");
    expect(line.textContent).toContain("Provisional");
    expect(line.getAttribute("href")).toContain("team-review-plan");
  });

  it("keeps multiple pinned Revisions isolated and shows an explicit no-result", () => {
    renderTable([
      contributor({
        maturity: [
          maturityEntry(),
          maturityEntry({
            templateRevisionId: "security-revision-4",
            label: "Security Baseline · Revision 4",
            kind: "no-result",
            stage: null,
            stageName: null,
            displayPercent: null,
            coverage: { answered: 0, unanswered: 4, total: 4 },
            provisional: false,
          }),
        ],
      }),
    ]);

    const result = screen.getByRole("link", {
      name: /Operational Readiness Review · Revision 2/,
    });
    const noResult = screen.getByRole("link", {
      name: /Security Baseline · Revision 4/,
    });
    expect(result.textContent).toContain("47%");
    expect(result.textContent).not.toContain("Security Baseline");
    expect(noResult.textContent).toContain("No applicable result");
    expect(noResult.textContent).toContain("0/4 answered");
    expect(noResult.textContent).not.toContain("0%");
  });

  it("does not imply a combined maturity score", () => {
    const { container } = renderTable([contributor()]);

    expect(container.textContent).not.toMatch(/overall maturity/i);
    expect(container.textContent).not.toMatch(/combined score/i);
    expect(container.textContent).not.toMatch(
      /team maturity|product maturity/i
    );
  });
});
