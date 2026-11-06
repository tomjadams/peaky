<template>
  <DataTable
    :columns="columns"
    :data="tableData"
    :sort-by="sortBy"
    :sort-direction="sortDirection"
    aria-label="Applications table"
    empty-message="No applications found"
    @sort="emit('sort', $event)"
  >
    <template #cell-name="{ row }">
      <span class="text-default text-base font-medium">
        {{ toApplicationTableRow(row).name }}
      </span>
    </template>

    <template #cell-status="{ row }">
      <UBadge
        :color="
          statusColorByValue[toApplicationTableRow(row).status] ?? 'neutral'
        "
        variant="subtle"
        size="md"
        class="min-w-18 justify-center px-3 py-1 text-sm font-medium whitespace-nowrap"
      >
        {{ statusLabelByValue[toApplicationTableRow(row).status] }}
      </UBadge>
    </template>

    <template #cell-owner="{ row }">
      <NuxtLink
        :to="`/teams/${toApplicationTableRow(row).teamId}`"
        class="group inline-flex flex-col items-start gap-0.5"
      >
        <span
          class="text-default group-hover:text-primary text-base font-medium"
        >
          {{ toApplicationTableRow(row).owner }}
        </span>
        <span class="text-muted group-hover:text-primary text-xs">
          Open team
          <Icon name="lucide:arrow-right" class="text-xs" aria-hidden="true" />
        </span>
      </NuxtLink>
    </template>

    <template #cell-orgName="{ row }">
      <span class="text-muted text-sm font-medium">
        {{ toApplicationTableRow(row).orgName }}
      </span>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import type { Application } from "~/composables/applications/useApplications";
import type { DataTableColumn } from "./DataTable.vue";

interface Props {
  applications: Application[];
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

const props = defineProps<Props>();

const emit = defineEmits<{
  sort: [key: string];
}>();

type ApplicationTableRow = Pick<
  Application,
  "id" | "name" | "status" | "owner" | "teamId" | "orgName"
>;

const statusColorByValue: Record<
  Application["status"],
  "success" | "primary" | "error"
> = {
  ready: "success",
  in_progress: "primary",
  action_needed: "error",
};

const statusLabelByValue: Record<Application["status"], string> = {
  ready: "Ready",
  in_progress: "In progress",
  action_needed: "Action needed",
};

const columns: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true, type: "text", width: "w-52" },
  {
    key: "status",
    label: "Status",
    sortable: true,
    type: "text",
    width: "w-32",
  },
  {
    key: "owner",
    label: "Owner",
    sortable: true,
    type: "text",
    width: "w-64",
  },
  {
    key: "orgName",
    label: "Org",
    sortable: true,
    type: "text",
    width: "w-40",
  },
  {
    key: "lastUpdated",
    label: "Last activity",
    sortable: true,
    type: "date",
    width: "w-36",
  },
];

const tableData = computed(() => {
  return props.applications as unknown as Record<string, unknown>[];
});

const toApplicationTableRow = (row: unknown): ApplicationTableRow => {
  return row as ApplicationTableRow;
};
</script>
