<script setup lang="ts">
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import type { Product, ProductOrigin } from "~/models";
import type { DataTableColumn } from "./DataTable.vue";
import { PRODUCT_ORIGIN_LABELS } from "~/composables/products/useProductFilters";
import { formatRelativeDate } from "~/utils/date";

const MAX_VISIBLE_TEAMS = 2;

type ProductTableRow = Pick<
  Product,
  "id" | "name" | "origin" | "isExternal" | "teamIds" | "lastActivityDate"
>;

function toRow(row: unknown): ProductTableRow {
  return row as ProductTableRow;
}

function originLabel(origin: ProductOrigin): string {
  return PRODUCT_ORIGIN_LABELS[origin] ?? origin;
}

function formatTooltipDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

interface Props {
  products: Product[];
  surface?: "active" | "archived";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  manageableProductIds?: string[];
  totalCount?: number;
  filteredCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  manageableProductIds: () => [],
  surface: "active",
  sortBy: undefined,
  sortDirection: undefined,
  totalCount: undefined,
  filteredCount: undefined,
});

const emit = defineEmits<{
  sort: [key: string];
  rowClick: [product: ProductTableRow];
  startReview: [id: string];
  archive: [id: string];
  restore: [id: string];
  delete: [id: string];
}>();

const columns: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true, type: "text" },
  { key: "origin", label: "Origin", sortable: true, type: "text" },
  { key: "teams", label: "Teams", sortable: false, type: "text" },
  { key: "totalReviewCount", label: "Reviews", sortable: true, type: "text" },
  {
    key: "lastActivityDate",
    label: "Last activity",
    sortable: true,
    type: "text",
  },
  { key: "actions", label: "Actions", sortable: false, type: "text" },
];

const tableData = computed(() => {
  return props.products as unknown as Record<string, unknown>[];
});
const { allGroups } = useCatalogGroupSearch();

const isArchivedSurface = computed(() => props.surface === "archived");
const manageableProductIdSet = computed(() => {
  return new Set(props.manageableProductIds ?? []);
});

const groupNameById = computed(() => {
  return new Map(allGroups.value.map((group) => [group.id, group.displayName]));
});

function canManageLifecycle(productId: string): boolean {
  return manageableProductIdSet.value.has(productId);
}

function resolveGroupName(groupId: string): string {
  return groupNameById.value.get(groupId) ?? groupId;
}

function rowMenuItems(productId: string) {
  if (isArchivedSurface.value) {
    return [
      {
        label: "Restore",
        icon: "i-lucide-archive-restore",
        onSelect: () => emit("restore", productId),
      },
      {
        label: "Delete",
        icon: "i-lucide-trash-2",
        color: "error" as const,
        onSelect: () => emit("delete", productId),
      },
    ];
  }

  return [
    {
      label: "Archive",
      icon: "i-lucide-archive",
      onSelect: () => emit("archive", productId),
    },
  ];
}
</script>

<template>
  <DataTable
    :columns="columns"
    :data="tableData"
    :clickable-rows="!isArchivedSurface"
    :sort-by="sortBy"
    :sort-direction="sortDirection"
    aria-label="Products table"
    title="Products"
    item-noun="products"
    :total-count="totalCount"
    :filtered-count="filteredCount"
    :empty-message="
      isArchivedSurface ? 'No archived products.' : 'No products yet.'
    "
    filtered-empty-message="No matches for your search."
    @sort="emit('sort', $event)"
    @row-click="emit('rowClick', toRow($event))"
  >
    <template v-if="$slots.console" #console>
      <slot name="console" />
    </template>

    <template #cell-name="{ row }">
      <NuxtLink
        v-if="!isArchivedSurface"
        :to="`/products/${toRow(row).id}`"
        class="text-default hover:text-primary text-base font-medium"
      >
        {{ toRow(row).name }}
      </NuxtLink>
      <span v-else class="text-default text-base font-medium">
        {{ toRow(row).name }}
      </span>
    </template>

    <template #cell-origin="{ row }">
      <div class="flex items-center gap-1.5">
        <UBadge color="neutral" variant="subtle" size="lg">
          {{ originLabel(toRow(row).origin) }}
        </UBadge>
        <UBadge
          v-if="toRow(row).isExternal"
          color="primary"
          variant="subtle"
          size="sm"
        >
          External
        </UBadge>
      </div>
    </template>

    <template #cell-teams="{ row }">
      <div class="flex items-center gap-1">
        <span
          v-for="id in toRow(row).teamIds.slice(0, MAX_VISIBLE_TEAMS)"
          :key="id"
          class="text-muted text-[13px] font-medium"
        >
          {{ resolveGroupName(id) }}
        </span>
        <UTooltip
          v-if="toRow(row).teamIds.length > MAX_VISIBLE_TEAMS"
          :text="
            toRow(row)
              .teamIds.slice(MAX_VISIBLE_TEAMS)
              .map((groupId) => resolveGroupName(groupId))
              .join(', ')
          "
        >
          <span
            class="text-muted cursor-default rounded-full border border-dashed px-2.5 py-1 text-[13px]"
          >
            +{{ toRow(row).teamIds.length - MAX_VISIBLE_TEAMS }} more
          </span>
        </UTooltip>
        <span
          v-if="toRow(row).teamIds.length === 0"
          class="text-dimmed text-[13px]"
          >—</span
        >
      </div>
    </template>

    <template #cell-lastActivityDate="{ row }">
      <UTooltip
        :text="
          toRow(row).lastActivityDate
            ? formatTooltipDate(toRow(row).lastActivityDate!)
            : ''
        "
      >
        <span class="text-muted text-sm">
          {{
            toRow(row).lastActivityDate
              ? formatRelativeDate(toRow(row).lastActivityDate!)
              : "—"
          }}
        </span>
      </UTooltip>
    </template>

    <template #cell-actions="{ row }">
      <div class="flex items-center justify-end gap-1">
        <UButton
          v-if="!isArchivedSurface"
          size="sm"
          color="primary"
          variant="ghost"
          icon="i-lucide-plus"
          @click.stop="emit('startReview', toRow(row).id)"
        >
          Start review
        </UButton>
        <UDropdownMenu
          v-if="canManageLifecycle(toRow(row).id)"
          :items="rowMenuItems(toRow(row).id)"
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
</template>
