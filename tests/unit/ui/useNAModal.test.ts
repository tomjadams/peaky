import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNAModal } from "~/ui/useNAModal";

describe("useNAModal", async () => {
  beforeEach(() => {
    const { closeModal } = useNAModal();
    closeModal();
  });

  describe("initial state", () => {
    it("should start closed", () => {
      const { isOpen } = useNAModal();
      expect(isOpen.value).toBe(false);
    });

    it("should have no current question", () => {
      const { currentQuestion } = useNAModal();
      expect(currentQuestion.value).toBeNull();
    });

    it("should have no selected reason", () => {
      const { selectedReason } = useNAModal();
      expect(selectedReason.value).toBeNull();
    });

    it("should have empty comment", () => {
      const { comment } = useNAModal();
      expect(comment.value).toBe("");
    });

    it("should have confirm disabled", () => {
      const { isConfirmEnabled } = useNAModal();
      expect(isConfirmEnabled.value).toBe(false);
    });
  });

  describe("openModal", () => {
    it("should open the modal with question context", () => {
      const { openModal, isOpen, currentQuestion } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Is encryption enabled?",
        type: "yes-no",
        answer: null,
      });

      expect(isOpen.value).toBe(true);
      expect(currentQuestion.value?.id).toBe("SEC-1");
      expect(currentQuestion.value?.text).toBe("Is encryption enabled?");
    });

    it("should preserve existing NA reason if present", () => {
      const { openModal, selectedReason, comment } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test question",
        type: "yes-no",
        answer: "na",
        naReason: {
          reason: "not-in-scope",
          comment: "Existing comment",
        },
      });

      expect(selectedReason.value).toBe("not-in-scope");
      expect(comment.value).toBe("Existing comment");
    });
  });

  describe("closeModal", () => {
    it("should close the modal and reset state", async () => {
      vi.useFakeTimers();
      const {
        openModal,
        closeModal,
        isOpen,
        currentQuestion,
        selectedReason,
        comment,
      } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      closeModal();

      expect(isOpen.value).toBe(false);
      expect(selectedReason.value).toBeNull();
      expect(comment.value).toBe("");

      // currentQuestion is cleared after animation
      await vi.advanceTimersByTimeAsync(350);
      expect(currentQuestion.value).toBeNull();
      vi.useRealTimers();
    });

    it("should keep currentQuestion accessible until modal animation completes", async () => {
      vi.useFakeTimers();
      const { openModal, closeModal, isOpen, currentQuestion } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Is encryption enabled?",
        type: "yes-no",
        answer: null,
      });

      closeModal();

      // Modal should be closed immediately for animation
      expect(isOpen.value).toBe(false);
      // But currentQuestion should remain accessible during animation (~300ms)
      expect(currentQuestion.value).not.toBeNull();
      expect(currentQuestion.value?.id).toBe("SEC-1");

      // After animation duration, currentQuestion should be cleared
      await vi.advanceTimersByTimeAsync(350);
      expect(currentQuestion.value).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("selectReason", () => {
    it("should select a reason", () => {
      const { openModal, selectReason, selectedReason } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      selectReason("not-in-scope");
      expect(selectedReason.value).toBe("not-in-scope");
    });

    it("should enable confirm when reason is selected", () => {
      const { openModal, selectReason, isConfirmEnabled } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      expect(isConfirmEnabled.value).toBe(false);
      selectReason("handled-by-infrastructure");
      expect(isConfirmEnabled.value).toBe(true);
    });

    it("should allow changing reason", () => {
      const { openModal, selectReason, selectedReason } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      selectReason("not-in-scope");
      selectReason("legacy-system");
      expect(selectedReason.value).toBe("legacy-system");
    });
  });

  describe("updateComment", () => {
    it("should update the comment", () => {
      const { openModal, updateComment, comment } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      updateComment("This is my comment");
      expect(comment.value).toBe("This is my comment");
    });

    it("should truncate comment to 200 characters", () => {
      const { openModal, updateComment, comment } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      const longComment = "a".repeat(250);
      updateComment(longComment);
      // No longer truncating - validation shown in UI instead
      expect(comment.value.length).toBe(250);
    });
  });

  describe("getNAReason", () => {
    it("should return null if no reason selected", () => {
      const { openModal, getNAReason } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      expect(getNAReason()).toBeNull();
    });

    it("should return reason object with selected reason", () => {
      const { openModal, selectReason, getNAReason } = useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      selectReason("pending-deprecation");
      const result = getNAReason();

      expect(result?.reason).toBe("pending-deprecation");
      expect(result?.comment).toBeUndefined();
    });

    it("should include comment when provided", () => {
      const { openModal, selectReason, updateComment, getNAReason } =
        useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      selectReason("other");
      updateComment("Custom reason explanation");
      const result = getNAReason();

      expect(result?.reason).toBe("other");
      expect(result?.comment).toBe("Custom reason explanation");
    });

    it("should exclude empty comment", () => {
      const { openModal, selectReason, updateComment, getNAReason } =
        useNAModal();

      openModal({
        id: "SEC-1",
        pillar: "security",
        text: "Test",
        type: "yes-no",
        answer: null,
      });

      selectReason("not-in-scope");
      updateComment("");
      const result = getNAReason();

      expect(result?.comment).toBeUndefined();
    });
  });
});
