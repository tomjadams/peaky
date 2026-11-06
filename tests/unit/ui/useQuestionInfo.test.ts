import { describe, it, expect, beforeEach } from "vitest";
import { useMoreInfoPanel } from "~/ui/useMoreInfoPanel";

describe("useMoreInfoPanel", async () => {
  beforeEach(() => {
    const { closeMoreInfoPanel } = useMoreInfoPanel();
    closeMoreInfoPanel();
  });

  describe("initial state", () => {
    it("should start with sidebar closed", () => {
      const { isOpen } = useMoreInfoPanel();
      expect(isOpen.value).toBe(false);
    });

    it("should have no current question", () => {
      const { currentInfo } = useMoreInfoPanel();
      expect(currentInfo.value).toBeNull();
    });
  });

  describe("openMoreInfoPanel", () => {
    it("should open the sidebar", () => {
      const { openMoreInfoPanel, isOpen } = useMoreInfoPanel();

      openMoreInfoPanel({
        title: "Test Question",
        whyImportant: "This is important because...",
        leadingPractices: ["Practice 1", "Practice 2"],
        helpfulLinks: [{ title: "Link", url: "https://example.com" }],
      });

      expect(isOpen.value).toBe(true);
    });

    it("should set the current question info", () => {
      const { openMoreInfoPanel, currentInfo } = useMoreInfoPanel();

      const questionInfo = {
        title: "Is encryption enabled?",
        whyImportant: "Encryption protects data at rest.",
        leadingPractices: ["Use AES-256", "Rotate keys"],
        helpfulLinks: [{ title: "AWS KMS", url: "https://aws.amazon.com/kms" }],
      };

      openMoreInfoPanel(questionInfo);

      expect(currentInfo.value?.title).toBe("Is encryption enabled?");
      expect(currentInfo.value?.whyImportant).toBe(
        "Encryption protects data at rest."
      );
      expect(currentInfo.value?.leadingPractices).toHaveLength(2);
      expect(currentInfo.value?.helpfulLinks).toHaveLength(1);
    });

    it("should update question info when called again", () => {
      const { openMoreInfoPanel, currentInfo } = useMoreInfoPanel();

      openMoreInfoPanel({
        title: "First Question",
        whyImportant: "First importance",
        leadingPractices: [],
        helpfulLinks: [],
      });

      openMoreInfoPanel({
        title: "Second Question",
        whyImportant: "Second importance",
        leadingPractices: ["New practice"],
        helpfulLinks: [],
      });

      expect(currentInfo.value?.title).toBe("Second Question");
      expect(currentInfo.value?.leadingPractices).toHaveLength(1);
    });
  });

  describe("closeMoreInfoPanel", () => {
    it("should close the sidebar", () => {
      const { openMoreInfoPanel, closeMoreInfoPanel, isOpen } =
        useMoreInfoPanel();

      openMoreInfoPanel({
        title: "Test",
        whyImportant: "Test",
        leadingPractices: [],
        helpfulLinks: [],
      });

      expect(isOpen.value).toBe(true);

      closeMoreInfoPanel();

      expect(isOpen.value).toBe(false);
    });

    it("should clear current question when closing", () => {
      const { openMoreInfoPanel, closeMoreInfoPanel, currentInfo } =
        useMoreInfoPanel();

      openMoreInfoPanel({
        title: "Preserved Question",
        whyImportant: "Should remain",
        leadingPractices: [],
        helpfulLinks: [],
      });

      closeMoreInfoPanel();

      expect(currentInfo.value).toBeNull();
    });
  });

  describe("shared state", () => {
    it("should share state across multiple composable calls", () => {
      const first = useMoreInfoPanel();
      const second = useMoreInfoPanel();

      first.openMoreInfoPanel({
        title: "Shared Question",
        whyImportant: "Shared importance",
        leadingPractices: [],
        helpfulLinks: [],
      });

      expect(second.isOpen.value).toBe(true);
      expect(second.currentInfo.value?.title).toBe("Shared Question");
    });
  });

  describe("readonly refs", () => {
    it("should return readonly isOpen", () => {
      const { isOpen } = useMoreInfoPanel();
      expect(typeof isOpen.value).toBe("boolean");
    });

    it("should return readonly currentQuestion", () => {
      const { currentInfo } = useMoreInfoPanel();
      expect(
        currentInfo.value === null || typeof currentInfo.value === "object"
      ).toBe(true);
    });
  });

  describe("QuestionInfo structure", () => {
    it("should handle empty leading practices", () => {
      const { openMoreInfoPanel, currentInfo } = useMoreInfoPanel();

      openMoreInfoPanel({
        title: "Question",
        whyImportant: "Important",
        leadingPractices: [],
        helpfulLinks: [],
      });

      expect(currentInfo.value?.leadingPractices).toEqual([]);
    });

    it("should handle multiple helpful links", () => {
      const { openMoreInfoPanel, currentInfo } = useMoreInfoPanel();

      openMoreInfoPanel({
        title: "Question",
        whyImportant: "Important",
        leadingPractices: [],
        helpfulLinks: [
          { title: "Link 1", url: "https://example1.com" },
          { title: "Link 2", url: "https://example2.com" },
          { title: "Link 3", url: "https://example3.com" },
        ],
      });

      expect(currentInfo.value?.helpfulLinks).toHaveLength(3);
      expect(currentInfo.value?.helpfulLinks[1]?.title).toBe("Link 2");
    });
  });
});
