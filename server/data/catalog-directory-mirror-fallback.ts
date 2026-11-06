import type {
  CatalogComponent,
  CatalogDirectoryMirrorSnapshot,
  DirectoryGroup,
  DirectoryUser,
} from "#shared/catalog-directory-mirror";
import { applications } from "./applications";
import { products } from "./products";
import { reviews } from "./reviews";

const FALLBACK_TEAMS = [
  {
    id: "wd_account_management",
    name: "Account Management",
    orgId: "org-customer-experience",
    orgName: "Customer Experience",
    memberCount: 12,
  },
  {
    id: "be-internal_services",
    name: "Internal Services",
    orgId: "org-business-enablement",
    orgName: "Business Enablement",
    memberCount: 10,
  },
  {
    id: "idp-developer_portal_experience",
    name: "Developer Portal Experience - DPX",
    orgId: "org-platform-engineering",
    orgName: "Platform Engineering",
    memberCount: 8,
  },
  {
    id: "payments-scalability",
    name: "Payments Scalability",
    orgId: "org-payments",
    orgName: "Payments",
    memberCount: 14,
  },
] as const;

const FALLBACK_CATALOG_DIRECTORY_MIRROR_VERSION =
  "2026-03-20-catalog-directory-fallback-v1";

const DIRECTORY_USER_OVERRIDES: Record<string, string> = {
  heitorl: "Heitor Lessa",
  vlads: "Vlad Skuba",
  "current-user": "Current User",
};

function humanizeIdentifier(id: string): string {
  return id
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function addDirectoryUser(
  usersById: Map<string, string>,
  id: string | undefined,
  displayName?: string
): void {
  if (!id) {
    return;
  }

  const trimmedId = id.trim();

  if (!trimmedId) {
    return;
  }

  usersById.set(
    trimmedId,
    displayName?.trim() ||
      DIRECTORY_USER_OVERRIDES[trimmedId] ||
      usersById.get(trimmedId) ||
      humanizeIdentifier(trimmedId)
  );
}

function buildDirectoryUsers(): DirectoryUser[] {
  const usersById = new Map<string, string>();

  for (const [id, displayName] of Object.entries(DIRECTORY_USER_OVERRIDES)) {
    addDirectoryUser(usersById, id, displayName);
  }

  for (const product of products) {
    addDirectoryUser(usersById, product.productManagerId);
    addDirectoryUser(usersById, product.engineeringLeadId);
    addDirectoryUser(usersById, product.createdBy);
  }

  for (const review of reviews) {
    for (const participant of [
      ...review.assessors,
      ...(review.advisors ?? review.reviewers ?? []),
    ]) {
      addDirectoryUser(usersById, participant.id, participant.name);
    }
  }

  return [...usersById.entries()]
    .map(([id, displayName]) => ({ id, displayName }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildDirectoryGroups(): DirectoryGroup[] {
  return FALLBACK_TEAMS.map((team) => ({
    id: team.id,
    displayName: team.name,
    description: `${team.name} in ${team.orgName}`,
    orgId: team.orgId,
    orgName: team.orgName,
    memberCount: team.memberCount,
  })).toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

function toLifecycle(status: (typeof applications)[number]["status"]): string {
  switch (status) {
    case "ready":
      return "production";
    case "in_progress":
      return "development";
    case "action_needed":
      return "attention";
  }
}

function buildCatalogComponents(groups: DirectoryGroup[]): CatalogComponent[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return applications
    .filter((application) => !application.archived)
    .map((application) => {
      const ownerGroup = groupById.get(application.teamId);

      return {
        id: application.id,
        displayName: application.name,
        description: `${application.owner} owned application`,
        type: "application",
        ownerGroupId: application.teamId,
        ownerGroupName: ownerGroup?.displayName,
        lifecycle: toLifecycle(application.status),
        system: ownerGroup?.orgId ?? application.orgId,
      } satisfies CatalogComponent;
    })
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getFallbackCatalogDirectoryMirrorSnapshot(): CatalogDirectoryMirrorSnapshot {
  const groups = buildDirectoryGroups();

  return {
    version: FALLBACK_CATALOG_DIRECTORY_MIRROR_VERSION,
    generatedAt: new Date().toISOString(),
    users: buildDirectoryUsers(),
    groups,
    components: buildCatalogComponents(groups),
  };
}
