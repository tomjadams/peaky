import type { Team } from "../../app/models";
import type { DirectoryGroup } from "../../shared/catalog-directory-mirror";
import { getCatalogDirectoryMirrorSnapshot } from "./catalog-directory-mirror";
import { reviews } from "./reviews";

interface TeamOrgMetadata {
  orgId: string;
  orgName: string;
}

const ACTIVE_REVIEW_STATUSES = new Set(["draft", "in-progress"]);
const DEFAULT_TEAM_ORG: TeamOrgMetadata = {
  orgId: "org-external-directory",
  orgName: "External directory",
};

const TEAM_ORG_OVERRIDES: Record<string, TeamOrgMetadata> = {
  "payments-scalability": {
    orgId: "org-payments",
    orgName: "Payments",
  },
};

function getTeamDirectoryGroup(teamId: string): DirectoryGroup | undefined {
  return getCatalogDirectoryMirrorSnapshot().groups.find(
    (group) => group.id === teamId
  );
}

function deriveTeamOrg(group: DirectoryGroup): TeamOrgMetadata {
  const override = TEAM_ORG_OVERRIDES[group.id];

  if (override) {
    return override;
  }

  if (group.orgId && group.orgName) {
    return {
      orgId: group.orgId,
      orgName: group.orgName,
    };
  }

  return DEFAULT_TEAM_ORG;
}

function buildTeamMetrics(teamId: string): {
  totalReviewCount: number;
  activeReviewCount: number;
  lastActivityDate: string;
} {
  const teamReviews = reviews.filter((review) => review.teamId === teamId);
  const latestReviewDate = teamReviews
    .map((review) => review.updatedAt)
    .toSorted((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return {
    totalReviewCount: teamReviews.length,
    activeReviewCount: teamReviews.filter((review) =>
      ACTIVE_REVIEW_STATUSES.has(review.status)
    ).length,
    lastActivityDate: latestReviewDate ?? new Date().toISOString(),
  };
}

function buildTeam(group: DirectoryGroup): Team {
  const metrics = buildTeamMetrics(group.id);
  const org = deriveTeamOrg(group);

  return {
    id: group.id,
    name: group.displayName,
    orgId: org.orgId,
    orgName: org.orgName,
    memberCount: group.memberCount ?? 0,
    totalReviewCount: metrics.totalReviewCount,
    activeReviewCount: metrics.activeReviewCount,
    lastActivityDate: metrics.lastActivityDate,
  };
}

export const getTeamsWithMetrics = (): Team[] => {
  const reviewedTeamIds = new Set(reviews.map((review) => review.teamId));

  return [...reviewedTeamIds]
    .map((teamId) => getTeamDirectoryGroup(teamId))
    .filter((group): group is DirectoryGroup => Boolean(group))
    .map(buildTeam);
};

export const getTeamById = (teamId: string): Team | undefined => {
  const group = getTeamDirectoryGroup(teamId);
  return group ? buildTeam(group) : undefined;
};
