import type { ChecklistItem, HelpfulLink, LeadingPractice } from "~/models";
import {
  withQuestionMutation,
  normalizeHelpfulLinks,
} from "./useTemplateStudio-state";

export function addPractice(
  pillarSlug: string,
  questionId: string,
  text: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const practice: LeadingPractice = {
      id: `lp-${Date.now()}`,
      order: question.leadingPractices.length + 1,
      text,
    };
    question.leadingPractices = [...question.leadingPractices, practice];
  });
}

export function updatePractice(
  pillarSlug: string,
  questionId: string,
  practiceId: string,
  text: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const practice = question.leadingPractices.find(
      (item) => item.id === practiceId
    );
    if (!practice) return false;
    practice.text = text;
  });
}

export function deletePractice(
  pillarSlug: string,
  questionId: string,
  practiceId: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const practiceIndex = question.leadingPractices.findIndex(
      (p) => p.id === practiceId
    );
    if (practiceIndex === -1) return false;
    question.leadingPractices = question.leadingPractices.toSpliced(
      practiceIndex,
      1
    );
    question.leadingPractices.forEach((p, index) => {
      p.order = index + 1;
    });
  });
}

export function reorderPractices(
  pillarSlug: string,
  questionId: string,
  fromIndex: number,
  toIndex: number
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const movedPractice = question.leadingPractices.at(fromIndex);
    if (!movedPractice) return false;
    const remainingPractices = question.leadingPractices.toSpliced(
      fromIndex,
      1
    );
    question.leadingPractices = remainingPractices.toSpliced(
      toIndex,
      0,
      movedPractice
    );
    question.leadingPractices.forEach((p, index) => {
      p.order = index + 1;
    });
  });
}

export function addChecklistItem(
  pillarSlug: string,
  questionId: string,
  text: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    if (!question.checklistItems) question.checklistItems = [];
    const item: ChecklistItem = {
      id: `cli-${Date.now()}`,
      order: question.checklistItems.length + 1,
      text,
    };
    question.checklistItems = [...question.checklistItems, item];
  });
}

export function updateChecklistItem(
  pillarSlug: string,
  questionId: string,
  itemId: string,
  text: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const item = question.checklistItems?.find((ci) => ci.id === itemId);
    if (!item) return false;
    item.text = text;
  });
}

export function deleteChecklistItem(
  pillarSlug: string,
  questionId: string,
  itemId: string
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    if (!question.checklistItems) return false;
    const itemIndex = question.checklistItems.findIndex(
      (item) => item.id === itemId
    );
    if (itemIndex === -1) return false;
    question.checklistItems = question.checklistItems.toSpliced(itemIndex, 1);
    question.checklistItems.forEach((item, index) => {
      item.order = index + 1;
    });
  });
}

export function reorderChecklistItems(
  pillarSlug: string,
  questionId: string,
  fromIndex: number,
  toIndex: number
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    if (!question.checklistItems) return false;
    const movedItem = question.checklistItems.at(fromIndex);
    if (!movedItem) return false;
    const remainingItems = question.checklistItems.toSpliced(fromIndex, 1);
    question.checklistItems = remainingItems.toSpliced(toIndex, 0, movedItem);
    question.checklistItems.forEach((item, index) => {
      item.order = index + 1;
    });
  });
}

export function addLink(
  pillarSlug: string,
  questionId: string,
  link: HelpfulLink
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    question.helpfulLinks = normalizeHelpfulLinks([
      ...question.helpfulLinks,
      link,
    ]);
  });
}

export function updateLink(
  pillarSlug: string,
  questionId: string,
  index: number,
  link: HelpfulLink
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    question.helpfulLinks[index] = link;
    question.helpfulLinks = normalizeHelpfulLinks(question.helpfulLinks);
  });
}

export function deleteLink(
  pillarSlug: string,
  questionId: string,
  index: number
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    question.helpfulLinks = normalizeHelpfulLinks(
      question.helpfulLinks.toSpliced(index, 1)
    );
  });
}

export function reorderLinks(
  pillarSlug: string,
  questionId: string,
  fromIndex: number,
  toIndex: number
) {
  withQuestionMutation(pillarSlug, questionId, (question) => {
    const movedLink = question.helpfulLinks.at(fromIndex);
    if (!movedLink) return false;
    const remainingLinks = question.helpfulLinks.toSpliced(fromIndex, 1);
    question.helpfulLinks = normalizeHelpfulLinks(
      remainingLinks.toSpliced(toIndex, 0, movedLink)
    );
  });
}
