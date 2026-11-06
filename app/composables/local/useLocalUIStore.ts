/**
 * UI orchestration store for local-first state.
 *
 * This store manages transient UI state only:
 * - selected tabs, active pillars, temporary filters
 * - pending-sync banners and connection-status hints
 * - review-queue UI state for changes that need human attention
 *
 * IMPORTANT: Domain truth lives in local SQLite, not here.
 * Do NOT store reviews, answers, products, or templates here.
 *
 * @see site/docs/development/walkthroughs/local-first-architecture.md
 */

import { ref, computed } from "vue";

// Connection state
const isOnline = ref(true);
const lastSyncAt = ref<Date | null>(null);
const pendingChangesCount = ref(0);

// Active review state (UI only, not domain data)
const activeReviewId = ref<string | null>(null);
const activePillarSlug = ref<string | null>(null);
const activeQuestionId = ref<string | null>(null);

// Filter state
const reviewFilters = ref<{
  status?: string[];
  subjectId?: string;
}>({});

// Review queue state (for items needing attention)
const reviewQueueExpanded = ref(false);

// Sync status for UI feedback
const syncStatus = ref<
  "synced" | "syncing" | "pending" | "error" | "has_downgrades"
>("synced");

/**
 * UI store for local-first app.
 * Manages transient UI state, not persisted domain truth.
 */
export function useLocalUIStore() {
  // Connection state
  const connectionStatus = computed(() => ({
    isOnline: isOnline.value,
    lastSyncAt: lastSyncAt.value,
    pendingChanges: pendingChangesCount.value,
    hasPendingChanges: pendingChangesCount.value > 0,
  }));

  function setOnline(online: boolean): void {
    isOnline.value = online;
  }

  function setLastSyncAt(date: Date): void {
    lastSyncAt.value = date;
  }

  function setPendingChangesCount(count: number): void {
    pendingChangesCount.value = count;
  }

  // Active review state
  const activeReview = computed(() => ({
    reviewId: activeReviewId.value,
    pillarSlug: activePillarSlug.value,
    questionId: activeQuestionId.value,
  }));

  function setActiveReview(reviewId: string | null): void {
    activeReviewId.value = reviewId;
    activePillarSlug.value = null;
    activeQuestionId.value = null;
  }

  function setActivePillar(slug: string | null): void {
    activePillarSlug.value = slug;
    activeQuestionId.value = null;
  }

  function setActiveQuestion(questionId: string | null): void {
    activeQuestionId.value = questionId;
  }

  // Filter state
  function setReviewFilters(filters: typeof reviewFilters.value): void {
    reviewFilters.value = filters;
  }

  function clearReviewFilters(): void {
    reviewFilters.value = {};
  }

  // Review queue state
  function toggleReviewQueue(): void {
    reviewQueueExpanded.value = !reviewQueueExpanded.value;
  }

  function setReviewQueueExpanded(expanded: boolean): void {
    reviewQueueExpanded.value = expanded;
  }

  // Sync status
  function setSyncStatus(status: typeof syncStatus.value): void {
    syncStatus.value = status;
  }

  return {
    // Connection
    connectionStatus,
    setOnline,
    setLastSyncAt,
    setPendingChangesCount,

    // Active review
    activeReview,
    setActiveReview,
    setActivePillar,
    setActiveQuestion,

    // Filters
    reviewFilters,
    setReviewFilters,
    clearReviewFilters,

    // Review queue
    reviewQueueExpanded,
    toggleReviewQueue,
    setReviewQueueExpanded,

    // Sync status
    syncStatus,
    setSyncStatus,
  };
}
