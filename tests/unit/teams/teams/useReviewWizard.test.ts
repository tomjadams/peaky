import { describe, expect, it } from "vitest";
import { useReviewWizard } from "~/composables/reviews/useReviewWizard";

describe("useReviewWizard", () => {
  it("starts at step 1 with empty state", () => {
    const wizard = useReviewWizard();

    expect(wizard.currentStep.value).toBe(1);
    expect(wizard.selectedTemplateIds.value).toEqual([]);
    expect(wizard.selectedApplicationIds.value).toEqual([]);
    expect(wizard.reviewName.value).toBe("");
  });

  it("validates that at least one template is selected", () => {
    const wizard = useReviewWizard();

    const moved = wizard.nextStep();

    expect(moved).toBe(false);
    expect(wizard.validationError.value).toContain(
      "Select at least one Revision"
    );
  });

  it("moves between steps and preserves state", () => {
    const wizard = useReviewWizard();

    wizard.toggleTemplate("revision-001");
    expect(wizard.nextStep()).toBe(true);
    expect(wizard.currentStep.value).toBe(2);

    wizard.toggleApplication("app-001");
    expect(wizard.nextStep()).toBe(true);
    expect(wizard.currentStep.value).toBe(3);

    wizard.previousStep();
    expect(wizard.currentStep.value).toBe(2);
    expect(wizard.selectedApplicationIds.value).toEqual(["app-001"]);
  });

  it("limits template selection to 3", () => {
    const wizard = useReviewWizard();

    wizard.toggleTemplate("revision-001");
    wizard.toggleTemplate("revision-002");
    wizard.toggleTemplate("revision-003");
    wizard.toggleTemplate("revision-004");

    expect(wizard.selectedTemplateIds.value).toHaveLength(3);
    expect(wizard.validationError.value).toContain("Maximum");
    // Even with message shown, 3 templates is valid so can proceed
    expect(wizard.canGoNext.value).toBe(true);
  });

  it("clears error when deselecting any template", () => {
    const wizard = useReviewWizard();

    // Select 3 templates (max)
    wizard.toggleTemplate("revision-001");
    wizard.toggleTemplate("revision-002");
    wizard.toggleTemplate("revision-003");

    // Try to add 4th - should show info message
    wizard.toggleTemplate("revision-004");
    expect(wizard.validationError.value).toContain("Maximum");

    // Deselect one - should clear message
    wizard.toggleTemplate("revision-001");
    expect(wizard.selectedTemplateIds.value).toHaveLength(2);
    expect(wizard.validationError.value).toBe("");
    expect(wizard.canGoNext.value).toBe(true);
  });

  it("can proceed with 3 templates even after hitting limit", () => {
    const wizard = useReviewWizard();

    // Select 3 templates
    wizard.toggleTemplate("revision-001");
    wizard.toggleTemplate("revision-002");
    wizard.toggleTemplate("revision-003");

    // Try to add 4th - shows info message but doesn't block
    wizard.toggleTemplate("revision-004");
    expect(wizard.validationError.value).toContain("Maximum");
    expect(wizard.canGoNext.value).toBe(true); // 3 is valid, can proceed

    // Proceed to next step despite info message
    expect(wizard.nextStep()).toBe(true);
    expect(wizard.currentStep.value).toBe(2);
  });

  it("requires review name before leaving step 3", () => {
    const wizard = useReviewWizard();

    wizard.toggleTemplate("revision-001");
    wizard.nextStep();
    wizard.nextStep();

    expect(wizard.currentStep.value).toBe(3);
    expect(wizard.nextStep()).toBe(false);
    expect(wizard.validationError.value).toBe("Review name is required.");
  });

  it("allows completing step 3 once review name is provided", () => {
    const wizard = useReviewWizard();
    wizard.toggleTemplate("revision-001");
    wizard.toggleTemplate("revision-003");
    wizard.toggleApplication("app-001");
    wizard.nextStep();
    wizard.nextStep();
    wizard.reviewName.value = "Q1 Readiness";

    expect(wizard.nextStep()).toBe(true);
    expect(wizard.validationError.value).toBe("");
  });
});
