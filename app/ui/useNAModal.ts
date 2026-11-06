import type {
  Question,
  NAReasonType,
  NotApplicableReason,
} from "~/models/question";

interface NAModalState {
  isOpen: boolean;
  currentQuestion: Question | null;
  currentItemId: string | null; // For checklist item N/A
  selectedReason: NAReasonType | null;
  comment: string;
}

const state = ref<NAModalState>({
  isOpen: false,
  currentQuestion: null,
  currentItemId: null,
  selectedReason: null,
  comment: "",
});

export function useNAModal() {
  const openModal = (question: Question, itemId?: string) => {
    // If itemId is provided, this is for a checklist item
    const existingReason = itemId
      ? question.itemNAReasons?.[itemId]
      : question.naReason;

    state.value = {
      isOpen: true,
      currentQuestion: question,
      currentItemId: itemId ?? null,
      selectedReason: existingReason?.reason ?? null,
      comment: existingReason?.comment ?? "",
    };
  };

  const closeModal = () => {
    // Close modal immediately for animation, but preserve currentQuestion/currentItemId
    // during the animation so handlers can still access them
    state.value.isOpen = false;
    state.value.selectedReason = null;
    state.value.comment = "";

    // Clear currentQuestion and currentItemId after animation completes (~300ms)
    setTimeout(() => {
      state.value.currentQuestion = null;
      state.value.currentItemId = null;
    }, 300);
  };

  const selectReason = (reason: NAReasonType) => {
    state.value.selectedReason = reason;
  };

  const updateComment = (comment: string) => {
    state.value.comment = comment;
  };

  const getNAReason = (): NotApplicableReason | null => {
    if (!state.value.selectedReason) return null;

    return {
      reason: state.value.selectedReason,
      comment: state.value.comment || undefined,
    };
  };

  const isConfirmEnabled = computed(() => state.value.selectedReason !== null);

  const isEditing = computed(() => {
    const question = state.value.currentQuestion;
    const itemId = state.value.currentItemId;
    if (!question) return false;

    if (itemId) {
      // Check if this item has an existing N/A reason
      return !!question.itemNAReasons?.[itemId];
    } else {
      // Check if the question has an existing N/A reason
      return !!question.naReason;
    }
  });

  return {
    isOpen: computed(() => state.value.isOpen),
    currentQuestion: computed(() => state.value.currentQuestion),
    currentItemId: computed(() => state.value.currentItemId),
    selectedReason: computed(() => state.value.selectedReason),
    comment: computed(() => state.value.comment),
    isEditing,
    isConfirmEnabled,
    openModal,
    closeModal,
    selectReason,
    updateComment,
    getNAReason,
  };
}
