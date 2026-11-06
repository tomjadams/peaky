<template>
  <div class="templates-page">
    <main class="templates-page__main w-full px-8 py-6 pl-28">
      <div
        class="templates-page__container mx-auto w-full max-w-6xl min-[1920px]:max-w-[1600px]"
      >
        <!-- Page Header -->
        <header class="templates-page__header mb-8">
          <SectionHeader
            title="Template library"
            description="Create and manage Peaky assessment templates"
          >
            <UButton
              size="md"
              to="/templates/new/edit"
              color="primary"
              icon="i-lucide-plus"
            >
              Create template
            </UButton>
          </SectionHeader>
        </header>

        <!-- Data Table -->
        <section class="templates-page__table" aria-label="Templates list">
          <DataTable
            :columns="columns"
            :data="filteredTemplates as unknown as Record<string, unknown>[]"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            :clickable-rows="true"
            title="Templates"
            item-noun="templates"
            :total-count="templates?.length ?? 0"
            :filtered-count="filteredTemplates.length"
            empty-message="No templates yet."
            filtered-empty-message="No matches for your search."
            aria-label="Templates"
            @sort="handleSort"
            @row-click="handleRowClick"
          >
            <template #console>
              <SearchInput
                v-model="searchQuery"
                placeholder="Search templates..."
                class="w-72"
              />
              <FilterChips
                :model-value="statusFilter ?? 'all'"
                :options="statusChipOptions"
                @update:model-value="
                  (value) => (statusFilter = value === 'all' ? null : value)
                "
              />
            </template>

            <template #cell-name="{ row }">
              <div class="flex flex-col">
                <span class="text-default font-semibold">
                  {{ (row as any).name }}
                </span>
                <span class="text-muted text-[13px]">
                  {{ (row as any).description }}
                </span>
              </div>
            </template>

            <template #cell-currentRevision="{ row }">
              <span
                v-if="(row as any).currentRevision"
                class="text-default font-mono text-sm font-semibold"
              >
                v{{ (row as any).currentRevision }}
              </span>
              <span v-else class="text-muted text-sm">
                No published revision
              </span>
            </template>

            <template #cell-hasDraft="{ row }">
              <span
                v-if="(row as any).hasDraft"
                aria-label="Draft available"
                class="bg-muted text-muted inline-flex rounded-md px-2 py-0.5 text-[13px] font-semibold"
              >
                Draft
              </span>
              <span v-else class="text-muted">—</span>
            </template>
          </DataTable>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumn } from "~/components/DataTable.vue";
import type { Command } from "~/composables/nav/useCommandPalette";
import type { TemplateCatalogEntry } from "~/models";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";
import { useTemplateCatalog } from "~/composables/templates/domain/useTemplateCatalog";

definePageMeta({
  name: "templates-list",
  breadcrumb: {
    label: "Templates",
  },
  pageHeader: {
    title: "Templates",
    showSurveyMode: false,
  },
});

const { registerCommands } = useCommandPalette();
const { templates } = useTemplateCatalog();

const templateList = computed(() => {
  return (templates.value ?? []).map((entry: TemplateCatalogEntry) => {
    const currentRevision = entry.publishedRevisions.toSorted(
      (a, b) => (b.revisionNumber ?? 0) - (a.revisionNumber ?? 0)
    )[0];
    return {
      id: entry.template.id,
      name: entry.template.name,
      description: entry.template.description,
      status: entry.template.status,
      currentRevision: currentRevision?.revisionNumber ?? null,
      currentRevisionId: currentRevision?.id ?? null,
      draftRevisionId: entry.draftRevision?.id ?? null,
      hasDraft: entry.draftRevision !== null,
      canEditDraft: entry.canEditDraft ?? false,
      reviewsCount: entry.reviewsCount ?? 0,
      updatedAt: entry.template.updatedAt,
      raw: entry,
    };
  });
});

const searchQuery = ref("");
const statusFilter = ref<string | null>(null);
const sortBy = ref("name");
const sortDirection = ref<"asc" | "desc">("asc");

const statusChipOptions = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const columns: DataTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  {
    key: "currentRevision",
    label: "Current revision",
    sortable: true,
    align: "center",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    type: "status",
    align: "center",
    statusColors: {
      draft: "bg-muted text-muted",
      active: "bg-success/10 text-success",
      archived: "bg-muted text-dimmed",
    },
  },
  {
    key: "hasDraft",
    label: "Draft",
    align: "center",
    headerClass: "normal-case",
  },
  {
    key: "reviewsCount",
    label: "Review using",
    sortable: true,
    align: "center",
  },
  {
    key: "updatedAt",
    label: "Last Updated",
    sortable: true,
    type: "date",
    align: "center",
  },
];

const filteredTemplates = computed(() => {
  let result = templateList.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }

  if (statusFilter.value) {
    result = result.filter((t) => t.status === statusFilter.value);
  }

  result = result.toSorted((a, b) => {
    const aVal = a[sortBy.value as keyof typeof a];
    const bVal = b[sortBy.value as keyof typeof b];

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection.value === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection.value === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  return result;
});

const handleSort = (key: string) => {
  if (sortBy.value === key) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = key;
    sortDirection.value = "asc";
  }
};

const getTemplateViewRoute = (row: Record<string, unknown>) => {
  const hasPublishedRevision = typeof row.currentRevisionId === "string";
  const targetId = row.currentRevisionId ?? row.draftRevisionId ?? row.id;
  return {
    name: "template-edit",
    params: { id: String(targetId) },
    query: hasPublishedRevision ? undefined : { mode: "view" },
  };
};

const handleRowClick = (row: Record<string, unknown>) => {
  navigateTo(getTemplateViewRoute(row));
};

// Command palette: template actions and navigation
const templateCommands = computed<Command[]>(() => {
  const commands: Command[] = [
    {
      id: "template-create",
      title: "Create new template",
      group: "Actions",
      icon: "lucide:plus",
      keywords: ["create", "new", "template", "add"],
      to: { name: "template-edit", params: { id: "new" } },
    },
  ];

  // Add navigation to each template
  if (templateList.value) {
    templateList.value.forEach((template) => {
      commands.push({
        id: `template-${template.id}`,
        title: `View ${template.name}`,
        group: "Templates",
        icon: "lucide:file-text",
        keywords: ["template", "view", "open", template.name.toLowerCase()],
        to: getTemplateViewRoute(template),
      });
    });
  }

  return commands;
});

onMounted(() => {
  let unregister = registerCommands(templateCommands.value, "lifecycle");

  watch(templates, () => {
    unregister();
    unregister = registerCommands(templateCommands.value, "lifecycle");
  });

  onUnmounted(() => unregister());
});
</script>
