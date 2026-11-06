/**
 * Reactive recent-changes feed over local `field_version_events`.
 *
 * Groups adjacent answer edits by actor and question, then enriches entries
 * with display metadata from the review workspace.
 *
 * Re-queries whenever `lastSyncAt` changes (after each pull cycle).
 */
import { computed, ref, watch, watchEffect, type MaybeRef, toValue } from "vue";
import { and, desc, eq, like, or } from "drizzle-orm";
import { withDatabase } from "~/local-db";
import { fieldVersionEvents } from "#shared/db/schema/field-version";
import { localOutbox } from "#shared/db/schema/sync";
import { lastSyncAt } from "~/composables/sync/useSyncClient";
import { localWriteAt } from "~/services/sync/pushTrigger";
import {
  derivePillarSlug,
  groupRecentChangeEntries,
  parseAnswer,
  parseRaw,
  type RecentChangeTrailEntry,
} from "~/composables/sync/fieldVersionChangeFeed";
import type { ReviewWorkspace } from "~/models/workspace";
import { formatQuestionReference } from "~/utils/questionReference";

const PAGE_SIZE = 10;

export {
  derivePillarSlug,
  groupRecentChangeEntries,
  type RecentChangeEntry,
  type RecentChangeTrailEntry,
} from "~/composables/sync/fieldVersionChangeFeed";

/**
 * Returns the ISO timestamp of the most recently synced field change for a
 * review, or null if no field_version_events exist. Used by ReviewMetrics to keep
 * the "Last Activity" card accurate even when review.updatedAt is stale.
 */
export async function getLatestSyncActivityAt(
  reviewId: string
): Promise<string | null> {
  if (!import.meta.client) return null;
  try {
    const rows = await withDatabase((db) =>
      db
        .select({ updatedAt: fieldVersionEvents.updatedAt })
        .from(fieldVersionEvents)
        .where(like(fieldVersionEvents.entityId, `${reviewId}:%`))
        .orderBy(desc(fieldVersionEvents.updatedAt))
        .limit(1)
    );
    return (rows[0] as { updatedAt?: string } | undefined)?.updatedAt ?? null;
  } catch {
    return null;
  }
}

export function useFieldVersions(
  reviewId: MaybeRef<string>,
  workspace?: MaybeRef<ReviewWorkspace | null>
) {
  const rawEntries = ref<RecentChangeTrailEntry[]>([]);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const hasMore = ref(false);
  /** Tracks how many raw DB rows have been consumed across all loads. */
  const rawOffset = ref(0);

  const entries = computed(() => groupRecentChangeEntries(rawEntries.value));

  const fetchRawRows = async (
    offset: number,
    limit: number
  ): Promise<RecentChangeTrailEntry[]> => {
    const id = toValue(reviewId);
    if (!id || !import.meta.client) return [];

    const prefix = `${id}:%`;

    const [rows, failedItems] = await withDatabase(async (db) => {
      const fvRows = await db
        .select()
        .from(fieldVersionEvents)
        .where(
          and(
            like(fieldVersionEvents.entityId, prefix),
            eq(fieldVersionEvents.fieldName, "answer")
          )
        )
        .orderBy(desc(fieldVersionEvents.updatedAt))
        .limit(limit)
        .offset(offset);

      const conflicts = await db
        .select({ id: localOutbox.id })
        .from(localOutbox)
        .where(
          and(
            like(localOutbox.entityId, prefix),
            eq(localOutbox.status, "failed"),
            or(
              eq(localOutbox.lastError, "hlc_conflict"),
              eq(localOutbox.lastError, "partial_hlc_conflict")
            )
          )
        );

      return [fvRows, conflicts] as const;
    });

    // Match by outbox ID → field_version_events.eventId (exact row that was rejected)
    const overriddenEventIds = new Set(failedItems.map((r) => r.id));

    return rows.map((row) => {
      const questionId = row.entityId.split(":").slice(1).join(":");
      const prevRaw = row.previousValue ?? null;
      return {
        id: row.id,
        entityId: row.entityId,
        questionId,
        pillarSlug: derivePillarSlug(questionId),
        answer: parseAnswer(row.value),
        previousAnswer: parseAnswer(prevRaw),
        rawAnswer: parseRaw(row.value),
        rawPreviousAnswer: parseRaw(prevRaw),
        actorId: row.actorId,
        updatedAt: row.updatedAt,
        hlc: row.hlc,
        isConflict: overriddenEventIds.has(row.eventId),
      };
    });
  };

  /** Adds question text, reference, and grouping labels from the workspace. */
  const enrichWithWorkspace = () => {
    try {
      const ws = toValue(workspace);
      if (!ws) return; // workspace not yet loaded — skip enrichment
      // Build templateId → name lookup
      const templateNameById = new Map(
        ws.templateRevisions.map((revision) => [revision.id, revision.name])
      );
      // Build questionId → {text, pillarName, templateName, checklistItems}
      const map = new Map<
        string,
        {
          text: string;
          questionReference: string | null;
          pillarName: string;
          templateName: string;
          checklistItems: { id: string; text: string }[];
        }
      >();
      for (const pillar of ws.pillars) {
        // pillar.id format: "templateId:pillarSlug" (or bare slug from API)
        const templateName =
          templateNameById.get(pillar.templateRevisionId) ?? "";
        for (const q of pillar.questions) {
          map.set(q.id, {
            text: q.text,
            questionReference: formatQuestionReference(pillar.slug, q.orderKey),
            pillarName: pillar.name,
            templateName,
            checklistItems: (
              (q as { checklistItems?: { id: string; text: string }[] })
                .checklistItems ?? []
            ).map((item) => ({ id: item.id, text: item.text })),
          });
        }
      }
      if (map.size === 0) return;
      rawEntries.value = rawEntries.value.map((e) => {
        const info = map.get(e.questionId);
        return info
          ? {
              ...e,
              questionText: info.text,
              questionReference: info.questionReference,
              pillarName: info.pillarName,
              templateName: info.templateName,
              checklistItems: info.checklistItems,
            }
          : e;
      });
    } catch {
      // best-effort — feed still works with question IDs only
    }
  };

  /**
   * Fetches raw rows iteratively until PAGE_SIZE grouped entries are produced
   * or data is exhausted. Uses `grouped.length > PAGE_SIZE` (strictly greater)
   * so the PAGE_SIZE-th group is guaranteed complete — a new group has started
   * after it, confirming the boundary.
   */
  const fetchUntilFull = async (
    startOffset: number
  ): Promise<{ rows: RecentChangeTrailEntry[]; exhausted: boolean }> => {
    const collected: RecentChangeTrailEntry[] = [];
    let currentOffset = startOffset;

    while (true) {
      const batch = await fetchRawRows(currentOffset, PAGE_SIZE + 1);
      const exhausted = batch.length <= PAGE_SIZE;
      collected.push(...batch.slice(0, PAGE_SIZE));
      currentOffset += Math.min(batch.length, PAGE_SIZE);

      const grouped = groupRecentChangeEntries(collected);
      if (grouped.length > PAGE_SIZE || exhausted) {
        return { rows: collected, exhausted };
      }
    }
  };

  const refresh = async () => {
    const id = toValue(reviewId);
    if (!id || !import.meta.client) return;
    isLoading.value = true;
    rawOffset.value = 0;
    try {
      const { rows, exhausted } = await fetchUntilFull(0);
      const grouped = groupRecentChangeEntries(rows);
      const visible = grouped.slice(0, PAGE_SIZE);
      const rawConsumed = visible.reduce((sum, e) => sum + e.changeCount, 0);
      hasMore.value = !exhausted || rows.length > rawConsumed;
      rawOffset.value = rawConsumed;
      rawEntries.value = rows.slice(0, rawConsumed);
      if (rawEntries.value.length > 0) {
        void enrichWithWorkspace();
      }
    } catch {
      // Change feed is best-effort
    } finally {
      isLoading.value = false;
    }
  };

  const loadMore = async () => {
    if (isLoadingMore.value || !hasMore.value) return;
    const id = toValue(reviewId);
    if (!id) return;
    isLoadingMore.value = true;
    try {
      const { rows, exhausted } = await fetchUntilFull(rawOffset.value);
      if (rows.length === 0) {
        hasMore.value = false;
        return;
      }
      const grouped = groupRecentChangeEntries(rows);
      const visible = grouped.slice(0, PAGE_SIZE);
      const rawConsumed = visible.reduce((sum, e) => sum + e.changeCount, 0);
      hasMore.value = !exhausted || rows.length > rawConsumed;
      rawOffset.value += rawConsumed;
      const newRawEntries = rows.slice(0, rawConsumed);
      rawEntries.value = [...rawEntries.value, ...newRawEntries];
      if (newRawEntries.length > 0) {
        void enrichWithWorkspace();
      }
    } catch {
      // Best-effort
    } finally {
      isLoadingMore.value = false;
    }
  };

  watchEffect(() => {
    void refresh();
  });

  watch(lastSyncAt, () => {
    void refresh();
  });

  // Also refresh on local writes (triggerPush increments localWriteAt).
  // This makes Recent Changes update immediately on local saves even when
  // the sync backend is unreachable.
  watch(localWriteAt, () => {
    void refresh();
  });

  // Re-run enrichment when workspace resolves after entries are already loaded.
  // This covers the race where refresh() fires before the workspace is ready.
  if (workspace) {
    watch(
      () => toValue(workspace),
      (ws) => {
        if (ws && rawEntries.value.length > 0) {
          enrichWithWorkspace();
        }
      }
    );
  }

  /** ISO timestamp of the most recently updated field_version entry, if any. */
  const latestActivityAt = computed(() =>
    entries.value.length > 0 ? entries.value[0]!.updatedAt : null
  );

  return {
    entries,
    isLoading,
    isLoadingMore,
    hasMore,
    refresh,
    loadMore,
    latestActivityAt,
  };
}
