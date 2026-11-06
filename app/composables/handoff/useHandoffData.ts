/**
 * Composable that hydrates the handoff state for one review
 * (improvement-plans/REQ-005 through REQ-008; local-first/REQ-011).
 *
 * Loads the review's synchronized practice rows and append-only
 * association stream from the local SQLite database and decodes them with
 * the persistence codecs — the same rows the sync engine maintains. The UI
 * projects from these and never writes tables directly; refresh replays
 * the read after every write-path mutation.
 */

import {
  eq,
  localReviewHandoffs,
  reviewHandoffAssociations,
  reviewHandoffPractices,
  waitForLocalDbReady,
  withDatabase,
} from "~/local-db";
import type { AssociationTransition } from "~/services/handoff/association";
import type { HandoffPracticeRecord } from "~/services/handoff/draft";
import {
  localHandoffFromRow,
  projectLocalHandoffAnalytics,
  resolveActiveLocalHandoff,
  type LocalReviewHandoffRecord,
} from "~/services/handoff/localLifecycle";
import {
  associationTransitionFromRow,
  handoffPracticeFromRow,
} from "~/services/handoff/persistence";

export function useHandoffData(reviewId: MaybeRef<string>) {
  const allRows = ref<readonly HandoffPracticeRecord[]>([]);
  const handoffs = ref<readonly LocalReviewHandoffRecord[]>([]);
  const history = ref<readonly AssociationTransition[]>([]);
  const loading = ref(true);

  const activeHandoff = computed(() =>
    resolveActiveLocalHandoff(handoffs.value, toValue(reviewId))
  );
  const rows = computed<readonly HandoffPracticeRecord[]>(() => {
    const activeId = activeHandoff.value?.id;
    return activeId
      ? allRows.value.filter((row) => row.localHandoffId === activeId)
      : [];
  });
  const ownedPracticeIds = computed<ReadonlySet<string>>(
    () =>
      new Set(
        allRows.value
          .filter((row) => row.localHandoffId !== null)
          .map((row) => row.id)
      )
  );
  const previouslyHandedOffIds = computed<ReadonlySet<string>>(
    () =>
      new Set(
        handoffs.value
          .filter((handoff) => handoff.status === "completed")
          .flatMap((handoff) => handoff.selectedPracticeIds)
      )
  );
  const analytics = computed(() =>
    handoffs.value.map(projectLocalHandoffAnalytics)
  );

  const fetchHandoff = async () => {
    if (import.meta.server) return;
    await waitForLocalDbReady();
    loading.value = true;
    try {
      const id = toValue(reviewId);
      const [practiceRows, associationRows, lifecycleRows] = await withDatabase(
        (db) =>
          Promise.all([
            db
              .select()
              .from(reviewHandoffPractices)
              .where(eq(reviewHandoffPractices.reviewId, id)),
            db
              .select()
              .from(reviewHandoffAssociations)
              .where(eq(reviewHandoffAssociations.reviewId, id)),
            db
              .select()
              .from(localReviewHandoffs)
              .where(eq(localReviewHandoffs.reviewId, id)),
          ])
      );
      allRows.value = practiceRows.map(handoffPracticeFromRow);
      history.value = associationRows.map(associationTransitionFromRow);
      handoffs.value = lifecycleRows
        .map(localHandoffFromRow)
        .toSorted((left, right) => left.sequence - right.sequence);
    } finally {
      loading.value = false;
    }
  };

  watch(() => toValue(reviewId), fetchHandoff, { immediate: true });

  return {
    rows,
    ownedPracticeIds,
    previouslyHandedOffIds,
    activeHandoff,
    analytics,
    history,
    loading,
    refresh: fetchHandoff,
  };
}
