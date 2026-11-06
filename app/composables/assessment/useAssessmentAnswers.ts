import type { QuestionAnswer } from "~/models/question";

/** Immutable answer state machine for assessment questions. Pure state transitions, no API calls. */
export function useAssessmentAnswers() {
  const answers = ref<Record<string, QuestionAnswer>>({});

  const setAnswer = (questionId: string, answer: QuestionAnswer) => {
    answers.value = {
      ...answers.value,
      [questionId]: answer,
    };
  };

  const clearAnswer = (questionId: string) => {
    // Store null explicitly rather than deleting the key.
    // Deleting causes getAnswer to return undefined, which falls back to the
    // stale q.answer from the last DB fetch — making the UI show the old answer.
    answers.value = { ...answers.value, [questionId]: null };
  };

  const getAnswer = (questionId: string): QuestionAnswer | null | undefined => {
    return answers.value[questionId];
  };

  const hasAnswer = (questionId: string): boolean => {
    return questionId in answers.value && answers.value[questionId] != null;
  };

  return {
    answers: readonly(answers),
    setAnswer,
    clearAnswer,
    getAnswer,
    hasAnswer,
  };
}
