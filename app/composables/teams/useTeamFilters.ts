import type { Team } from "~/models";
import { useFilterState } from "~/composables/table/useFilterState";

export const useTeamFilters = () => {
  const { searchQuery, filterStates, filterItems, resetFilters } =
    useFilterState<Team>({
      searchStateKey: "teams-search-query",
      searchFields: (team) => [team.name, team.orgName],
      filterFields: {
        org: {
          stateKey: "teams-org-filter",
          defaultValue: "all",
          match: (team, value) => team.orgId === value,
        },
      },
    });

  const orgFilter = filterStates.org;

  const filterTeams = (teams: Team[]): Team[] => filterItems(teams);

  return {
    searchQuery,
    orgFilter,
    filterTeams,
    resetFilters,
  };
};
