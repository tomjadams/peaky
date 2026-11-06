import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import SearchInput from "~/components/SearchInput.vue";

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = (props = {}) => {
  return render(SearchInput, {
    props: {
      modelValue: "",
      placeholder: "Search applications...",
      ...props,
    },
    global: {
      stubs: {
        Icon: true,
        UInput: {
          template:
            '<div class="u-input"><input :value="modelValue" :placeholder="placeholder" role="textbox" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot name="trailing" /></div>',
          props: ["modelValue", "placeholder", "icon", "size", "ui"],
        },
        UButton: {
          template:
            '<button :aria-label="ariaLabel" @click="$emit(\'click\')"></button>',
          props: {
            ariaLabel: String,
            variant: String,
            color: String,
            size: String,
            icon: String,
          },
        },
      },
    },
  });
};

describe("SearchInput", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders search input", () => {
      renderComponent();
      expect(screen.getByRole("textbox")).toBeDefined();
    });

    it("has placeholder text", () => {
      renderComponent();
      expect(
        screen.getByPlaceholderText("Search applications...")
      ).toBeDefined();
    });
  });

  describe("input behavior", () => {
    it("displays the model value", () => {
      renderComponent({ modelValue: "test query" });
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("test query");
    });

    it("emits update:modelValue on input", async () => {
      const { emitted } = renderComponent();
      const input = screen.getByRole("textbox");

      await fireEvent.update(input, "new search");

      expect(emitted()["update:modelValue"]).toBeTruthy();
    });
  });

  describe("clear button", () => {
    it("does not show clear button when empty", () => {
      renderComponent({ modelValue: "" });
      expect(screen.queryByLabelText("Clear search")).toBeNull();
    });

    it("shows clear button when has value", () => {
      renderComponent({ modelValue: "search text" });
      expect(screen.getByLabelText("Clear search")).toBeDefined();
    });

    it("clears input when clear button clicked", async () => {
      const { emitted } = renderComponent({ modelValue: "search text" });

      await fireEvent.click(screen.getByLabelText("Clear search"));

      const events = emitted();
      expect(events["update:modelValue"]).toBeTruthy();
      expect(events["update:modelValue"]![0]).toEqual([""]);
    });
  });

  describe("accessibility", () => {
    it("clear button has aria-label", () => {
      renderComponent({ modelValue: "text" });
      expect(screen.getByLabelText("Clear search")).toBeDefined();
    });
  });
});
