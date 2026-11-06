<script setup lang="ts">
import ArchiveConfirmDialog from "~/components/lifecycle/ArchiveConfirmDialog.vue";
import DeleteConfirmDialog from "~/components/lifecycle/DeleteConfirmDialog.vue";
import type { TableColumn } from "~/components/DataTable.vue";

interface StatusFilterOption {
  value: string;
  label: string;
}

interface ReviewActionState {
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
}

interface Props {
  reviewSurface: "active" | "archived";
  activeCount: number;
  archivedCount: number;
  reviewRowsCount: number;
  filteredReviewsCount: number;
  reviewColumns: TableColumn[];
  reviewTableData: Record<string, unknown>[];
  sortBy: string;
  sortDirection: "asc" | "desc";
  searchQuery: string;
  statusFilter: string;
  statusFilters: StatusFilterOption[];
  archivedDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  newReviewTo: string;
  tableAriaLabel: string;
  archiveDialogOpen: boolean;
  archiveDialogTitle: string;
  archiveDialogDescription: string;
  archiveDetailsTitle: string;
  archiveDetailsDescription: string;
  archiveConfirmLabel: string;
  archiveLoading: boolean;
  archiveCloseDisabled: boolean;
  archiveTone?: "primary" | "warning";
  deleteDialogOpen: boolean;
  deleteDialogTitle: string;
  deleteDialogDescription: string;
  deleteWarningTitle: string;
  deleteWarningDescription?: string;
  deleteWarningItems?: string[];
  deleteResourceTitle?: string;
  deleteResourceDescription?: string;
  deleteResourceSecondaryDescription?: string;
  deleteConfirmationInputId: string;
  deleteConfirmationTarget: string;
  deleteConfirmationValue: string;
  deleteConfirmationHelp?: string;
  deleteConfirmLabel: string;
  deleteConfirmDisabled: boolean;
  deleteLoading: boolean;
  deleteCloseDisabled: boolean;
  getTemplateNamesLabel: (row: unknown) => string;
  getReviewActions: (review: unknown) => ReviewActionState;
  resolveReviewRow: (row: unknown) => unknown;
}

const props = withDefaults(defineProps<Props>(), {
  archiveTone: "warning",
  deleteWarningDescription: undefined,
  deleteWarningItems: () => [],
  deleteResourceTitle: undefined,
  deleteResourceDescription: undefined,
  deleteResourceSecondaryDescription: undefined,
  deleteConfirmationHelp: undefined,
});

const emit = defineEmits<{
  "update:reviewSurface": [value: "active" | "archived"];
  "update:searchQuery": [value: string];
  "update:statusFilter": [value: string];
  "update:archiveDialogOpen": [value: boolean];
  "update:deleteDialogOpen": [value: boolean];
  "update:deleteConfirmationValue": [value: string];
  sort: [value: string];
  "row-click": [row: Record<string, unknown>];
  "clear-filters": [];
  "open-archive": [review: unknown];
  restore: [review: unknown];
  "open-delete": [review: unknown];
  "confirm-archive": [];
  "confirm-delete": [];
}>();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit("update:searchQuery", value),
});

const surfaceChipOptions = computed(() => [
  { label: "Active", value: "active", count: props.activeCount },
  { label: "Archived", value: "archived", count: props.archivedCount },
]);

const statusChipOptions = computed(() =>
  props.statusFilters.map((filter) => ({
    label: filter.label,
    value: filter.value,
  }))
);

// The sheet's own total/filtered pair is scoped to the current surface
// (Active or Archived), not the combined count across both — that combined
// count (reviewRowsCount) only decides the true first-review empty state.
const currentSurfaceTotal = computed(() =>
  props.reviewSurface === "archived" ? props.archivedCount : props.activeCount
);

interface ReviewRowMenuItem {
  label: string;
  icon: string;
  color?: "error";
  onSelect: () => void;
}

function reviewRowMenuItems(row: unknown): ReviewRowMenuItem[] {
  const actions = props.getReviewActions(props.resolveReviewRow(row));
  const items: ReviewRowMenuItem[] = [];

  if (actions.canArchive) {
    items.push({
      label: "Archive",
      icon: "i-lucide-archive",
      onSelect: () => emit("open-archive", props.resolveReviewRow(row)),
    });
  }
  if (actions.canRestore) {
    items.push({
      label: "Restore",
      icon: "i-lucide-archive-restore",
      onSelect: () => emit("restore", props.resolveReviewRow(row)),
    });
  }
  if (actions.canDelete) {
    items.push({
      label: "Delete",
      icon: "i-lucide-trash-2",
      color: "error",
      onSelect: () => emit("open-delete", props.resolveReviewRow(row)),
    });
  }

  return items;
}
</script>

<template>
  <section>
    <DataTable
      :columns="reviewColumns"
      :data="reviewTableData"
      :clickable-rows="true"
      :sort-by="sortBy"
      :sort-direction="sortDirection"
      :aria-label="tableAriaLabel"
      title="Reviews"
      item-noun="reviews"
      :total-count="currentSurfaceTotal"
      :filtered-count="filteredReviewsCount"
      @row-click="emit('row-click', $event)"
      @sort="emit('sort', $event)"
    >
      <template #console>
        <SearchInput
          v-model="localSearchQuery"
          placeholder="Search reviews..."
          class="w-64"
        />
        <FilterChips
          :model-value="reviewSurface"
          :options="surfaceChipOptions"
          @update:model-value="
            (value) =>
              emit('update:reviewSurface', value as 'active' | 'archived')
          "
        />
        <FilterChips
          v-if="reviewSurface === 'active'"
          :model-value="statusFilter"
          :options="statusChipOptions"
          @update:model-value="(value) => emit('update:statusFilter', value)"
        />
      </template>

      <template #footer-note>
        <p v-if="reviewSurface === 'archived'" class="text-muted text-[13px]">
          {{ archivedDescription }}
        </p>
      </template>

      <template #empty>
        <div
          v-if="reviewRowsCount === 0"
          class="flex flex-col items-center gap-2 px-4 py-10 text-center"
        >
          <Icon
            name="lucide:clipboard-list"
            class="text-dimmed mx-auto h-10 w-10"
          />
          <p class="text-default text-sm font-semibold">{{ emptyTitle }}</p>
          <p class="text-muted text-sm">{{ emptyDescription }}</p>
          <UButton
            class="mt-2"
            color="primary"
            icon="i-lucide-plus"
            :to="newReviewTo"
          >
            Start new review
          </UButton>
        </div>
        <div
          v-else-if="currentSurfaceTotal === 0"
          class="flex flex-col items-center gap-2 px-4 py-8 text-center"
        >
          <Icon name="lucide:archive-x" class="text-dimmed h-8 w-8" />
          <p class="text-muted text-sm">
            {{
              reviewSurface === "archived"
                ? "No archived reviews yet."
                : "No reviews yet."
            }}
          </p>
        </div>
        <div
          v-else
          class="flex flex-col items-center gap-2 px-4 py-8 text-center"
        >
          <Icon name="lucide:search-x" class="text-dimmed h-8 w-8" />
          <p class="text-muted text-sm">No matches for your filters.</p>
          <button
            type="button"
            class="text-primary hover:text-primary/80 text-sm font-medium"
            @click="emit('clear-filters')"
          >
            Clear filters
          </button>
        </div>
      </template>

      <template #cell-templateNames="{ value }">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="(name, index) in Array.isArray(value) ? value : []"
            :key="`${name}-${index}`"
            class="bg-muted/80 text-muted rounded-md px-2 py-0.5 text-[13px] font-medium min-[1920px]:px-2.5 min-[1920px]:py-1 min-[1920px]:text-sm"
          >
            {{ name }}
          </span>
          <span v-if="!Array.isArray(value) || value.length === 0">—</span>
        </div>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end">
          <UDropdownMenu
            v-if="reviewRowMenuItems(row).length > 0"
            :items="reviewRowMenuItems(row)"
            :content="{ align: 'end' }"
          >
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis"
              aria-label="More actions"
              @click.stop
            />
          </UDropdownMenu>
        </div>
      </template>
    </DataTable>

    <ArchiveConfirmDialog
      :open="archiveDialogOpen"
      :title="archiveDialogTitle"
      :description="archiveDialogDescription"
      :details-title="archiveDetailsTitle"
      :details-description="archiveDetailsDescription"
      :confirm-label="archiveConfirmLabel"
      confirm-color="warning"
      :loading="archiveLoading"
      :close-disabled="archiveCloseDisabled"
      :tone="archiveTone"
      @update:open="emit('update:archiveDialogOpen', $event)"
      @confirm="emit('confirm-archive')"
    />

    <DeleteConfirmDialog
      :open="deleteDialogOpen"
      :title="deleteDialogTitle"
      :description="deleteDialogDescription"
      :warning-title="deleteWarningTitle"
      :warning-description="deleteWarningDescription"
      :warning-items="deleteWarningItems"
      :resource-title="deleteResourceTitle"
      :resource-description="deleteResourceDescription"
      :resource-secondary-description="deleteResourceSecondaryDescription"
      :confirmation-input-id="deleteConfirmationInputId"
      :confirmation-target="deleteConfirmationTarget"
      :confirmation-value="deleteConfirmationValue"
      :confirmation-help="deleteConfirmationHelp"
      :confirm-label="deleteConfirmLabel"
      :confirm-disabled="deleteConfirmDisabled"
      :loading="deleteLoading"
      :close-disabled="deleteCloseDisabled"
      @update:open="emit('update:deleteDialogOpen', $event)"
      @update:confirmation-value="
        emit('update:deleteConfirmationValue', $event)
      "
      @confirm="emit('confirm-delete')"
    />
  </section>
</template>
