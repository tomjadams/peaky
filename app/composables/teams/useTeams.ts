import type { Team } from "~/models";
import { teamMutations } from "~/services/entity/TeamMutations";
import { lastSyncAt } from "~/composables/sync/useSyncClient";

// Module-level singletons so state survives navigation.
// pending starts false once data has been loaded once — subsequent page
// visits render existing data instantly instead of showing the skeleton.
const teams = ref<Team[]>([]);
const pending = ref(true);
const error = ref<Error | null>(null);
let loaded = false;

async function fetchTeamsWithRemoteMetrics(): Promise<Team[]> {
  const localTeams = await teamMutations.fetchAll();
  const remoteTeams = await $fetch<Team[]>("/api/teams").catch(() => null);
  if (!remoteTeams) return localTeams;

  const remoteById = new Map(remoteTeams.map((team) => [team.id, team]));
  return localTeams.map((team) => {
    const remote = remoteById.get(team.id);
    if (!remote) return team;
    return {
      ...team,
      totalReviewCount: Math.max(
        team.totalReviewCount,
        remote.totalReviewCount
      ),
      activeReviewCount: Math.max(
        team.activeReviewCount,
        remote.activeReviewCount
      ),
      lastActivityDate:
        new Date(remote.lastActivityDate).getTime() >
        new Date(team.lastActivityDate).getTime()
          ? remote.lastActivityDate
          : team.lastActivityDate,
    };
  });
}

async function refresh(): Promise<void> {
  if (!import.meta.client) return;
  if (!loaded) pending.value = true;
  error.value = null;
  try {
    teams.value = await fetchTeamsWithRemoteMetrics();
    loaded = true;
  } catch (err) {
    error.value = err instanceof Error ? err : new Error(String(err));
  } finally {
    pending.value = false;
  }
}

if (import.meta.client) {
  void refresh();
  watch(lastSyncAt, () => void refresh());
}

export const useTeams = () => {
  return { teams, pending, error, refresh };
};
