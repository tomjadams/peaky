import type {
  CatalogComponent,
  CatalogDirectoryMirrorSnapshot,
  DirectoryGroup,
  DirectoryUser,
} from "#shared/catalog-directory-mirror";

export interface LaunchpadTokenResponse {
  access_token?: string;
  token_type?: string;
}

export interface LaunchpadPaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  size?: number;
}

export interface LaunchpadSystemRead {
  id: string;
  domain: string;
  title?: string | null;
  description?: string | null;
  docs?: string | null;
  owner: string;
  additionalOwners?: string[] | null;
  tags?: string[] | null;
  dateModified: string;
  dateCreated?: string;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
}

export interface LaunchpadComponentRead {
  id: string;
  title?: string | null;
  description?: string | null;
  owner: string;
  additionalOwners?: string[] | null;
  system?: string | null;
  tags?: string[] | null;
  dateModified: string;
  dateCreated?: string;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
}

export interface LaunchpadGroupMetadataRead {
  groupName: string;
  humanReadableGroupName?: string | null;
  teamPageUrl?: string | null;
  status: string;
  primaryContact: string;
  productManagerContact?: string | null;
  dateCreated: string;
  dateModified: string;
  createdBy?: string | null;
  lastModifiedBy?: string | null;
  createdOnBehalfOf?: string | null;
  lastModifiedOnBehalfOf?: string | null;
}

export interface LaunchpadEntityRelation {
  type: string;
  targetRef: string;
}

export interface LaunchpadEntityMetadata {
  name: string;
  title?: string | null;
  description?: string | null;
}

export interface LaunchpadUserEntity {
  kind: "User" | "user";
  metadata: LaunchpadEntityMetadata;
  spec?: {
    profile?: {
      displayName?: string | null;
      email?: string | null;
    } | null;
  } | null;
}

export interface LaunchpadGroupEntity {
  kind: "Group" | "group";
  metadata: LaunchpadEntityMetadata;
  spec?: {
    type?: string | null;
    groupMetadata?: LaunchpadGroupMetadataRead | null;
  } | null;
  relations?: LaunchpadEntityRelation[] | null;
}

export interface LaunchpadSystemEntity {
  kind: "System" | "system";
  metadata: LaunchpadEntityMetadata;
  spec: {
    owner: string;
    additionalOwners?: string[] | null;
    domain: string;
  };
}

export interface BuildLaunchpadCatalogSnapshotOptions {
  systems: LaunchpadSystemRead[];
  components: LaunchpadComponentRead[];
  groupMetadata: LaunchpadGroupMetadataRead[];
  users?: LaunchpadUserEntity[];
  groups?: LaunchpadGroupEntity[];
  systemEntities?: LaunchpadSystemEntity[];
  generatedAt?: string;
  maxGroupMemberCount?: number;
  excludedGroupNames?: string[];
}

function humanizeIdentifier(id: string): string {
  return id
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeUserId(id: string | null | undefined): string | null {
  const trimmed = id?.trim();
  return trimmed ? trimmed : null;
}

function addDirectoryUser(
  usersById: Map<string, string>,
  userId: string | null | undefined,
  displayName?: string | null
): void {
  const normalizedId = normalizeUserId(userId);

  if (!normalizedId) {
    return;
  }

  usersById.set(
    normalizedId,
    displayName?.trim() ||
      usersById.get(normalizedId) ||
      humanizeIdentifier(normalizedId)
  );
}

function buildUsers(
  options: BuildLaunchpadCatalogSnapshotOptions
): DirectoryUser[] {
  const usersById = new Map<string, string>();

  for (const user of options.users ?? []) {
    addDirectoryUser(
      usersById,
      user.metadata.name,
      user.spec?.profile?.displayName ?? user.metadata.title
    );
  }

  for (const group of options.groupMetadata) {
    addDirectoryUser(usersById, group.primaryContact);
    addDirectoryUser(usersById, group.productManagerContact);
    addDirectoryUser(usersById, group.createdBy);
    addDirectoryUser(usersById, group.lastModifiedBy);
    addDirectoryUser(usersById, group.createdOnBehalfOf);
    addDirectoryUser(usersById, group.lastModifiedOnBehalfOf);
  }

  for (const system of options.systems) {
    addDirectoryUser(usersById, system.createdBy);
    addDirectoryUser(usersById, system.lastModifiedBy);
  }

  for (const component of options.components) {
    addDirectoryUser(usersById, component.createdBy);
    addDirectoryUser(usersById, component.lastModifiedBy);
  }

  return [...usersById.entries()]
    .map(([id, displayName]) => ({ id, displayName }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

// Legacy Workday-derived groups with the T_/TS_ prefixes are duplicates of
// real LDAP groups. They should be excluded from the snapshot.
const isLegacyWorkdayGroup = (id: string): boolean =>
  id.startsWith("T_") || id.startsWith("TS_");

function buildGroups(
  options: BuildLaunchpadCatalogSnapshotOptions
): DirectoryGroup[] {
  const excludedGroupNames = new Set(
    (options.excludedGroupNames ?? ["all_employees"]).map((name) =>
      name.toLowerCase()
    )
  );

  const entityGroups = (options.groups ?? [])
    .filter(
      (group) =>
        !excludedGroupNames.has(group.metadata.name.toLowerCase()) &&
        !isLegacyWorkdayGroup(group.metadata.name)
    )
    .map((group) => {
      const groupMetadata = group.spec?.groupMetadata;

      return {
        id: group.metadata.name,
        displayName:
          groupMetadata?.humanReadableGroupName?.trim() ||
          group.metadata.title?.trim() ||
          humanizeIdentifier(group.metadata.name),
        description:
          groupMetadata?.teamPageUrl ??
          group.metadata.description?.trim() ??
          `${group.metadata.name} (${groupMetadata?.status?.toLowerCase() ?? group.spec?.type ?? "unknown"})`,
        orgId: undefined,
        orgName: undefined,
        memberCount: group.relations?.filter(
          (relation) => relation.type === "hasMember"
        ).length,
      } satisfies DirectoryGroup;
    });

  if (entityGroups.length > 0) {
    return entityGroups.toSorted((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }

  return options.groupMetadata
    .filter(
      (group) =>
        !excludedGroupNames.has(group.groupName.toLowerCase()) &&
        !isLegacyWorkdayGroup(group.groupName)
    )
    .map((group) => ({
      id: group.groupName,
      displayName:
        group.humanReadableGroupName?.trim() ||
        humanizeIdentifier(group.groupName),
      description:
        group.teamPageUrl ??
        `${group.groupName} (${group.status.toLowerCase()})`,
      orgId: undefined,
      orgName: undefined,
      memberCount: undefined,
    }))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildComponents(
  options: BuildLaunchpadCatalogSnapshotOptions,
  groups: DirectoryGroup[]
): CatalogComponent[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const fallbackGroupById = new Map(
    options.groupMetadata.map((group) => [
      group.groupName,
      group.humanReadableGroupName?.trim() ||
        humanizeIdentifier(group.groupName),
    ])
  );

  // Components owned by legacy T_/TS_ groups keep their owner reference in
  // the raw snapshot so data-quality issues are visible, but ownerGroupName
  // resolves to the human-readable name when available.
  const resolveOwner = (
    ownerId: string
  ): {
    ownerGroupId: string | undefined;
    ownerGroupName: string | undefined;
  } => {
    if (isLegacyWorkdayGroup(ownerId)) {
      return {
        ownerGroupId: undefined,
        ownerGroupName: fallbackGroupById.get(ownerId),
      };
    }
    return {
      ownerGroupId: ownerId,
      ownerGroupName:
        groupById.get(ownerId)?.displayName ?? fallbackGroupById.get(ownerId),
    };
  };

  const systemEntities = options.systemEntities ?? [];

  if (systemEntities.length > 0) {
    return systemEntities
      .map((system) => {
        const owner = resolveOwner(system.spec.owner);
        const component: CatalogComponent = {
          id: system.metadata.name,
          displayName:
            system.metadata.title?.trim() ||
            humanizeIdentifier(system.metadata.name),
          description: system.metadata.description?.trim() || undefined,
          type: "system",
          ownerGroupId: owner.ownerGroupId,
          ownerGroupName: owner.ownerGroupName,
          lifecycle: undefined,
          system: system.spec.domain,
        };
        return component;
      })
      .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return options.systems
    .map((system) => {
      const owner = resolveOwner(system.owner);
      const component: CatalogComponent = {
        id: system.id,
        displayName: system.title?.trim() || humanizeIdentifier(system.id),
        description: system.description?.trim() || undefined,
        type: "system",
        ownerGroupId: owner.ownerGroupId,
        ownerGroupName: owner.ownerGroupName,
        lifecycle: undefined,
        system: system.domain,
      };
      return component;
    })
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

export function buildLaunchpadCatalogSnapshot(
  options: BuildLaunchpadCatalogSnapshotOptions
): CatalogDirectoryMirrorSnapshot {
  const groups = buildGroups(options);

  return {
    version: "launchpad-openapi-v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    users: buildUsers(options),
    groups,
    components: buildComponents(options, groups),
  };
}
