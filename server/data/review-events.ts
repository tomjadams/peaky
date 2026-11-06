/**
 * Review event storage - append-only audit log.
 *
 * Events explain how state changed, while current-state tables show what is true now.
 * This provides CloudTrail-like auditability and enables history derivation.
 *
 * @see site/docs/development/walkthroughs/local-first-auditing.md
 */
import { notifyAdminEventsUpdated } from "./admin-events-stream";
import { findPublishedTemplateRevisionDetail } from "./templates";

export type ActorType = "user" | "integration" | "system";
export type EventStatus = "pending" | "synced" | "failed";

// Event type constants
export const EVENT_TYPES = {
  REVIEW_CREATED: "ReviewCreated.v1",
  REVIEW_ARCHIVED: "ReviewArchived.v1",
  REVIEW_RESTORED: "ReviewRestored.v1",
  REVIEW_DELETED: "ReviewDeleted.v1",
  ANSWER_RECORDED: "ReviewAnswerRecorded.v1",
  ANSWER_IMPORTED: "ReviewAnswerImported.v1",
  NOTE_RECORDED: "ReviewNoteRecorded.v1",
  NOTE_DELETED: "ReviewNoteDeleted.v1",
  ATTACHMENT_UPLOADED: "ReviewAttachmentUploaded.v1",
  ATTACHMENT_DELETED: "ReviewAttachmentDeleted.v1",
  PROGRESS_UPDATED: "ReviewProgressUpdated.v1",
  CHECKPOINT_SAVED: "ReviewCheckpointSaved.v1",
  PARTICIPANT_ADDED: "ReviewParticipantAdded.v1",
  PARTICIPANT_REMOVED: "ReviewParticipantRemoved.v1",
  SCORE_RECOMPUTED: "ReviewScoreRecomputed.v1",
  PERMISSION_DOWNGRADED: "ReviewPermissionDowngraded.v1",
  PUBLISH_COMPLETED: "ReviewPublishCompleted.v1",
} as const;

export type ReviewEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface ReviewEvent {
  id: string;
  reviewId: string;
  eventType: ReviewEventType;
  actorType: ActorType;
  actorId: string;
  actorName?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  time: string;
  status: EventStatus;
  syncedAt?: string;
  /** Set when a GDPR right-to-erasure request has been applied to this event. */
  piiRedactedAt?: string;
  /** Actor ID of the admin who processed the erasure. */
  piiRedactedBy?: string;
}

const importedQuestionIds = [
  "01932b3c-7d00-7000-8000-000000001001",
  "01932b3c-7d00-7000-8000-000000001004",
].flatMap(
  (templateId) =>
    findPublishedTemplateRevisionDetail(templateId)?.pillars.flatMap((pillar) =>
      pillar.questions.map((question) => question.id)
    ) ?? []
);

// In-memory event store (seeded + runtime)
const seedEvents: ReviewEvent[] = [
  // Session 1: Reliability and resilience
  {
    id: "01932b3c-7d00-7000-8000-000000006001",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: "vlads",
    actorName: "Vlad Skuba",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      note: "Completed all reliability and resilience questions",
      questionsAnswered: 3,
      questionsChanged: 0,
      progressDelta: 30,
      overallProgress: 30,
    },
    time: "2025-10-15T14:30:00Z",
    status: "synced",
    syncedAt: "2025-10-15T14:30:05Z",
  },
  // Session 2: Observability and response started
  {
    id: "01932b3c-7d00-7000-8000-000000006002",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: "heitorl",
    actorName: "Heitor Lessa",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      note: "Started observability and response assessment",
      questionsAnswered: 1,
      questionsChanged: 0,
      progressDelta: 10,
      overallProgress: 40,
    },
    time: "2025-11-03T10:15:00Z",
    status: "synced",
    syncedAt: "2025-11-03T10:15:05Z",
  },
  // Session 3: PCI-DSS template work
  {
    id: "01932b3c-7d00-7000-8000-000000006003",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: "vlads",
    actorName: "Vlad Skuba",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      note: "Initial PCI-DSS assessment",
      questionsAnswered: 6,
      questionsChanged: 0,
      progressDelta: 43,
      overallProgress: 83,
      templateId: "01932b3c-7d00-7000-8000-000000001002",
    },
    time: "2025-11-10T11:20:00Z",
    status: "synced",
    syncedAt: "2025-11-10T11:20:05Z",
  },
  // Session 4: More observability + change safety
  {
    id: "01932b3c-7d00-7000-8000-000000006004",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: "vladk",
    actorName: "Vlad Kostiuk",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      note: "Expanded observability and started change safety review",
      questionsAnswered: 2,
      questionsChanged: 0,
      progressDelta: 4,
      overallProgress: 87,
    },
    time: "2025-11-20T16:45:00Z",
    status: "synced",
    syncedAt: "2025-11-20T16:45:05Z",
  },
  // Answer import event with provenance
  {
    id: "01932b3c-7d00-7000-8000-000000006005",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.ANSWER_IMPORTED,
    actorType: "integration",
    actorId: "ci-cd-pipeline",
    actorName: "CI/CD Pipeline",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      source: "ci-cd",
      runId: "pipeline-1842",
      importedCount: importedQuestionIds.length,
      mode: "draft-fill",
      questionIds: importedQuestionIds,
    },
    metadata: {
      confidence: 0.81,
      evidence: [
        "https://github.com/org/repo/commit/abc123",
        "https://docs.internal/security-policy.md",
      ],
    },
    time: "2025-12-10T08:00:00Z",
    status: "synced",
    syncedAt: "2025-12-10T08:00:05Z",
  },
  // Session 5: More PCI-DSS
  {
    id: "01932b3c-7d00-7000-8000-000000006006",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    eventType: EVENT_TYPES.CHECKPOINT_SAVED,
    actorType: "user",
    actorId: "heitorl",
    actorName: "Heitor Lessa",
    data: {
      reviewName: "2026 Operational Readiness Review",
      teamId: "payments-scalability",
      note: "Completed PCI-DSS assessment",
      questionsAnswered: 2,
      questionsChanged: 0,
      progressDelta: 13,
      overallProgress: 100,
      templateId: "01932b3c-7d00-7000-8000-000000001002",
    },
    time: "2025-12-12T09:15:00Z",
    status: "synced",
    syncedAt: "2025-12-12T09:15:05Z",
  },
];

// Runtime events (created at runtime, survive browser refresh)
const runtimeEvents: ReviewEvent[] = [];
let eventCounter = seedEvents.length;

/**
 * Add a new event to the append-only log.
 */
export function addEvent(
  input: Omit<ReviewEvent, "id" | "time" | "status">
): ReviewEvent {
  eventCounter += 1;
  const event: ReviewEvent = {
    ...input,
    id: `event-r${String(eventCounter).padStart(3, "0")}`,
    time: new Date().toISOString(),
    status: "pending",
  };
  runtimeEvents.push(event);
  notifyAdminEventsUpdated();
  return event;
}

/**
 * Get all events for a review, sorted by occurrence time.
 */
export function getEventsByReviewId(reviewId: string): ReviewEvent[] {
  return [...seedEvents, ...runtimeEvents]
    .filter((e) => e.reviewId === reviewId)
    .toSorted(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
}

export function getAllReviewEvents(): ReviewEvent[] {
  return [...seedEvents, ...runtimeEvents].toSorted(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
}

/**
 * Get events for a review since a given timestamp.
 */
export function getEventsByReviewIdSince(
  reviewId: string,
  since: string
): ReviewEvent[] {
  const sinceTime = new Date(since).getTime();
  return getEventsByReviewId(reviewId).filter(
    (e) => new Date(e.time).getTime() > sinceTime
  );
}

/**
 * Get a single event by ID.
 */
export function getEventById(eventId: string): ReviewEvent | undefined {
  return (
    seedEvents.find((e) => e.id === eventId) ??
    runtimeEvents.find((e) => e.id === eventId)
  );
}

/**
 * Get pending events (not yet synced).
 */
export function getPendingEvents(): ReviewEvent[] {
  return runtimeEvents.filter((e) => e.status === "pending");
}

/**
 * Mark an event as synced.
 */
export function markEventSynced(eventId: string): boolean {
  const event = runtimeEvents.find((e) => e.id === eventId);
  if (!event) return false;
  event.status = "synced";
  event.syncedAt = new Date().toISOString();
  return true;
}

/**
 * Mark an event as rejected.
 */
export function markEventRejected(eventId: string): boolean {
  const event = runtimeEvents.find((e) => e.id === eventId);
  if (!event) return false;
  event.status = "failed";
  return true;
}

/**
 * Apply GDPR right-to-erasure to an event.
 *
 * Redacts human-identifiable fields (actorName, note content) in place and
 * records when and by whom the erasure was processed. The event record itself
 * is retained for audit integrity — only PII fields are overwritten.
 *
 * Persisting via the existing in-memory store mirrors what a DB UPDATE would do.
 */
export function redactEventPii(
  eventId: string,
  byActorId: string
): ReviewEvent | null {
  const event =
    seedEvents.find((e) => e.id === eventId) ??
    runtimeEvents.find((e) => e.id === eventId);

  if (!event) return null;
  if (event.piiRedactedAt) return event; // idempotent

  event.piiRedactedAt = new Date().toISOString();
  event.piiRedactedBy = byActorId;
  event.actorName = "[Redacted]";

  // Erase any residual free-text content that may contain PII
  const piiFields = ["content", "note"] as const;
  for (const field of piiFields) {
    if (typeof event.data[field] === "string") {
      event.data = { ...event.data, [field]: "[Redacted — GDPR erasure]" };
    }
  }

  notifyAdminEventsUpdated();
  return event;
}

/**
 * Clear runtime events (for testing).
 */
export function clearRuntimeEvents(): void {
  runtimeEvents.length = 0;
  eventCounter = seedEvents.length;
}
