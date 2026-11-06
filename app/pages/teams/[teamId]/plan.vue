<template>
  <div class="team-plan ml-20 flex min-w-0 flex-1 flex-col">
    <div class="team-plan__main page-gutters-spacious w-full min-w-0 py-6">
      <div class="team-plan__container max-w-8xl mx-auto">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <span class="text-muted text-sm">Loading team plan...</span>
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="subtle"
          title="Failed to load team plan"
          description="Please try again."
        />

        <template v-else-if="teamPlan">
          <div class="mb-6">
            <h2
              class="text-highlighted text-[30px] font-extrabold tracking-[-0.015em]"
            >
              Follow-ups
            </h2>
            <p class="text-muted mt-1 text-[15px]">
              What is contributing to readiness across this team's reviews.
            </p>
          </div>

          <StatStrip layout="quad-stacked" class="mb-14">
            <StatBlock
              label="Contributors"
              :value="teamPlan.contributors.length"
              sub-label="Team reviews"
              :reveal-index="0"
            />

            <StatBlock
              label="Follow-up"
              :value="
                teamPlan.summary.followUp + teamPlan.summary.checklistGaps
              "
              sub-label="Across all reviews"
              :reveal-index="1"
            />

            <StatBlock
              label="Not assessed"
              :value="teamPlan.summary.notAssessed"
              sub-label="Unanswered questions"
              :reveal-index="2"
            />

            <StatBlock
              label="Repeated items"
              :value="teamPlan.rollups.length"
              tone="attention"
              sub-label="Shared across reviews"
              :reveal-index="3"
            />
          </StatStrip>

          <div
            v-if="teamPlan.contributors.length === 0"
            class="flex flex-col items-center gap-4 py-16 text-center"
          >
            <Icon name="lucide:users" class="text-dimmed h-12 w-12" />
            <div>
              <h3 class="text-default text-lg font-semibold">
                No reviews found
              </h3>
              <p class="text-muted mt-1 text-sm">
                Start reviews for this team to build a rollup of follow-ups.
              </p>
            </div>
          </div>

          <template v-else>
            <ProductPlanRollups
              v-if="teamPlan.rollups.length > 0"
              :rollups="teamPlan.rollups"
              :contributors="teamPlan.contributors"
            />
            <div v-else class="py-10 text-center">
              <p class="text-dimmed text-sm">
                No items appear in more than one team review yet.
              </p>
            </div>

            <section class="mt-8">
              <div class="mb-4">
                <h3 class="text-default text-lg font-semibold">
                  Contributor factors
                </h3>
                <p class="text-muted mt-1 text-sm">
                  Reviews and team areas driving these follow-ups.
                </p>
              </div>
              <ProductPlanContributorsTable
                :contributors="teamPlan.contributors"
                :product-id="teamId"
              />
            </section>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTeamDetails } from "~/composables/teams/useTeamDetails";
import { useTeamPlanData } from "~/composables/teams/useTeamPlanData";

definePageMeta({
  name: "team-plan",
  breadcrumb: {
    label: "Follow-ups",
  },
  pageHeader: {
    title: "Follow-ups",
    showSurveyMode: false,
  },
});

const route = useRoute();
const teamId = computed(() => String(route.params.teamId));

const { team } = useTeamDetails(teamId);
const { teamPlan, loading, error } = useTeamPlanData(
  teamId,
  computed(() => team.value?.name)
);
</script>
