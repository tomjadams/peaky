<template>
  <div
    class="applications-dashboard ml-20 flex flex-1 flex-col min-[1920px]:mx-16 lg:mx-32"
  >
    <main class="applications-dashboard__main w-full px-8 py-6">
      <div
        class="applications-dashboard__container max-w-8xl mx-auto min-[1920px]:max-w-[1920px]"
      >
        <div
          class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 class="text-default text-2xl font-bold">
              Applications Dashboard
            </h2>
            <p class="text-muted mt-1 text-sm">
              Browse operational readiness across applications linked to
              team-owned reviews. This is a read-only view — open a team to
              start or manage reviews.
            </p>
          </div>
        </div>

        <StatStrip layout="triple" class="mb-16">
          <StatBlock
            label="Total Applications"
            :value="filteredApplications.length"
            :reveal-index="0"
          />
          <StatBlock label="Ready" :value="readyCount" :reveal-index="1" />
          <StatBlock
            label="Need Attention"
            :value="actionNeededCount"
            tone="attention"
            :reveal-index="2"
          />
        </StatStrip>

        <div
          class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search applications..."
            class="flex-1 sm:max-w-md"
          />

          <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div class="flex items-center gap-3">
              <div class="text-muted flex items-center gap-1.5 text-sm">
                <Icon name="lucide:filter" class="h-4 w-4" aria-hidden="true" />
                <span>Org:</span>
              </div>
              <USelect
                v-model="orgFilter"
                :items="organizationOptions"
                size="lg"
                icon="i-lucide-building-2"
                class="w-full sm:w-64"
              />
            </div>

            <div class="flex items-center gap-3">
              <div class="text-muted flex items-center gap-1.5 text-sm">
                <Icon name="lucide:boxes" class="h-4 w-4" aria-hidden="true" />
                <span>Product:</span>
              </div>
              <USelect
                v-model="productFilter"
                :items="productOptions"
                size="lg"
                icon="i-lucide-box"
                class="w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        <ClientOnly>
          <DashboardLoadingState
            v-if="pending"
            :column-count="5"
            :filter-count="2"
            :row-count="6"
          />

          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            title="Failed to load applications"
            description="Please try again."
          />

          <div
            v-else-if="
              filteredApplications.length === 0 &&
              !searchQuery &&
              orgFilter === 'all' &&
              productFilter === 'all'
            "
            class="bg-elevated border-default rounded-lg border p-12 text-center"
          >
            <Icon
              name="lucide:app-window"
              class="text-dimmed mx-auto h-12 w-12"
            />
            <h3 class="text-default mt-4 text-lg font-semibold">
              No applications yet
            </h3>
            <p class="text-muted mt-2 text-sm">
              Applications appear here once they are linked to team-owned
              reviews.
            </p>
          </div>

          <div
            v-else-if="sortedApplications.length === 0"
            class="bg-elevated border-default rounded-lg border p-12 text-center"
          >
            <Icon
              name="lucide:search-x"
              class="text-dimmed mx-auto h-12 w-12"
            />
            <h3 class="text-default mt-4 text-lg font-semibold">No matches</h3>
            <p class="text-muted mt-2 text-sm">
              No applications match your current filters.
            </p>
          </div>

          <ApplicationTable
            v-else
            :applications="sortedApplications"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            @sort="handleSort"
          />

          <template #fallback>
            <DashboardLoadingState
              :column-count="5"
              :filter-count="2"
              :row-count="6"
            />
          </template>
        </ClientOnly>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  fetchRemoteApplications,
  useApplications,
} from "~/composables/applications/useApplications";
import { useApplicationFilters } from "~/composables/applications/useApplicationFilters";

definePageMeta({
  breadcrumb: {
    label: "Applications",
  },
  pageHeader: {
    title: "Applications",
    showSurveyMode: false,
  },
});

const {
  data: remoteApplications,
  pending: remotePending,
  error: remoteError,
  refresh: refreshRemote,
} = await useLazyAsyncData(
  "applications-dashboard-remote",
  fetchRemoteApplications,
  {
    default: () => [],
  }
);

const { applications, pending, error } = useApplications({
  initialRemoteApplications: remoteApplications,
  remotePending,
  remoteError,
  refreshRemote,
});
const { searchQuery, orgFilter, productFilter, filterApplications } =
  useApplicationFilters();
const sortBy = ref("name");
const sortDirection = ref<"asc" | "desc">("asc");

const filteredApplications = computed(() => {
  if (!applications.value) return [];
  return filterApplications(applications.value);
});

const sortedApplications = computed(() => {
  return filteredApplications.value.toSorted((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (sortBy.value) {
      case "status":
        compareA = a.status;
        compareB = b.status;
        break;
      case "owner":
        compareA = a.owner.toLowerCase();
        compareB = b.owner.toLowerCase();
        break;
      case "orgName":
        compareA = a.orgName.toLowerCase();
        compareB = b.orgName.toLowerCase();
        break;
      case "lastUpdated":
        compareA = new Date(a.lastUpdated).getTime();
        compareB = new Date(b.lastUpdated).getTime();
        break;
      case "name":
      default:
        compareA = a.name.toLowerCase();
        compareB = b.name.toLowerCase();
        break;
    }

    if (compareA < compareB) return sortDirection.value === "asc" ? -1 : 1;
    if (compareA > compareB) return sortDirection.value === "asc" ? 1 : -1;
    return 0;
  });
});

const readyCount = computed(() => {
  return filteredApplications.value.filter((app) => app.status === "ready")
    .length;
});

const actionNeededCount = computed(() => {
  return filteredApplications.value.filter(
    (app) => app.status === "action_needed"
  ).length;
});

const organizationOptions = computed(() => {
  const byOrganization = new Map<string, { id: string; name: string }>();

  applications.value?.forEach((application) => {
    if (!byOrganization.has(application.orgId)) {
      byOrganization.set(application.orgId, {
        id: application.orgId,
        name: application.orgName,
      });
    }
  });

  const items = Array.from(byOrganization.values())
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((organization) => ({
      label: organization.name,
      value: organization.id,
    }));

  return [{ label: "All organizations", value: "all" }, ...items];
});

const productOptions = computed(() => {
  const byProduct = new Map<string, { id: string; name: string }>();

  applications.value?.forEach((application) => {
    if (!byProduct.has(application.productId)) {
      byProduct.set(application.productId, {
        id: application.productId,
        name: application.productName,
      });
    }
  });

  const items = Array.from(byProduct.values())
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((product) => ({
      label: product.name,
      value: product.id,
    }));

  return [{ label: "All products", value: "all" }, ...items];
});

const handleSort = (column: string) => {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }

  sortBy.value = column;
  sortDirection.value = "asc";
};
</script>
