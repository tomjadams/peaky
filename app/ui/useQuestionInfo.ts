import { useMoreInfoPanel, type QuestionInfo } from "~/ui/useMoreInfoPanel";

export type { QuestionInfo };

export const useQuestionInfo = () => {
  const { isOpen, currentInfo, openMoreInfoPanel, closeMoreInfoPanel } =
    useMoreInfoPanel();

  return {
    isOpen,
    currentQuestion: currentInfo,
    openQuestionInfo: openMoreInfoPanel,
    closeQuestionInfo: closeMoreInfoPanel,
  };
};
