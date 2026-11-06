/**
 * Pending review queue composable.
 *
 * Manages items that need human attention after:
 * - Access revoked during reconnect
 * - Conflict detected during sync
 * - Rejected by server
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import {
  withDatabase,
  safeParse,
  firstOrNull,
  eq,
  isNull,
  desc,
} from "~/local-db";
import type { pendingReviewResolution } from "#shared/db/schema";
import { pendingReviewQueue } from "#shared/db/schema";
import { pendingQueueService } from "~/services/sync/PendingQueueService";

// Derive types from schema consts
type PendingReviewResolution = (typeof pendingReviewResolution)[number];

// Types
export type PendingReviewItem = typeof pendingReviewQueue.$inferSelect;
export type Resolution = PendingReviewResolution;

// Parsed item type with JSON parsed
export interface ParsedPendingReviewItem extends Omit<
  PendingReviewItem,
  "localPayload" | "remotePayload"
> {
  localPayload: Record<string, unknown> | null;
  remotePayload: Record<string, unknown> | null;
}

/**
 * Parse JSON fields in pending review item.
 */
function parsePendingReviewItem(
  item: PendingReviewItem
): ParsedPendingReviewItem {
  return {
    ...item,
    localPayload: safeParse<Record<string, unknown> | null>(
      item.localPayload,
      null
    ),
    remotePayload: safeParse<Record<string, unknown> | null>(
      item.remotePayload,
      null
    ),
  };
}

/**
 * Get all pending review items for the current actor.
 */
export function usePendingReviewItems(): {
  items: ComputedRef<ParsedPendingReviewItem[]>;
  count: ComputedRef<number>;
  byReason: ComputedRef<Record<string, ParsedPendingReviewItem[]>>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const data = ref<PendingReviewItem[]>([]);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      await withDatabase(async (db) => {
        const result = await db
          .select()
          .from(pendingReviewQueue)
          .where(isNull(pendingReviewQueue.resolvedAt))
          .orderBy(desc(pendingReviewQueue.createdAt));

        data.value = result;
      });
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Initial fetch
  refresh();

  const items = computed<ParsedPendingReviewItem[]>(() =>
    data.value.map(parsePendingReviewItem)
  );

  const count = computed(() => items.value.length);

  const byReason = computed(() => {
    const result: Record<string, ParsedPendingReviewItem[]> = {
      access_revoked: [],
      conflict: [],
      rejected: [],
    };

    for (const item of items.value) {
      const list = result[item.reason];
      if (list) list.push(item);
    }

    return result;
  });

  return {
    items,
    count,
    byReason,
    error,
    isLoading,
    refresh,
  };
}

/**
 * Get a single pending review item.
 */
export function usePendingReviewItem(itemId: string): {
  item: ComputedRef<ParsedPendingReviewItem | null>;
  error: Ref<Error | null>;
  isLoading: Ref<boolean>;
  refresh: () => Promise<void>;
} {
  const data = ref<PendingReviewItem | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);

  async function refresh(): Promise<void> {
    if (!itemId) {
      data.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;
    try {
      await withDatabase(async (db) => {
        const result = await db
          .select()
          .from(pendingReviewQueue)
          .where(eq(pendingReviewQueue.id, itemId))
          .limit(1);

        data.value = firstOrNull(result);
      });
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e));
    } finally {
      isLoading.value = false;
    }
  }

  // Initial fetch
  refresh();

  const item = computed<ParsedPendingReviewItem | null>(() =>
    data.value ? parsePendingReviewItem(data.value) : null
  );

  return {
    item,
    error,
    isLoading,
    refresh,
  };
}

/**
 * Resolve a pending review item.
 */
export async function resolvePendingReviewItem(
  itemId: string,
  resolution: Resolution
): Promise<void> {
  return pendingQueueService.resolveItem(itemId, resolution);
}

/**
 * Discard a pending review item (delete without applying).
 */
export async function discardPendingReviewItem(itemId: string): Promise<void> {
  return pendingQueueService.discardItem(itemId);
}

/**
 * Get the local payload for a pending item.
 */
export async function getLocalPayload(
  itemId: string
): Promise<Record<string, unknown> | null> {
  return pendingQueueService.getLocalPayload(itemId);
}
