import type { TemplateQuestion } from "~/models";
import { createUuidV7 } from "~/local-db";
import {
  activePillarSlug,
  expandedQuestionId,
  withTemplateMutation,
  withPillarMutation,
  withQuestionMutation,
  createTemplateQuestion,
} from "./useTemplateStudio-state";

export function addPillar(name: string, slug: string, description?: string) {
  withTemplateMutation((draft) => {
    draft.pillars = [
      ...draft.pillars,
      {
        id: createUuidV7(),
        templateRevisionId: draft.id,
        slug,
        name,
        description: description ?? "",
        order: draft.pillars.length + 1,
        questions: [],
      },
    ];
    activePillarSlug.value = slug;
  });
}

export function updatePillar(slug: string, updates: Record<string, unknown>) {
  withPillarMutation(slug, (pillar) => {
    Object.assign(pillar, updates);
  });
}

export function deletePillar(slug: string) {
  withTemplateMutation((draft) => {
    const pillarIndex = draft.pillars.findIndex(
      (pillar) => pillar.slug === slug
    );
    if (pillarIndex === -1) return false;
    draft.pillars = draft.pillars.toSpliced(pillarIndex, 1);
    draft.pillars.forEach((pillar, index) => {
      pillar.order = index + 1;
    });
    if (activePillarSlug.value === slug) {
      activePillarSlug.value = draft.pillars[0]?.slug ?? null;
    }
  });
}

export function reorderPillars(fromIndex: number, toIndex: number) {
  withTemplateMutation((draft) => {
    const movedPillar = draft.pillars.at(fromIndex);
    if (!movedPillar) return false;
    const remainingPillars = draft.pillars.toSpliced(fromIndex, 1);
    draft.pillars = remainingPillars.toSpliced(toIndex, 0, movedPillar);
    draft.pillars.forEach((pillar, index) => {
      pillar.order = index + 1;
    });
  });
}

export function addQuestion(
  pillarSlug: string,
  text: string,
  type: "yes-no" | "checklist" = "yes-no"
) {
  withPillarMutation(pillarSlug, (pillar) => {
    const question = createTemplateQuestion(
      pillar.questions.length + 1,
      text,
      type
    );
    pillar.questions = [...pillar.questions, question];
    expandedQuestionId.value = question.id;
  });
}

export function updateQuestion(
  pillarSlug: string,
  questionId: string,
  updates: Partial<TemplateQuestion>
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    if (updates.type === "checklist" && !question.checklistItems) {
      question.checklistItems = [];
    }
    Object.assign(question, updates);
  });
}

export function deleteQuestion(pillarSlug: string, questionId: string) {
  withPillarMutation(pillarSlug, (pillar) => {
    const questionIndex = pillar.questions.findIndex(
      (q) => q.id === questionId
    );
    if (questionIndex === -1) return false;
    pillar.questions = pillar.questions.toSpliced(questionIndex, 1);
    pillar.questions.forEach((q, index) => {
      q.order = index + 1;
    });
    if (expandedQuestionId.value === questionId)
      expandedQuestionId.value = null;
  });
}

export function reorderQuestions(
  pillarSlug: string,
  fromIndex: number,
  toIndex: number
) {
  withPillarMutation(pillarSlug, (pillar) => {
    const movedQuestion = pillar.questions.at(fromIndex);
    if (!movedQuestion) return false;
    const remainingQuestions = pillar.questions.toSpliced(fromIndex, 1);
    pillar.questions = remainingQuestions.toSpliced(toIndex, 0, movedQuestion);
    pillar.questions.forEach((q, index) => {
      q.order = index + 1;
    });
  });
}
