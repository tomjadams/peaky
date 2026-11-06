/**
 * Local-first team state composable.
 *
 * Provides reactive access to teams stored in the local database.
 *
 * Mutation operations (create, fetchAll, fetchById) are in
 * ~/services/entity/TeamMutations.ts.
 *
 * @see site/docs/development/walkthroughs/local-first-data-model-api.md
 */

import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { teamMutations } from "~/services/entity/TeamMutations";
import type { Team } from "~/models/team";

export function useLocalTeam(teamId: MaybeRef<string>): {
  team: ComputedRef<Team | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const id = computed(() => toValue(teamId));
  const data = ref<Team | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!id.value) {
      data.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      data.value = await teamMutations.fetchById(id.value);
      if (!data.value) {
        console.warn("[local-first] Team profile not found", {
          subjectReference: id.value,
          diagnostic: "TEAM_PROFILE_NOT_FOUND",
        });
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      console.error("[local-first] Team profile read failed", {
        subjectReference: id.value,
        diagnostic: "TEAM_PROFILE_READ_FAILED",
        errorName: error.value.name,
        errorMessage: error.value.message,
      });
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    id,
    (nextId) => {
      if (!nextId) {
        data.value = null;
        return;
      }

      void refresh();
    },
    { immediate: true }
  );

  return {
    team: computed(() => data.value),
    error,
    isLoading,
    refresh,
  };
}
