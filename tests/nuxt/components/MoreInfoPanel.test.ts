import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import MoreInfoPanel from "~/components/MoreInfoPanel.vue";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";

beforeEach(() => {
  useMoreInfoPanel().closeMoreInfoPanel();
});

afterEach(cleanup);

it("presents question guidance as scannable sections", async () => {
  useMoreInfoPanel().openMoreInfoPanel({
    title: "Are service-level objectives tied to user outcomes?",
    whyImportant:
      "Objectives help teams make consistent decisions during incidents and planning.",
    leadingPractices: [
      "Define user-facing indicators",
      "Document target rationale",
      "Review objectives quarterly",
      "Connect alerts to objectives",
      "Track error-budget decisions",
    ],
    helpfulLinks: [
      { title: "SLO guide", url: "https://example.com/slo" },
      { title: "Review checklist", url: "https://example.com/review" },
    ],
    action: {
      label: "Open question in assessment",
      to: "/assessment#question-slo",
    },
  });

  render(MoreInfoPanel, {
    global: {
      stubs: {
        Icon: true,
        NuxtLink: {
          props: ["to"],
          template: `<a :href="to"><slot /></a>`,
        },
        USlideover: {
          props: ["open", "title"],
          template:
            '<aside v-if="open"><h2>{{ title }}</h2><slot name="body" /></aside>',
        },
      },
    },
  });

  expect(
    screen.getByRole("heading", { name: "Question information" })
  ).toBeTruthy();
  expect(
    screen.getByText("Are service-level objectives tied to user outcomes?")
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Why this matters" })
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Leading practices" })
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Resources" })).toBeTruthy();
  expect(screen.queryByText("2 links")).toBeNull();
  expect(
    screen.getByRole("link", { name: "Open question in assessment" })
  ).toHaveProperty("href", "http://localhost:3000/assessment#question-slo");
  expect(screen.queryByText("Connect alerts to objectives")).toBeNull();

  await fireEvent.click(
    screen.getByRole("button", { name: "Show 2 more practices" })
  );
  expect(screen.getByText("Connect alerts to objectives")).toBeTruthy();
});
