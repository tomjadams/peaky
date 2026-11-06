/**
 * Composable that aggregates improvement plan data for a product.
 *
 * Discovers contributing reviews through:
 *   1. Product-owned reviews
 *   2. Application/component reviews
 *   3. Team reviews
 *
 * Then builds the improvement plan for each contributor in parallel
 * and aggregates them into a ProductPlan using buildProductPlan.
 */

import type {
  ProductPlan,
  PlanContributor,
  PlanItem,
  ProductContributorsResponse,
} from "~/models/improvement-plan";
import type { ReviewWorkspace } from "~/models/workspace";
import {
  buildImprovementPlan,
  buildProductPlan,
  computeTopArea,
} from "~/services/review/ImprovementPlanProjection";
import { workspaceToReviewContext } from "~/composables/reviews/useReviewPlanData";
import { fetchReviewWorkspace } from "~/composables/reviews/useReviewWorkspace";
import { compactMaturityEntries } from "~/services/maturity/compactContext";
import { productMutations } from "~/services/entity/ProductMutations";

/**
 * Build a contributors URL with query parameters from local product metadata.
 * Used as a fallback when the server's ephemeral store does not yet know
 * about a product (e.g., local-first data that has not been synced).
 */
async function fetchContributorsWithFallback(
  productId: string
): Promise<ProductContributorsResponse["contributors"]> {
  const localProduct = await productMutations.fetchById(productId);
  const query = new URLSearchParams();

  if (localProduct?.componentIds) {
    for (const cid of localProduct.componentIds) {
      query.append("componentIds", cid);
    }
  }
  if (localProduct?.teamIds) {
    for (const tid of localProduct.teamIds) {
      query.append("teamIds", tid);
    }
  }

  const queryString = query.toString();
  const fallbackUrl = queryString
    ? `/api/products/${productId}/contributors?${queryString}`
    : `/api/products/${productId}/contributors`;

  const response = await $fetch<ProductContributorsResponse>(fallbackUrl);
  return response.contributors;
}

export function useProductPlanData(productId: MaybeRef<string>) {
  const id = computed(() => toValue(productId));
  const productPlan = ref<ProductPlan | null>(null);
  const loading = ref(true);
  const error = ref<Error | null>(null);

  const load = async () => {
    const currentId = id.value;
    if (!currentId) {
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      // 1. Try the server API directly (fast path for products the server
      //    already knows about, e.g., hardcoded seed data).
      let contributorSummaries: ProductContributorsResponse["contributors"];
      try {
        const response = await $fetch<ProductContributorsResponse>(
          `/api/products/${currentId}/contributors`
        );
        contributorSummaries = response.contributors;
      } catch {
        // Server does not know this product (common in local-first mode
        // where the sync backend is not yet deployed). Fall back to
        // reading the product metadata from the local DB and passing it
        // as query parameters so the server can still discover reviews.
        contributorSummaries = await fetchContributorsWithFallback(currentId);
      }

      if (contributorSummaries.length === 0) {
        productPlan.value = buildProductPlan(currentId, [], []);
        loading.value = false;
        return;
      }

      // 3. Load workspaces in parallel (performance guardrail: cap at 10)
      const capped = contributorSummaries.slice(0, 10);
      const workspaceResults = await Promise.allSettled(
        capped.map((meta) => fetchReviewWorkspace(meta.reviewId))
      );

      // 4. Build plans from successful workspace fetches
      const contributors: PlanContributor[] = [];
      const allItems: PlanItem[] = [];

      for (let i = 0; i < capped.length; i++) {
        const meta = capped[i]!;
        const result = workspaceResults[i]!;

        if (result.status === "rejected") {
          console.warn(
            `[useProductPlanData] Failed to load workspace for review ${meta.reviewId}:`,
            result.reason
          );
          continue;
        }

        const workspace: ReviewWorkspace = result.value;

        // Determine subject type from contributor type
        const subjectType =
          meta.contributorType === "team"
            ? ("team" as const)
            : meta.contributorType === "application"
              ? ("application" as const)
              : ("product" as const);

        const ctx = workspaceToReviewContext(workspace, subjectType);
        ctx.subjectId = meta.sourceId;
        const plan = buildImprovementPlan(ctx);

        const topArea = computeTopArea(plan.items);

        contributors.push({
          reviewId: meta.reviewId,
          reviewName: meta.reviewName,
          contributorType: meta.contributorType,
          sourceName: meta.sourceName,
          sourceId: meta.sourceId,
          summary: plan.summary,
          topArea,
          // Compact per-Revision maturity context (maturity-score/AC-062).
          maturity: compactMaturityEntries(workspace),
        });

        allItems.push(...plan.items);
      }

      productPlan.value = buildProductPlan(currentId, contributors, allItems);
    } catch (e) {
      error.value =
        e instanceof Error ? e : new Error("Failed to load product plan");
    } finally {
      loading.value = false;
    }
  };

  watch(id, () => void load(), { immediate: true });

  return {
    productPlan,
    loading,
    error,
    refresh: load,
  };
}
