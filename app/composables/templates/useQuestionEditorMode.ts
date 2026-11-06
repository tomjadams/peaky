import { useLocalStorage } from "@vueuse/core";

export type QuestionEditorMode = "guided" | "compact";

// Shared ref across all composable calls for reactivity
let sharedViewMode: ReturnType<
  typeof useLocalStorage<QuestionEditorMode>
> | null = null;

export const useQuestionEditorMode = () => {
  if (!sharedViewMode) {
    sharedViewMode = useLocalStorage<QuestionEditorMode>(
      "templateStudio.viewMode",
      "guided"
    );
  }

  return {
    viewMode: sharedViewMode,
  };
};
