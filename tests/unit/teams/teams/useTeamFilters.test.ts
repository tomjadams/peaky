import { beforeEach, describe, expect, it } from "vitest";
import type { Team } from "~/models";
import { useTeamFilters } from "~/composables/teams/useTeamFilters";

describe("useTeamFilters", () => {
  const mockTeams: Team[] = [
    {
      id: "team-1",
      name: "Customer Portal",
      orgId: "org-cx",
      orgName: "Customer Experience",
      memberCount: 12,
      totalReviewCount: 3,
      activeReviewCount: 2,
      lastActivityDate: "2026-02-20T00:00:00Z",
    },
    {
      id: "team-2",
      name: "API Foundation",
      orgId: "org-pe",
      orgName: "Platform Engineering",
      memberCount: 10,
      totalReviewCount: 1,
      activeReviewCount: 1,
      lastActivityDate: "2026-02-12T00:00:00Z",
    },
    {
      id: "team-3",
      name: "Reporting",
      orgId: "org-fp",
      orgName: "Financial Products",
      memberCount: 8,
      totalReviewCount: 1,
      activeReviewCount: 0,
      lastActivityDate: "2026-02-14T00:00:00Z",
    },
  ];

  let filterTeams: ReturnType<typeof useTeamFilters>["filterTeams"];
  let searchQuery: ReturnType<typeof useTeamFilters>["searchQuery"];
  let orgFilter: ReturnType<typeof useTeamFilters>["orgFilter"];
  let resetFilters: ReturnType<typeof useTeamFilters>["resetFilters"];

  beforeEach(() => {
    const composable = useTeamFilters();
    filterTeams = composable.filterTeams;
    searchQuery = composable.searchQuery;
    orgFilter = composable.orgFilter;
    resetFilters = composable.resetFilters;
    resetFilters();
  });

  it("returns all teams with no filters", () => {
    expect(filterTeams(mockTeams)).toHaveLength(3);
  });

  it("filters by organization", () => {
    orgFilter.value = "org-cx";
    const result = filterTeams(mockTeams);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("team-1");
  });

  it("filters by search query on team name", () => {
    searchQuery.value = "api";
    const result = filterTeams(mockTeams);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("team-2");
  });

  it("filters by search query on org name", () => {
    searchQuery.value = "financial";
    const result = filterTeams(mockTeams);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("team-3");
  });

  it("combines organization and search filters", () => {
    orgFilter.value = "org-cx";
    searchQuery.value = "customer";
    const result = filterTeams(mockTeams);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("team-1");
  });

  it("resets filters", () => {
    searchQuery.value = "portal";
    orgFilter.value = "org-cx";

    resetFilters();

    expect(searchQuery.value).toBe("");
    expect(orgFilter.value).toBe("all");
  });
});
