<template>
  <div class="team-review-selector ml-20 flex flex-1 flex-col lg:mx-32">
    <main class="team-review-selector__main w-full px-8 py-6">
      <div class="mx-auto max-w-4xl">
        <div class="mb-6">
          <h2 class="text-default text-2xl font-bold">Start New Review</h2>
          <p class="text-muted mt-2 text-sm">
            First, pick which team this review belongs to.
          </p>
        </div>

        <div class="bg-default border-default mb-8 rounded-lg border px-5 py-6">
          <UStepper
            :model-value="0"
            :items="steps"
            :ui="{
              separator:
                'bg-default ring-1 ring-default group-data-[state=completed]:bg-primary/40',
              trigger:
                'bg-muted ring-1 ring-default group-data-[state=active]:ring-primary/50 group-data-[state=completed]:ring-primary/30',
            }"
          />
        </div>

        <section class="space-y-4" data-testid="wizard-step-team">
          <p class="text-muted text-sm">
            Search and select <strong>one</strong> team.
          </p>

          <SearchInput
            v-model="teamSearch"
            placeholder="Search teams..."
            class="sm:max-w-md"
          />

          <div
            v-if="selectedTeam"
            class="bg-elevated border-default rounded-lg border p-3"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="text-default text-[13px] font-semibold">
                Selected team
              </span>
            </div>
            <span
              class="bg-default border-default text-muted inline-flex rounded-full border px-2.5 py-1 text-[13px]"
            >
              {{ selectedTeam.displayName }}
            </span>
          </div>

          <UAlert
            v-if="selectionError"
            color="error"
            variant="subtle"
            title="Could not prepare team review"
            :description="selectionError"
          />

          <div class="grid gap-4">
            <button
              v-for="team in paginatedTeams"
              :key="team.id"
              type="button"
              role="radio"
              :aria-checked="selectedTeamId === team.id"
              :class="[
                'rounded-lg border p-5 text-left transition-all duration-150 active:scale-[0.99]',
                selectedTeamId === team.id
                  ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
                  : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated opacity-70 ring-1 hover:opacity-100',
              ]"
              @click="selectedTeamId = team.id"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-default text-base font-semibold">
                    {{ team.displayName }}
                  </h3>
                  <p class="text-dimmed mt-2 text-[13px]">
                    LDAP: {{ team.id }}
                  </p>
                </div>

                <span
                  :class="[
                    'mt-0.5 inline-flex h-6 w-6 items-center justify-center',
                    selectedTeamId === team.id ? 'text-primary' : 'text-dimmed',
                  ]"
                >
                  <Icon
                    :name="
                      selectedTeamId === team.id
                        ? 'lucide:circle-check-big'
                        : 'lucide:circle'
                    "
                    class="h-4 w-4"
                  />
                </span>
              </div>
            </button>

            <div
              v-if="filteredTeams.length === 0"
              class="bg-elevated border-default text-muted rounded-lg border px-4 py-6 text-sm"
            >
              No teams match your search.
            </div>
          </div>

          <div
            v-if="totalTeamPages > 1"
            class="flex items-center justify-between px-1"
          >
            <span class="text-muted text-[13px] font-medium">
              Teams · Page {{ teamPage }} of {{ totalTeamPages }}
            </span>

            <div
              class="bg-elevated/70 border-default flex items-center gap-1 rounded-full border p-1"
            >
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                icon="i-lucide-chevron-left"
                :disabled="teamPage === 1"
                @click="teamPage -= 1"
              >
                Previous
              </UButton>

              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                trailing-icon="i-lucide-chevron-right"
                :disabled="teamPage === totalTeamPages"
                @click="teamPage += 1"
              >
                Next page
              </UButton>
            </div>
          </div>
        </section>

        <div
          class="bg-default border-default mt-8 flex items-center justify-between rounded-lg border p-4"
        >
          <UButton
            size="lg"
            color="neutral"
            variant="ghost"
            @click="navigateTo('/teams')"
          >
            Cancel
          </UButton>

          <UButton
            size="lg"
            color="primary"
            trailing-icon="i-lucide-arrow-right"
            :loading="isContinuing"
            :disabled="!selectedTeamId"
            @click="handleContinue"
          >
            Continue
          </UButton>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import { teamReviewService } from "~/services/review/TeamReviewService";

definePageMeta({
  breadcrumb: {
    label: "New Review",
  },
  pageHeader: {
    title: "New Review",
    showSurveyMode: false,
  },
});

const { dedupedGroups } = useCatalogGroupSearch();

const teamSearch = ref("");
const selectedTeamId = ref("");
const teamPage = ref(1);
const isContinuing = ref(false);
const selectionError = ref<string | null>(null);
const TEAMS_PER_PAGE = 6;

const steps = [
  { value: 1, title: "Team", description: "Step 1 of 4" },
  { value: 2, title: "Templates", description: "Step 2 of 4" },
  { value: 3, title: "Applications", description: "Step 3 of 4" },
  { value: 4, title: "Review", description: "Step 4 of 4" },
];

const filteredTeams = computed(() => {
  const query = teamSearch.value.trim().toLowerCase();
  if (!query) return dedupedGroups.value;

  return dedupedGroups.value.filter((team) => {
    return (
      team.displayName.toLowerCase().includes(query) ||
      team.id.toLowerCase().includes(query)
    );
  });
});

const totalTeamPages = computed(() => {
  return Math.max(1, Math.ceil(filteredTeams.value.length / TEAMS_PER_PAGE));
});

const paginatedTeams = computed(() => {
  const start = (teamPage.value - 1) * TEAMS_PER_PAGE;
  return filteredTeams.value.slice(start, start + TEAMS_PER_PAGE);
});

const selectedTeam = computed(() => {
  return dedupedGroups.value.find((team) => team.id === selectedTeamId.value);
});

watch(teamSearch, () => {
  teamPage.value = 1;
});

watch(totalTeamPages, (value) => {
  if (teamPage.value > value) {
    teamPage.value = value;
  }
});

const handleContinue = async () => {
  if (!selectedTeam.value) return;

  isContinuing.value = true;
  selectionError.value = null;

  try {
    await teamReviewService.ensureTeamProfile({
      id: selectedTeam.value.id,
      slug: selectedTeam.value.id,
      name: selectedTeam.value.displayName,
      orgId: selectedTeam.value.orgId ?? "unknown",
      orgName: selectedTeam.value.orgName ?? "Unknown",
      memberCount: selectedTeam.value.memberCount ?? 0,
    });
    await navigateTo(`/teams/${selectedTeam.value.id}/reviews/new`);
  } catch (error) {
    selectionError.value =
      error instanceof Error ? error.message : "Unknown error";
  } finally {
    isContinuing.value = false;
  }
};
</script>
