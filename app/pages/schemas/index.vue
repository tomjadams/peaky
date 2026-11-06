<template>
  <div class="schemas-page ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="schemas-page__main w-full px-8 py-6">
      <div class="schemas-page__container max-w-8xl mx-auto space-y-6">
        <SectionHeader title="Event schemas" class="mb-2" />
        <p class="text-muted mb-4 text-[15px]">
          All {{ EVENT_CATALOG_ENTRIES.length }} domain event types. Each schema
          is served as a JSON Schema file at its
          <code class="font-mono">/schemas/{EventName.v1}.json</code> URL.
        </p>

        <!-- Table -->
        <DataTable
          :columns="columns"
          :data="tableData"
          row-key="type"
          :clickable-rows="true"
          :sort-by="sortBy"
          :sort-direction="sortDir"
          title="Schema catalog"
          item-noun="schemas"
          :total-count="EVENT_CATALOG_ENTRIES.length"
          :filtered-count="tableData.length"
          aria-label="Event schemas"
          empty-message="No schemas yet."
          filtered-empty-message="No matches for your filters."
          @sort="handleSort"
          @row-click="handleRowClick"
        >
          <template #console>
            <SearchInput
              v-model="searchQuery"
              placeholder="Search event types..."
              class="w-72"
            />
            <USelect
              v-model="domainFilter"
              :items="DOMAIN_OPTIONS"
              size="md"
              icon="i-lucide-layers-3"
              class="w-44"
            />
            <USelect
              v-model="sourceFilter"
              :items="SOURCE_OPTIONS"
              icon="i-lucide-radio"
              size="md"
              class="w-44"
            />
          </template>

          <template #cell-type="{ row }">
            <NuxtLink
              :to="`/schemas/${row.type}`"
              class="text-primary font-mono text-sm font-medium hover:underline"
              @click.stop
            >
              {{ row.type }}
            </NuxtLink>
          </template>

          <template #cell-domain="{ row }">
            <span class="text-muted text-sm font-medium">{{ row.domain }}</span>
          </template>

          <template #cell-description="{ row }">
            <span class="text-muted text-sm">{{ row.description }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end">
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-download"
                @click.stop="openJsonSchema(row.type as string)"
              >
                JSON
              </UButton>
            </div>
          </template>
        </DataTable>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumn } from "~/components/DataTable.vue";
import { EVENT_CATALOG_ENTRIES } from "~/services/events/schemas/index";
import { buildDataSchemaUrl } from "~/services/events/config";

definePageMeta({
  breadcrumb: { label: "Event schemas" },
});

const DOMAIN_OPTIONS = [
  { label: "All domains", value: "all" },
  { label: "Review", value: "Review" },
  { label: "Product", value: "Product" },
  { label: "Template", value: "Template" },
];

const UNIQUE_SOURCES = [
  ...new Set(EVENT_CATALOG_ENTRIES.flatMap((e) => e.sources)),
];
const SOURCE_OPTIONS = [
  { label: "All sources", value: "all" },
  ...UNIQUE_SOURCES.map((s) => ({ label: s, value: s })),
];

const columns: DataTableColumn[] = [
  {
    key: "type",
    label: "Event type",
    sortable: true,
    type: "text",
    width: "w-72",
  },
  {
    key: "domain",
    label: "Domain",
    sortable: true,
    type: "text",
    width: "w-36",
  },
  { key: "description", label: "Description", sortable: false, type: "text" },
  { key: "actions", label: "Actions", sortable: false, type: "text" },
];

function deriveDomain(type: string): string {
  if (type.startsWith("Review")) return "Review";
  if (type.startsWith("Product")) return "Product";
  if (type.startsWith("Template")) return "Template";
  return "Internal";
}

const searchQuery = ref("");
const domainFilter = ref("all");
const sourceFilter = ref("all");
const sortBy = ref("type");
const sortDir = ref<"asc" | "desc">("asc");

function handleSort(key: string) {
  if (sortBy.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = key;
    sortDir.value = "asc";
  }
}

const filtered = computed(() => {
  let result = EVENT_CATALOG_ENTRIES.map((e) =>
    Object.assign({}, e, { domain: deriveDomain(e.type) })
  );

  if (domainFilter.value !== "all") {
    result = result.filter((e) => e.domain === domainFilter.value);
  }

  if (sourceFilter.value !== "all") {
    // sources is now narrowed to DomainEventEnvelope["source"]; the filter
    // value comes from the same dropdown so it's safe to read as the same
    // type. Cast at the comparison site rather than narrowing the ref.
    const filterValue = sourceFilter.value as
      | "peaky.client"
      | "peaky.sync"
      | "peaky.system";
    result = result.filter((e) => e.sources.includes(filterValue));
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (e) =>
        e.type.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }

  return result.toSorted((a, b) => {
    const aVal = String(a[sortBy.value as keyof typeof a] ?? "");
    const bVal = String(b[sortBy.value as keyof typeof b] ?? "");
    return sortDir.value === "asc"
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  });
});

const tableData = computed<Record<string, unknown>[]>(() =>
  filtered.value.map((e) => ({
    type: e.type,
    domain: e.domain,
    description: e.description,
  }))
);

function handleRowClick(row: Record<string, unknown>) {
  navigateTo(`/schemas/${row.type}`);
}

function openJsonSchema(type: string) {
  if (import.meta.client) {
    window.open(buildDataSchemaUrl(type), "_blank");
  }
}
</script>
