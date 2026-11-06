import type { DirectoryGroup } from "#shared/catalog-directory-mirror";

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase();
}

function scoreDirectoryGroup(group: DirectoryGroup): number {
  const id = group.id;
  const description = group.description?.toLowerCase() ?? "";

  // Legacy Workday prefixes — these are leftover duplicates and should NOT
  // be chosen as the canonical group.
  if (id.startsWith("TS_")) {
    return -10 + Math.min(group.memberCount ?? 0, 20);
  }

  if (id.startsWith("T_")) {
    return -10 + Math.min(group.memberCount ?? 0, 20);
  }

  // Explicit BE/branch-engineering groups (highest non-legacy score).
  if (id.startsWith("be-")) {
    return 70 + Math.min(group.memberCount ?? 0, 20);
  }

  // LDAP-style identifiers with hyphens/underscores are canonical.
  if (id.includes("-") || id.includes("_")) {
    return 60 + Math.min(group.memberCount ?? 0, 20);
  }

  // Descriptive Workday strings that may indicate a real team group.
  if (description.includes("workday integration: group for team")) {
    return 50 + Math.min(group.memberCount ?? 0, 20);
  }

  if (description.includes("workday integration: this group is a team group")) {
    return 40 + Math.min(group.memberCount ?? 0, 20);
  }

  return Math.min(group.memberCount ?? 0, 20);
}

export function dedupeDirectoryGroups(
  groups: DirectoryGroup[]
): DirectoryGroup[] {
  const preferredByName = new Map<string, DirectoryGroup>();

  for (const group of groups) {
    const key = normalizeDisplayName(group.displayName);
    const current = preferredByName.get(key);

    if (!current) {
      preferredByName.set(key, group);
      continue;
    }

    const candidateScore = scoreDirectoryGroup(group);
    const currentScore = scoreDirectoryGroup(current);

    if (
      candidateScore > currentScore ||
      (candidateScore === currentScore &&
        group.id.localeCompare(current.id) < 0)
    ) {
      preferredByName.set(key, group);
    }
  }

  return [...preferredByName.values()].toSorted((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

export function getDirectoryGroupAliases(
  groups: DirectoryGroup[],
  groupId: string
): string[] {
  const selected = groups.find((group) => group.id === groupId);

  if (!selected) {
    return [groupId];
  }

  const key = normalizeDisplayName(selected.displayName);

  return groups
    .filter((group) => normalizeDisplayName(group.displayName) === key)
    .map((group) => group.id);
}
