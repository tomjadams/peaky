/**
 * Composable that hydrates the improvement plan for a single review.
 *
 * Wraps useReviewWorkspace and adapts the workspace projection into
 * the ReviewContext expected by buildImprovementPlan.
 */

import type { ReviewWorkspace } from "~/models/workspace";
import type {
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
} from "~/models/template";
import type { ImprovementPlan } from "~/models/improvement-plan";
import type { AnswerStateLike } from "~/services/review/ReviewProjection";
import {
  buildImprovementPlan,
  type ReviewContext,
} from "~/services/review/ImprovementPlanProjection";
import { useReviewWorkspace } from "./useReviewWorkspace";

// ─── Workspace adapter ────────────────────────────────────────

/**
 * Convert a ReviewWorkspace projection into the ReviewContext shape
 * expected by buildImprovementPlan.
 *
 * The workspace uses typed QuestionAnswer values; AnswerStateLike
 * expects serialized JSON strings (for safeParse in the projection).
 * Every selected Template Revision is mapped, with Pillars partitioned by
 * their own templateRevisionId — nothing collapses onto the first Revision
 * and no cross-Revision score is produced (reviews/AC-029;
 * maturity-score/AC-025, AC-039).
 */
export function workspaceToReviewContext(
  workspace: ReviewWorkspace,
  subjectType: "team" | "product" | "application"
): ReviewContext {
  const templates: TemplateRevisionDetail[] = workspace.templateRevisions.map(
    (templateRevision) => ({
      ...templateRevision,
      pillars: workspace.pillars
        .filter((pillar) => pillar.templateRevisionId === templateRevision.id)
        .map(
          (pillar): TemplatePillar => ({
            id: pillar.id,
            templateRevisionId: templateRevision.id,
            slug: pillar.slug,
            name: pillar.name,
            description: pillar.description,
            order: Number(pillar.orderKey) || 0,
            questions: pillar.questions.map(
              (question): TemplateQuestion => ({
                id: question.id,
                order: Number(question.orderKey) || 0,
                type: question.type ?? "yes-no",
                text: question.text,
                riskLevel: question.riskLevel ?? "medium",
                importance: question.importance ?? "",
                checklistItems: question.checklistItems,
                leadingPractices: (question.leadingPractices ?? []).map(
                  (practice, index) => ({
                    id: practice.id ?? String(index),
                    order: practice.order ?? index,
                    text: practice.text,
                  })
                ),
                helpfulLinks: question.helpfulLinks ?? [],
              })
            ),
          })
        ),
    })
  );

  // Serialize typed workspace answers to JSON strings for safeParse
  const answers: AnswerStateLike[] = workspace.answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer !== null ? JSON.stringify(a.answer) : null,
    naReason: a.naReason != null ? JSON.stringify(a.naReason) : null,
    itemNaReasons:
      a.itemNaReasons != null ? JSON.stringify(a.itemNaReasons) : null,
  }));

  return {
    reviewId: workspace.review.id,
    subjectId: workspace.subject.id,
    subjectType,
    templates,
    answers,
  };
}

// ─── Composable ───────────────────────────────────────────────

/**
 * Hydrates the improvement plan for a single review.
 *
 * Wraps `useReviewWorkspace` and converts the workspace into the
 * `ReviewContext` expected by `buildImprovementPlan`. Pass `subjectIdOverride`
 * when the route's subject ID differs from the workspace's subject ID
 * (e.g. product-level plan pages that load application reviews).
 */
export function useReviewPlanData(
  reviewId: MaybeRef<string>,
  subjectType: "team" | "product" | "application",
  subjectIdOverride?: MaybeRef<string | undefined>
) {
  const {
    workspace,
    loading,
    error,
    localWritesReady,
    localWriteError,
    refresh,
  } = useReviewWorkspace(reviewId);

  const plan = computed((): ImprovementPlan | null => {
    if (!workspace.value) return null;
    const ctx = workspaceToReviewContext(workspace.value, subjectType);
    const subjectId = subjectIdOverride
      ? toValue(subjectIdOverride)
      : undefined;
    if (subjectId) {
      ctx.subjectId = subjectId;
    }
    return buildImprovementPlan(ctx);
  });

  return {
    plan,
    workspace,
    loading,
    error,
    localWritesReady,
    localWriteError,
    refresh,
  };
}
