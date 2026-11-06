import type {
  PlanContributor,
  PlanItem,
  ProductPlan,
} from "~/models/improvement-plan";
import {
  buildImprovementPlan,
  buildProductPlan,
  computeTopArea,
} from "~/services/review/ImprovementPlanProjection";
import { useSubjectReviews } from "~/composables/reviews/useSubjectReviews";
import { workspaceToReviewContext } from "~/composables/reviews/useReviewPlanData";
import { fetchReviewWorkspace } from "~/composables/reviews/useReviewWorkspace";
import { compactMaturityEntries } from "~/services/maturity/compactContext";

/**
 * Aggregates improvement plan data for a team across all its active reviews.
 *
 * Loads review summaries via `useSubjectReviews`, then fetches each workspace
 * in parallel and builds a `ProductPlan` (shared shape for both product and team rollups).
 * Archived reviews are excluded. Failed workspace fetches are warned and skipped —
 * one inaccessible review does not block the rest of the plan.
 */
export function useTeamPlanData(
  teamId: MaybeRef<string>,
  teamName: MaybeRef<string | null | undefined>
) {
  const id = computed(() => toValue(teamId));
  const name = computed(() => toValue(teamName) ?? id.value);
  const teamPlan = ref<ProductPlan | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  const {
    reviews,
    sortedReviews,
    pending,
    error: reviewsError,
  } = useSubjectReviews("team", id);

  const load = async () => {
    const currentId = id.value;
    if (!currentId || pending.value || reviews.value === null) return;

    loading.value = true;
    error.value = null;

    try {
      if (reviewsError.value) throw reviewsError.value;

      const reviewSummaries = sortedReviews.value.filter(
        (review) => review.status !== "archived"
      );

      if (reviewSummaries.length === 0) {
        teamPlan.value = buildProductPlan(currentId, [], []);
        return;
      }

      // Cap parallel fetches to match useProductPlanData — a team with many
      // reviews should not trigger unbounded parallel workspace requests.
      const capped = reviewSummaries.slice(0, 10);
      const workspaceResults = await Promise.allSettled(
        capped.map((review) => fetchReviewWorkspace(review.id))
      );

      const contributors: PlanContributor[] = [];
      const allItems: PlanItem[] = [];

      for (let i = 0; i < capped.length; i++) {
        const review = capped[i]!;
        const result = workspaceResults[i]!;

        if (result.status === "rejected") {
          console.warn(
            `[useTeamPlanData] Failed to load workspace for review ${review.id}:`,
            result.reason
          );
          continue;
        }

        const ctx = workspaceToReviewContext(result.value, "team");
        ctx.subjectId = currentId;
        const plan = buildImprovementPlan(ctx);

        const topArea = computeTopArea(plan.items);

        contributors.push({
          reviewId: review.id,
          reviewName: review.name,
          contributorType: "team",
          sourceName: name.value,
          sourceId: currentId,
          summary: plan.summary,
          topArea,
          // Compact per-Revision maturity context (maturity-score/AC-062).
          maturity: compactMaturityEntries(result.value),
        });

        allItems.push(...plan.items);
      }

      teamPlan.value = buildProductPlan(currentId, contributors, allItems);
    } catch (e) {
      error.value =
        e instanceof Error ? e : new Error("Failed to load team plan");
    } finally {
      loading.value = false;
    }
  };

  watch([id, reviews, pending, reviewsError], () => void load(), {
    immediate: true,
  });

  return {
    teamPlan,
    loading,
    error,
    refresh: load,
  };
}
