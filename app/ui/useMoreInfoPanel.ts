export interface QuestionInfo {
  title: string;
  whyImportant: string;
  leadingPractices: string[];
  helpfulLinks: Array<{
    title: string;
    url: string;
  }>;
  action?: {
    label: string;
    to: string;
  };
}

export const useMoreInfoPanel = () => {
  const isOpen = useState<boolean>("moreInfoPanelOpen", () => false);
  const currentInfo = useState<QuestionInfo | null>(
    "currentMoreInfo",
    () => null
  );

  const openMoreInfoPanel = (info: QuestionInfo) => {
    currentInfo.value = info;
    isOpen.value = true;
  };

  const closeMoreInfoPanel = () => {
    isOpen.value = false;
    currentInfo.value = null;
  };

  return {
    isOpen: readonly(isOpen),
    currentInfo: readonly(currentInfo),
    openMoreInfoPanel,
    closeMoreInfoPanel,
  };
};
