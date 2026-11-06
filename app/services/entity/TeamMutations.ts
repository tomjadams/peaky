import {
  withDatabase,
  firstOrNull,
  eq,
  or,
  desc,
  inArray,
  createUuidV7,
  nowISO,
} from "~/local-db";
import { subjects, teamProfiles, reviews } from "#shared/db/schema";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import type { Team } from "~/models/team";

type LocalTeamProfileRow = typeof teamProfiles.$inferSelect;
type LocalReviewMetricsRow = {
  subjectId: string;
  status: string;
  updatedAt: string;
};

type LocalTeamRecord = LocalTeamProfileRow & {
  subjectName: string;
};

const ACTIVE_REVIEW_STATUSES = new Set(["draft", "in-progress"]);

function buildMetricsBySubject(reviewRows: LocalReviewMetricsRow[]): Map<
  string,
  {
    totalReviewCount: number;
    activeReviewCount: number;
    lastActivityDate: string | null;
  }
> {
  const metrics = new Map<
    string,
    {
      totalReviewCount: number;
      activeReviewCount: number;
      lastActivityDate: string | null;
    }
  >();

  for (const row of reviewRows) {
    const current = metrics.get(row.subjectId) ?? {
      totalReviewCount: 0,
      activeReviewCount: 0,
      lastActivityDate: null,
    };

    current.totalReviewCount += 1;
    if (ACTIVE_REVIEW_STATUSES.has(row.status)) {
      current.activeReviewCount += 1;
    }

    current.lastActivityDate =
      current.lastActivityDate === null ||
      new Date(row.updatedAt).getTime() >
        new Date(current.lastActivityDate).getTime()
        ? row.updatedAt
        : current.lastActivityDate;

    metrics.set(row.subjectId, current);
  }

  return metrics;
}

function toTeam(
  record: LocalTeamRecord,
  metricsBySubject: Map<
    string,
    {
      totalReviewCount: number;
      activeReviewCount: number;
      lastActivityDate: string | null;
    }
  >
): Team {
  const metrics = metricsBySubject.get(record.subjectId);

  return {
    id: record.subjectId,
    name: record.subjectName,
    orgId: record.orgId,
    orgName: record.orgName,
    memberCount: record.memberCount,
    totalReviewCount: metrics?.totalReviewCount ?? 0,
    activeReviewCount: metrics?.activeReviewCount ?? 0,
    lastActivityDate: metrics?.lastActivityDate ?? record.updatedAt,
  };
}

async function fetchLocalTeamRecords(
  teamId?: string
): Promise<LocalTeamRecord[]> {
  return withDatabase(async (db) => {
    const baseQuery = db
      .select({
        id: teamProfiles.id,
        subjectId: teamProfiles.subjectId,
        orgId: teamProfiles.orgId,
        orgName: teamProfiles.orgName,
        memberCount: teamProfiles.memberCount,
        createdBy: teamProfiles.createdBy,
        createdAt: teamProfiles.createdAt,
        updatedAt: teamProfiles.updatedAt,
        subjectName: subjects.name,
      })
      .from(teamProfiles)
      .innerJoin(subjects, eq(subjects.id, teamProfiles.subjectId))
      .orderBy(desc(teamProfiles.updatedAt));

    if (!teamId) {
      return baseQuery;
    }

    return baseQuery
      .where(or(eq(teamProfiles.subjectId, teamId), eq(subjects.slug, teamId)))
      .limit(1);
  });
}

async function fetchReviewMetrics(subjectIds: string[]): Promise<
  Map<
    string,
    {
      totalReviewCount: number;
      activeReviewCount: number;
      lastActivityDate: string | null;
    }
  >
> {
  if (subjectIds.length === 0) {
    return new Map();
  }

  const reviewRows = await withDatabase(async (db) => {
    return db
      .select({
        subjectId: reviews.subjectId,
        status: reviews.status,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(inArray(reviews.subjectId, subjectIds));
  });

  return buildMetricsBySubject(reviewRows);
}

export class TeamMutations {
  async fetchAll(): Promise<Team[]> {
    const records = await fetchLocalTeamRecords();
    const metricsBySubject = await fetchReviewMetrics(
      records.map((record) => record.subjectId)
    );

    return records.map((record) => toTeam(record, metricsBySubject));
  }

  /**
   * Ensure a team exists in the local database.
   *
   * Called when creating a review for a catalog team that has no local record yet.
   * Uses INSERT OR IGNORE semantics so repeated calls are safe.
   */
  /**
   * Ensure a team exists in the local database.
   *
   * Called when creating a review for a catalog team that has no local record yet.
   * Uses INSERT OR IGNORE semantics so repeated calls are safe.
   *
   * @param input.id   - Canonical catalog ID (e.g., "payments-scalability")
   * @param input.slug - URL-friendly identifier used in routes (e.g., "payments-scalability")
   */
  async upsert(input: {
    id: string;
    slug?: string;
    name: string;
    orgId: string;
    orgName: string;
    memberCount: number;
  }): Promise<void> {
    const actor = readPersistedActor();
    const now = nowISO();

    // Unit of Work: two sequential idempotent writes grouped in a single DB callback.
    // subjects uses INSERT OR IGNORE (onConflictDoNothing) on its primary key.
    // teamProfiles has no unique-on-subjectId constraint, so we check first to avoid
    // inserting orphan rows with a throwaway UUID on every repeated call.
    await withDatabase(async (db) => {
      await db
        .insert(subjects)
        .values({
          id: input.id,
          type: "team",
          name: input.name,
          slug: input.slug ?? input.id,
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      const existing = await db
        .select({ id: teamProfiles.id })
        .from(teamProfiles)
        .where(eq(teamProfiles.subjectId, input.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(teamProfiles).values({
          id: createUuidV7(),
          subjectId: input.id,
          orgId: input.orgId,
          orgName: input.orgName,
          memberCount: input.memberCount,
          createdBy: actor.id,
          createdAt: now,
          updatedAt: now,
        });
      }
    });
  }

  async fetchById(teamId: string): Promise<Team | null> {
    const records = await fetchLocalTeamRecords(teamId);
    const record = firstOrNull(records);

    if (!record) {
      return null;
    }

    const metricsBySubject = await fetchReviewMetrics([record.subjectId]);
    return toTeam(record, metricsBySubject);
  }
}

export const teamMutations = new TeamMutations();
