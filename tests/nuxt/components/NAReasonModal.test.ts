import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/vue";
import { ref, computed } from "vue";
import NAReasonModal from "~/components/NAReasonModal.vue";

// Mock useNAModal composable
const mockIsOpen = ref(false);
const mockCurrentQuestion = ref<{ text: string } | null>(null);
const mockSelectedReason = ref<string | null>(null);
const mockComment = ref("");
const mockIsConfirmEnabled = computed(() => mockSelectedReason.value !== null);

const mockCloseModal = vi.fn(() => {
  mockIsOpen.value = false;
});
const mockSelectReason = vi.fn((reason: string) => {
  mockSelectedReason.value = reason;
});
const mockUpdateComment = vi.fn((text: string) => {
  mockComment.value = text.slice(0, 200);
});
const mockGetNAReason = vi.fn(() => {
  if (!mockSelectedReason.value) return null;
  return {
    reason: mockSelectedReason.value,
    comment: mockComment.value || undefined,
  };
});

vi.mock("~/ui/useNAModal", () => ({
  useNAModal: () => ({
    isOpen: mockIsOpen,
    currentQuestion: mockCurrentQuestion,
    selectedReason: mockSelectedReason,
    comment: mockComment,
    isConfirmEnabled: mockIsConfirmEnabled,
    closeModal: mockCloseModal,
    selectReason: mockSelectReason,
    updateComment: mockUpdateComment,
    getNAReason: mockGetNAReason,
  }),
}));

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = () => {
  return render(NAReasonModal, {
    global: {
      stubs: {
        Icon: true,
        Teleport: true,
        UModal: {
          template:
            '<div v-if="open" role="dialog" aria-modal="true"><slot name="content" /></div>',
          props: ["open", "ui"],
        },
      },
    },
  });
};

describe("NAReasonModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockIsOpen.value = false;
    mockCurrentQuestion.value = null;
    mockSelectedReason.value = null;
    mockComment.value = "";
  });

  describe("visibility", () => {
    it("does not render when closed", () => {
      mockIsOpen.value = false;
      renderComponent();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renders when open", () => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
      renderComponent();
      expect(screen.getByRole("dialog")).toBeDefined();
    });
  });

  describe("content display", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Is encryption enabled?" };
    });

    it("displays modal title", () => {
      renderComponent();
      expect(
        screen.getByText("Why is this question not applicable?")
      ).toBeDefined();
    });

    it.skip("displays question text", () => {
      // Skipped: Question text is now rendered inside RichTextEditor (TipTap)
      // which requires full DOM environment to render properly in tests
      // The functionality is covered by e2e tests
      renderComponent();
    });

    it("displays all reason options", () => {
      renderComponent();
      expect(screen.getByText("Not in scope")).toBeDefined();
      expect(screen.getByText("Handled by infrastructure")).toBeDefined();
      expect(screen.getByText("Legacy system")).toBeDefined();
      expect(screen.getByText("Pending deprecation")).toBeDefined();
      expect(screen.getByText("Other")).toBeDefined();
    });
  });

  describe("reason selection", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
    });

    it("calls selectReason when reason button clicked", async () => {
      renderComponent();
      await fireEvent.click(screen.getByText("Not in scope"));
      expect(mockSelectReason).toHaveBeenCalledWith("not-in-scope");
    });
  });

  describe("comment input", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
    });

    it("displays character counter with limit", () => {
      renderComponent();
      // Test counter shows current count and limit, not exact format
      expect(screen.getByText(/0.*200|200/)).toBeDefined();
    });

    it("calls updateComment when typing", async () => {
      renderComponent();
      const textarea = screen.getByPlaceholderText(/Details will be saved/);
      await fireEvent.update(textarea, "My comment");
      expect(mockUpdateComment).toHaveBeenCalledWith("My comment");
    });
  });

  describe("confirm button", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
    });

    it("is disabled when no reason selected", () => {
      mockSelectedReason.value = null;
      renderComponent();
      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton.hasAttribute("disabled")).toBe(true);
    });

    it("is enabled when reason selected", () => {
      mockSelectedReason.value = "not-in-scope";
      renderComponent();
      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton.hasAttribute("disabled")).toBe(false);
    });

    it("emits confirm and closes modal when clicked", async () => {
      mockSelectedReason.value = "not-in-scope";
      mockGetNAReason.mockReturnValue({
        reason: "not-in-scope",
        comment: undefined,
      });

      const { emitted } = renderComponent();
      await fireEvent.click(screen.getByText("Confirm"));

      expect(emitted()["confirm"]).toBeTruthy();
      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  describe("cancel button", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
    });

    it("closes modal when cancel clicked", async () => {
      renderComponent();
      await fireEvent.click(screen.getByText("Cancel"));
      expect(mockCloseModal).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    beforeEach(() => {
      mockIsOpen.value = true;
      mockCurrentQuestion.value = { text: "Test question?" };
    });

    it("has dialog role with aria-modal", () => {
      renderComponent();
      const dialog = screen.getByRole("dialog");
      expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("has accessible heading", () => {
      renderComponent();
      expect(
        screen.getByText("Why is this question not applicable?")
      ).toBeDefined();
    });
  });
});
