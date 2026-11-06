import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/vue";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import ProductPlanPage from "~/pages/products/[productId]/plan.vue";
import TeamPlanPage from "~/pages/teams/[teamId]/plan.vue";

const { plan } = vi.hoisted(() => {
  const summary = {
    followUp: 2,
    checklistGaps: 0,
    notAssessed: 1,
    documentedExceptions: 0,
    total: 3,
    critical: 2,
    high: 0,
  };
  const result = {
    templateRevisionId: "revision-orr-2",
    label: "Operational Readiness Review · Revision 2",
    kind: "result" as const,
    stage: 3,
    stageName: "Defined",
    displayPercent: 47,
    coverage: { answered: 7, unanswered: 2, total: 9 },
    provisional: true,
    advisorReviewed: false,
  };
  const noResult = {
    templateRevisionId: "revision-security-4",
    label: "Security Baseline · Revision 4",
    kind: "no-result" as const,
    stage: null,
    stageName: null,
    displayPercent: null,
    coverage: { answered: 0, unanswered: 4, total: 4 },
    provisional: false,
    advisorReviewed: false,
  };
  const itemDetails = {
    state: "follow-up" as const,
    severity: "critical" as const,
    questionText: "Are retries bounded?",
    questionReference: "REL-1",
    pillarName: "Reliability",
    templateName: "Operational Readiness Review",
    revisionNumber: 2,
    explanation: "Answered No",
  };
  const contributors = [
    {
      reviewId: "review-team",
      reviewName: "Team reliability review",
      contributorType: "team" as const,
      sourceName: "Payments Scalability",
      sourceId: "payments-scalability",
      summary,
      topArea: "Reliability",
      maturity: [result, noResult],
    },
    {
      reviewId: "review-app",
      reviewName: "Application readiness review",
      contributorType: "application" as const,
      sourceName: "ModificationQueueProcessor",
      sourceId: "modificationqueueprocessor",
      summary,
      topArea: "Reliability",
      maturity: [result],
    },
  ];
  const items = [
    Object.assign(
      {
        identity: {
          reviewId: "review-team",
          subjectId: "payments-scalability",
          subjectType: "team" as const,
          templateId: "template-orr",
          templateRevisionId: "revision-orr-2",
          pillarSlug: "reliability",
          questionId: "question-retries",
        },
      },
      itemDetails
    ),
    Object.assign(
      {
        identity: {
          reviewId: "review-app",
          subjectId: "modificationqueueprocessor",
          subjectType: "application" as const,
          templateId: "template-orr",
          templateRevisionId: "revision-orr-2",
          pillarSlug: "reliability",
          questionId: "question-retries",
        },
      },
      itemDetails
    ),
  ];

  return {
    plan: {
      productId: "product-1",
      contributors,
      summary,
      rollups: [
        {
          rollupKey: "revision-orr-2::question-retries",
          templateId: "template-orr",
          templateRevisionId: "revision-orr-2",
          revisionNumber: 2,
          questionId: "question-retries",
          questionReference: "REL-1",
          questionText: "Are retries bounded?",
          pillarSlug: "reliability",
          pillarName: "Reliability",
          severity: "critical" as const,
          items,
          contributors: contributors.map((contributor) => ({
            reviewId: contributor.reviewId,
            reviewName: contributor.reviewName,
            sourceName: contributor.sourceName,
            contributorType: contributor.contributorType,
          })),
        },
      ],
    },
  };
});

const planRef = { __v_isRef: true, value: plan };
const falseRef = { __v_isRef: true, value: false };
const nullRef = { __v_isRef: true, value: null };

mockNuxtImport("useRoute", () => () => ({
  params: { productId: "product-1", teamId: "payments-scalability" },
}));

vi.mock("~/composables/products/useProductPlanData", () => ({
  useProductPlanData: () => ({
    productPlan: planRef,
    loading: falseRef,
    error: nullRef,
  }),
}));

vi.mock("~/composables/teams/useTeamDetails", () => ({
  useTeamDetails: () => ({
    team: {
      __v_isRef: true,
      value: { id: "payments-scalability", name: "Payments Scalability" },
    },
  }),
}));

vi.mock("~/composables/teams/useTeamPlanData", () => ({
  useTeamPlanData: () => ({
    teamPlan: planRef,
    loading: falseRef,
    error: nullRef,
  }),
}));

const stubs = {
  NuxtLink: {
    props: ["to"],
    template: `<a :href="JSON.stringify(to)"><slot /></a>`,
  },
  Icon: { template: `<i aria-hidden="true" />` },
  UIcon: { template: `<i aria-hidden="true" />` },
  UAlert: { template: `<div><slot /></div>` },
  UButton: {
    props: ["label"],
    template: `<button type="button">{{ label }}<slot /></button>`,
  },
  UDropdownMenu: { template: `<div><slot /></div>` },
  UTooltip: { template: `<span><slot /></span>` },
  InlineMarkdown: {
    props: ["text"],
    template: `<span>{{ text }}</span>`,
  },
  StatStrip: { template: `<div><slot /></div>` },
  StatBlock: {
    props: ["label", "value"],
    template: `<div>{{ label }} {{ value }}</div>`,
  },
};

const renderPage = (component: typeof TeamPlanPage | typeof ProductPlanPage) =>
  render(component, { global: { stubs } });

const expectRoutedRevisionContext = (container: Element) => {
  expect(container.querySelector("main")).toBeNull();
  const contributorTable = container.querySelector(
    ".product-plan-contributors"
  );
  expect(contributorTable).not.toBeNull();

  const teamReviewLink = within(contributorTable as HTMLElement).getByRole(
    "link",
    { name: "Team reliability review" }
  );
  const teamRow = teamReviewLink.closest(".product-plan-contributors__row");
  expect(teamRow).not.toBeNull();

  const resultLine = within(teamRow as HTMLElement).getByRole("link", {
    name: /Operational Readiness Review · Revision 2/,
  });
  expect(resultLine.textContent).toContain("47%");
  expect(resultLine.textContent).toContain("Stage 3 · Defined");
  expect(resultLine.textContent).toContain("7/9 answered");
  expect(resultLine.textContent).toContain("Provisional");
  expect(resultLine.getAttribute("href")).toContain("team-review-plan");

  const noResultLine = within(teamRow as HTMLElement).getByRole("link", {
    name: /Security Baseline · Revision 4/,
  });
  expect(noResultLine.textContent).toContain("No applicable result");
  expect(noResultLine.textContent).not.toContain("0%");

  const rollups = screen.getByTestId("product-plan-rollups");
  for (const reviewName of [
    "Team reliability review",
    "Application readiness review",
  ]) {
    const source = within(rollups).getByRole("listitem", {
      name: `${reviewName} source`,
    });
    expect(
      within(source).getByText("Operational Readiness Review · Revision 2")
    ).toBeTruthy();
    expect(source.textContent).toContain("Stage 3 · Defined");
    expect(source.textContent).toContain("7/9 answered");
    expect(source.textContent).not.toContain("Security Baseline");
  }

  expect(container.textContent).not.toMatch(/combined score|overall score/i);
  expect(container.textContent).not.toMatch(/team maturity|product maturity/i);
};

describe("routed team and product Follow-ups Revision context", () => {
  afterEach(cleanup);

  it("renders projected context on the team Follow-ups route", () => {
    const { container } = renderPage(TeamPlanPage);

    expect(
      screen.getAllByRole("heading", { name: "Follow-ups" }).length
    ).toBeGreaterThan(0);
    expectRoutedRevisionContext(container);
  });

  it("renders projected context on the product Follow-ups route", () => {
    const { container } = renderPage(ProductPlanPage);

    expect(
      screen.getAllByRole("heading", { name: "Follow-ups" }).length
    ).toBeGreaterThan(0);
    expectRoutedRevisionContext(container);
  });
});
