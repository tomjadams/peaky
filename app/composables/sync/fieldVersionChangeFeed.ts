import { isChecklist } from "~/utils/recentChangesChecklist";

const CHANGE_GROUP_WINDOW_MS = 5_000;

export interface RecentChangeTrailEntry {
  id: string;
  entityId: string;
  questionId: string;
  questionReference?: string | null;
  pillarSlug: string;
  pillarName?: string;
  templateName?: string;
  questionText?: string;
  answer: string | null;
  previousAnswer: string | null;
  rawAnswer: unknown;
  rawPreviousAnswer: unknown;
  checklistItems?: { id: string; text: string }[];
  actorId: string;
  updatedAt: string;
  hlc: string;
  isConflict: boolean;
}

export interface RecentChangeEntry extends RecentChangeTrailEntry {
  changeCount: number;
  trail: RecentChangeTrailEntry[];
}

/** Derives a pillar slug from a structured question ID like "infrastructure-q-1". */
export function derivePillarSlug(questionId: string): string {
  const match = /^(.+)-q-\d+$/.exec(questionId);
  return match?.[1] ?? questionId;
}

/** Returns the raw parsed JSON value — object/array/string/null. */
export function parseRaw(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function formatAnswer(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (isChecklist(raw)) {
    const checked = raw.checked.length;
    const na = raw.na?.length ?? 0;
    const total = checked + na;
    return na > 0 ? `${checked}/${total} checked` : `${checked} checked`;
  }
  if (Array.isArray(raw)) return `${raw.length} checked`;
  return null;
}

/** Parses the JSON-encoded field value into a display-ready answer string. */
export function parseAnswer(raw: string | null): string | null {
  return formatAnswer(parseRaw(raw));
}

function toTimeMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function areRelatedChanges(
  newer: RecentChangeTrailEntry,
  older: RecentChangeTrailEntry
): boolean {
  if (newer.entityId !== older.entityId || newer.actorId !== older.actorId) {
    return false;
  }
  const newerMs = toTimeMs(newer.updatedAt);
  const olderMs = toTimeMs(older.updatedAt);
  if (newerMs === null || olderMs === null) return false;
  return Math.abs(newerMs - olderMs) <= CHANGE_GROUP_WINDOW_MS;
}

function buildTrail(group: RecentChangeTrailEntry[]): RecentChangeTrailEntry[] {
  const chronological = group.toReversed();
  let previousRaw: unknown = chronological[0]?.rawPreviousAnswer ?? null;
  const trail: RecentChangeTrailEntry[] = [];
  for (const entry of chronological) {
    const trailEntry = {
      ...entry,
      previousAnswer: formatAnswer(previousRaw),
      rawPreviousAnswer: previousRaw,
    };
    previousRaw = entry.rawAnswer;
    trail.push(trailEntry);
  }
  return trail;
}

function mergeRecentChangeGroup(
  group: RecentChangeTrailEntry[]
): RecentChangeEntry {
  const newest = group[0]!;
  const oldest = group[group.length - 1]!;
  const trail = buildTrail(group);
  return {
    ...newest,
    previousAnswer: oldest.previousAnswer,
    rawPreviousAnswer: oldest.rawPreviousAnswer,
    isConflict: group.some((entry) => entry.isConflict),
    changeCount: group.length,
    trail,
  };
}

/**
 * Groups rows that are already sorted newest-first by updatedAt, matching the
 * SQLite query order used by the Recent Changes feed.
 */
export function groupRecentChangeEntries(
  rows: RecentChangeTrailEntry[]
): RecentChangeEntry[] {
  const groups: RecentChangeTrailEntry[][] = [];
  for (const row of rows) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (current && previous && areRelatedChanges(previous, row)) {
      current.push(row);
    } else {
      groups.push([row]);
    }
  }
  return groups.map(mergeRecentChangeGroup);
}
