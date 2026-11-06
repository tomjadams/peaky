import { computed, ref, type Ref } from "vue";
import type { ReviewSummary } from "~/models";

type ReviewSurface = "active" | "archived";

function getSortValue(review: ReviewSummary, column: string): string | number {
  switch (column) {
    case "name":
      return review.name.toLowerCase();
    case "status":
      return review.status;
    case "progress":
      return review.progress;
    case "updatedAt":
    default:
      return new Date(review.updatedAt).getTime();
  }
}

export const useProductReviewTable = (
  reviews: Ref<ReviewSummary[]>,
  surface: Ref<ReviewSurface>
) => {
  const searchQuery = ref("");
  const statusFilter = ref<string>("all");
  const sortBy = ref("updatedAt");
  const sortDirection = ref<"asc" | "desc">("desc");

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "in-progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
  ];

  const surfaceReviews = computed(() => {
    return reviews.value.filter((review) =>
      surface.value === "archived"
        ? review.status === "archived"
        : review.status !== "archived"
    );
  });

  const filteredReviews = computed(() => {
    let result = [...surfaceReviews.value];

    if (surface.value !== "archived" && statusFilter.value !== "all") {
      result = result.filter((r) => r.status === statusFilter.value);
    }

    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.templateNames.some((t) => t.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      const valA = getSortValue(a, sortBy.value);
      const valB = getSortValue(b, sortBy.value);
      const dir = sortDirection.value === "asc" ? 1 : -1;
      return valA < valB ? -dir : valA > valB ? dir : 0;
    });

    return result;
  });

  const reviewTableData = computed(() => {
    return filteredReviews.value.map((review) => ({
      id: review.id,
      name: review.name,
      templateNames: review.templateNames,
      status: review.status,
      progress: review.progress,
      assessors: review.assessors.map((a) => a.name),
      reviewers: (review.advisors ?? review.reviewers ?? []).map(
        (advisor) => advisor.name
      ),
      updatedAt: review.updatedAt,
    })) as unknown as Record<string, unknown>[];
  });

  const handleSort = (column: string) => {
    if (sortBy.value === column) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    } else {
      sortBy.value = column;
      sortDirection.value = "asc";
    }
  };

  const clearFilters = () => {
    searchQuery.value = "";
    statusFilter.value = "all";
  };

  return {
    searchQuery,
    statusFilter,
    statusFilters,
    sortBy,
    sortDirection,
    filteredReviews,
    reviewTableData,
    handleSort,
    clearFilters,
  };
};
