import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/vue";
import PillarSection from "~/components/assessment/PillarSection.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}, slots = {}) => {
  return render(PillarSection, {
    props: {
      pillarName: "Reliability",
      pillarSlug: "reliability",
      answeredCount: 5,
      totalCount: 10,
      ...props,
    },
    slots: {
      default: "<div>Question content</div>",
      ...slots,
    },
  });
};

describe("PillarSection", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("displays the pillar name as heading", () => {
      renderComponent({ pillarName: "Security" });
      expect(screen.getByRole("heading", { name: "Security" })).toBeDefined();
    });

    it("displays one answered/total summary", () => {
      renderComponent({ answeredCount: 3, totalCount: 8 });
      expect(screen.getByText("3 of 8 answered")).toBeDefined();
      expect(screen.queryByText("50%")).toBeNull();
    });

    it("shows empty state when totalCount is 0", () => {
      renderComponent({ totalCount: 0 });
      expect(screen.getByText("No questions in this pillar")).toBeDefined();
    });

    it("keeps the production card styling by default", () => {
      const { container } = renderComponent();
      const body = container.querySelector(".pillar-section__card");

      expect(body?.className).toContain("rounded-lg");
      expect(body?.className).toContain("border");
      expect(screen.getByText("Template pillar")).toBeDefined();
    });

    it("renders a flat preview variant with one index tick and no kicker", () => {
      const { container } = renderComponent({ variant: "flat" });
      const body = container.querySelector(".pillar-section__card");

      expect(body?.className).not.toMatch(/\brounded/);
      expect(body?.className).not.toMatch(/\bborder\b/);
      expect(body?.className).not.toMatch(/\bp-6\b/);
      expect(screen.queryByText("Template pillar")).toBeNull();
      expect(
        container.querySelectorAll("[data-pillar-index-tick]")
      ).toHaveLength(1);
    });
  });

  describe("accessibility", () => {
    it("has section element with proper id", () => {
      const { container } = renderComponent({ pillarSlug: "security" });
      const section = container.querySelector("section");
      expect(section?.getAttribute("id")).toBe("pillar-security");
    });

    it("has aria-label on section", () => {
      const { container } = renderComponent({ pillarName: "Reliability" });
      const section = container.querySelector("section");
      expect(section?.getAttribute("aria-label")).toBe("Reliability Questions");
    });
  });
});
