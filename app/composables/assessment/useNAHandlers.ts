import type {
  NotApplicableReason,
  Question,
  QuestionAnswer,
} from "~/models/question";
import { useNAModal } from "~/ui/useNAModal";

export function useNAHandlers(handlers: {
  handleAnswer: (
    questionId: string,
    value: QuestionAnswer | null,
    naReason?: NotApplicableReason
  ) => void;
  handleItemNAConfirm: (
    questionId: string,
    itemId: string,
    reason: NotApplicableReason
  ) => void;
  handleItemNAClear: (questionId: string, itemId: string) => void;
}) {
  const { openModal } = useNAModal();

  const handleAnswerChange = (
    question: Question,
    value: QuestionAnswer | null
  ) => {
    handlers.handleAnswer(question.id, value);
  };

  const handleNAClick = (question: Question) => {
    openModal(question);
  };

  const handleItemNAClick = (question: Question, itemId: string) => {
    openModal(question, itemId);
  };

  const onNAConfirm = (reason: NotApplicableReason) => {
    const { currentQuestion, currentItemId } = useNAModal();
    const question = currentQuestion.value;
    const itemId = currentItemId.value;

    if (question) {
      if (itemId) {
        handlers.handleItemNAConfirm(question.id, itemId, reason);
      } else {
        // Same path as Yes/No: handleAnswer with "na" + reason so tracking
        // and draft() fire automatically through handleAnswerWithTracking.
        handlers.handleAnswer(question.id, "na", reason);
      }
    }
  };

  const onNAClear = () => {
    const { currentQuestion, currentItemId } = useNAModal();
    const question = currentQuestion.value;
    const itemId = currentItemId.value;

    if (question) {
      if (itemId) {
        handlers.handleItemNAClear(question.id, itemId);
      } else {
        handlers.handleAnswer(question.id, null);
      }
    }
  };

  return {
    handleAnswerChange,
    handleNAClick,
    handleItemNAClick,
    onNAConfirm,
    onNAClear,
  };
}
