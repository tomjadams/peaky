import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import AnswerToggle from "~/components/assessment/AnswerToggle.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}) => {
  return render(AnswerToggle, {
    props: {
      modelValue: null,
      ...props,
    },
    global: {
      stubs: {
        Icon: true,
      },
    },
  });
};

describe("AnswerToggle", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders three buttons (Yes, No, N/A)", () => {
      renderComponent();
      expect(screen.getByRole("button", { name: /yes/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /no/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /n\/a/i })).toBeDefined();
    });

    it("uses custom legend when provided", () => {
      renderComponent({ legend: "Custom answer" });
      expect(screen.getByText("Custom answer")).toBeDefined();
    });
  });

  describe("interactions", () => {
    it("emits update:modelValue with 'yes' when clicking Yes", async () => {
      const { emitted } = renderComponent({ modelValue: null });
      await fireEvent.click(screen.getByRole("button", { name: /yes/i }));
      expect(emitted()["update:modelValue"]).toEqual([["yes"]]);
    });

    it("emits update:modelValue with 'no' when clicking No", async () => {
      const { emitted } = renderComponent({ modelValue: null });
      await fireEvent.click(screen.getByRole("button", { name: /no/i }));
      expect(emitted()["update:modelValue"]).toEqual([["no"]]);
    });

    it("emits na-click when clicking N/A", async () => {
      const { emitted } = renderComponent({ modelValue: null });
      await fireEvent.click(screen.getByRole("button", { name: /n\/a/i }));
      expect(emitted()["na-click"]).toBeTruthy();
      expect(emitted()["update:modelValue"]).toBeFalsy();
    });

    it("emits null when clicking already selected Yes (toggle off)", async () => {
      const { emitted } = renderComponent({ modelValue: "yes" });
      await fireEvent.click(screen.getByRole("button", { name: /yes/i }));
      expect(emitted()["update:modelValue"]).toEqual([[null]]);
    });

    it("emits null when clicking already selected No (toggle off)", async () => {
      const { emitted } = renderComponent({ modelValue: "no" });
      await fireEvent.click(screen.getByRole("button", { name: /no/i }));
      expect(emitted()["update:modelValue"]).toEqual([[null]]);
    });
  });

  describe("accessibility", () => {
    it("has aria-pressed=true on selected Yes button", () => {
      renderComponent({ modelValue: "yes" });
      const yesButton = screen.getByRole("button", { name: /yes/i });
      expect(yesButton.getAttribute("aria-pressed")).toBe("true");
    });

    it("has aria-pressed=false on unselected buttons", () => {
      renderComponent({ modelValue: "yes" });
      const noButton = screen.getByRole("button", { name: /no/i });
      expect(noButton.getAttribute("aria-pressed")).toBe("false");
    });

    it("has a fieldset with legend for screen readers", () => {
      renderComponent({ legend: "Answer selection" });
      expect(screen.getByRole("group")).toBeDefined();
      expect(screen.getByText("Answer selection")).toBeDefined();
    });
  });
});
