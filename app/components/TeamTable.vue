<template>
  <DataTable
    :columns="columns"
    :data="tableData"
    :clickable-rows="true"
    :sort-by="sortBy"
    :sort-direction="sortDirection"
    aria-label="Teams table"
    title="Teams"
    item-noun="teams"
    :total-count="totalCount"
    :filtered-count="filteredCount"
    empty-message="No teams yet."
    filtered-empty-message="No matches for your search."
    @sort="emit('sort', $event)"
    @row-click="emit('rowClick', $event)"
  >
    <template v-if="$slots.console" #console>
      <slot name="console" />
    </template>

    <template #cell-name="{ row }">
      <NuxtLink
        :to="`/teams/${toTeamTableRow(row).id}`"
        class="text-default hover:text-primary text-base font-medium min-[1920px]:text-[17px]"
      >
        {{ toTeamTableRow(row).name }}
      </NuxtLink>
    </template>

    <template #cell-orgName="{ row }">
      <span class="text-muted text-sm font-medium min-[1920px]:text-base">
        {{ toTeamTableRow(row).orgName }}
      </span>
    </template>

    <template #cell-actions="{ row }">
      <div class="flex items-center justify-end">
        <UButton
          size="sm"
          color="primary"
          variant="ghost"
          icon="i-lucide-plus"
          class="whitespace-nowrap min-[1920px]:px-4 min-[1920px]:py-2 min-[1920px]:text-base"
          @click.stop="emit('startReview', toTeamTableRow(row).id)"
        >
          Start review
        </UButton>
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import type { Team } from "~/models";
import type { DataTableColumn } from "./DataTable.vue";

interface Props {
  teams: Team[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  totalCount?: number;
  filteredCount?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  sort: [key: string];
  startReview: [id: string];
  rowClick: [row: Record<string, unknown>];
}>();

type TeamTableRow = Pick<Team, "id" | "name" | "orgName">;

const columns: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true, type: "text" },
  { key: "orgName", label: "Org", sortable: true, type: "text" },
  {
    key: "activeReviewCount",
    label: "Reviews",
    sortable: true,
    type: "text",
  },
  {
    key: "lastActivityDate",
    label: "Last activity",
    sortable: true,
    type: "date",
  },
  {
    key: "actions",
    label: "Actions",
    sortable: false,
    type: "text",
    width: "w-36 min-[1920px]:w-48",
  },
];

const tableData = computed(() => {
  return props.teams as unknown as Record<string, unknown>[];
});

const toTeamTableRow = (row: unknown): TeamTableRow => {
  return row as TeamTableRow;
};
</script>
