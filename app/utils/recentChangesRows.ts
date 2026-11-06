import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";

export function toTableRow(entry: RecentChangeEntry): Record<string, unknown> {
  return Object.assign({}, entry, { _key: entry.id }) as unknown as Record<
    string,
    unknown
  >;
}

function isRecentChangeEntry(row: unknown): row is RecentChangeEntry {
  if (typeof row !== "object" || row === null) return false;
  const candidate = row as Partial<RecentChangeEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.entityId === "string" &&
    typeof candidate.questionId === "string" &&
    typeof candidate.pillarSlug === "string" &&
    typeof candidate.actorId === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.hlc === "string" &&
    typeof candidate.isConflict === "boolean" &&
    typeof candidate.changeCount === "number" &&
    Array.isArray(candidate.trail)
  );
}

export function toRecentChangeEntry(row: unknown): RecentChangeEntry {
  if (!isRecentChangeEntry(row)) {
    throw new TypeError("Invalid Recent Changes row");
  }
  return row;
}

export function actorDisplayName(actorId: string): string {
  const stripped = actorId.replace(/^actor_/, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function resolveActorDisplayName(
  actorId: string,
  currentActor: { id: string; name: string },
  catalogDisplayName?: string
): string {
  return (
    catalogDisplayName ??
    (actorId === currentActor.id
      ? currentActor.name
      : actorDisplayName(actorId))
  );
}
