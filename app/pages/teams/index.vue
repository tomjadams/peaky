<template>
  <div class="teams-dashboard flex flex-1 flex-col">
    <main
      class="teams-dashboard__main w-full py-6 pr-12 pl-32 min-[1920px]:pr-16 min-[1920px]:pl-36"
    >
      <div
        class="teams-dashboard__container max-w-8xl mx-auto min-[1920px]:max-w-[1920px]"
      >
        <SectionHeader
          title="Teams dashboard"
          description="Track operational readiness for teams synced from your external source system."
          class="mb-10"
        >
          <UButton
            size="lg"
            color="primary"
            icon="i-lucide-plus"
            @click="handleStartReviewFromSelection"
          >
            New team review
          </UButton>
        </SectionHeader>

        <StatStrip layout="triple" class="mb-16">
          <StatBlock
            label="Total teams"
            :value="filteredTeams.length"
            :reveal-index="0"
          />
          <StatBlock
            label="Active reviews"
            :value="activeReviewsCount"
            :reveal-index="1"
          />
          <StatBlock
            label="Pending actions"
            :value="pendingActionsCount"
            tone="attention"
            :reveal-index="2"
          />
        </StatStrip>

        <ClientOnly>
          <DashboardLoadingState
            v-if="pending"
            :column-count="5"
            :filter-count="1"
            :row-count="6"
            :show-primary-action="true"
          />

          <UAlert
            v-else-if="error"
            color="error"
            variant="subtle"
            title="Failed to load teams"
            description="Please try again."
          />

          <TeamTable
            v-else
            :teams="sortedTeams"
            :sort-by="sortBy"
            :sort-direction="sortDirection"
            :total-count="teams?.length ?? 0"
            :filtered-count="sortedTeams.length"
            @sort="handleSort"
            @row-click="handleTeamClick"
            @start-review="handleStartReview"
          >
            <template #console>
              <SearchInput
                v-model="searchQuery"
                placeholder="Search teams..."
                class="w-72"
              />
              <USelect
                v-model="orgFilter"
                :items="organizationOptions"
                size="md"
                icon="i-lucide-building-2"
                class="w-56"
              />
            </template>
          </TeamTable>

          <template #fallback>
            <DashboardLoadingState
              :column-count="5"
              :filter-count="1"
              :row-count="6"
              :show-primary-action="true"
            />
          </template>
        </ClientOnly>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useTeams } from "~/composables/teams/useTeams";
import { useTeamFilters } from "~/composables/teams/useTeamFilters";

definePageMeta({
  breadcrumb: {
    label: "Teams",
  },
  pageHeader: {
    title: "Teams",
    showSurveyMode: false,
  },
});

const { teams, pending, error } = useTeams();
const { searchQuery, orgFilter, filterTeams } = useTeamFilters();

const sortBy = ref("name");
const sortDirection = ref<"asc" | "desc">("asc");

const filteredTeams = computed(() => {
  if (!teams.value) return [];

  return filterTeams(teams.value);
});

const sortedTeams = computed(() => {
  return filteredTeams.value.toSorted((a, b) => {
    let compareA: string | number;
    let compareB: string | number;

    switch (sortBy.value) {
      case "orgName":
        compareA = a.orgName.toLowerCase();
        compareB = b.orgName.toLowerCase();
        break;
      case "activeReviewCount":
        compareA = a.activeReviewCount;
        compareB = b.activeReviewCount;
        break;
      case "lastActivityDate":
        compareA = new Date(a.lastActivityDate).getTime();
        compareB = new Date(b.lastActivityDate).getTime();
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

const activeReviewsCount = computed(() => {
  return filteredTeams.value.reduce(
    (sum, team) => sum + team.activeReviewCount,
    0
  );
});

const pendingActionsCount = computed(() => {
  return filteredTeams.value.reduce(
    (sum, team) => sum + team.activeReviewCount * 2,
    0
  );
});

const organizationOptions = computed(() => {
  const options = teams.value ?? [];
  const byOrg = new Map<string, { id: string; name: string }>();

  options.forEach((team) => {
    if (!byOrg.has(team.orgId)) {
      byOrg.set(team.orgId, { id: team.orgId, name: team.orgName });
    }
  });

  const items = Array.from(byOrg.values())
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((org) => ({
      label: org.name,
      value: org.id,
    }));

  return [{ label: "All organizations", value: "all" }, ...items];
});

const handleSort = (column: string) => {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }

  sortBy.value = column;
  sortDirection.value = "asc";
};

const handleTeamClick = (row: Record<string, unknown>) => {
  navigateTo(`/teams/${String(row.id)}`);
};

const handleStartReview = (teamId: string) => {
  navigateTo(`/teams/${teamId}/reviews/new`);
};

const handleStartReviewFromSelection = () => {
  navigateTo("/teams/reviews/new");
};
</script>
