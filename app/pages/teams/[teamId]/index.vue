<template>
  <div class="team-details flex flex-1 flex-col">
    <main
      class="team-details__main w-full py-6 pr-12 pl-32 min-[1920px]:pr-16 min-[1920px]:pl-36"
    >
      <div
        class="team-details__container max-w-8xl mx-auto min-[1920px]:max-w-[1920px]"
      >
        <div
          v-if="teamPending || reviewsPending"
          class="flex items-center justify-center py-16"
        >
          <span class="text-muted text-sm">Loading team...</span>
        </div>

        <UAlert
          v-else-if="teamError || reviewsError"
          color="error"
          variant="subtle"
          title="Failed to load team details"
          :description="loadErrorDescription"
        />

        <template v-else-if="team">
          <SectionHeader :title="team.name" class="mb-2">
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-clipboard-list"
                :to="`/teams/${teamId}/plan`"
              >
                Follow-ups
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-plus"
                :to="`/teams/${teamId}/reviews/new`"
              >
                Start new review
              </UButton>
            </div>
          </SectionHeader>
          <div class="mb-6 flex items-center gap-3 text-sm">
            <span class="text-muted font-medium">{{ team.orgName }}</span>
            <span class="text-muted">{{ team.memberCount }} members</span>
          </div>

          <StatStrip layout="triple" class="mb-16">
            <StatBlock
              label="Active reviews"
              :value="activeReviews"
              :reveal-index="0"
            />
            <StatBlock
              label="Avg progress"
              :value="averageProgress"
              unit="%"
              :reveal-index="1"
            />
            <StatBlock
              label="Archived reviews"
              :value="archivedReviewRows.length"
              :reveal-index="2"
            />
          </StatStrip>

          <SubjectReviewsSection
            :review-surface="reviewSurface"
            :active-count="activeReviewRows.length"
            :archived-count="archivedReviewRows.length"
            :review-rows-count="reviewRows.length"
            :filtered-reviews-count="filteredReviews.length"
            :review-columns="reviewColumns"
            :review-table-data="reviewTableData"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            :search-query="searchQuery"
            :status-filter="statusFilter"
            :status-filters="statusFilters"
            archived-description="Archived reviews are hidden from the default team view until they are restored."
            empty-title="No reviews yet."
            empty-description="Start your first team-scoped readiness review."
            :new-review-to="`/teams/${teamId}/reviews/new`"
            table-aria-label="Team reviews"
            :archive-dialog-open="isArchiveConfirmOpen"
            :archive-dialog-title="`Archive ${archiveDialogReviewName}?`"
            archive-dialog-description="Archive is not permanent delete. Archived reviews move to the Archived surface and can be restored later."
            archive-details-title="Review access stays scoped"
            archive-details-description="Only assigned advisors and admins can archive or restore team reviews."
            archive-confirm-label="Archive review"
            :archive-loading="isUpdatingReviewStatus"
            :archive-close-disabled="isUpdatingReviewStatus"
            :delete-dialog-open="isDeleteConfirmOpen"
            :delete-dialog-title="`Delete ${deleteDialogReviewName} permanently?`"
            delete-dialog-description="This permanently removes the archived review and associated team review resources from the current workspace."
            delete-warning-title="Permanent delete cannot be undone"
            :delete-warning-items="deleteReviewResources"
            delete-confirmation-input-id="team-review-delete-confirmation"
            :delete-confirmation-target="deleteDialogReviewName"
            :delete-confirmation-value="deleteConfirmationText"
            delete-confirm-label="Delete permanently"
            :delete-confirm-disabled="!isDeleteConfirmationValid"
            :delete-loading="isDeletingReview"
            :delete-close-disabled="isDeletingReview"
            :get-template-names-label="getTemplateNamesLabel"
            :get-review-actions="
              (review) => getReviewActions(review as TeamReviewSummary)
            "
            :resolve-review-row="resolveReviewRow"
            @update:review-surface="reviewSurface = $event"
            @update:search-query="searchQuery = $event"
            @update:status-filter="statusFilter = $event"
            @update:archive-dialog-open="handleArchiveDialogOpen"
            @update:delete-dialog-open="handleDeleteDialogOpen"
            @update:delete-confirmation-value="deleteConfirmationText = $event"
            @sort="handleSort"
            @row-click="handleReviewClick"
            @clear-filters="clearFilters"
            @open-archive="openArchiveDialog($event as TeamReviewSummary)"
            @restore="handleRestoreReview($event as TeamReviewSummary)"
            @open-delete="openDeleteDialog($event as TeamReviewSummary)"
            @confirm-archive="handleArchiveConfirm"
            @confirm-delete="handleDeleteConfirm"
          />
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import SubjectReviewsSection from "~/components/reviews/SubjectReviewsSection.vue";
import type { TableColumn } from "~/components/DataTable.vue";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { useProductReviewTable } from "~/composables/products/useProductReviewTable";
import { isReviewAdmin } from "~/services/review/ReviewGovernance";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useTeamDetails } from "~/composables/teams/useTeamDetails";
import { useSubjectReviews } from "~/composables/reviews/useSubjectReviews";
import type { ReviewSummary } from "~/models";

type TeamReviewSummary = ReviewSummary;

definePageMeta({
  name: "team-details",
  breadcrumb: {
    label: "Overview",
  },
  pageHeader: {
    title: "Team Details",
    showSurveyMode: false,
  },
});

const route = useRoute();
const teamId = computed(() => String(route.params.teamId));
const { reviewActor } = useCurrentActor();

const { setPageHeader } = usePageHeader();

const {
  team,
  pending: teamPending,
  error: teamError,
  diagnostic: teamDiagnostic,
} = useTeamDetails(teamId);

const {
  sortedReviews,
  activeReviews: activeReviewRows,
  archivedReviews: archivedReviewRows,
  pending: reviewsPending,
  error: reviewsError,
  archiveReview,
  restoreReview,
  deleteReview,
} = useSubjectReviews("team", teamId);

const reviewSurface = ref<"active" | "archived">("active");
const toast = useToast();
const isArchiveConfirmOpen = ref(false);
const archiveReviewId = ref<string | null>(null);
const isDeleteConfirmOpen = ref(false);
const deleteReviewId = ref<string | null>(null);
const deleteConfirmationText = ref("");
const isUpdatingReviewStatus = ref(false);
const isDeletingReview = ref(false);

const loadErrorDescription = computed(() => {
  if (teamDiagnostic.value === "TEAM_NOT_FOUND") {
    return "This team is unavailable or you do not have access. Diagnostic: TEAM_NOT_FOUND.";
  }
  if (teamError.value) {
    return `The local team profile for “${teamId.value}” could not be read. Diagnostic: TEAM_PROFILE_READ_FAILED. Check the browser console for details.`;
  }

  return "The review list could not be loaded. Diagnostic: SUBJECT_REVIEWS_LOAD_FAILED. Check the browser console for details.";
});

watchEffect(() => {
  if (!team.value) return;
  setPageHeader({
    title: team.value.name,
    showSurveyMode: false,
  });
});

const reviewColumns: TableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "templateNames", label: "Templates", sortable: false },
  { key: "status", label: "Status", type: "status", sortable: true },
  { key: "progress", label: "Progress", type: "progress", sortable: true },
  { key: "updatedAt", label: "Updated", type: "date", sortable: true },
  { key: "actions", label: "Actions", sortable: false },
];

const reviewRows = computed(() => sortedReviews.value ?? []);
const {
  searchQuery,
  statusFilter,
  statusFilters,
  sortBy,
  sortDirection,
  filteredReviews,
  reviewTableData,
  handleSort,
  clearFilters,
} = useProductReviewTable(reviewRows, reviewSurface);

const reviewById = computed(() => {
  return new Map(reviewRows.value.map((review) => [review.id, review]));
});

function resolveReviewRow(row: unknown): TeamReviewSummary {
  const summary = toTeamReviewSummary(row);
  return reviewById.value.get(summary.id) ?? summary;
}

const archiveCandidate = computed(() => {
  return archiveReviewId.value
    ? (reviewById.value.get(archiveReviewId.value) ?? null)
    : null;
});

const deleteCandidate = computed(() => {
  return deleteReviewId.value
    ? (reviewById.value.get(deleteReviewId.value) ?? null)
    : null;
});

const archiveDialogReviewName = computed(() => {
  return archiveCandidate.value?.name ?? "this review";
});

const deleteDialogReviewName = computed(() => {
  return deleteCandidate.value?.name ?? "this review";
});

const deleteReviewResources = computed(() => {
  if (!deleteCandidate.value) {
    return [];
  }

  const advisors =
    deleteCandidate.value.advisors ?? deleteCandidate.value.reviewers ?? [];
  const participantCount =
    deleteCandidate.value.assessors.length + advisors.length;

  return [
    `${deleteCandidate.value.templateNames.length} linked template${deleteCandidate.value.templateNames.length === 1 ? "" : "s"}`,
    `${participantCount} assigned participant${participantCount === 1 ? "" : "s"}`,
    "assessment answers, notes, attachments, and audit history references",
  ];
});

const isDeleteConfirmationValid = computed(() => {
  return deleteConfirmationText.value.trim() === deleteDialogReviewName.value;
});

const toTeamReviewSummary = (row: unknown): TeamReviewSummary => {
  return row as TeamReviewSummary;
};

const getTemplateNamesLabel = (row: unknown): string => {
  const { templateNames } = toTeamReviewSummary(row);
  return Array.isArray(templateNames) ? templateNames.join(", ") : "—";
};

function getReviewActions(review: TeamReviewSummary) {
  const advisors = review.advisors ?? review.reviewers ?? [];
  const canManage =
    isReviewAdmin(reviewActor.value) ||
    advisors.some((advisor) => advisor.id === reviewActor.value.id);
  const canDelete =
    review.status === "archived" && isReviewAdmin(reviewActor.value);

  return {
    canArchive: canManage && review.status !== "archived",
    canRestore: canManage && review.status === "archived",
    canDelete,
  };
}

function openArchiveDialog(review: TeamReviewSummary) {
  archiveReviewId.value = review.id;
  isArchiveConfirmOpen.value = true;
}

function closeArchiveDialog() {
  isArchiveConfirmOpen.value = false;
  archiveReviewId.value = null;
}

function handleArchiveDialogOpen(open: boolean) {
  if (open) {
    isArchiveConfirmOpen.value = true;
    return;
  }

  closeArchiveDialog();
}

function openDeleteDialog(review: TeamReviewSummary) {
  deleteReviewId.value = review.id;
  deleteConfirmationText.value = "";
  isDeleteConfirmOpen.value = true;
}

function closeDeleteDialog() {
  isDeleteConfirmOpen.value = false;
  deleteReviewId.value = null;
  deleteConfirmationText.value = "";
}

function handleDeleteDialogOpen(open: boolean) {
  if (open) {
    isDeleteConfirmOpen.value = true;
    return;
  }

  closeDeleteDialog();
}

async function handleArchiveConfirm() {
  if (!archiveCandidate.value) {
    return;
  }

  const candidate = archiveCandidate.value;
  isUpdatingReviewStatus.value = true;

  try {
    await archiveReview(candidate.id, reviewActor.value);
    toast.add({
      title: "Review archived",
      description: `${candidate.name} moved to Archived reviews and can be restored later.`,
      color: "success",
    });
    closeArchiveDialog();
  } catch (error) {
    toast.add({
      title: "Could not archive review",
      description: error instanceof Error ? error.message : "Please try again.",
      color: "error",
    });
  } finally {
    isUpdatingReviewStatus.value = false;
  }
}

async function handleRestoreReview(review: TeamReviewSummary) {
  isUpdatingReviewStatus.value = true;

  try {
    await restoreReview(review.id, reviewActor.value);
    toast.add({
      title: "Review restored",
      description: `${review.name} is back in active reviews.`,
      color: "success",
    });
  } catch (error) {
    toast.add({
      title: "Could not restore review",
      description: error instanceof Error ? error.message : "Please try again.",
      color: "error",
    });
  } finally {
    isUpdatingReviewStatus.value = false;
  }
}

async function handleDeleteConfirm() {
  if (!deleteCandidate.value || !isDeleteConfirmationValid.value) {
    return;
  }

  const candidate = deleteCandidate.value;
  isDeletingReview.value = true;

  try {
    await deleteReview(candidate.id, reviewActor.value);
    toast.add({
      title: "Review deleted permanently",
      description: `${candidate.name} and its associated resources were removed.`,
      color: "success",
    });
    closeDeleteDialog();
  } catch (error) {
    toast.add({
      title: "Could not delete review",
      description: error instanceof Error ? error.message : "Please try again.",
      color: "error",
    });
  } finally {
    isDeletingReview.value = false;
  }
}

const activeReviews = computed(() => {
  return activeReviewRows.value.filter(
    (review) => review.status === "draft" || review.status === "in-progress"
  ).length;
});

const averageProgress = computed(() => {
  if (activeReviewRows.value.length === 0) return 0;
  const total = activeReviewRows.value.reduce(
    (sum, review) => sum + review.progress,
    0
  );
  return Math.round(total / activeReviewRows.value.length);
});

const handleReviewClick = (row: Record<string, unknown>) => {
  const reviewId = toTeamReviewSummary(row).id;
  navigateTo(`/teams/${teamId.value}/reviews/${reviewId}`);
};
</script>
