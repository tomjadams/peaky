import { computed, type MaybeRef } from "vue";
import { useLocalTeam } from "~/composables/local/useLocalTeam";

export const useTeamDetails = (teamId: MaybeRef<string>) => {
  const {
    team,
    error: localError,
    isLoading: pending,
    refresh,
  } = useLocalTeam(teamId);

  const error = computed(() => {
    if (pending.value || team.value) {
      return null;
    }

    return localError.value ?? new Error("Team unavailable");
  });
  const diagnostic = computed(() => {
    if (!error.value) {
      return null;
    }

    return localError.value ? "TEAM_PROFILE_READ_FAILED" : "TEAM_NOT_FOUND";
  });

  return { team, pending, error, diagnostic, refresh };
};
