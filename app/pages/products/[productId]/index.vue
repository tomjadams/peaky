<template>
  <div class="product-details flex flex-1 flex-col">
    <main
      class="product-details__main w-full py-6 pr-12 pl-32 min-[1920px]:pr-16 min-[1920px]:pl-36"
    >
      <div
        class="product-details__container max-w-8xl mx-auto min-[1920px]:max-w-[1920px]"
      >
        <div
          v-if="productPending || reviewsPending"
          class="animate-pulse"
          aria-busy="true"
          aria-label="Loading product"
        >
          <div class="bg-muted h-[3px] w-10 rounded-full" />
          <div class="bg-muted mt-3 h-8 w-72 max-w-full rounded-lg" />
          <div class="bg-muted mt-4 h-5 w-56 max-w-full rounded-lg" />
          <div class="bg-muted mt-10 h-28 w-full rounded-lg" />
          <div class="mt-16 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            <div v-for="column in 4" :key="column" class="space-y-2.5">
              <div class="bg-muted h-4 w-24 rounded-lg" />
              <div class="bg-muted h-4 w-32 rounded-lg" />
              <div class="bg-muted h-4 w-28 rounded-lg" />
            </div>
          </div>
          <div class="bg-muted mt-16 h-72 w-full rounded-lg" />
        </div>

        <UAlert
          v-else-if="productError || reviewsError"
          color="error"
          variant="subtle"
          title="Failed to load product details"
          description="Please try again."
        />

        <template v-else-if="product">
          <!-- Header -->
          <SectionHeader :title="product.name" class="mb-3">
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                :to="`/products/${productId}/edit`"
              >
                Edit
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-clipboard-list"
                :to="`/products/${productId}/plan`"
              >
                Follow-ups
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-plus"
                :to="`/products/${productId}/reviews/new`"
              >
                Start new review
              </UButton>
            </div>
          </SectionHeader>
          <!-- The product's own facts, as identifier chips rather than a
               run-on sentence. "Internal" is not shown: every product is
               internal today, so a chip there would imply a choice that
               does not exist. -->
          <div class="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              class="border-default bg-muted text-muted inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium"
            >
              {{ originLabel }}
            </span>
            <span
              v-if="product.isExternal"
              class="border-default bg-muted text-muted inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium"
            >
              External
            </span>
            <span class="text-dimmed text-sm">{{ createdLabel }}</span>
          </div>

          <StatStrip layout="triple" class="mb-16">
            <StatBlock
              label="Active reviews"
              :value="activeReviews"
              sub-label="draft or in progress"
              :reveal-index="0"
            />
            <StatBlock
              label="Total reviews"
              :value="totalReviews"
              :sub-label="archivedSubLabel"
              :reveal-index="1"
            />
            <StatBlock
              label="Last activity"
              :value="lastActivity"
              :reveal-index="2"
            />
          </StatStrip>

          <!-- The product's title block — see ProductTitleBlock.vue. It
               carries its own caption, so no page-level survey tick here. -->
          <ProductTitleBlock
            class="mb-12"
            :product-manager="productManagerCell"
            :engineering-lead="engineeringLeadCell"
            :teams="teamCells"
            :applications="applicationCells"
            :references="referenceCells"
            :added-by="addedByLabel"
          />

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
            archived-description="Archived reviews stay hidden from the default view until you restore them."
            empty-title="No reviews yet."
            empty-description="Start your first product-scoped readiness review."
            :new-review-to="`/products/${productId}/reviews/new`"
            table-aria-label="Product reviews"
            :archive-dialog-open="isArchiveConfirmOpen"
            :archive-dialog-title="`Archive ${archiveDialogReviewName}?`"
            archive-dialog-description="Archive is not permanent delete. Archived reviews move to the Archived surface and can be restored later."
            archive-details-title="Review access stays controlled"
            archive-details-description="Only product owners and admins can archive or restore product reviews."
            archive-confirm-label="Archive review"
            :archive-loading="isUpdatingReviewStatus"
            :archive-close-disabled="isUpdatingReviewStatus"
            :delete-dialog-open="isDeleteConfirmOpen"
            :delete-dialog-title="`Delete ${deleteDialogReviewName} permanently?`"
            delete-dialog-description="This permanently removes the archived review and associated resources from the current workspace."
            delete-warning-title="Permanent delete cannot be undone"
            :delete-warning-items="deleteReviewResources"
            delete-confirmation-input-id="product-review-delete-confirmation"
            :delete-confirmation-target="deleteDialogReviewName"
            :delete-confirmation-value="deleteConfirmationText"
            delete-confirm-label="Delete permanently"
            :delete-confirm-disabled="!isDeleteConfirmationValid"
            :delete-loading="isDeletingReview"
            :delete-close-disabled="isDeletingReview"
            :get-template-names-label="getTemplateNamesLabel"
            :get-review-actions="
              (review) => getReviewActions(review as ProductReviewSummary)
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
            @open-archive="openArchiveDialog($event as ProductReviewSummary)"
            @restore="handleRestoreReview($event as ProductReviewSummary)"
            @open-delete="openDeleteDialog($event as ProductReviewSummary)"
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
import type {
  TitleBlockEntity,
  TitleBlockPerson,
  TitleBlockReference,
} from "~/components/ProductTitleBlock.vue";
import { formatRelativeDate } from "~/utils/date";
import {
  catalogUserUrl,
  catalogGroupUrl,
  catalogComponentUrl,
} from "~/utils/catalog";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { useCatalogUserSearch } from "~/composables/catalog/useCatalogUserSearch";
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import { useCatalogComponentSearch } from "~/composables/catalog/useCatalogComponentSearch";
import { usePageHeader } from "~/composables/nav/usePageHeader";
import { useProductDetails } from "~/composables/products/useProductDetails";
import { useSubjectReviews } from "~/composables/reviews/useSubjectReviews";
import type { ReviewSummary } from "~/models";
import { useProductReviewTable } from "~/composables/products/useProductReviewTable";
import { PRODUCT_ORIGIN_LABELS } from "~/composables/products/useProductFilters";
import { isReviewAdmin } from "~/services/review/ReviewGovernance";

type ProductReviewSummary = ReviewSummary;

interface ResourceRow {
  type: string;
  label: string;
  icon: string;
  href?: string;
}

function toReviewSummary(row: unknown): ProductReviewSummary {
  return row as ProductReviewSummary;
}

function getTemplateNamesLabel(row: unknown): string {
  const { templateNames } = toReviewSummary(row);
  return Array.isArray(templateNames) ? templateNames.join(", ") : "—";
}

definePageMeta({
  name: "product-details",
  breadcrumb: {
    label: "Overview",
  },
  pageHeader: {
    title: "Product Details",
    showSurveyMode: false,
  },
});

const route = useRoute();
const productId = computed(() => String(route.params.productId));
const { reviewActor } = useCurrentActor();
const { allUsers } = useCatalogUserSearch();
const { allGroups } = useCatalogGroupSearch();
const { allComponents } = useCatalogComponentSearch();

const { setPageHeader } = usePageHeader();

const {
  product,
  pending: productPending,
  error: productError,
} = useProductDetails(productId);

const {
  sortedReviews,
  activeReviews: activeReviewRows,
  archivedReviews: archivedReviewRows,
  pending: reviewsPending,
  error: reviewsError,
  archiveReview,
  restoreReview,
  deleteReview,
} = useSubjectReviews("product", productId);

const reviewRows = computed(() => sortedReviews.value ?? []);
const reviewSurface = ref<"active" | "archived">("active");
const toast = useToast();
const userNameById = computed(() => {
  return new Map(allUsers.value.map((user) => [user.id, user.displayName]));
});

const groupNameById = computed(() => {
  return new Map(allGroups.value.map((group) => [group.id, group.displayName]));
});

const componentNameById = computed(() => {
  return new Map(
    allComponents.value.map((component) => [
      component.id,
      component.displayName,
    ])
  );
});

function resolveUserName(id: string): string {
  return userNameById.value.get(id) ?? id;
}

function resolveGroupName(id: string): string {
  return groupNameById.value.get(id) ?? id;
}

function resolveComponentName(id: string): string {
  return componentNameById.value.get(id) ?? id;
}

const isArchiveConfirmOpen = ref(false);
const archiveReviewId = ref<string | null>(null);
const isDeleteConfirmOpen = ref(false);
const deleteReviewId = ref<string | null>(null);
const deleteConfirmationText = ref("");
const isUpdatingReviewStatus = ref(false);
const isDeletingReview = ref(false);

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

function resolveReviewRow(row: unknown): ProductReviewSummary {
  const summary = toReviewSummary(row);
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

function getReviewActions(review: ProductReviewSummary) {
  const ownerIds = [
    product.value?.productManagerId,
    product.value?.engineeringLeadId,
  ].filter((ownerId): ownerId is string => Boolean(ownerId));
  const canManage =
    isReviewAdmin(reviewActor.value) || ownerIds.includes(reviewActor.value.id);
  const canDelete =
    review.status === "archived" && isReviewAdmin(reviewActor.value);

  return {
    canArchive: canManage && review.status !== "archived",
    canRestore: canManage && review.status === "archived",
    canDelete,
  };
}

function openArchiveDialog(review: ProductReviewSummary) {
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

function openDeleteDialog(review: ProductReviewSummary) {
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

async function handleRestoreReview(review: ProductReviewSummary) {
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

watchEffect(() => {
  if (!product.value) return;
  setPageHeader({
    title: product.value.name,
    showSurveyMode: false,
  });
});

// Table column configuration
const reviewColumns: TableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "templateNames", label: "Templates", sortable: false },
  { key: "status", label: "Status", type: "status", sortable: true },
  { key: "progress", label: "Progress", type: "progress", sortable: true },
  {
    key: "assessors",
    label: "Team",
    type: "avatar-group",
  },
  {
    key: "reviewers",
    label: "Advisors",
    type: "avatar-group",
  },
  { key: "updatedAt", label: "Updated", type: "date", sortable: true },
  { key: "actions", label: "Actions", sortable: false },
];

// formatRelativeDate returns "Today"/"Yesterday" capitalised; the chip row
// reads as one sentence-case line.
const createdLabel = computed(() => {
  if (!product.value) return "";
  const relative = formatRelativeDate(product.value.createdAt);
  return `Created ${relative.charAt(0).toLowerCase()}${relative.slice(1)}`;
});

const originLabel = computed(() => {
  if (!product.value) return "";
  return PRODUCT_ORIGIN_LABELS[product.value.origin] ?? product.value.origin;
});

const resourceRows = computed((): ResourceRow[] => {
  if (!product.value) return [];
  const rows: ResourceRow[] = [];
  if (product.value.roadmapUrl)
    rows.push({
      type: "Roadmap",
      label: "View roadmap",
      icon: "lucide:map",
      href: product.value.roadmapUrl,
    });
  if (product.value.documentationUrl)
    rows.push({
      type: "Docs",
      label: "View documentation",
      icon: "lucide:book-open",
      href: product.value.documentationUrl,
    });
  if (product.value.supportChannel)
    rows.push({
      type: "Support",
      label: product.value.supportChannel,
      icon: "lucide:message-square",
    });
  return rows;
});

// ── Title block cells ───────────────────────────────────────────────────
// The panel is presentational: the page resolves every directory id to a
// display name and a catalog URL before handing it over.
const productManagerCell = computed<TitleBlockPerson>(() => ({
  name: product.value ? resolveUserName(product.value.productManagerId) : "",
  href: product.value ? catalogUserUrl(product.value.productManagerId) : "",
}));

const engineeringLeadCell = computed<TitleBlockPerson | null>(() => {
  const leadId = product.value?.engineeringLeadId;
  if (!leadId) return null;
  return { name: resolveUserName(leadId), href: catalogUserUrl(leadId) };
});

const teamCells = computed<TitleBlockEntity[]>(() =>
  (product.value?.teamIds ?? []).map((teamId) => ({
    label: resolveGroupName(teamId),
    href: catalogGroupUrl(teamId),
  }))
);

const applicationCells = computed<TitleBlockEntity[]>(() =>
  (product.value?.componentIds ?? []).map((componentId) => ({
    label: resolveComponentName(componentId),
    href: catalogComponentUrl(componentId),
  }))
);

const referenceCells = computed<TitleBlockReference[]>(() =>
  resourceRows.value.map((row) => ({
    label: row.type,
    value: row.label,
    icon: row.icon,
    href: row.href,
  }))
);

// The title block's drawn-by field. Falls back to the stored id when the
// directory has no row for it — never a blank or a made-up name.
const addedByLabel = computed(() =>
  product.value ? resolveUserName(product.value.createdBy) : ""
);

const activeReviews = computed(() => {
  return activeReviewRows.value.filter(
    (review) => review.status === "draft" || review.status === "in-progress"
  ).length;
});

const totalReviews = computed(() => reviewRows.value.length);

// "{N} {noun}" — the app-wide count grammar.
const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

// Only stated when there is something archived to state.
const archivedSubLabel = computed(() =>
  archivedReviewRows.value.length > 0
    ? `${countLabel(archivedReviewRows.value.length, "review")} archived`
    : undefined
);

const lastActivity = computed(() => {
  if (reviewRows.value.length === 0) return "No activity";
  const latest = reviewRows.value[0];
  return latest ? formatRelativeDate(latest.updatedAt) : "No activity";
});

const handleReviewClick = (row: Record<string, unknown>) => {
  const reviewId = toReviewSummary(row).id;
  navigateTo(`/products/${productId.value}/reviews/${reviewId}`);
};
</script>
