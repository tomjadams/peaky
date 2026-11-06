export type ReviewWizardStep = 1 | 2 | 3;

export const MAX_REVIEW_REVISIONS = 3;

export const useReviewWizard = () => {
  const currentStep = ref<ReviewWizardStep>(1);
  const selectedTemplateIds = ref<string[]>([]);
  const selectedApplicationIds = ref<string[]>([]);
  const reviewName = ref("");
  const templateSearch = ref("");
  const applicationSearch = ref("");
  const validationError = ref("");
  const submitting = ref(false);

  const canGoNext = computed(() => {
    if (currentStep.value === 1) {
      return (
        selectedTemplateIds.value.length >= 1 &&
        selectedTemplateIds.value.length <= MAX_REVIEW_REVISIONS
      );
    }

    if (currentStep.value === 3) {
      return reviewName.value.trim().length > 0;
    }

    return true;
  });

  const canGoBack = computed(() => currentStep.value > 1);

  const clearValidationError = () => {
    validationError.value = "";
  };

  const toggleTemplate = (templateId: string) => {
    clearValidationError();

    if (selectedTemplateIds.value.includes(templateId)) {
      selectedTemplateIds.value = selectedTemplateIds.value.filter(
        (id) => id !== templateId
      );
      return;
    }

    if (selectedTemplateIds.value.length >= MAX_REVIEW_REVISIONS) {
      validationError.value = `Maximum ${MAX_REVIEW_REVISIONS} Revisions allowed.`;
      return;
    }

    selectedTemplateIds.value = [...selectedTemplateIds.value, templateId];
  };

  const toggleApplication = (applicationId: string) => {
    clearValidationError();

    if (selectedApplicationIds.value.includes(applicationId)) {
      selectedApplicationIds.value = selectedApplicationIds.value.filter(
        (id) => id !== applicationId
      );
      return;
    }

    selectedApplicationIds.value = [
      ...selectedApplicationIds.value,
      applicationId,
    ];
  };

  const nextStep = () => {
    if (currentStep.value === 1 && !canGoNext.value) {
      if (validationError.value.length === 0) {
        validationError.value = "Select at least one Revision.";
      }
      return false;
    }

    clearValidationError();

    if (currentStep.value === 1 && selectedTemplateIds.value.length === 0) {
      validationError.value = "Select at least one template.";
      return false;
    }

    if (currentStep.value === 3 && reviewName.value.trim().length === 0) {
      validationError.value = "Review name is required.";
      return false;
    }

    if (currentStep.value < 3) {
      currentStep.value = (currentStep.value + 1) as ReviewWizardStep;
    }

    return true;
  };

  const previousStep = () => {
    clearValidationError();
    if (currentStep.value > 1) {
      currentStep.value = (currentStep.value - 1) as ReviewWizardStep;
    }
  };

  const goToStep = (step: ReviewWizardStep) => {
    clearValidationError();
    currentStep.value = step;
  };

  const resetWizard = () => {
    currentStep.value = 1;
    selectedTemplateIds.value = [];
    selectedApplicationIds.value = [];
    reviewName.value = "";
    templateSearch.value = "";
    applicationSearch.value = "";
    validationError.value = "";
  };

  return {
    currentStep,
    selectedTemplateIds,
    selectedApplicationIds,
    reviewName,
    templateSearch,
    applicationSearch,
    validationError,
    submitting,
    canGoNext,
    canGoBack,
    toggleTemplate,
    toggleApplication,
    clearValidationError,
    nextStep,
    previousStep,
    goToStep,
    resetWizard,
  };
};
