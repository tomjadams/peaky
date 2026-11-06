import type { Question, QuestionAnswer, NotApplicableReason } from "~/models";
import { isChecklistWithNAAnswer } from "~/models/question";
import { normalizeQuestionAnswer } from "~/services/assessment/answerSemantics";
import { isQuestionComplete } from "~/services/review/questionCompletion";
import { useAssessmentFetch } from "./useAssessmentFetch";
import { useAssessmentMutate } from "./useAssessmentMutate";
import { useAssessmentAnswers } from "./useAssessmentAnswers";
import { useAssessmentProgress } from "./useAssessmentProgress";
import { useAssessmentNavigation } from "./useAssessmentNavigation";
import { useTemplateSelector } from "~/ui/useTemplateSelector";

/**
 * Main orchestrator for assessment functionality.
 * Composes all assessment modules into a unified API for assessment.vue and survey.vue pages.
 */
export function useAssessment(reviewId: MaybeRef<string>) {
  const { review, questionsData, pending, error, refresh } =
    useAssessmentFetch(reviewId);

  const { answers, setAnswer, clearAnswer, getAnswer, hasAnswer } =
    useAssessmentAnswers();

  const progress = useAssessmentProgress();
  const {
    activeTemplateRevisionId,
    activePillarSlug,
    setActiveTemplateRevision,
    setActivePillar,
  } = useTemplateSelector();
  const activeTemplate = computed(() => {
    const templates = review.value?.templates ?? [];
    return (
      templates.find(
        (template) =>
          template.templateRevisionId === activeTemplateRevisionId.value
      ) ?? templates[0]
    );
  });
  watch(
    () => review.value?.templates,
    (templates) => {
      if (!templates?.length) return;
      if (
        !templates.some(
          (template) =>
            template.templateRevisionId === activeTemplateRevisionId.value
        )
      ) {
        setActiveTemplateRevision(templates[0]!.templateRevisionId);
        setActivePillar(templates[0]!.pillars[0]?.slug ?? null);
      }
    },
    { immediate: true }
  );

  watch(activeTemplate, (template) => {
    if (!template) return;
    if (
      !template.pillars.some((pillar) => pillar.slug === activePillarSlug.value)
    )
      setActivePillar(template.pillars[0]?.slug ?? null);
  });

  const pillars = computed(() =>
    (activeTemplate.value?.pillars ?? []).map((pillar) =>
      Object.assign({}, pillar, {
        templateRevisionId: activeTemplate.value!.templateRevisionId,
        key: `${activeTemplate.value!.templateRevisionId}::${pillar.slug}`,
      })
    )
  );
  const navigation = useAssessmentNavigation(pillars);

  const { saving, saveAnswer, saveProgress, createMilestone } =
    useAssessmentMutate(reviewId, activeTemplateRevisionId);

  // N/A reason tracking
  const naReasons = ref<Record<string, NotApplicableReason>>({});
  const itemNAReasons = ref<
    Record<string, Record<string, NotApplicableReason>>
  >({}); // questionId -> itemId -> reason

  const setNAReason = (questionId: string, reason: NotApplicableReason) => {
    naReasons.value = { ...naReasons.value, [questionId]: reason };
  };

  const clearNAReason = (questionId: string) => {
    const { [questionId]: _, ...rest } = naReasons.value;
    naReasons.value = rest;
  };

  const setItemNAReason = (
    questionId: string,
    itemId: string,
    reason: NotApplicableReason
  ) => {
    const questionReasons = itemNAReasons.value[questionId] ?? {};
    itemNAReasons.value = {
      ...itemNAReasons.value,
      [questionId]: { ...questionReasons, [itemId]: reason },
    };
  };

  const clearItemNAReason = (questionId: string, itemId: string) => {
    const questionReasons = itemNAReasons.value[questionId];
    if (!questionReasons) return;

    const { [itemId]: _, ...rest } = questionReasons;
    if (Object.keys(rest).length === 0) {
      const { [questionId]: __, ...restQuestions } = itemNAReasons.value;
      itemNAReasons.value = restQuestions;
    } else {
      itemNAReasons.value = {
        ...itemNAReasons.value,
        [questionId]: rest,
      };
    }
  };

  const clearQuestionItemNAReasons = (questionId: string) => {
    if (!(questionId in itemNAReasons.value)) return;
    const { [questionId]: _, ...rest } = itemNAReasons.value;
    itemNAReasons.value = rest;
  };

  // Questions merged with local answer state
  const questions = computed<Question[]>(() => {
    if (!questionsData.value?.questions) return [];
    return questionsData.value.questions.map((question) => {
      const localAnswer = getAnswer(question.id);
      const answer = localAnswer !== undefined ? localAnswer : question.answer;
      return {
        ...question,
        answer: normalizeQuestionAnswer(question, answer),
        naReason: naReasons.value[question.id] ?? question.naReason,
        itemNAReasons:
          itemNAReasons.value[question.id] ?? question.itemNAReasons,
      };
    });
  });

  const getQuestionsForPillar = (pillarSlug: string) => {
    return questions.value.filter(
      (question) =>
        question.templateRevisionId ===
          activeTemplate.value?.templateRevisionId &&
        question.pillar === pillarSlug
    );
  };

  const sourceQuestion = (questionId: string) =>
    questionsData.value?.questions.find(
      (question) => question.id === questionId
    );

  const currentAnswer = (questionId: string): QuestionAnswer => {
    const localAnswer = getAnswer(questionId);
    if (localAnswer !== undefined) return localAnswer;
    return sourceQuestion(questionId)?.answer ?? null;
  };

  // Answer handler that also manages N/A state.
  // Pass naReason when the answer is "na" so the reason is stored atomically.
  const handleAnswer = (
    questionId: string,
    value: QuestionAnswer | null,
    naReason?: NotApplicableReason
  ) => {
    const question = sourceQuestion(questionId);
    const normalized = question
      ? normalizeQuestionAnswer(question, value)
      : value;
    if (normalized === null) {
      clearAnswer(questionId);
    } else {
      setAnswer(questionId, normalized);
    }
    if (!isChecklistWithNAAnswer(normalized)) {
      clearQuestionItemNAReasons(questionId);
    }
    if (naReason) {
      setNAReason(questionId, naReason);
    } else if (normalized !== "na" && naReasons.value[questionId]) {
      clearNAReason(questionId);
    }
  };

  const checklistAnswer = (questionId: string) => {
    const question = sourceQuestion(questionId);
    if (question && question.type !== "checklist") return null;
    return normalizeQuestionAnswer(
      {
        type: "checklist",
        checklistItems: question?.checklistItems,
      },
      currentAnswer(questionId)
    );
  };

  const handleItemNAConfirm = (
    questionId: string,
    itemId: string,
    reason: NotApplicableReason
  ) => {
    const question = sourceQuestion(questionId);
    if (question && question.type !== "checklist") return;
    if (
      question?.checklistItems &&
      !question.checklistItems.some((item) => item.id === itemId)
    ) {
      return;
    }
    const answer = checklistAnswer(questionId);
    const checked = isChecklistWithNAAnswer(answer) ? answer.checked : [];
    const na = isChecklistWithNAAnswer(answer) ? answer.na : [];

    setItemNAReason(questionId, itemId, reason);
    setAnswer(questionId, {
      checked: checked.filter((id) => id !== itemId),
      na: na.includes(itemId) ? na : [...na, itemId],
    });
  };

  const handleItemNAClear = (questionId: string, itemId: string) => {
    clearItemNAReason(questionId, itemId);
    const answer = checklistAnswer(questionId);
    if (!isChecklistWithNAAnswer(answer)) return;

    setAnswer(questionId, {
      checked: answer.checked,
      na: answer.na.filter((id) => id !== itemId),
    });
  };

  // Progress computations
  const overallProgress = computed(() => {
    const total = questions.value.length;
    if (total === 0) return 0;
    const answered = questions.value.filter((q) =>
      isQuestionComplete(q, q.answer)
    ).length;
    return Math.round((answered / total) * 100);
  });

  const answeredCount = computed(() => {
    return questions.value.filter((q) => isQuestionComplete(q, q.answer))
      .length;
  });

  const totalQuestionCount = computed(() => {
    return progress.getTotalQuestions(
      (review.value?.templates ?? []).flatMap((template) => template.pillars)
    );
  });

  return {
    // Data
    review,
    activeTemplate,
    activeTemplateRevisionId,
    questions,
    questionsData,
    pending,
    error,
    refresh,

    // Answers
    answers,
    setAnswer,
    clearAnswer,
    getAnswer,
    hasAnswer,
    handleAnswer,
    handleItemNAConfirm,
    handleItemNAClear,
    naReasons: readonly(naReasons),
    itemNAReasons: readonly(itemNAReasons),

    // Questions
    getQuestionsForPillar,

    // Progress
    overallProgress,
    answeredCount,
    totalQuestionCount,
    isComplete: () => progress.isComplete(pillars.value),

    // Navigation
    currentPillar: navigation.currentPillar,
    currentPillarIndex: navigation.currentPillarIndex,
    nextPillar: navigation.nextPillar,
    prevPillar: navigation.prevPillar,
    goToPillar: navigation.goToPillar,
    goToPillarBySlug: navigation.goToPillarBySlug,
    pillars,

    // Mutations
    saving,
    saveAnswer,
    saveProgress,
    createMilestone,
  };
}
